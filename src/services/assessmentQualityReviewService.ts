import {
  AssessmentPackage,
  AssessmentGenerationPlan,
  AssessmentGradeCalibrationProfile,
  SubjectAssessmentProfile,
  AssessmentValidationSection,
  AssessmentValidationFinding,
  AssessmentValidationStatus,
  AssessmentQualityDimension,
  AssessmentQualityReviewProvider,
  AssessmentAIQualityFinding,
} from '../types';

export interface QualityReviewResult {
  section: AssessmentValidationSection;
  reviewerStatus: 'NOT_REQUESTED' | 'COMPLETED' | 'REVIEW_UNAVAILABLE';
}

const VALID_QUALITY_DIMENSIONS: Set<AssessmentQualityDimension> = new Set([
  'TRACEABILITY',
  'CONTENT_ALIGNMENT',
  'COGNITIVE_ALIGNMENT',
  'ITEM_CONSTRUCTION',
  'STIMULUS_QUALITY',
  'ANSWER_VERIFICATION',
  'DISTRACTOR_QUALITY',
  'GRADE_LANGUAGE',
  'SENSITIVITY',
  'DUPLICATION',
]);

const TARGET_REQUIRED_DIMENSIONS = new Set<AssessmentQualityDimension>([
  'CONTENT_ALIGNMENT',
  'COGNITIVE_ALIGNMENT',
  'ITEM_CONSTRUCTION',
  'STIMULUS_QUALITY',
  'ANSWER_VERIFICATION',
  'DISTRACTOR_QUALITY',
  'GRADE_LANGUAGE',
  'SENSITIVITY',
]);

const VALID_QUALITY_STATUSES = new Set(['PASS', 'REVIEW', 'FAIL']);

