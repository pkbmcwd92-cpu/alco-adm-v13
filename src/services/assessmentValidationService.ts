import {
  AssessmentPackage,
  AssessmentPackageValidationContext,
  AssessmentValidationSection,
  AssessmentValidationFinding,
  AssessmentValidationStatus,
  AssessmentValidationReport,
  ValidateGeneratedAssessmentInput,
} from '../types';
import { validateAssessmentPackage } from './assessmentPackageService';
import { validateAssessmentCoverage } from './assessmentCoverageValidationService';
import { verifyAssessmentPackageAnswers } from './assessmentAnswerVerificationService';
import { reviewAssessmentPackageQuality } from './assessmentQualityReviewService';

export function runStructuralAssessmentValidation(
  pkg: AssessmentPackage,
  context: AssessmentPackageValidationContext
): AssessmentValidationSection {
  const findings: AssessmentValidationFinding[] = [];

  // 1. Reuse existing 9B canonical package validator
  const validationResult = validateAssessmentPackage(pkg, context);

  // Normalize existing errors to BLOCKING / FAIL
  if (validationResult.errors && validationResult.errors.length > 0) {
    for (const errMessage of validationResult.errors) {
      findings.push({
        code: 'STRUCTURAL_ERROR',
        status: 'FAIL',
        severity: 'BLOCKING',
        message: errMessage,
        source: 'DETERMINISTIC',
      });
    }
  }

  // Normalize existing warnings to REVIEW / REVIEW
  if (validationResult.warnings && validationResult.warnings.length > 0) {
    for (const warnMessage of validationResult.warnings) {
      findings.push({
        code: 'STRUCTURAL_WARNING',
        status: 'REVIEW',
        severity: 'REVIEW',
        message: warnMessage,
        source: 'DETERMINISTIC',
      });
    }
  }

  // 2. Additional deterministic structural checks
  // Check dangling answer key options or dangling instrument items
  if (pkg.answerKeys) {
    for (const ak of pkg.answerKeys) {
      const targetInst = pkg.instruments.find((i) => i.id === ak.instrumentId);
      if (!targetInst) {
        findings.push({
          code: 'DANGLING_ANSWER_KEY_INSTRUMENT',
          status: 'FAIL',
          severity: 'BLOCKING',
          instrumentId: ak.instrumentId,
          message: `Kunci jawaban merujuk instrumen (${ak.instrumentId}) yang tidak ada dalam perangkat.`,
          source: 'DETERMINISTIC',
        });
        continue;
      }

      if (targetInst.type === 'WRITTEN_TEST' && targetInst.items) {
        const itemExists = targetInst.items.some((item) => item.id === ak.instrumentItemId);
        if (!itemExists) {
          findings.push({
            code: 'DANGLING_ANSWER_KEY_ITEM',
            status: 'FAIL',
            severity: 'BLOCKING',
            instrumentId: ak.instrumentId,
            instrumentItemId: ak.instrumentItemId,
            message: `Kunci jawaban merujuk item (${ak.instrumentItemId}) yang tidak ada dalam instrumen.`,
            source: 'DETERMINISTIC',
          });
        }
      }
    }
  }

  // FINDING 10: Check blueprint.instrumentId linkage & conflict validation
  for (const bpItem of pkg.blueprintItems || []) {
    if (bpItem.instrumentId) {
      const inst = pkg.instruments.find((i) => i.id === bpItem.instrumentId);
      if (!inst) {
        findings.push({
          code: 'DANGLING_BLUEPRINT_INSTRUMENT',
          status: 'FAIL',
          severity: 'BLOCKING',
          blueprintItemId: bpItem.id,
          message: `Item kisi-kisi merujuk instrumen (${bpItem.instrumentId}) yang tidak ada.`,
          source: 'DETERMINISTIC',
        });
      } else {
        // Validate type agreement
        if (bpItem.instrumentType && inst.type !== bpItem.instrumentType) {
          findings.push({
            code: 'BLUEPRINT_INSTRUMENT_TYPE_MISMATCH',
            status: 'FAIL',
            severity: 'BLOCKING',
            blueprintItemId: bpItem.id,
            instrumentId: bpItem.instrumentId,
            message: `Item kisi-kisi (${bpItem.id}) memiliki instrumentId (${bpItem.instrumentId}) bertipe ${inst.type} yang berbeda dengan instrumentType (${bpItem.instrumentType}).`,
            source: 'DETERMINISTIC',
          });
        }

        // Validate item ownership agreement if instrumentItemIds is provided
        if (Array.isArray(bpItem.instrumentItemIds) && bpItem.instrumentItemIds.length > 0) {
          if (inst.type === 'WRITTEN_TEST' && Array.isArray((inst as any).items)) {
            const instItemIds = new Set(((inst as any).items as any[]).map((i) => i.id));
            for (const itemId of bpItem.instrumentItemIds) {
              if (!instItemIds.has(itemId)) {
                // Check if this item belongs to another instrument
                const ownerInst = pkg.instruments.find(
                  (otherInst) =>
                    otherInst.id !== inst.id &&
                    'items' in otherInst &&
                    Array.isArray((otherInst as any).items) &&
                    (otherInst as any).items.some((i: any) => i.id === itemId)
                );
                findings.push({
                  code: 'BLUEPRINT_INSTRUMENT_ITEM_OWNERSHIP_MISMATCH',
                  status: 'FAIL',
                  severity: 'BLOCKING',
                  blueprintItemId: bpItem.id,
                  instrumentId: bpItem.instrumentId,
                  instrumentItemId: itemId,
                  message: `Item kisi-kisi (${bpItem.id}) merujuk item (${itemId}) yang ${
                    ownerInst ? `dimiliki oleh instrumen lain (${ownerInst.id})` : `tidak ada pada instrumen (${inst.id})`
                  }.`,
                  source: 'DETERMINISTIC',
                });
              }
            }
          }
        }
      }
    }
  }

  // Calculate section status
  const hasFail = findings.some((f) => f.status === 'FAIL');
  const hasReview = findings.some((f) => f.status === 'REVIEW');
  const status: AssessmentValidationStatus = hasFail ? 'FAIL' : hasReview ? 'REVIEW' : 'PASS';

  return {
    status,
    findings,
  };
}

