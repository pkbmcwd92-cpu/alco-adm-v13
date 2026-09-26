import {
  AssessmentInstrumentType,
  CognitiveDemand,
  AssessmentGradeCalibrationProfile,
  SubjectAssessmentProfile,
  AssessmentValidationFinding,
} from './index';

export type AssessmentRegenerationTarget =
  | 'INDICATOR'
  | 'MATERIAL_CONTEXT'
  | 'STIMULUS'
  | 'ITEM_PROMPT'
  | 'OPTIONS'
  | 'PROPOSED_ANSWER'
  | 'SCORING_GUIDE'
  | 'RUBRIC'
  | 'TASK'
  | 'EVIDENCE_REQUIREMENT'
  | 'OBSERVATION_CONTENT'
  | 'COVERAGE_UNIT';

export type AssessmentRegenerationLocatorKind =
  | 'BLUEPRINT_ITEM'
  | 'COVERAGE_UNIT'
  | 'INSTRUMENT'
  | 'INSTRUMENT_ITEM'
  | 'ANSWER_KEY'
  | 'SCORING_GUIDE'
  | 'RUBRIC';

export interface AssessmentRegenerationLocator {
  kind: AssessmentRegenerationLocatorKind;
  id: string;
}

export interface AssessmentRegenerationRequest {
  packageId: string;
  expectedPackageRevision: number;

  target: AssessmentRegenerationTarget;
  targetId: string; // ID of the specific target item/instrument/blueprint
  locator?: AssessmentRegenerationLocator;

  requestedFields?: string[];

  reason?: string;
  validationFindingIds?: string[];

  explicitTeacherOverride?: boolean;
}

export interface AssessmentRegenerationContract {
  packageId: string;
  packageRevision: number;

  target: AssessmentRegenerationTarget;
  targetId: string;
  locator?: AssessmentRegenerationLocator;

  immutableContext: {
    coverageUnitId?: string;
    objectiveRefId?: string;
    criterionId?: string;
    instrumentType?: string;
    allocationUnit?: string;
    cognitiveDemand?: string;
  };

  preservedContent: any;
  editableContent: any;

  gradeCalibration?: AssessmentGradeCalibrationProfile;
  subjectProfile?: SubjectAssessmentProfile;

  validationFindings?: AssessmentValidationFinding[];
}

export interface AssessmentRegenerationProvider {
  regenerate(
    contract: AssessmentRegenerationContract
  ): Promise<any>;
}

export interface AssessmentRegenerationDraft {
  target: AssessmentRegenerationTarget;
  targetId: string;
  locator?: AssessmentRegenerationLocator;
  proposedChanges: any;
}

export type DependencyFreshness =
  | 'CURRENT'
  | 'STALE'
  | 'NEEDS_REVIEW';

export type AssessmentRegenerationResultStatus =
  | 'REGENERATED'
  | 'TEACHER_EDIT_PROTECTED'
  | 'STALE_REGENERATION_REQUEST'
  | 'REGENERATION_NOT_ELIGIBLE'
  | 'FAILED';

export interface AssessmentRegenerationResult {
  status: AssessmentRegenerationResultStatus;
  regeneratedPackage?: import('./index').AssessmentPackage;
  draft?: AssessmentRegenerationDraft;
  issues?: string[];
}
