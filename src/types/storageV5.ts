import {
  TeacherProfile,
  SchoolData,
  PrincipalHistory,
  YearPlan,
  SemesterPlan,
  AnnualJPReference,
  SemesterJPSetting,
  CurriculumContextLock,
  CPData,
  CPAnalysisData,
  TPData,
  ATPData,
  AcademicCalendar,
  CalendarDay,
  TimeAllocation,
  LearningPlan,
  AssessmentCriterion,
  AssessmentPlan,
  AssessmentPackage,
  Student,
  AttendanceSession,
  AttendanceRecord,
  Assessment,
  AssessmentResult,
  RemedialRecord,
  EnrichmentRecord,
  AppDocumentRecord,
} from './index';

/**
 * Storage key constant for V5 storage engine.
 */
export const STORAGE_KEY_V5 = 'administrasi_guru_ai_storage_v5';

/**
 * Workspace V5 representation bound strictly to YearPlan.
 * Does not contain academicSettingId, semester, or activeSemester.
 */
export interface AdministrationWorkspaceV5 {
  id: string;
  profileId: string;
  schoolId: string;
  yearPlanId: string;
  name: string;
  documentDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Scoped container for entities belonging strictly to an annual (YearPlan) scope.
 */
export interface YearScopedEntry<T> {
  yearPlanId: string;
  value: T;
}

/**
 * Scoped container for entities belonging strictly to a semester (SemesterPlan) scope.
 */
export interface SemesterScopedEntry<T> {
  semesterPlanId: string;
  value: T;
}

/**
 * Annual domain entity collections owned at the YearPlan level.
 */
export interface AnnualDataStoreV5 {
  cp: YearScopedEntry<CPData>[];
  cpAnalysis: YearScopedEntry<CPAnalysisData>[];
  tp: YearScopedEntry<TPData>[];
  atp: YearScopedEntry<ATPData>[];
  curriculumContext: YearScopedEntry<CurriculumContextLock>[];
}

export interface SemesterCalendarEntry {
  calendar: AcademicCalendar;
  days: CalendarDay[];
}

export interface SemesterAttendanceEntry {
  sessions: AttendanceSession[];
  records: AttendanceRecord[];
}

export interface SemesterGradeEntry {
  assessments: Assessment[];
  results: AssessmentResult[];
}

/**
 * Semester domain entity collections owned at the SemesterPlan level.
 * Exact canonical shapes without union representations.
 */
export interface SemesterDataStoreV5 {
  academicCalendar: SemesterScopedEntry<SemesterCalendarEntry>[];
  timeAllocation: SemesterScopedEntry<TimeAllocation[]>[];
  learningPlan: SemesterScopedEntry<LearningPlan[]>[];
  assessmentCriteria: SemesterScopedEntry<AssessmentCriterion[]>[];
  assessmentPlan: SemesterScopedEntry<AssessmentPlan[]>[];
  assessmentPackage: SemesterScopedEntry<AssessmentPackage[]>[];
  roster: SemesterScopedEntry<Student[]>[];
  attendance: SemesterScopedEntry<SemesterAttendanceEntry>[];
  grade: SemesterScopedEntry<SemesterGradeEntry>[];
  remedial: SemesterScopedEntry<RemedialRecord[]>[];
  enrichment: SemesterScopedEntry<EnrichmentRecord[]>[];
}

/**
 * Canonical Application State for Storage V5.
 * Strictly enforces schemaVersion: 5 and clear annual vs semester hierarchy.
 */
export interface AppStorageStateV5 {
  schemaVersion: 5;
  activeProfileId?: string;
  activeYearPlanId?: string;
  activeSemesterPlanId?: string;
  activeWorkspaceId?: string;

  profiles: TeacherProfile[];
  schools: SchoolData[];
  principalHistories: PrincipalHistory[];

  workspaces: AdministrationWorkspaceV5[];
  yearPlans: YearPlan[];
  semesterPlans: SemesterPlan[];

  annualJPReferences: YearScopedEntry<AnnualJPReference>[];
  semesterJPSettings: SemesterScopedEntry<SemesterJPSetting>[];

  annualData: AnnualDataStoreV5;
  semesterData: SemesterDataStoreV5;
  documents: AppDocumentRecord[];
}

/**
 * Canonical backup envelope for V5 format.
 */
export interface StorageBackupV5 {
  app: 'Administrasi Guru AI';
  schemaVersion: 5;
  exportedAt: string;
  data: AppStorageStateV5;
}
