import {
  AssessmentDifficultyTarget,
  AssessmentEvidenceType,
  AssessmentInstrumentType,
  AssessmentStimulusType,
  CognitiveDemand,
} from './index';

// ==========================================
// AUDIT 9C.2: GENERATION RULE PROVENANCE
// ==========================================

export type AssessmentGenerationRuleSource =
  | 'OFFICIAL'
  | 'OFFICIAL_REFERENCE'
  | 'OFFICIAL_ASSESSMENT_REFERENCE'
  | 'PEDAGOGICAL_RULE'
  | 'APP_DEFAULT'
  | 'AI_RECOMMENDATION';

export interface AssessmentGenerationRule {
  id: string;
  sourceType: AssessmentGenerationRuleSource;
  description: string;

  sourceRef?: string;
  sourceTitle?: string;
  sourceAgency?: string;
  sourceVersion?: string;
}

// ==========================================
// AUDIT 9C.2: ASSESSMENT GENERATION PROFILE & CALIBRATION
// ==========================================

export interface AssessmentReferenceProgression {
  framework: 'AKM';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  sourceType: 'OFFICIAL_REFERENCE';
}

export type AssessmentReadingLoad =
  | 'VERY_LOW'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH';

export type AssessmentInstructionLoad =
  | 'SINGLE_STEP_PREFERRED'
  | 'LIMITED_MULTI_STEP'
  | 'MULTI_STEP_ALLOWED';

export type AssessmentAbstractionLevel =
  | 'CONCRETE'
  | 'CONCRETE_TO_ABSTRACT'
  | 'ABSTRACT_ALLOWED';

export type AssessmentVisualSupport =
  | 'STRONGLY_CONSIDER'
  | 'CONSIDER'
  | 'AS_NEEDED';

export interface AssessmentGradeCalibrationProfile {
  grade: number;
  readingLoad: AssessmentReadingLoad;
  instructionLoad: AssessmentInstructionLoad;
  abstractionLevel: AssessmentAbstractionLevel;
  visualSupport: AssessmentVisualSupport;
  rules: AssessmentGenerationRule[];
}

export interface AssessmentGenerationProfile {
  grade: number;
  phase?: string;
  referenceProgression?: AssessmentReferenceProgression;
  gradeCalibration: AssessmentGradeCalibrationProfile;
  provenance: AssessmentGenerationRule[];
}

// ==========================================
// AUDIT 9C.2: SUBJECT ASSESSMENT PROFILE
// ==========================================

export interface SubjectCompetencyDomain {
  id: string;
  name: string;
  description?: string;
}

export interface AssessmentEvidenceRecommendationRule {
  id: string;
  ruleDescription: string;
  triggerKeywords?: string[];
  recommendedEvidenceTypes: AssessmentEvidenceType[];
  recommendedInstrumentTypes: AssessmentInstrumentType[];
  rationaleCode: string;
  provenance: AssessmentGenerationRule;
}

export type SubjectAssessmentProfileStatus =
  | 'SPECIFIC'
  | 'GENERIC'
  | 'UNRESOLVED';

export interface SubjectAssessmentProfile {
  subjectKey: string;
  subjectLabel?: string;
  competencyDomains: SubjectCompetencyDomain[];
  supportedEvidenceTypes: AssessmentEvidenceType[];
  supportedInstrumentTypes: AssessmentInstrumentType[];
  recommendationRules: AssessmentEvidenceRecommendationRule[];
  provenance: AssessmentGenerationRule[];
  profileStatus: SubjectAssessmentProfileStatus;
}

// ==========================================
// AUDIT 9C.2: EVIDENCE RECOMMENDATION
// ==========================================

export type AssessmentEvidenceConfidence =
  | 'DETERMINISTIC'
  | 'RULE_BASED'
  | 'NEEDS_TEACHER_REVIEW';

export interface AssessmentEvidenceRecommendation {
  objectiveRefId: string;
  criterionId?: string;
  evidenceTypes: AssessmentEvidenceType[];
  recommendedInstrumentTypes: AssessmentInstrumentType[];
  rationaleCode: string;
  provenance: AssessmentGenerationRule[];
  confidence: AssessmentEvidenceConfidence;
}

// ==========================================
// AUDIT 9C.2: GENERATION SPEC & RESOLUTION
// ==========================================

export type AssessmentGenerationResolutionStatus =
  | 'RESOLVED'
  | 'NEEDS_REVIEW'
  | 'BLOCKED';

export type AssessmentGenerationIssueSeverity = 'REVIEW' | 'BLOCKING';

export interface AssessmentGenerationIssue {
  code: string;
  severity: AssessmentGenerationIssueSeverity;
  message: string;
  objectiveRefId?: string;
  criterionId?: string;
}

export interface ResolvedAssessmentObjective {
  id: string;
  sourceType: 'TP' | 'KD';
  text: string;
  criterionIds: string[];
}

export interface ResolvedAssessmentCriterion {
  id: string;
  objectiveRefId: string;
  name: string;
  description?: string;
}

