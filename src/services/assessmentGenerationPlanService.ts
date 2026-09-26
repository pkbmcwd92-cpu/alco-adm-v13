import {
  AssessmentAllocationSummary,
  AssessmentAllocationUnit,
  AssessmentCoverageUnit,
  AssessmentDifficultyTarget,
  AssessmentEvidenceType,
  AssessmentGenerationConstraints,
  AssessmentGenerationIssue,
  AssessmentGenerationPlan,
  AssessmentGenerationResolutionStatus,
  AssessmentGenerationRule,
  AssessmentGenerationSpec,
  AssessmentInstrumentType,
  AssessmentStimulusType,
  CognitiveDemand,
} from '../types';

export const PROV_MINIMUM_COVERAGE_ALLOCATION: AssessmentGenerationRule = {
  id: 'APP-DEFAULT-MINIMUM-COVERAGE',
  sourceType: 'APP_DEFAULT',
  description: 'Minimum satu unit bukti untuk setiap coverage unit yang dapat dihitung.',
};

export const PROV_PEDAGOGICAL_COGNITIVE_DEMAND: AssessmentGenerationRule = {
  id: 'PROV-PEDAGOGICAL-COGNITIVE-DEMAND',
  sourceType: 'PEDAGOGICAL_RULE',
  description: 'Kaidah pedagogis taksonomi kompetensi berdasarkan kata kerja operasional teks tujuan.',
};

const VALID_INSTRUMENT_TYPES: Set<AssessmentInstrumentType> = new Set([
  'WRITTEN_TEST',
  'ORAL_TEST',
  'PERFORMANCE',
  'OBSERVATION',
  'ASSIGNMENT',
  'PROJECT',
  'PRODUCT',
  'PORTFOLIO',
  'SELF_ASSESSMENT',
  'PEER_ASSESSMENT',
]);

/**
 * Deterministic ID Generator for Coverage Units
 */