export function validateAssessmentAssembly(pkg: AssessmentPackage): AssessmentValidationSection {
  const findings: AssessmentValidationFinding[] = [];

  // 1. Check exact duplicate item prompts (deterministic normalized string match)
  const promptMap = new Map<string, { instrumentId: string; itemId: string; rawPrompt: string }[]>();

  for (const inst of pkg.instruments) {
    if (inst.type === 'WRITTEN_TEST' && inst.items) {
      for (const item of inst.items) {
        if (!item.prompt) continue;
        const normalizedPrompt = item.prompt.trim().toLowerCase().replace(/\s+/g, ' ');
        const existing = promptMap.get(normalizedPrompt) || [];
        existing.push({ instrumentId: inst.id, itemId: item.id, rawPrompt: item.prompt });
        promptMap.set(normalizedPrompt, existing);
      }
    }
  }

  for (const [_normPrompt, matches] of promptMap.entries()) {
    if (matches.length > 1) {
      findings.push({
        code: 'EXACT_DUPLICATE_ITEM_PROMPT',
        status: 'REVIEW',
        severity: 'REVIEW',
        instrumentId: matches[0].instrumentId,
        instrumentItemId: matches[0].itemId,
        message: `Ditemukan item dengan teks soal persis sama pada ${matches.length} lokasi ("${matches[0].rawPrompt}").`,
        source: 'DETERMINISTIC',
      });
    }
  }

  // FINDING 9: Removed arbitrary consecutive answer choice threshold heuristic.

  const hasFail = findings.some((f) => f.status === 'FAIL');
  const hasReview = findings.some((f) => f.status === 'REVIEW');
  const status: AssessmentValidationStatus = hasFail ? 'FAIL' : hasReview ? 'REVIEW' : 'PASS';

  return {
    status,
    findings,
  };
}

export async function validateGeneratedAssessment(
  input: ValidateGeneratedAssessmentInput
): Promise<AssessmentValidationReport> {
  const {
    assessmentPackage: pkg,
    generationPlan,
    validationContext,
    gradeCalibration,
    subjectProfile,
    qualityReviewProvider,
    answerVerificationProvider,
  } = input;

  // 1. Structural Validation
  const structuralSection = runStructuralAssessmentValidation(pkg, validationContext);

  // 2. Coverage Validation
  const coverageSection = validateAssessmentCoverage(pkg, generationPlan, validationContext);

  // 3. Answer Verification
  const answerVerificationRes = await verifyAssessmentPackageAnswers(pkg, answerVerificationProvider);
  const answerVerificationSection = answerVerificationRes.section;

  // 4. Quality Review
  const qualityReviewRes = await reviewAssessmentPackageQuality(
    pkg,
    generationPlan,
    gradeCalibration,
    subjectProfile,
    qualityReviewProvider
  );
  const qualitySection = qualityReviewRes.section;
  const reviewerStatus = qualityReviewRes.reviewerStatus;

  // 5. Assembly Validation
  const assemblySection = validateAssessmentAssembly(pkg);

  // 6. Aggregate overall status
  // Rule 42: DETERMINISTIC FAIL > AI PASS
  const sections = [structuralSection, coverageSection, answerVerificationSection, qualitySection, assemblySection];

  const hasAnyFail = sections.some((s) => s.status === 'FAIL');
  const hasAnyReview = sections.some((s) => s.status === 'REVIEW') || reviewerStatus === 'REVIEW_UNAVAILABLE';

  let overallStatus: AssessmentValidationStatus = 'PASS';
  if (hasAnyFail) {
    overallStatus = 'FAIL';
  } else if (hasAnyReview) {
    overallStatus = 'REVIEW';
  }

  // FINDING 6: Deterministic report ID without Math.random()
  const pkgRevision = pkg.revision ?? 1;
  const reportId = `val_rep_${pkg.id}_rev_${pkgRevision}`;

  return {
    id: reportId,
    assessmentPackageId: pkg.id,
    packageRevision: pkgRevision,
    structural: structuralSection,
    coverage: coverageSection,
    answerVerification: answerVerificationSection,
    quality: qualitySection,
    assembly: assemblySection,
    overallStatus,
    reviewerStatus,
    engineVersion: '9C.5-1.0.0',
    reviewerMetadata: qualityReviewProvider ? { provider: 'AI_QUALITY_REVIEWER' } : undefined,
    createdAt: new Date().toISOString(),
  };
}

export function isAssessmentValidationReportStale(
  report: AssessmentValidationReport,
  pkg: AssessmentPackage
): boolean {
  if (!report || !pkg) return true;
  if (report.assessmentPackageId !== pkg.id) return true;
  const pkgRevision = pkg.revision ?? 1;
  return report.packageRevision !== pkgRevision;
}
