import {
  AssessmentPackage,
  AssessmentBlueprintItem,
  AssessmentInstrument,
  AssessmentAnswerKey,
  AssessmentScoringGuide,
  AssessmentRubric,
  AssessmentInstrumentType,
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  DocumentMode,
  DocumentSnapshot,
} from './index';

export interface AssessmentExportEligibilityResult {
  eligible: boolean;
  package?: AssessmentPackage;
  blockers: string[];
  warnings: string[];
  resolvedPackageId?: string;
  revision?: number;
}

export type AssessmentSnapshotMode = 'CANONICAL_PACKAGE' | 'BLANK_TEMPLATE';

export interface BaseAssessmentDocumentSnapshot extends DocumentSnapshot {
  snapshotId: string;
  mode: AssessmentSnapshotMode;
  documentType: 'ASESMEN';
  documentDate?: string; // ISO string or YYYY-MM-DD
  formattedDocumentDate: string; // e.g. "Jakarta, 20 September 2026"
  blueprintItems: AssessmentBlueprintItem[];
  instruments: AssessmentInstrument[];
  answerKeys: AssessmentAnswerKey[];
  scoringGuides: AssessmentScoringGuide[];
  rubrics: AssessmentRubric[];
  resolvedObjectives: Record<string, { code: string; statement: string }>;
  studentNames?: string[];
  documentMode: DocumentMode;
  generatedAt: string;
}

export interface CanonicalAssessmentDocumentSnapshot extends BaseAssessmentDocumentSnapshot {
  mode: 'CANONICAL_PACKAGE';
  documentDate: string;
  assessmentPlanId?: string;
  assessmentPlanTitle?: string;
  assessmentPackageId: string;
  assessmentPackageRevision: number;
  packageTitle: string;
  packageReviewReason?: string;
}

export interface BlankAssessmentDocumentSnapshot extends BaseAssessmentDocumentSnapshot {
  mode: 'BLANK_TEMPLATE';
  documentDate?: string;
  assessmentPlanId?: undefined;
  assessmentPlanTitle?: undefined;
  assessmentPackageId?: undefined;
  assessmentPackageRevision?: undefined;
  packageTitle?: undefined;
  packageReviewReason?: undefined;
}

export type AssessmentDocumentSnapshot =
  | CanonicalAssessmentDocumentSnapshot
  | BlankAssessmentDocumentSnapshot;

export interface NormalizedAssessmentKisiKisiRow {
  no: number;
  tpCodeAndStatement: string;
  indicator: string;
  material: string;
  instrumentType: string;
}

export interface NormalizedWrittenItem {
  no: number;
  prompt: string;
  stimulus?: string;
  itemType: string;
  options?: { label: string; text: string }[];
}

export interface NormalizedOralItem {
  no: number;
  prompt: string;
  expectedResponse?: string;
}

export interface NormalizedAssessmentInstrument {
  id: string;
  type: AssessmentInstrumentType;
  typeLabel: string;
  title?: string;
  instructions?: string;
  // Specific instrument fields
  writtenItems?: NormalizedWrittenItem[];
  oralItems?: NormalizedOralItem[];
  task?: string;
  performanceAspects?: {
    label: string;
    description?: string;
    weight?: number;
  }[];
  expectedOutput?: string;
  projectBrief?: string;
  expectedDeliverable?: string;
  productBrief?: string;
  expectedProduct?: string;
  evidenceRequirements?: string[];
  observationAspects?: { label: string; indicator?: string }[];
  recordingScheme?: string;
  responseScheme?: string;
  selfPeerItems?: { no: number; statement: string; category?: string }[];
}

export interface NormalizedAssessmentAnswerKey {
  itemNumber?: number;
  instrumentType: string;
  answerType: string;
  value: string;
  notes?: string;
}

export interface NormalizedAssessmentScoringGuide {
  title: string;
  guideType: string;
  maxScore?: number;
  instructions?: string;
  notes?: string;
}

export interface NormalizedAssessmentRubricScale {
  label: string;
  score?: number;
}

export interface NormalizedAssessmentRubricCriterion {
  label: string;
  descriptors: string[];
  weight?: number;
}

export interface NormalizedAssessmentRubric {
  title: string;
  scale: NormalizedAssessmentRubricScale[];
  criteria: NormalizedAssessmentRubricCriterion[];
}

export interface NormalizedAssessmentSignoff {
  locationAndDate: string;
  principalTitle: string;
  principalName: string;
  principalNip?: string;
  teacherTitle: string;
  teacherName: string;
  teacherNip?: string;
  isBlankMode: boolean;
}

export interface NormalizedAssessmentDocument {
  metadata: {
    title: string;
    subTitle: string;
    schoolName: string;
    npsn?: string;
    schoolAddress?: string;
    curriculum: string;
    subject: string;
    grade: string;
    phase?: string;
    academicYear: string;
    semester: string;
    teacherName: string;
    teacherNip?: string;
    packageId?: string;
    packageRevision?: number;
    documentDate?: string;
    formattedDocumentDate: string;
    isBlankMode: boolean;
    mode: AssessmentSnapshotMode;
  };
  kisiKisi: {
    title: string;
    rows: NormalizedAssessmentKisiKisiRow[];
  };
  instruments: {
    title: string;
    list: NormalizedAssessmentInstrument[];
  };
  answerKeys: {
    title: string;
    list: NormalizedAssessmentAnswerKey[];
  };
  scoringGuides: {
    title: string;
    list: NormalizedAssessmentScoringGuide[];
  };
  rubrics: {
    title: string;
    list: NormalizedAssessmentRubric[];
  };
  signoff: NormalizedAssessmentSignoff;
}

export interface AssessmentExportOptions {
  documentDate?: string;
  documentMode?: DocumentMode;
  skipDownload?: boolean;
}