export function createDeterministicCoverageId(
  objectiveRefId: string,
  criterionId?: string,
  instrumentType?: string
): string {
  const cleanObjId = (objectiveRefId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const cleanCritId = criterionId
    ? criterionId.trim().replace(/[^a-zA-Z0-9_-]/g, '_')
    : 'objective';

  const baseId = `coverage:${cleanObjId}:${cleanCritId}`;

  // Backward-compatible helper behavior for legacy/two-argument callers.
  // Production B.1 coverage generation MUST always pass instrumentType.
  if (typeof instrumentType !== 'string' || instrumentType.trim() === '') {
    return baseId;
  }

  const cleanInstrumentType = instrumentType
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  return `${baseId}:${cleanInstrumentType}`;
}

/**
 * Map canonical instrument type to semantic allocation unit
 * Returns undefined if instrumentType is missing, unresolved, or unknown.
 */
export function mapInstrumentToAllocationUnit(
  instrumentType?: AssessmentInstrumentType
): AssessmentAllocationUnit | undefined {
  if (!instrumentType) return undefined;
  switch (instrumentType) {
    case 'WRITTEN_TEST':
    case 'ORAL_TEST':
    case 'SELF_ASSESSMENT':
    case 'PEER_ASSESSMENT':
      return 'ITEM';
    case 'PERFORMANCE':
    case 'ASSIGNMENT':
    case 'PROJECT':
    case 'PRODUCT':
      return 'TASK';
    case 'PORTFOLIO':
      return 'EVIDENCE';
    case 'OBSERVATION':
      return 'OBSERVATION';
    default:
      return undefined;
  }
}

/**
 * Conservative Indonesian text cognitive demand resolver
 * Returns undefined if ambiguous or no clear operational verb signal
 */
export function resolveConservativeCognitiveDemand(text?: string): CognitiveDemand | undefined {
  if (!text || typeof text !== 'string') return undefined;
  const lower = text.toLowerCase();

  const signals = {
    RECALL_UNDERSTAND:
      /\b(mengidentifikasi|menyebutkan|menjelaskan|mendeskripsikan|mengenal|mengingat|menunjukkan|menamai)\b/i.test(
        lower
      ),
    APPLY:
      /\b(menerapkan|menggunakan|mempraktikkan|mendemonstrasikan|menghitung|menjalankan|memperagakan|mengoperasikan)\b/i.test(
        lower
      ),
    ANALYZE_REASON:
      /\b(menganalisis|membandingkan|menelaah|menguraikan|menghubungkan|menyimpulkan|menginvestigasi|membedakan)\b/i.test(
        lower
      ),
    EVALUATE_CREATE:
      /\b(mengevaluasi|merancang|membuat|menciptakan|mengembangkan|menyusun|mengkreasi|menilai)\b/i.test(
        lower
      ),
  };

  const matched = (Object.keys(signals) as CognitiveDemand[]).filter((k) => signals[k]);
  if (matched.length === 1) {
    return matched[0];
  }
  return undefined;
}

export interface ResolveAssessmentGenerationPlanParams {
  generationSpec?: AssessmentGenerationSpec | null;
  constraints?: Partial<AssessmentGenerationConstraints> | null;
}

/**
 * Single Entry Point: resolveAssessmentGenerationPlan
 *
 * Mengubah AssessmentGenerationSpec (Audit 9C.2) menjadi rencana cakupan asesmen
 * dan perencanaan butir/tugas (AssessmentGenerationPlan) secara deterministik dan fail-closed.
 */
export function resolveAssessmentGenerationPlan(
  params: ResolveAssessmentGenerationPlanParams
): AssessmentGenerationPlan {
  const planIssues: AssessmentGenerationIssue[] = [];

  // 1. Validasi Keberadaan Input GenerationSpec
  if (!params || !params.generationSpec) {
    const blockingIssue: AssessmentGenerationIssue = {
      code: 'SPEC_MISSING',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationSpec wajib disertakan dan tidak boleh null/undefined.',
    };
    return {
      generationSpec: undefined,
      constraints: {
        assemblyMode: params?.constraints?.assemblyMode || 'AUTO_RECOMMENDED',
        ...(params?.constraints?.durationMinutes !== undefined
          ? { durationMinutes: params.constraints.durationMinutes }
          : {}),
        ...(params?.constraints?.requestedTotalItems !== undefined
          ? { requestedTotalItems: params.constraints.requestedTotalItems }
          : {}),
      },
      coverageUnits: [],
      summary: {
        objectiveCount: 0,
        criterionCount: 0,
        coverageUnitCount: 0,
        allocatedCount: 0,
        allocationSummary: {
          itemCount: 0,
          taskCount: 0,
          evidenceCount: 0,
          observationCount: 0,
          unresolvedCount: 0,
        },
      },
      resolution: {
        status: 'BLOCKED',
        issues: [blockingIssue],
      },
    };
  }

  const spec = params.generationSpec;
  const isUpstreamBlocked = spec.resolution?.status === 'BLOCKED';
  const isUpstreamNeedsReview = spec.resolution?.status === 'NEEDS_REVIEW';

  if (isUpstreamBlocked) {
    planIssues.push({
      code: 'UPSTREAM_SPEC_BLOCKED',
      severity: 'BLOCKING',
      message: 'GenerationSpec hulu berada dalam status BLOCKED. Perencanaan tidak dapat dilanjutkan.',
    });
  }

  // 2. Validasi Constraints & Pertahankan Input Guru (Preserve Invalid Input)
  const assemblyMode = params.constraints?.assemblyMode === 'TEACHER_DEFINED'
    ? 'TEACHER_DEFINED'
    : 'AUTO_RECOMMENDED';

  const durationMinutes = params.constraints?.durationMinutes;
  if (durationMinutes !== undefined) {
    if (
      typeof durationMinutes !== 'number' ||
      !Number.isFinite(durationMinutes) ||
      durationMinutes <= 0
    ) {
      planIssues.push({
        code: 'CONSTRAINT_INVALID',
        severity: 'BLOCKING',
        message: 'durationMinutes harus berupa angka positif yang valid (> 0).',
      });
    }
  }

  const requestedTotalItems = params.constraints?.requestedTotalItems;
  if (requestedTotalItems !== undefined) {
    if (
      typeof requestedTotalItems !== 'number' ||
      !Number.isFinite(requestedTotalItems) ||
      !Number.isInteger(requestedTotalItems) ||
      requestedTotalItems <= 0
    ) {
      planIssues.push({
        code: 'CONSTRAINT_INVALID',
        severity: 'BLOCKING',
        message: 'requestedTotalItems harus berupa bilangan bulat positif yang valid (> 0).',
      });
    }
  }

  const resolvedConstraints: AssessmentGenerationConstraints = {
    assemblyMode,
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(requestedTotalItems !== undefined ? { requestedTotalItems } : {}),
  };

  // 3. Validasi Keberadaan Objectives
  const objectives = Array.isArray(spec.objectives) ? spec.objectives : [];
  if (objectives.length === 0) {
    planIssues.push({
      code: 'OBJECTIVES_EMPTY',
      severity: 'BLOCKING',
      message: 'Tujuan pembelajaran / kompetensi dasar belum tersedia pada GenerationSpec.',
    });
  }

  const plannedInstruments = Array.isArray(spec.plannedInstrumentTypes)
    ? spec.plannedInstrumentTypes
    : [];

  if (plannedInstruments.length === 0) {
    planIssues.push({
      code: 'PLANNED_INSTRUMENT_EMPTY',
      severity: 'BLOCKING',
      message: 'Tidak ada tipe instrumen yang direncanakan pada GenerationSpec.',
    });
  }

  // 4. Bangun Coverage Units untuk setiap Objective & Criteria
  const coverageUnits: AssessmentCoverageUnit[] = [];
  const specCriteria = Array.isArray(spec.criteria) ? spec.criteria : [];
  const evidenceRecs = Array.isArray(spec.evidenceRecommendations)
    ? spec.evidenceRecommendations
    : [];

  for (const obj of objectives) {
    const associatedCritIds: string[] = [];

    if (Array.isArray(obj.criterionIds) && obj.criterionIds.length > 0) {
      for (const critId of obj.criterionIds) {
        const foundCrit = specCriteria.find((c) => c.id === critId);
        if (!foundCrit) {
          planIssues.push({
            code: 'DANGLING_CRITERION_REF',
            severity: 'BLOCKING',
            message: `Criterion ID "${critId}" yang direferensikan oleh TP "${obj.id}" tidak ditemukan dalam daftar kriteria spesifikasi.`,
            objectiveRefId: obj.id,
            criterionId: critId,
          });
        }
        associatedCritIds.push(critId);
      }
    } else {
      // Periksa apakah ada kriteria dalam spec.criteria yang merujuk objective ini
      const matching = specCriteria.filter((c) => c.objectiveRefId === obj.id);
      for (const m of matching) {
        associatedCritIds.push(m.id);
      }
    }

    // Jika memiliki kriteria, buat satu coverage unit per kriteria
    // Jika tidak memiliki kriteria sama sekali, buat satu coverage unit dengan criterionId undefined
    const critTargets: (string | undefined)[] =
      associatedCritIds.length > 0 ? associatedCritIds : [undefined];

    for (const targetCritId of critTargets) {
      const baseUnitIssues: AssessmentGenerationIssue[] = [];
      const baseUnitProvenance: AssessmentGenerationRule[] = [];

      // A. Resolve Evidence Recommendation once for this objective/criterion.
      // Evidence recommendation remains advisory and MUST NOT remove
      // canonical instruments selected in AssessmentPlan.
      const matchingRec = evidenceRecs.find(
        (r) =>
          r.objectiveRefId === obj.id &&
          (targetCritId
            ? r.criterionId === targetCritId || !r.criterionId
            : true)
      );

      let resolvedEvidenceType: AssessmentEvidenceType | undefined = undefined;

      if (matchingRec) {
        if (matchingRec.evidenceTypes.length === 1) {
          resolvedEvidenceType = matchingRec.evidenceTypes[0];
        } else if (matchingRec.evidenceTypes.length > 1) {
          resolvedEvidenceType = undefined;

          baseUnitIssues.push({
            code: 'EVIDENCE_RECOMMENDATION_AMBIGUOUS',
            severity: 'REVIEW',
            message: `Terdapat beberapa tipe bukti yang direkomendasikan (${matchingRec.evidenceTypes.join(
              ', '
            )}). Diperlukan telaah guru untuk memilih bukti spesifik.`,
            objectiveRefId: obj.id,
            criterionId: targetCritId,
          });
        } else {
          resolvedEvidenceType = undefined;

          baseUnitIssues.push({
            code: 'EVIDENCE_RECOMMENDATION_EMPTY',
            severity: 'REVIEW',
            message: 'Tidak ada tipe bukti yang direkomendasikan untuk kompetensi ini.',
            objectiveRefId: obj.id,
            criterionId: targetCritId,
          });
        }

        if (matchingRec.confidence === 'NEEDS_TEACHER_REVIEW') {
          baseUnitIssues.push({
            code: 'EVIDENCE_CONFIDENCE_REVIEW',
            severity: 'REVIEW',
            message: 'Rekomendasi bukti memerlukan konfirmasi/telaah oleh guru.',
            objectiveRefId: obj.id,
            criterionId: targetCritId,
          });
        }
      } else {
        baseUnitIssues.push({
          code: 'EVIDENCE_RECOMMENDATION_NOT_FOUND',
          severity: 'REVIEW',
          message: `Rekomendasi bukti tidak ditemukan pada spesifikasi untuk kompetensi ID "${obj.id}".`,
          objectiveRefId: obj.id,
          criterionId: targetCritId,
        });
      }

      // B. Cognitive demand belongs to objective/criterion context,
      // therefore it is resolved once and reused for every confirmed instrument.
      const targetCritObj = targetCritId
        ? specCriteria.find((c) => c.id === targetCritId)
        : undefined;

      const textToAnalyze = targetCritObj
        ? `${obj.text} ${targetCritObj.name} ${targetCritObj.description || ''}`
        : obj.text;

      const cognitiveDemand =
        resolveConservativeCognitiveDemand(textToAnalyze);

      if (cognitiveDemand) {
        baseUnitProvenance.push(
          PROV_PEDAGOGICAL_COGNITIVE_DEMAND
        );
      }

      // C. Expand canonical teacher-confirmed instruments.
      //
      // B.1 CONTRACT:
      // Objective × Criterion × Planned Instrument = Coverage Unit.
      //
      // Recommendation MUST NOT collapse multiple canonical instruments
      // into one instrument.
      for (
        let instrumentIndex = 0;
        instrumentIndex < plannedInstruments.length;
        instrumentIndex++
      ) {
        const plannedInstrument = plannedInstruments[instrumentIndex];

        const unitIssues: AssessmentGenerationIssue[] = [
          ...baseUnitIssues,
        ];

        const unitProvenance: AssessmentGenerationRule[] = [
          ...baseUnitProvenance,
        ];

        const instrumentIdPart =
          typeof plannedInstrument === 'string' &&
          plannedInstrument.trim() !== ''
            ? plannedInstrument
            : `unknown_${instrumentIndex + 1}`;

        const unitId = createDeterministicCoverageId(
          obj.id,
          targetCritId,
          instrumentIdPart
        );

        let resolvedInstrumentType:
          | AssessmentInstrumentType
          | undefined = undefined;

        if (!VALID_INSTRUMENT_TYPES.has(plannedInstrument)) {
          unitIssues.push({
            code: 'UNKNOWN_INSTRUMENT_TYPE',
            severity: 'BLOCKING',
            message: `Tipe instrumen "${plannedInstrument}" tidak dikenal dalam sistem.`,
            objectiveRefId: obj.id,
            criterionId: targetCritId,
          });
        } else {
          resolvedInstrumentType = plannedInstrument;
        }

        // D. Allocation semantic follows each canonical instrument.
        // Never default unresolved/unknown instruments to ITEM.
        const allocationUnit =
          mapInstrumentToAllocationUnit(
            resolvedInstrumentType
          );

        // E. These fields remain unresolved unless real data exists.
        // NO DATA > FAKE DATA.
        const difficultyTarget:
          | AssessmentDifficultyTarget
          | undefined = undefined;

        const stimulusType:
          | AssessmentStimulusType
          | undefined = undefined;

        const assessmentIndicator:
          | string
          | undefined = undefined;

        const materialOrContext:
          | string
          | undefined = undefined;

        // F. Minimum one semantic unit for each resolved coverage unit.
        let recommendedCount:
          | number
          | undefined = undefined;

        if (allocationUnit !== undefined) {
          recommendedCount = 1;

          unitProvenance.push(
            PROV_MINIMUM_COVERAGE_ALLOCATION
          );
        }

        // G. Unit status
        let unitStatus:
          | 'RESOLVED'
          | 'NEEDS_REVIEW'
          | 'BLOCKED' = 'RESOLVED';

        if (
          unitIssues.some(
            (issue) => issue.severity === 'BLOCKING'
          )
        ) {
          unitStatus = 'BLOCKED';
        } else if (
          unitIssues.some(
            (issue) => issue.severity === 'REVIEW'
          )
        ) {
          unitStatus = 'NEEDS_REVIEW';
        }

        coverageUnits.push({
          id: unitId,
          objectiveRefId: obj.id,
          criterionId: targetCritId,
          evidenceType: resolvedEvidenceType,
          instrumentType: resolvedInstrumentType,
          allocationUnit,
          recommendedCount,
          cognitiveDemand,
          stimulusType,
          difficultyTarget,
          assessmentIndicator,
          materialOrContext,
          provenance: unitProvenance,
          status: unitStatus,
          issues: unitIssues,
        });
      }
    }
  }

  // 5. Hitung Alokasi Semantik & Evaluasi Alokasi Guru vs Minimum ITEM Coverage
  let itemCount = 0;
  let taskCount = 0;
  let evidenceCount = 0;
  let observationCount = 0;
  let unresolvedCount = 0;

  for (const u of coverageUnits) {
    switch (u.allocationUnit) {
      case 'ITEM':
        itemCount += u.recommendedCount ?? 1;
        break;
      case 'TASK':
        taskCount += u.recommendedCount ?? 1;
        break;
      case 'EVIDENCE':
        evidenceCount += u.recommendedCount ?? 1;
        break;
      case 'OBSERVATION':
        observationCount += u.recommendedCount ?? 1;
        break;
      default:
        unresolvedCount += 1;
        break;
    }
  }

  const minItemCoverageCount = itemCount;
  let finalAllocatedCount = minItemCoverageCount;

  if (requestedTotalItems !== undefined) {
    if (requestedTotalItems < minItemCoverageCount) {
      planIssues.push({
        code: 'TEACHER_ITEM_COUNT_UNDER_COVERAGE',
        severity: 'REVIEW',
        message: `Jumlah butir yang diminta (${requestedTotalItems}) lebih kecil dari jumlah cakupan minimal butir (${minItemCoverageCount}). Jumlah permintaan guru dipertahankan tanpa penaikan otomatis.`,
      });
      finalAllocatedCount = requestedTotalItems;
    } else if (requestedTotalItems > minItemCoverageCount) {
      planIssues.push({
        code: 'EXTRA_ITEM_ALLOCATION_REQUIRES_REVIEW',
        severity: 'REVIEW',
        message: `Alokasi tambahan (${requestedTotalItems - minItemCoverageCount} butir) di atas cakupan minimal butir memerlukan telaah atau penentuan distribusi oleh guru.`,
      });
      finalAllocatedCount = requestedTotalItems;
    } else {
      finalAllocatedCount = requestedTotalItems;
    }
  }

  // 6. Evaluasi Status Final Plan
  // Kumpulkan seluruh issues dari plan dan seluruh coverage units
  const allIssues: AssessmentGenerationIssue[] = [...planIssues];
  for (const u of coverageUnits) {
    for (const ui of u.issues) {
      allIssues.push(ui);
    }
  }

  let finalPlanStatus: AssessmentGenerationResolutionStatus = 'RESOLVED';
  const hasBlocking = allIssues.some((i) => i.severity === 'BLOCKING');
  const hasReview = allIssues.some((i) => i.severity === 'REVIEW');

  if (isUpstreamBlocked || hasBlocking) {
    finalPlanStatus = 'BLOCKED';
  } else if (isUpstreamNeedsReview || hasReview) {
    finalPlanStatus = 'NEEDS_REVIEW';
  } else {
    finalPlanStatus = 'RESOLVED';
  }

  return {
    academicSettingId: spec.academicSettingId,
    generationSpec: spec,
    constraints: resolvedConstraints,
    coverageUnits,
    summary: {
      objectiveCount: objectives.length,
      criterionCount: specCriteria.length,
      coverageUnitCount: coverageUnits.length,
      allocatedCount: finalAllocatedCount,
      allocationSummary: {
        itemCount,
        taskCount,
        evidenceCount,
        observationCount,
        unresolvedCount,
      },
    },
    resolution: {
      status: finalPlanStatus,
      issues: allIssues,
    },
  };
}
