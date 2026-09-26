import {
  AssessmentPlan,
  AssessmentPackage,
  AssessmentValidationReport,
} from '../types';
import {
  resolveAssessmentGenerationSpec,
} from './assessmentGenerationSpecService';
import {
  resolveAssessmentGenerationPlan,
} from './assessmentGenerationPlanService';

export type AssessmentGenerationUIState =
  | 'NO_PLAN'
  | 'PLAN_NOT_READY'
  | 'GENERATION_BLOCKED'
  | 'READY_TO_GENERATE'
  | 'GENERATING'
  | 'DRAFT_REVIEW'
  | 'REGENERATING_TARGET'
  | 'FINAL_VALIDATION'
  | 'READY_FOR_CONFIRMATION'
  | 'SIAP';

export interface ResolveUIStateInput {
  selectedPlanId?: string;
  assessmentPlan?: AssessmentPlan | null;
  activePackage?: AssessmentPackage | null;
  isGenerating?: boolean;
  isRegenerating?: boolean;
  isValidating?: boolean;
  academicSetting?: any;
  tp?: any;
  k13Analysis?: any;
  assessmentCriteria?: any[];
  validationReport?: AssessmentValidationReport | null;
  confirmationEligible?: boolean;
}

/**
 * Deterministic UI State Resolver for 9C.7 workflow.
 * Encapsulates the entire multi-stage transition pipeline in a pure, testable function.
 */
export function resolveAssessmentGenerationUIState(
  input: ResolveUIStateInput
): AssessmentGenerationUIState {
  const {
    selectedPlanId,
    assessmentPlan,
    activePackage,
    isGenerating,
    isRegenerating,
    isValidating,
    academicSetting,
    tp,
    k13Analysis,
    assessmentCriteria,
    validationReport,
    confirmationEligible,
  } = input;

  // 1. NO_PLAN
  if (!selectedPlanId || !assessmentPlan) {
    return 'NO_PLAN';
  }

  // 2. PLAN_NOT_READY
  if (assessmentPlan.workflowStatus !== 'SIAP') {
    return 'PLAN_NOT_READY';
  }

  // 3. Resolve spec and plan to determine if GENERATION_BLOCKED
  const spec = resolveAssessmentGenerationSpec({
    assessmentPlan,
    academicSetting,
    tp,
    k13Analysis,
    assessmentCriteria,
    activeAssessmentPackageId: activePackage?.id,
  });

  const genPlan = resolveAssessmentGenerationPlan({
    generationSpec: spec,
  });

  if (spec.resolution.status === 'BLOCKED' || genPlan.resolution.status === 'BLOCKED') {
    return 'GENERATION_BLOCKED';
  }

  // 4. If package exists and is confirmed SIAP
  if (activePackage?.workflowStatus === 'SIAP') {
    return 'SIAP';
  }

  // 5. Transient generating state - can happen with or without activePackage
  if (isGenerating) {
    return 'GENERATING';
  }

  // 6. If package does not exist yet
  if (!activePackage) {
    return 'READY_TO_GENERATE';
  }

  // 7. Transient regenerating target state (only valid if package exists)
  if (isRegenerating) {
    return 'REGENERATING_TARGET';
  }

  // 8. Transient validation state (only valid if package exists)
  if (isValidating) {
    return 'FINAL_VALIDATION';
  }

  // 9. If package exists but is not SIAP, and has run validation
  const pkgRevision =
    activePackage.revision ?? 1;

  const isReportCurrent =
    !!validationReport &&
    validationReport.assessmentPackageId ===
      activePackage.id &&
    validationReport.packageRevision ===
      pkgRevision;

  const reportStatusAllowsTeacherConfirmation =
    validationReport?.overallStatus === 'PASS' ||
    validationReport?.overallStatus === 'REVIEW';

  if (
    isReportCurrent &&
    reportStatusAllowsTeacherConfirmation &&
    confirmationEligible
  ) {
    return 'READY_FOR_CONFIRMATION';
  }

  // 10. Default state for existing draft package
  return 'DRAFT_REVIEW';
}
