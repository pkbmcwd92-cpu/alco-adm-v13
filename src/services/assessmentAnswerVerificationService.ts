import {
  AssessmentPackage,
  AssessmentValidationSection,
  AssessmentValidationFinding,
  AssessmentValidationStatus,
  AssessmentAnswerVerificationResult,
  AssessmentAnswerVerificationProvider,
  AssessmentAnswerVerificationRequestItem,
} from '../types';

export interface VerifyAssessmentAnswersResult {
  section: AssessmentValidationSection;
  itemResults: AssessmentAnswerVerificationResult[];
}

const ALLOWED_VERIFIER_STATUSES = new Set(['VERIFIED', 'REVIEW', 'REJECTED']);

export async function verifyAssessmentPackageAnswers(
  pkg: AssessmentPackage,
  provider?: AssessmentAnswerVerificationProvider
): Promise<VerifyAssessmentAnswersResult> {
  const findings: AssessmentValidationFinding[] = [];
  const itemResults: AssessmentAnswerVerificationResult[] = [];

  const itemsToVerifyWithAI: AssessmentAnswerVerificationRequestItem[] = [];

  for (const inst of pkg.instruments) {
    if (inst.type !== 'WRITTEN_TEST' || !inst.items) {
      // Non-written test instruments are NOT_APPLICABLE for binary answer verification
      continue;
    }

    for (const item of inst.items) {
      // ESSAY items do not use binary answer verification
      if (item.itemType === 'ESSAY') {
        itemResults.push({
          instrumentId: inst.id,
          instrumentItemId: item.id,
          status: 'NOT_APPLICABLE',
          method: 'DETERMINISTIC',
          reason: 'Soal uraian tidak menggunakan verifikasi jawaban biner.',
        });
        continue;
      }

      // 1. Deterministic Answer Integrity Checks
      let isDeterministicFail = false;

      // Find answer key entry if present
      const answerKey = pkg.answerKeys?.find((ak) => ak.instrumentItemId === item.id);

      // Check options validity if MULTIPLE_CHOICE or MULTIPLE_SELECT
      if (item.itemType === 'MULTIPLE_CHOICE' || item.itemType === 'MULTIPLE_SELECT') {
        const options = item.options || [];

        // Check dangling option reference in answer key
        if (answerKey) {
          const selectedOptionIds = answerKey.optionIds || (answerKey as any).selectedOptionIndices || [];
          for (const optRef of selectedOptionIds) {
            let exists = false;
            if (typeof optRef === 'number') {
              exists = optRef >= 0 && optRef < options.length;
            } else {
              exists = options.some((o, idx) => o.id === optRef || String(idx) === String(optRef));
            }
            if (!exists) {
              isDeterministicFail = true;
              findings.push({
                code: 'DANGLING_ANSWER_KEY_OPTION',
                status: 'FAIL',
                severity: 'BLOCKING',
                instrumentId: inst.id,
                instrumentItemId: item.id,
                message: `Kunci jawaban merujuk opsi (${optRef}) yang tidak ada pada soal "${item.id}".`,
                source: 'DETERMINISTIC',
              });
            }
          }
        }

        // Check dual answer source conflict: options[].isCorrect vs AssessmentAnswerKey
        const correctOptionsFromOptions = options
          .filter((o) => o.isCorrect)
          .map((o) => o.id);

        if (answerKey && correctOptionsFromOptions.length > 0) {
          const keyOptionIds = [...(answerKey.optionIds || (answerKey as any).selectedOptionIndices || [])].map((id) => {
            if (typeof id === 'number') return options[id]?.id || String(id);
            return id;
          }).sort();
          const optionIdsFromOptions = [...correctOptionsFromOptions].sort();

          const isConflict =
            keyOptionIds.length !== optionIdsFromOptions.length ||
            keyOptionIds.some((val, idx) => val !== optionIdsFromOptions[idx]);

          if (isConflict) {
            isDeterministicFail = true;
            findings.push({
              code: 'ANSWER_SOURCE_CONFLICT',
              status: 'FAIL',
              severity: 'BLOCKING',
              instrumentId: inst.id,
              instrumentItemId: item.id,
              message: `Konflik sumber kunci jawaban antara options[].isCorrect (${optionIdsFromOptions.join(',')}) dan AssessmentAnswerKey (${keyOptionIds.join(',')}) pada item "${item.id}".`,
              source: 'DETERMINISTIC',
            });
          }
        }
      }

      // Check MATCHING item structural reference integrity
      if (item.itemType === 'MATCHING') {
        const premises = item.matchingPremises || [];
        const responses = item.matchingResponses || [];
        const pairs = answerKey?.matchingPairs || item.matchingPairs || [];

        for (const pair of pairs) {
          const premiseExists = premises.some((p) => p.id === pair.premiseId);
          const responseExists = responses.some((r) => r.id === pair.responseId);

          if (!premiseExists || !responseExists) {
            isDeterministicFail = true;
            findings.push({
              code: 'DANGLING_MATCHING_REFERENCE',
              status: 'FAIL',
              severity: 'BLOCKING',
              instrumentId: inst.id,
              instrumentItemId: item.id,
              message: `Pasangan menjodohkan merujuk premis/respon yang tidak ada pada item "${item.id}".`,
              source: 'DETERMINISTIC',
            });
          }
        }
      }

      if (isDeterministicFail) {
        itemResults.push({
          instrumentId: inst.id,
          instrumentItemId: item.id,
          status: 'REJECTED',
          method: 'DETERMINISTIC',
          reason: 'Gagal verifikasi integritas struktural kunci jawaban.',
        });
        continue;
      }

      // Check if item needs semantic AI verification
      if (provider) {
        itemsToVerifyWithAI.push({
          instrumentId: inst.id,
          instrumentItemId: item.id,
          itemType: item.itemType,
          prompt: item.prompt,
          stimulus: item.stimulus,
          options: item.options?.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })),
          premises: item.matchingPremises?.map((p) => ({ id: p.id, text: p.text })),
          responses: item.matchingResponses?.map((r) => ({ id: r.id, text: r.text })),
          categories: item.categoryResponseCategories?.map((c) => ({ id: c.id, text: c.label })),
          proposedAnswerKey: answerKey || { value: item.prompt },
        });
      } else {
        // BLOCKER 1: Structural validity alone does NOT mean semantic VERIFIED.
        // Without semantic verifier provider, mark objective items as REVIEW / MANUAL_REQUIRED.
        itemResults.push({
          instrumentId: inst.id,
          instrumentItemId: item.id,
          status: 'REVIEW',
          method: 'MANUAL_REQUIRED',
          reason: 'Integritas struktural valid, tetapi verifikasi semantik jawaban memerlukan peninjauan manual oleh guru.',
        });
        findings.push({
          code: 'ANSWER_SEMANTIC_VERIFICATION_REQUIRED',
          status: 'REVIEW',
          severity: 'REVIEW',
          instrumentId: inst.id,
          instrumentItemId: item.id,
          message: `Jawaban item "${item.id}" valid secara struktural tetapi belum terverifikasi secara semantik.`,
          source: 'DETERMINISTIC',
        });
      }
    }
  }

  // 2. Call AI Answer Verification Provider if items require semantic verification
  if (provider && itemsToVerifyWithAI.length > 0) {
    try {
      const aiResponse = await provider.verify({
        assessmentPackage: pkg,
        itemsToVerify: itemsToVerifyWithAI,
      });

      const requestedIdsSet = new Set(itemsToVerifyWithAI.map((i) => i.instrumentItemId));
      const validAiResultsMap = new Map<string, { status: string; reason?: string }>();
      const duplicateItemIds = new Set<string>();
      const invalidStatusItemIds = new Set<string>();

      if (aiResponse && Array.isArray(aiResponse.results)) {
        const seenItemIds = new Set<string>();
        for (const res of aiResponse.results) {
          if (!res || typeof res !== 'object') continue;
          const itemId = res.instrumentItemId;

          if (!itemId || typeof itemId !== 'string' || !requestedIdsSet.has(itemId)) {
            // Extra/unknown item ID returned by provider
            findings.push({
              code: 'UNEXPECTED_VERIFIER_ITEM_ID',
              status: 'REVIEW',
              severity: 'REVIEW',
              instrumentItemId: typeof itemId === 'string' ? itemId : undefined,
              message: `Verifikator AI mengembalikan hasil untuk item ID tidak dikenal (${itemId}).`,
              source: 'ANSWER_VERIFIER',
            });
            continue;
          }

          if (seenItemIds.has(itemId)) {
            duplicateItemIds.add(itemId);
            validAiResultsMap.delete(itemId);
            findings.push({
              code: 'DUPLICATE_VERIFIER_RESULT',
              status: 'REVIEW',
              severity: 'REVIEW',
              instrumentItemId: itemId,
              message: `Verifikator AI mengembalikan hasil ganda untuk item "${itemId}".`,
              source: 'ANSWER_VERIFIER',
            });
            continue;
          }

          seenItemIds.add(itemId);

          if (!ALLOWED_VERIFIER_STATUSES.has(res.status)) {
            invalidStatusItemIds.add(itemId);
            findings.push({
              code: 'INVALID_VERIFIER_STATUS',
              status: 'REVIEW',
              severity: 'REVIEW',
              instrumentItemId: itemId,
              message: `Verifikator AI mengembalikan status tidak valid (${res.status}) untuk item "${itemId}".`,
              source: 'ANSWER_VERIFIER',
            });
            continue;
          }

          validAiResultsMap.set(itemId, {
            status: res.status,
            reason: typeof res.reason === 'string' ? res.reason : undefined,
          });
        }
      } else {
        findings.push({
          code: 'MALFORMED_VERIFIER_RESPONSE',
          status: 'REVIEW',
          severity: 'REVIEW',
          message: 'Respon verifikator AI tidak berformat objek dengan array results.',
          source: 'ANSWER_VERIFIER',
        });
      }

      for (const itemReq of itemsToVerifyWithAI) {
        const itemId = itemReq.instrumentItemId;
        const validRes = validAiResultsMap.get(itemId);

        if (!validRes || duplicateItemIds.has(itemId) || invalidStatusItemIds.has(itemId)) {
          itemResults.push({
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            status: 'REVIEW',
            method: 'MANUAL_REQUIRED',
            reason: 'Respon verifikator AI tidak valid, terduplikasi, atau tidak memuat item ID ini.',
          });
          findings.push({
            code: 'ANSWER_VERIFICATION_UNRESOLVED',
            status: 'REVIEW',
            severity: 'REVIEW',
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            message: `Verifikasi jawaban untuk item "${itemId}" tidak mendapatkan hasil AI yang terstruktur dengan valid.`,
            source: 'ANSWER_VERIFIER',
          });
          continue;
        }

        if (validRes.status === 'VERIFIED') {
          itemResults.push({
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            status: 'VERIFIED',
            method: 'AI',
            reason: validRes.reason || 'Kunci jawaban terverifikasi tepat oleh AI verifier.',
          });
        } else if (validRes.status === 'REJECTED') {
          itemResults.push({
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            status: 'REJECTED',
            method: 'AI',
            reason: validRes.reason || 'Kunci jawaban ditolak oleh AI verifier karena tidak tepat.',
          });
          findings.push({
            code: 'WRONG_SEMANTIC_ANSWER',
            status: 'FAIL',
            severity: 'BLOCKING',
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            message: `Kunci jawaban untuk item "${itemId}" ditolak: ${validRes.reason || 'Kunci jawaban tidak tepat.'}`,
            source: 'ANSWER_VERIFIER',
          });
        } else {
          itemResults.push({
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            status: 'REVIEW',
            method: 'MANUAL_REQUIRED',
            reason: validRes.reason || 'Jawaban memerlukan peninjauan manual oleh guru.',
          });
          findings.push({
            code: 'ANSWER_VERIFICATION_REVIEW',
            status: 'REVIEW',
            severity: 'REVIEW',
            instrumentId: itemReq.instrumentId,
            instrumentItemId: itemId,
            message: `Verifikasi jawaban item "${itemId}" memerlukan peninjauan manual: ${validRes.reason || 'Ambiguitas jawaban.'}`,
            source: 'ANSWER_VERIFIER',
          });
        }
      }
    } catch (err: any) {
      // Provider failure must fail safe to REVIEW
      for (const itemReq of itemsToVerifyWithAI) {
        itemResults.push({
          instrumentId: itemReq.instrumentId,
          instrumentItemId: itemReq.instrumentItemId,
          status: 'REVIEW',
          method: 'MANUAL_REQUIRED',
          reason: `Verifikator jawaban gagal: ${err?.message || 'Error eksekusi'}.`,
        });
        findings.push({
          code: 'ANSWER_VERIFICATION_PROVIDER_FAILED',
          status: 'REVIEW',
          severity: 'REVIEW',
          instrumentId: itemReq.instrumentId,
          instrumentItemId: itemReq.instrumentItemId,
          message: `Verifikator jawaban AI mengalami error: ${err?.message || 'Error'}.`,
          source: 'ANSWER_VERIFIER',
        });
      }
    }
  }

  // Aggregate status
  const hasFail = findings.some((f) => f.status === 'FAIL') || itemResults.some((r) => r.status === 'REJECTED');
  const hasReview = findings.some((f) => f.status === 'REVIEW') || itemResults.some((r) => r.status === 'REVIEW');
  const status: AssessmentValidationStatus = hasFail ? 'FAIL' : hasReview ? 'REVIEW' : 'PASS';

  return {
    section: {
      status,
      findings,
    },
    itemResults,
  };
}