export interface ResolvedAssessmentCurriculumContext {
  academicSettingId?: string;
  curriculumType?: 'KURIKULUM_MERDEKA' | 'K13';
  rawCurriculumName?: string;
  grade?: number;
  schoolLevel?: 'SD' | 'SMP' | 'SMA';
  phase?: string;
}

export interface AssessmentSourceContext {
  id: string;
  sourceType:
    | 'CANONICAL_CURRICULUM'
    | 'OFFICIAL_GUIDANCE'
    | 'TEACHER_SOURCE';
  title?: string;
  sourceRef?: string;
  revision?: string;
}

export interface AssessmentGenerationSpec {
  assessmentPlanId: string;
  assessmentPackageId: string;
  academicSettingId?: string;

  curriculumContext: ResolvedAssessmentCurriculumContext;
  objectives: ResolvedAssessmentObjective[];
  criteria: ResolvedAssessmentCriterion[];
  generationProfile?: AssessmentGenerationProfile;
  subjectProfile: SubjectAssessmentProfile;
  evidenceRecommendations: AssessmentEvidenceRecommendation[];
  plannedInstrumentTypes: AssessmentInstrumentType[];
  sourceContext: AssessmentSourceContext[];

  resolution: {
    status: AssessmentGenerationResolutionStatus;
    issues: AssessmentGenerationIssue[];
  };
}

// ==========================================
// AUDIT 9C.3: COVERAGE & ASSEMBLY PLAN
// ==========================================

export type AssessmentAssemblyMode =
  | 'AUTO_RECOMMENDED'
  | 'TEACHER_DEFINED';

export type AssessmentAllocationUnit =
  | 'ITEM'
  | 'TASK'
  | 'EVIDENCE'
  | 'OBSERVATION';

export interface AssessmentGenerationConstraints {
  assemblyMode: AssessmentAssemblyMode;
  durationMinutes?: number;
  requestedTotalItems?: number;
}

export interface AssessmentAllocationSummary {
  itemCount: number;
  taskCount: number;
  evidenceCount: number;
  observationCount: number;
  unresolvedCount: number;
}

export interface AssessmentCoverageUnit {
  id: string;

  objectiveRefId: string;
  criterionId?: string;

  evidenceType?: AssessmentEvidenceType;
  instrumentType?: AssessmentInstrumentType;

  allocationUnit?: AssessmentAllocationUnit;
  recommendedCount?: number;

  cognitiveDemand?: CognitiveDemand;
  stimulusType?: AssessmentStimulusType;
  difficultyTarget?: AssessmentDifficultyTarget;

  assessmentIndicator?: string;
  materialOrContext?: string;

  provenance: AssessmentGenerationRule[];

  status:
    | 'RESOLVED'
    | 'NEEDS_REVIEW'
    | 'BLOCKED';

  issues: AssessmentGenerationIssue[];
}

export interface AssessmentGenerationPlan {
  academicSettingId?: string;
  generationSpec?: AssessmentGenerationSpec;

  constraints: AssessmentGenerationConstraints;

  coverageUnits: AssessmentCoverageUnit[];

  summary: {
    objectiveCount: number;
    criterionCount: number;
    coverageUnitCount: number;
    allocatedCount?: number;
    allocationSummary: AssessmentAllocationSummary;
  };

  resolution: {
    status:
      | 'RESOLVED'
      | 'NEEDS_REVIEW'
      | 'BLOCKED';

    issues: AssessmentGenerationIssue[];
  };
}

// ==========================================
// AUDIT 9C.4: AI ASSESSMENT PACKAGE GENERATOR
// ==========================================

export type AssessmentGeneratedContentSource =
  | 'CANONICAL'
  | 'OFFICIAL_GUIDANCE'
  | 'TEACHER'
  | 'AI_DRAFT'
  | 'AI_SYNTHETIC';

export interface AssessmentTeacherContext {
  instructions?: string;
  focusAreas?: string[];
  localContext?: string;
  preferredStimulusTypes?: AssessmentStimulusType[];
}

export interface AssessmentGenerationSource {
  id: string;
  sourceType:
    | 'TEACHER_PROVIDED'
    | 'TEXTBOOK'
    | 'OFFICIAL_REFERENCE'
    | 'CURRICULUM_EXCERPT';
  title: string;
  content: string;
  provenance?: AssessmentGenerationRule;
}

export interface AssessmentGenerationContractUnit {
  coverageUnitId: string;
  objectiveRefId: string;
  criterionId?: string;
  objectiveText: string;
  criterionText?: string;
  instrumentType: AssessmentInstrumentType;
  allocationUnit: AssessmentAllocationUnit;
  requiredCount: number;
  cognitiveDemand?: CognitiveDemand;
  stimulusType?: AssessmentStimulusType;
  difficultyTarget?: AssessmentDifficultyTarget;
  assessmentIndicator?: string;
  materialOrContext?: string;
  indicatorSource?: AssessmentGeneratedContentSource;
  materialSource?: AssessmentGeneratedContentSource;
}

