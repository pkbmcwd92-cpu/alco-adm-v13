import {
  AssessmentPackage,
  AssessmentGenerationPlan,
  AssessmentPackageValidationContext,
  AssessmentGradeCalibrationProfile,
  SubjectAssessmentProfile,
} from './index';

export type AssessmentValidationStatus =
  | 'PASS'
  | 'REVIEW'
  | 'FAIL';

export type AssessmentValidationSeverity =
  | 'BLOCKING'
  | 'REVIEW'
  | 'INFO';

export type AssessmentQualityDimension =
  | 'TRACEABILITY'
  | 'CONTENT_ALIGNMENT'
  | 'COGNITIVE_ALIGNMENT'
  | 'ITEM_CONSTRUCTION'
  | 'STIMULUS_QUALITY'
  | 'ANSWER_VERIFICATION'
  | 'DISTRACTOR_QUALITY'
  | 'GRADE_LANGUAGE'
  | 'SENSITIVITY'
  | 'DUPLICATION';

export type AssessmentValidationFindingSource =
  | 'DETERMINISTIC'
  | 'ANSWER_VERIFIER'
  | 'AI_QUALITY_REVIEWER';

export interface AssessmentValidationFinding {
  id?: string;
  code: string;
  status: AssessmentValidationStatus;
  severity: AssessmentValidationSeverity;

  dimension?: AssessmentQualityDimension;

  coverageUnitId?: string;
  blueprintItemId?: string;
  instrumentId?: string;
  instrumentItemId?: string;
  answerKeyId?: string;
  scoringGuideId?: string;
  rubricId?: string;
  targetField?: 'ITEM_PROMPT' | 'STIMULUS';

  message: string;
  source: AssessmentValidationFindingSource;
}

export interface AssessmentValidationSection {
  status: AssessmentValidationStatus;
  findings: AssessmentValidationFinding[];
}

export interface AssessmentValidationReport {
  id: string;

  assessmentPackageId: string;
  packageRevision: number;

  structural: AssessmentValidationSection;
  coverage: AssessmentValidationSection;
  answerVerification: AssessmentValidationSection;
  quality: AssessmentValidationSection;
  assembly: AssessmentValidationSection;

  overallStatus: AssessmentValidationStatus;

  reviewerStatus:
    | 'NOT_REQUESTED'
    | 'COMPLETED'
    | 'REVIEW_UNAVAILABLE';

  engineVersion: string;

  reviewerMetadata?: {
    provider?: string;
    model?: string;
  };

  createdAt: string;
}

export type AssessmentAnswerVerificationStatus =
  | 'VERIFIED'
  | 'REVIEW'
  | 'REJECTED'
  | 'NOT_APPLICABLE';

export type AssessmentAnswerVerificationMethod =
  | 'DETERMINISTIC'
  | 'AI'
  | 'MANUAL_REQUIRED';

export interface AssessmentAnswerVerificationResult {
  instrumentId: string;
  instrumentItemId: string;

  status: AssessmentAnswerVerificationStatus;
  method: AssessmentAnswerVerificationMethod;

  reason?: string;
}

export interface AssessmentAnswerVerificationRequestItem {
  instrumentId: string;
  instrumentItemId: string;
  itemType: string;
  prompt: string;
  stimulus?: string;
  options?: Array<{ id: string; text: string; isCorrect?: boolean }>;
  premises?: Array<{ id: string; text: string }>;
  responses?: Array<{ id: string; text: string }>;
  categories?: Array<{ id: string; text: string }>;
  proposedAnswerKey?: any;
}

export interface AssessmentAnswerVerificationRequest {
  assessmentPackage: AssessmentPackage;
  itemsToVerify: AssessmentAnswerVerificationRequestItem[];
}

export interface AssessmentAnswerVerificationRawResponse {
  results: Array<{
    instrumentItemId: string;
    status: AssessmentAnswerVerificationStatus;
    reason?: string;
  }>;
}

export interface AssessmentAnswerVerificationProvider {
  verify(
    request: AssessmentAnswerVerificationRequest
  ): Promise<AssessmentAnswerVerificationRawResponse>;
}

export interface AssessmentQualityReviewRequest {
  assessmentPackage: AssessmentPackage;
  generationPlan?: AssessmentGenerationPlan;
  gradeCalibration?: AssessmentGradeCalibrationProfile;
  subjectProfile?: SubjectAssessmentProfile;
}

export interface AssessmentAIQualityFinding {
  unitId?: string;
  instrumentItemId?: string;
  coverageUnitId?: string;
  dimension: AssessmentQualityDimension;
  status: 'PASS' | 'REVIEW' | 'FAIL';
  reason: string;
}

export interface AssessmentQualityReviewRawResponse {
  findings: AssessmentAIQualityFinding[];
}

export interface AssessmentQualityReviewProvider {
  review(
    request: AssessmentQualityReviewRequest
  ): Promise<AssessmentQualityReviewRawResponse>;
}

export interface ValidateGeneratedAssessmentInput {
  assessmentPackage: AssessmentPackage;

  generationPlan?: AssessmentGenerationPlan;

  validationContext: AssessmentPackageValidationContext;

  gradeCalibration?: AssessmentGradeCalibrationProfile;
  subjectProfile?: SubjectAssessmentProfile;

  qualityReviewProvider?: AssessmentQualityReviewProvider;
  answerVerificationProvider?: AssessmentAnswerVerificationProvider;
}