export async function reviewAssessmentPackageQuality(
  pkg: AssessmentPackage,
  generationPlan?: AssessmentGenerationPlan,
  gradeCalibration?: AssessmentGradeCalibrationProfile,
  subjectProfile?: SubjectAssessmentProfile,
  provider?: AssessmentQualityReviewProvider
): Promise<QualityReviewResult> {
  const findings: AssessmentValidationFinding[] = [];

  if (!provider) {
    findings.push({
      code: 'QUALITY_REVIEW_SKIPPED',
      status: 'REVIEW',
      severity: 'REVIEW',
      message:
        'AI Quality Reviewer tidak dikonfigurasi. Pemeriksaan kualitas AI tidak dijalankan; guru perlu meninjau perangkat secara manual sebelum konfirmasi SIAP.',
      source: 'AI_QUALITY_REVIEWER',
    });
    return {
      section: {
        status: 'REVIEW',
        findings,
      },
      reviewerStatus: 'NOT_REQUESTED',
    };
  }

  try {
    const rawResponse = await provider.review({
      assessmentPackage: pkg,
      generationPlan,
      gradeCalibration,
      subjectProfile,
    });

    if (!rawResponse || !Array.isArray(rawResponse.findings)) {
      findings.push({
        code: 'QUALITY_REVIEWER_UNAVAILABLE',
        status: 'REVIEW',
        severity: 'REVIEW',
        message: 'AI Quality Reviewer tidak mengembalikan daftar temuan yang valid.',
        source: 'AI_QUALITY_REVIEWER',
      });
      return {
        section: {
          status: 'REVIEW',
          findings,
        },
        reviewerStatus: 'REVIEW_UNAVAILABLE',
      };
    }

    // Build sets of valid IDs in package and plan
    const validUnitIds = new Set<string>();
    if (generationPlan?.coverageUnits) {
      generationPlan.coverageUnits.forEach((u) => validUnitIds.add(u.id));
    }
    pkg.blueprintItems.forEach((bp) => validUnitIds.add(bp.id));
    pkg.instruments.forEach((inst) => {
      validUnitIds.add(inst.id);
      if ('items' in inst && Array.isArray((inst as any).items)) {
        (inst as any).items.forEach((item: any) => validUnitIds.add(item.id));
      }
    });

    const itemsWithDistractorsSet = new Set<string>();
    pkg.instruments.forEach((inst) => {
      if (inst.type === 'WRITTEN_TEST' && Array.isArray((inst as any).items)) {
        (inst as any).items.forEach((item: any) => {
          if (item.options && Array.isArray(item.options) && item.options.length > 0) {
            itemsWithDistractorsSet.add(item.id);
          }
        });
      }
    });

    let hasMalformedEntry = false;

    for (const rawFinding of rawResponse.findings) {
      if (!rawFinding || typeof rawFinding !== 'object') {
        hasMalformedEntry = true;
        continue;
      }

      // Validate finding fields
      const isValidDimension = VALID_QUALITY_DIMENSIONS.has(rawFinding.dimension as AssessmentQualityDimension);
      const isValidStatus = VALID_QUALITY_STATUSES.has(rawFinding.status);
      const isValidReason = typeof rawFinding.reason === 'string' && rawFinding.reason.trim().length > 0;

      const targetId = rawFinding.unitId || rawFinding.instrumentItemId || rawFinding.coverageUnitId;
      const requiresTarget = TARGET_REQUIRED_DIMENSIONS.has(rawFinding.dimension as AssessmentQualityDimension);

      let isValidTarget = true;
      if (requiresTarget) {
        if (!targetId || typeof targetId !== 'string' || !validUnitIds.has(targetId)) {
          isValidTarget = false;
        }
      } else if (targetId && !validUnitIds.has(targetId)) {
        isValidTarget = false;
      }

      if (rawFinding.dimension === 'DISTRACTOR_QUALITY') {
        if (!targetId || !itemsWithDistractorsSet.has(targetId)) {
          isValidTarget = false;
        }
      }

      if (!isValidDimension || !isValidStatus || !isValidReason || !isValidTarget) {
        hasMalformedEntry = true;
        findings.push({
          code: 'MALFORMED_QUALITY_FINDING',
          status: 'REVIEW',
          severity: 'REVIEW',
          message: `Ditemukan entri temuan kualitas AI tidak valid (dimension=${rawFinding.dimension}, status=${rawFinding.status}, targetId=${targetId}).`,
          source: 'AI_QUALITY_REVIEWER',
        });
        continue;
      }

      // Record valid finding
      findings.push({
        code: `QUALITY_${rawFinding.dimension}_${rawFinding.status}`,
        status: rawFinding.status as AssessmentValidationStatus,
        severity:
          rawFinding.status === 'FAIL'
            ? 'BLOCKING'
            : rawFinding.status === 'REVIEW'
            ? 'REVIEW'
            : 'INFO',
        dimension: rawFinding.dimension as AssessmentQualityDimension,
        coverageUnitId: rawFinding.coverageUnitId || rawFinding.unitId,
        instrumentItemId: rawFinding.instrumentItemId,
        message: rawFinding.reason.trim(),
        source: 'AI_QUALITY_REVIEWER',
      });
    }

    const hasFail = findings.some((f) => f.status === 'FAIL');
    const hasReview = findings.some((f) => f.status === 'REVIEW') || hasMalformedEntry;
    const status: AssessmentValidationStatus = hasFail ? 'FAIL' : hasReview ? 'REVIEW' : 'PASS';

    // FINDING 8: If any finding was malformed, reviewerStatus MUST be REVIEW_UNAVAILABLE
    const reviewerStatus = hasMalformedEntry ? 'REVIEW_UNAVAILABLE' : 'COMPLETED';

    return {
      section: {
        status,
        findings,
      },
      reviewerStatus,
    };
  } catch (err: any) {
    findings.push({
      code: 'QUALITY_REVIEWER_UNAVAILABLE',
      status: 'REVIEW',
      severity: 'REVIEW',
      message: `AI Quality Reviewer mengalami error: ${err?.message || 'Gagal eksekusi'}.`,
      source: 'AI_QUALITY_REVIEWER',
    });
    return {
      section: {
        status: 'REVIEW',
        findings,
      },
      reviewerStatus: 'REVIEW_UNAVAILABLE',
    };
  }
}