export interface AssessmentGenerationContract {
  assessmentPlanId: string;
  assessmentPackageId: string;
  academicSettingId: string;
  curriculumContext: ResolvedAssessmentCurriculumContext;
  gradeCalibration?: AssessmentGradeCalibrationProfile;
  subjectProfile: SubjectAssessmentProfile;
  sourceContext: AssessmentSourceContext[];
  units: AssessmentGenerationContractUnit[];
}

export interface AssessmentAIGenerationRequest {
  systemPrompt: string;
  userPrompt: string;
  generationContract: AssessmentGenerationContract;
}

export interface AssessmentAIGenerationRawResponse {
  rawText: string;
}

export interface AssessmentAIGenerationProvider {
  generate(
    request: AssessmentAIGenerationRequest
  ): Promise<AssessmentAIGenerationRawResponse>;
}

// Intermediate Typed Draft Structures
export interface GeneratedAssessmentUnitBase {
  coverageUnitId: string;
  objectiveRefId: string;
  criterionId?: string;
  instrumentType: AssessmentInstrumentType;
  allocationUnit: AssessmentAllocationUnit;
  assessmentIndicator?: string;
  indicatorSource?: AssessmentGeneratedContentSource;
  materialOrContext?: string;
  materialSource?: AssessmentGeneratedContentSource;
}

export interface GeneratedItemUnit extends GeneratedAssessmentUnitBase {
  allocationUnit: 'ITEM';
  itemType:
    | 'MULTIPLE_CHOICE'
    | 'MULTIPLE_SELECT'
    | 'TRUE_FALSE'
    | 'SHORT_ANSWER'
    | 'ESSAY'
    | 'MATCHING'
    | 'CATEGORY_RESPONSE';
  prompt: string;
  stimulus?: string;
  stimulusOrigin?: 'OFFICIAL_SOURCE' | 'TEACHER_SOURCE' | 'AI_SYNTHETIC';
  stimulusSource?: string;
  options?: { id?: string; text: string; isCorrect?: boolean }[];
  matchingPremises?: { id: string; text: string }[];
  matchingResponses?: { id: string; text: string }[];
  categoryStatements?: { id: string; text: string }[];
  categoryCategories?: { id: string; label: string }[];
  proposedAnswer?: {
    answerType:
      | 'EXACT'
      | 'OPTION'
      | 'MULTIPLE_OPTION'
      | 'EXPECTED_RESPONSE'
      | 'MATCHING'
      | 'CATEGORY_RESPONSE';
    value?: string;
    optionIndices?: number[];
    matchingPairs?: { premise: string; response: string }[];
    categoryAnswers?: { statement: string; category: string }[];
    explanation?: string;
  };
  scoringGuideDraft?: {
    instructions?: string;
    maxScore?: number;
  };
}

export interface GeneratedTaskUnit extends GeneratedAssessmentUnitBase {
  allocationUnit: 'TASK';
  taskTitle: string;
  taskPrompt: string;
  instructions?: string;
  expectedDeliverable?: string;
  aspects?: { label: string; description?: string; weight?: number }[];
  rubricDraft?: {
    title: string;
    criteria: { label: string; indicator?: string; weight?: number }[];
    scale: { label: string; score?: number; descriptor?: string; order: number }[];
  };
  scoringGuideDraft?: {
    instructions?: string;
    maxScore?: number;
  };
}

export interface GeneratedEvidenceUnit extends GeneratedAssessmentUnitBase {
  allocationUnit: 'EVIDENCE';
  instructions: string;
  evidenceRequirements: string[];
  rubricDraft?: {
    title: string;
    criteria: { label: string; indicator?: string; weight?: number }[];
    scale: { label: string; score?: number; descriptor?: string; order: number }[];
  };
  scoringGuideDraft?: {
    instructions?: string;
    maxScore?: number;
  };
}

export interface GeneratedObservationUnit extends GeneratedAssessmentUnitBase {
  allocationUnit: 'OBSERVATION';
  recordingScheme?: string;
  instructions?: string;
  aspects: { label: string; indicator?: string }[];
  rubricDraft?: {
    title: string;
    criteria: { label: string; indicator?: string }[];
    scale: { label: string; score?: number; descriptor?: string; order: number }[];
  };
}

export type GeneratedAssessmentUnit =
  | GeneratedItemUnit
  | GeneratedTaskUnit
  | GeneratedEvidenceUnit
  | GeneratedObservationUnit;

// 9C.4 Input and Result Contracts
export interface GenerateAssessmentPackageInput {
  generationPlan: AssessmentGenerationPlan;
  academicSettingId?: string;
  teacherContext?: AssessmentTeacherContext;
  sourceMaterials?: AssessmentGenerationSource[];
  existingPackage?: import('./index').AssessmentPackage;
  provider?: AssessmentAIGenerationProvider;
}

export type AssessmentGenerationResultStatus =
  | 'GENERATED'
  | 'PARTIAL'
  | 'BLOCKED'
  | 'FAILED';

export interface AssessmentGenerationResult {
  status: AssessmentGenerationResultStatus;
  generatedPackage?: import('./index').AssessmentPackage;
  contract?: AssessmentGenerationContract;
  generatedUnits: GeneratedAssessmentUnit[];
  failedCoverageUnitIds: string[];
  issues: AssessmentGenerationIssue[];
}

