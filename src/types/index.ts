export type CurriculumType = 'KURIKULUM_MERDEKA' | 'K13';
export type DocumentMode = 'data' | 'blank';

export type SemesterNumber = 1 | 2;
export type AcademicScopeType = 'YEAR' | 'SEMESTER';

/**
 * Lightweight contract for locking curriculum context at YearPlan level.
 */
export interface CurriculumContextLock {
  curriculumType: CurriculumType;
  academicYear: string;
  regulationIds?: string[];
  structureRuleId?: string;
  cpVersion?: string;
  lockedAt?: string;
}

/**
 * Canonical YearPlan represents the administrative identity of 1 full academic year.
 * Must NOT contain semester authority or activeSemester fields.
 */
export interface YearPlan {
  id: string;
  profileId: string;
  schoolId: string;
  academicYear: string;
  curriculumType: CurriculumType;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  grade: string;
  classSection?: string;
  subject: string;
  subjectCode?: string;
  phase?: string;
  curriculumLock?: CurriculumContextLock;
  createdAt: string;
  updatedAt: string;
}

/**
 * Canonical SemesterPlan represents a semester under a parent YearPlan.
 * Derives profileId, schoolId, academicYear, grade, subject, curriculumType from parent YearPlan.
 */
export interface SemesterPlan {
  id: string;
  yearPlanId: string;
  semester: SemesterNumber;
  createdAt: string;
  updatedAt: string;
}

/**
 * Annual official JP reference.
 * Note: referenceWeeklyEquivalentJP != actualScheduledWeeklyJP.
 */
export interface AnnualJPReference {
  officialAnnualJP: number | null;
  referenceWeeklyEquivalentJP?: number | null;
  regulationReference?: string;
}

/**
 * Semester scheduled JP setting.
 * Note: actualScheduledWeeklyJP is the real school schedule, distinct from reference weekly equivalent.
 */
export interface SemesterJPSetting {
  semesterPlanId: string;
  actualScheduledWeeklyJP: number | null;
  source:
    | 'SCHOOL_SCHEDULE'
    | 'TEACHER_CONFIRMED'
    | 'UNRESOLVED';
}

export type { AssessmentPackageValidationContext } from '../services/assessmentPackageService';

export * from './jpEngine';

export type WorkflowStatus = 'BLOCKED' | 'READY' | 'IN_PROGRESS' | 'COMPLETE' | 'STALE';

export type DataProvenanceOrigin = 'USER' | 'AI' | 'SYSTEM';

export interface DataProvenance {
  generatedBy?: DataProvenanceOrigin;
  generatedAt?: string;
  sourceRevision?: number;
  engine?: string;
}

export interface AdministrationContext {
  workspaceId: string;
  teacherProfileId: string;
  schoolId: string;
  academicYear: string;
  semester: 1 | 2;
  curriculumType: CurriculumType;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  grade: number;
  rawGrade: string;
  subjectCode: string;
  subjectName: string;
  phase?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  curriculumResolutionStatus: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
}

export interface TeacherProfile {
  id: string;
  name: string;
  nip: string;
  nuptk?: string;
  status: 'PNS' | 'PPPK' | 'Guru Tetap Yayasan (GTY)' | 'Guru Tidak Tetap (GTT) / Honorer' | 'Lainnya';
  defaultSubject: string;
  defaultLevel: 'SD' | 'SMP' | 'SMA' | 'SMK';
  schoolId?: string; // ID of the primary school (1 Profil Guru = 1 Sekolah Utama)
  createdAt: string;
  updatedAt: string;
}

/**
 * @deprecated Migration-only legacy entity.
 * In v4, 1 TeacherProfile = 1 primary SchoolData via TeacherProfile.schoolId.
 * Retained strictly for reading and migrating legacy v3 storage data.
 */
export interface TeacherSchoolAssignment {
  id: string;
  teacherId: string;
  schoolId: string;
  status?: 'active' | 'inactive' | 'archived';
  startDate?: string;
  endDate?: string;
  role?: string; // e.g. "Guru Kelas", "Guru Mapel", etc.
  createdAt: string;
  updatedAt: string;
}

export type SchoolVerificationStatus = 'verified' | 'unverified' | 'unknown' | 'local_reference';

export interface SchoolData {
  id: string;
  name: string;
  npsn: string;
  address: string;
  village: string; // Desa/Kelurahan
  district: string; // Kecamatan
  regency: string; // Kabupaten/Kota
  province: string;
  principalName: string;
  principalNip: string;
  lastVerifiedAt?: string;
  principalSource?: string;
  principalSourceUrl?: string;
  verificationStatus?: SchoolVerificationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PrincipalHistory {
  id: string;
  schoolId: string;
  name: string;
  nip: string;
  startDate: string;
  endDate?: string;
  source?: string;
  sourceUrl?: string;
  isActive: boolean;
  createdAt: string;
}

/**
 * @deprecated legacy runtime contract — migration target YearPlan/SemesterPlan
 */
export interface AdministrationWorkspace {
  id: string;
  profileId: string;
  schoolId: string;
  academicSettingId: string;
  name: string; // e.g. "PJOK — Kelas 1 — Semester 1 — 2026/2027"
  /**
   * Tanggal resmi administrasi untuk seluruh dokumen
   * pada workspace ini, format YYYY-MM-DD.
   * Berbeda dari createdAt / updatedAt.
   */
  documentDate?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * @deprecated legacy runtime contract — migration target YearPlan/SemesterPlan
 */
export interface AcademicSetting {
  id: string;
  profileId: string;
  curriculum: string; // e.g. "Kurikulum Merdeka" or "Kurikulum 2013"
  curriculumType?: CurriculumType;
  academicYear: string; // e.g. "2025/2026"
  semester?: '1 (Ganjil)' | '2 (Genap)' | '';
  level?: 'SD' | 'SMP' | 'SMA' | 'SMK' | '';
  grade: string; // e.g. "Kelas 4"
  phase: string; // e.g. "Fase B" (derived from grade)
  subject: string; // e.g. "Bahasa Indonesia"
  subjectWeeklyJP?: number; // JP Intrakurikuler Mapel per Minggu (Domain ideal)
  /** @deprecated Compatibility alias. Mirrors subjectWeeklyJP */
  totalHoursPerWeek?: number; // e.g. 4 JP / minggu
  isHoursOverridden?: boolean;
  hoursSourceType?: 'OFFICIAL' | 'USER_OVERRIDE' | 'UNVERIFIED' | 'LEGACY_VALUE';
  regulationReference?: string;
  updatedAt: string;
}

/**
 * Single source of truth for the active working context
 * used across all downstream steps (CP, TP, ATP, AdminDocs, AI prompts).
 * @deprecated legacy runtime contract — migration target YearPlan/SemesterPlan
 */
export interface ActiveContext {
  profileId: string;
  schoolId: string;
  curriculum: string;
  curriculumType?: CurriculumType;
  academicYear: string;
  semester: '1 (Ganjil)' | '2 (Genap)' | string;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK' | string;
  grade: string;
  phase: string;
  subject: string;
  subjectWeeklyJP?: number;
  /** @deprecated Compatibility alias */
  totalHoursPerWeek?: number;
  isHoursOverridden?: boolean;
  hoursSourceType?: 'OFFICIAL' | 'USER_OVERRIDE' | 'UNVERIFIED' | 'LEGACY_VALUE';
  regulationReference?: string;
}

export type WorkflowCompletionStatus = 'BELUM_DIMULAI' | 'DRAFT' | 'PERLU_DILENGKAPI' | 'SIAP';

export type CPVerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'LOCAL_REFERENCE'
  | 'SUPERSEDED'
  | 'VERSION_CONFLICT'
  | 'verified'
  | 'unverified'
  | 'local_reference';

export function normalizeCPVerificationStatus(
  status?: string
): 'VERIFIED' | 'UNVERIFIED' | 'LOCAL_REFERENCE' | 'SUPERSEDED' | 'VERSION_CONFLICT' {
  if (!status) return 'UNVERIFIED';
  const u = status.toUpperCase().trim();
  if (u === 'VERIFIED') return 'VERIFIED';
  if (u === 'UNVERIFIED') return 'UNVERIFIED';
  if (u === 'LOCAL_REFERENCE' || u === 'LOCAL' || u === 'DRAFT') return 'LOCAL_REFERENCE';
  if (u === 'SUPERSEDED') return 'SUPERSEDED';
  if (u === 'VERSION_CONFLICT' || u === 'AMBIGUOUS') return 'VERSION_CONFLICT';
  return 'UNVERIFIED';
}

export interface CPSource {
  id?: string;
  title: string;
  institution: string;
  documentYear?: string;
  url?: string;
  page?: string;
  retrievedAt: string;
  verificationStatus: CPVerificationStatus;
  regulationId?: string;
  regulationIds?: string[];
  versionCode?: string;
}

export interface CPElem {
  id: string;
  name: string; // e.g. "Menyimak", "Membaca dan Memirsa", "Berbicara dan Mempresentasikan", "Menulis"
  content: string;
}

export interface CPData {
  id: string;
  academicSettingId: string;
  cpId?: string;
  cpVersion?: string;
  regulationIds?: string[];
  regulationSourceId?: string;
  generalDescription: string;
  elements: CPElem[];
  source?: CPSource;
  aiNotes?: string;
  workflowStatus?: WorkflowCompletionStatus;
  lastEditedAt?: string;
  updatedAt: string;
}

export interface CPAnalysisItem {
  id: string;
  elementId?: string;
  elementName: string;
  cpText?: string;
  cpCompetence: string; // Kompetensi / KKO dari CP
  materialScope: string; // Lingkup Materi Inti
  meaningfulUnderstanding?: string; // Pemahaman Bermakna / Variasi
  suggestedTp?: string; // Rumusan Awal TP
  order: number;
}

export interface CPAnalysisData {
  id: string;
  academicSettingId: string;
  workspaceId?: string;
  cpId?: string;
  cpSourceId?: string;
  cpRegulationIds?: string[];
  cpVersion?: string;
  academicYear?: string;
  subjectCode?: string;
  phase?: string;
  generalSummary?: string;
  items: CPAnalysisItem[];
  sourceCPVersion?: string;
  basedOnCpUpdatedAt?: string;
  revision?: number;
  status?: 'DRAFT' | 'FINAL';
  generatedBy?: 'AI' | 'TEACHER' | 'AI_EDITED_BY_TEACHER';
  generatedAt?: string;
  workflowStatus?: WorkflowCompletionStatus;
  needsReview?: boolean;
  reviewReason?: string;
  provenance?: DataProvenance;
  updatedAt: string;
}

export interface TPItem {
  id: string;
  code: string; // e.g. "TP 1.1", "TP 4.1"
  cpAnalysisId?: string; // Lineage reference to CPAnalysisItem.id
  elementName?: string;
  statement: string; // Pernyataan Tujuan Pembelajaran
  description?: string;
  competence: string; // Kompetensi / KKO yang dituju (misal: "Menganalisis", "Menjelaskan")
  contentScope: string; // Lingkup Materi / Konsep Inti
  /**
   * @deprecated Legacy compatibility.
   * Prefer graduateProfileDimensions for current documents.
   */
  p3Dimensions?: string[]; // Dimensi Profil Pelajar Pancasila
  graduateProfileDimensions?: string[]; // Dimensi Profil Lulusan (2026 canonical)
  order: number;
  sequence?: number;
  status?: 'DRAFT' | 'FINAL';
  cpAnalysisItemIds?: string[];
  provenance?: DataProvenance;
}

export interface TPData {
  id: string;
  academicSettingId: string;
  workspaceId?: string;
  cpId?: string;
  cpVersion?: string;
  cpRegulationIds?: string[];
  cpAnalysisId?: string;
  academicYear?: string;
  subjectCode?: string;
  phase?: string;
  items: TPItem[];
  basedOnCpUpdatedAt?: string;
  basedOnAnalysisUpdatedAt?: string;
  sourceAnalysisRevision?: number;
  revision?: number;
  status?: 'DRAFT' | 'FINAL';
  workflowStatus?: WorkflowCompletionStatus;
  needsReview?: boolean;
  reviewReason?: string;
  generatedBy?: 'AI' | 'TEACHER' | 'AI_EDITED_BY_TEACHER';
  generatedAt?: string;
  provenance?: DataProvenance;
  updatedAt: string;
}

export interface ATPItem {
  id: string;
  stepNumber: number; // Urutan Alur Pembelajaran (1, 2, 3...)
  sequence?: number; // Alias for stepNumber
  tpId?: string; // Canonical reference to TPItem.id
  tpCode?: string; // Resolved display code
  tpStatement?: string; // Resolved display statement
  materialScope?: string; // Resolved display material scope
  allocatedJP?: number | null; // Alokasi Jam Pelajaran (explicitly nullable! Unknown = null)
  jp?: number | null; // Compatibility field
  /**
   * @deprecated BUKAN canonical authority penempatan semester ke depan.
   * Canonical semester placement nantinya berasal dari: TimeAllocation → SemesterPlan.
   * Dipertahankan untuk backward compatibility legacy runtime.
   */
  semester?: 1 | 2 | null;
  /**
   * @deprecated Legacy compatibility.
   * Prefer graduateProfileDimensions for current documents.
   */
  p3Dimensions?: string[]; // Profil Pelajar Pancasila
  graduateProfileDimensions?: string[]; // Dimensi Profil Lulusan (2026 canonical)
  assessmentPlan?: string; // Asesmen Awal, Formatif, Sumatif
  glossary?: string; // Kata Kunci / Glosarium
  resources?: string; // Sumber Belajar / Media
  sourceTpRevision?: number;
  provenance?: DataProvenance;
}

export interface ATPData {
  id: string;
  academicSettingId: string;
  workspaceId?: string;
  tpId?: string;
  tpDataId?: string;
  academicYear?: string;
  subjectCode?: string;
  phase?: string;
  rationale?: string; // Rasionalisasi Alur Pembelajaran
  items: ATPItem[];
  totalJP?: number;
  knownTotalJP?: number;
  hasUnknownJP?: boolean;
  allocationComplete?: boolean;
  basedOnTpUpdatedAt?: string;
  sourceTpRevision?: number;
  revision?: number;
  status?: 'DRAFT' | 'FINAL';
  workflowStatus?: WorkflowCompletionStatus;
  needsReview?: boolean;
  reviewReason?: string;
  generatedBy?: 'AI' | 'TEACHER' | 'AI_EDITED_BY_TEACHER';
  generatedAt?: string;
  provenance?: DataProvenance;
  updatedAt: string;
}

export type DocumentType =
  | 'CP'
  | 'ANALISIS_CP_TP'
  | 'TP'
  | 'ATP'
  | 'PROTA'
  | 'PROMES'
  | 'MODUL_AJAR'
  | 'ASESMEN'
  | 'JURNAL'
  | 'KALENDER_AKADEMIK'
  | 'HARI_EFEKTIF'
  | 'ALOKASI_WAKTU'
  | 'DAFTAR_HADIR'
  | 'KKTP'
  | 'DAFTAR_NILAI'
  | 'REMEDIAL_PENGAYAAN'
  | 'ANALISIS_SKL_KI_KD'
  | 'PENETAPAN_KKM';

// ==========================================
// SISWA (STUDENT DATA MODEL)
// ==========================================
export interface Student {
  id: string;
  academicSettingId: string;
  nisn?: string;
  name: string;
  gender?: 'L' | 'P';
  notes?: string;
}

// ==========================================
// MODUL A: PERENCANAAN WAKTU
// ==========================================
export type CalendarWorkflowStatus =
  | 'AUTO_RESOLVED'
  | 'REVIEWED'
  | 'MANUAL_OVERRIDE'
  | 'CONFIRMED'
  | 'UNRESOLVED';

export type CalendarResolutionStatus =
  | 'UNRESOLVED'
  | 'PARTIALLY_RESOLVED'
  | 'RESOLVED'
  | 'MANUALLY_OVERRIDDEN'
  | 'REGION_REQUIRED'
  | 'ACADEMIC_YEAR_REQUIRED'
  | 'SEMESTER_REQUIRED'
  | 'INVALID_SEMESTER'
  | 'UNVERIFIED_SOURCE';

export type CalendarLayerType = 'REGIONAL_BASE' | 'NATIONAL_OVERLAY' | 'SCHOOL_OVERRIDE' | 'MANUAL';

export interface CalendarProvenance {
  sourceType: CalendarSourceType;
  sourceName: string;
  sourceAuthority: string;
  sourceUrl?: string;
  region: string;
  academicYear: string;
  documentNumber?: string;
  documentTitle?: string;
  publicationDate?: string;
  effectiveDate?: string;
  sourceVersion?: string;
  retrievedAt: string;
  checksumOrDate?: string;
}

export interface SchoolCalendarOverride {
  id: string;
  date: string; // YYYY-MM-DD
  status: CalendarDayStatus;
  notes?: string;
  reason?: string;
  isEffectiveOverride?: boolean;
  createdAt: string;
}

export type CalendarSourceType =
  | 'REGIONAL_EDUCATION_CALENDAR'
  | 'NATIONAL_HOLIDAY_OVERLAY'
  | 'SCHOOL_OVERRIDE'
  | 'SCHOOL_ADJUSTMENT'
  | 'MANUAL'
  | 'IMPORTED'
  | 'LEGACY'
  | 'UNVERIFIED'
  // Legacy compatibility aliases
  | 'REGIONAL_CALENDAR'
  | 'SCHOOL_CALENDAR';

export interface AcademicCalendar {
  id: string;
  academicSettingId: string;
  academicYear: string;
  semester: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  schoolDaysPerWeek?: number | null; // 5 atau 6 hari sekolah per minggu (nullable / unresolved)
  sourceType?: CalendarSourceType;
  sourceName?: string;
  sourceReference?: string;
  sourceAuthority?: string;
  sourceDocumentNumber?: string;
  sourceUrl?: string;
  sourceRegion?: string;
  workflowStatus?: CalendarWorkflowStatus;
  resolutionStatus?: CalendarResolutionStatus;
  reviewStatus?: 'UNREVIEWED' | 'REVIEWED' | 'CONFIRMED';
  actionableMessage?: string;
  retrievedAt?: string;
  verifiedAt?: string;
  confirmedAt?: string;
  reviewedAt?: string;
  isOverridden?: boolean;
  overrideReason?: string;
  overrides?: SchoolCalendarOverride[];
  provenance?: CalendarProvenance;
  nationalProvenance?: CalendarProvenance;
  nationalProvenances?: CalendarProvenance[];
  nationalHolidayOverlayName?: string;
  nationalHolidayOverlayUrl?: string;
  nationalHolidayCount?: number;
  regionalEventCount?: number;
  schoolEventCount?: number;
  /** @deprecated Compatibility alias. Prefer setting.subjectWeeklyJP */
  jpPerWeek?: number | null;
  notes?: string;
  updatedAt: string;
}

export type CalendarDayStatus =
  | 'EFFECTIVE_LEARNING'
  | 'HOLIDAY'
  | 'SCHOOL_EVENT'
  | 'ASSESSMENT'
  | 'BREAK'
  | 'NON_LEARNING'
  // Legacy aliases
  | 'effective'
  | 'holiday'
  | 'schoolEvent'
  | 'weekend'
  | 'other';

export interface CalendarDay {
  id: string;
  academicCalendarId: string;
  date: string; // YYYY-MM-DD
  status: CalendarDayStatus;
  notes?: string;
  sourceType?: CalendarSourceType | 'REGIONAL_EDUCATION_CALENDAR' | 'NATIONAL_HOLIDAY_OVERLAY' | 'SCHOOL_OVERRIDE' | 'MANUAL';
  sourceName?: string;
  sourceLayer?: CalendarLayerType;
  sourceAuthority?: string;
  sourceDocumentNumber?: string;
  sourceUrl?: string;
  sourceProvenances?: CalendarProvenance[];
  isOverridden?: boolean;
  overrideReason?: string;
  originalStatus?: CalendarDayStatus;
  category?:
    | 'NATIONAL_HOLIDAY'
    | 'CUTI_BERSAMA'
    | 'REGIONAL_HOLIDAY'
    | 'SEMESTER_BREAK'
    | 'MID_SEMESTER_BREAK'
    | 'SCHOOL_EVENT'
    | 'ASSESSMENT'
    | 'RELIGIOUS_HOLIDAY'
    | 'OTHER';
}

export interface TimeAllocation {
  id: string;
  academicSettingId: string;
  sourceType?: 'ATP_ITEM' | 'TP' | 'KD' | 'K13_OBJECTIVE' | 'ASSESSMENT' | 'RESERVE' | 'LEGACY' | 'UNKNOWN';
  sourceId?: string;
  tpId?: string;
  atpItemId?: string;
  semester?: string | number;
  weekNumber?: number;
  startWeek?: number;
  endWeek?: number;
  month?: number;
  monthName?: string;
  jp: number;
  allocatedJP?: number;
  notes?: string;
}

export type {
  CurriculumStructureRule,
  MasterCurriculumStructure,
  SubjectJPResult,
  SubjectJPQuery,
  JPVerificationStatus,
  JPSourceType,
  TeachingAssignment,
  AdditionalDuty,
  TeacherLoadValidationResult,
  EffectiveDayResult,
  AvailableJPResult,
  AvailableJPCalculation,
  LearningTimeAllocation,
  TimeAllocationSourceType,
  TimeAllocationStatus,
  TimeAllocationValidationResult,
  RegulatorySource,
} from './jpEngine';

// ==========================================
// MODUL B: PELAKSANAAN & ASESMEN
// ==========================================
export interface AttendanceSession {
  id: string;
  academicSettingId: string;
  date: string; // YYYY-MM-DD
  meetingNumber: number;
  topic?: string;
  notes?: string;
  createdAt: string;
}

export type AttendanceStatus = 'H' | 'S' | 'I' | 'A' | 'D'; // Hadir, Sakit, Izin, Alpa, Dispensasi

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  note?: string;
}

export type KKTPApproach = 'deskripsi' | 'rubrik' | 'skala_interval' | 'legacy_kkm';
export type AssessmentCriterionMode = 'DESCRIPTION' | 'RUBRIC' | 'INTERVAL' | 'LEGACY_KKM';

export interface KKTPLevel {
  level: string; // e.g. "Perlu Bimbingan", "Cukup", "Baik", "Sangat Baik"
  label: string;
  description: string;
  scoreRange?: string;
}

export interface AssessmentCriterion {
  id: string;
  academicSettingId: string;
  workspaceId?: string;
  tpId: string; // Terhubung ke TP (Merdeka) atau KD (K13)
  description: string;
  approach: KKTPApproach;
  criterionMode?: AssessmentCriterionMode;
  method?: 'DESCRIPTION' | 'RUBRIC' | 'INTERVAL' | 'LEGACY_KKM';
  indicators: string[];
  levels: KKTPLevel[];
  passingThreshold?: number | null; // Nilai KKM minimum jika pendekatan legacy_kkm, null jika non-legacy
  kompleksitas?: number | null;
  dayaDukung?: number | null;
  intake?: number | null;
  notes?: string;
  sourceTpRevision?: number;
  basedOnTpUpdatedAt?: string;
  provenance?: DataProvenance;
  workflowStatus?: 'DRAFT' | 'PERLU_DILENGKAPI' | 'SIAP';
  generatedBy?: 'AI' | 'AI_EDITED_BY_TEACHER' | 'TEACHER';
  needsReview?: boolean;
  reviewReason?: string;
  updatedAt: string;
}

// ==========================================
// MODEL CANONICAL PERENCANAAN PEMBELAJARAN
// (Permendikbudristek 12/2024 & Permendikdasmen 13/2025)
// ==========================================
export type LearningPlanStatus =
  | 'DRAFT'
  | 'PERLU_DILENGKAPI'
  | 'SIAP';

export type LearningPlanSource =
  | 'MANUAL'
  | 'AI_DRAFT'
  | 'MIGRATED';

export interface LearningObjectiveReference {
  id: string;
  tpId?: string;
  code?: string;
  statement: string;
  materialScope?: string;
}

export interface LearningActivity {
  id: string;
  stepName?: 'Pendahuluan' | 'Kegiatan Inti' | 'Penutup' | string;
  title?: string;
  description: string;
  durationMinutes?: number;
  activityType?: 'opening' | 'core' | 'closing' | string;
}

export interface AssessmentPlanItem {
  id: string;
  type: 'INITIAL' | 'FORMATIVE' | 'SUMMATIVE';
  method?: string;
  technique?: string;
  instrument?: string;
  linkedTpIds: string[];
  description?: string;
}

export interface LearningResource {
  id: string;
  type?: string;
  title: string;
  source?: string;
  url?: string;
}

export interface DifferentiationPlan {
  content?: string;
  process?: string;
  product?: string;
  notes?: string;
}

export interface ReflectionPlan {
  teacherReflection?: string;
  studentReflection?: string;
}

// ==========================================
// CANONICAL LEARNING EXPERIENCE & PEMBELAJARAN MENDALAM (2026)
// ==========================================
export type LearningExperiencePhase =
  | 'UNDERSTAND'
  | 'APPLY'
  | 'REFLECT';

export interface LearningExperience {
  id: string;
  phase: LearningExperiencePhase;
  description: string;
  linkedTpIds?: string[];
  durationMinutes?: number;
}

export type DeepLearningPrinciple =
  | 'MINDFUL'
  | 'MEANINGFUL'
  | 'JOYFUL';

export interface DeepLearningFrameworkContext {
  pedagogicalPractice?: string[];
  learningPartnership?: string[];
  learningEnvironment?: string[];
  digitalUtilization?: string[];
}

export interface DeepLearningContext {
  principles?: DeepLearningPrinciple[];
  graduateProfileDimensions?: string[];
  framework?: DeepLearningFrameworkContext;
}

/**
 * Model canonical perencanaan pembelajaran (Modul Ajar / RPP).
 * Komponen minimal sesuai regulasi 2024-2026:
 * 1. Tujuan Pembelajaran (Canonical TP/ATP references)
 * 2. Langkah/Pengalaman Belajar (Langkah Pembelajaran legacy atau Pengalaman Belajar canonical 2026)
 * 3. Asesmen / Rencana Penilaian (Awal, Formatif, Sumatif)
 */
export interface LearningPlan {
  id: string;
  academicSettingId: string;
  curriculumType?: CurriculumType;
  sourceType: LearningPlanSource;
  status: LearningPlanStatus;

  // Canonical dependencies
  tpIds: string[];
  atpItemIds: string[];
  kktpCriterionIds?: string[];
  timeAllocationIds?: string[];

  title?: string;
  topic?: string;

  objectives: LearningObjectiveReference[];

  /**
   * Legacy learning steps (opening, core, closing).
   * Maintained for backward compatibility.
   */
  learningSteps?: {
    opening?: LearningActivity[];
    core?: LearningActivity[];
    closing?: LearningActivity[];
  };

  /**
   * Canonical 2026 Pengalaman Belajar (Memahami, Mengaplikasi, Merefleksi).
   */
  learningExperiences?: LearningExperience[];

  /**
   * Konteks Pembelajaran Mendalam (Berkesadaran, Bermakna, Menggembirakan)
   */
  deepLearningContext?: DeepLearningContext;

  assessmentPlan: {
    initial?: AssessmentPlanItem[];
    formative?: AssessmentPlanItem[];
    summative?: AssessmentPlanItem[];
  };

  resources?: LearningResource[];
  differentiation?: DifferentiationPlan;
  meaningfulUnderstanding?: string;
  triggerQuestions?: string[];
  reflection?: ReflectionPlan;
  enrichmentPlan?: string;
  remedialPlan?: string;

  // Explicit contextual metadata provided by teacher
  initialCompetency?: string;
  targetStudents?: string;
  learningModel?: string;

  /**
   * Dimensi Profil Lulusan (Canonical 2026).
   */
  graduateProfileDimensions?: string[];

  /**
   * @deprecated Legacy compatibility.
   * Prefer graduateProfileDimensions for current documents.
   */
  p3Dimensions?: string[];
  allocatedJP?: number;

  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

// ==========================================
// CANONICAL ASSESSMENT PLAN DATA MODEL (AUDIT 9A)
// ==========================================
export type AssessmentPurpose =
  | 'FORMATIVE'
  | 'SUMMATIVE';

export type AssessmentTiming =
  | 'PRE'
  | 'DURING'
  | 'POST'
  | 'MID_SEMESTER'
  | 'END_SEMESTER'
  | 'END_YEAR'
  | 'END_LEVEL'
  | 'CUSTOM';

export type AssessmentScopeType =
  | 'TP'
  | 'MULTI_TP'
  | 'UNIT'
  | 'SEMESTER'
  | 'YEAR'
  | 'LEVEL'
  | 'CUSTOM';

export type AssessmentInstrumentType =
  | 'WRITTEN_TEST'
  | 'ORAL_TEST'
  | 'PERFORMANCE'
  | 'OBSERVATION'
  | 'ASSIGNMENT'
  | 'PROJECT'
  | 'PRODUCT'
  | 'PORTFOLIO'
  | 'SELF_ASSESSMENT'
  | 'PEER_ASSESSMENT';

export interface AssessmentInstrumentRef {
  id: string;
  type: AssessmentInstrumentType;
  label?: string;
}

export interface AssessmentPlan {
  id: string;
  academicSettingId: string;
  workspaceId?: string;

  title: string;

  purpose: AssessmentPurpose;
  timing: AssessmentTiming;
  scopeType: AssessmentScopeType;

  tpIds: string[];
  criterionIds: string[];

  learningPlanIds?: string[];

  instruments: AssessmentInstrumentRef[];

  displayLabel?: string;
  customTimingLabel?: string;
  customScopeLabel?: string;

  workflowStatus:
    | 'DRAFT'
    | 'PERLU_DILENGKAPI'
    | 'SIAP';

  needsReview?: boolean;
  reviewReason?: string;

  revision?: number;
  provenance?: DataProvenance;

  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

// ==========================================
// CANONICAL ASSESSMENT PACKAGE (AUDIT 9B & 9C.1)
// ==========================================

export type CognitiveDemand =
  | 'RECALL_UNDERSTAND'
  | 'APPLY'
  | 'ANALYZE_REASON'
  | 'EVALUATE_CREATE';

export type AssessmentEvidenceType =
  | 'KNOWLEDGE_RESPONSE'
  | 'REASONING'
  | 'ORAL_RESPONSE'
  | 'PERFORMANCE'
  | 'OBSERVATION'
  | 'PRODUCT'
  | 'PROJECT'
  | 'PORTFOLIO';

export type AssessmentStimulusType =
  | 'NONE'
  | 'TEXT'
  | 'IMAGE'
  | 'TABLE'
  | 'CHART'
  | 'DIAGRAM'
  | 'SCENARIO'
  | 'DATA'
  | 'MATHEMATICAL_REPRESENTATION';

export type AssessmentDifficultyTarget =
  | 'BASIC'
  | 'MODERATE'
  | 'CHALLENGING';

export type AssessmentStimulusOrigin =
  | 'OFFICIAL_SOURCE'
  | 'TEACHER_SOURCE'
  | 'AI_SYNTHETIC';

export interface AssessmentBlueprintItem {
  id: string;
  coverageUnitId?: string;
  objectiveRefId: string; // ID for TP or KD
  criterionId?: string; // ID for KKTP Criterion
  assessmentIndicator?: string; // Indicator written by teacher
  materialOrContext?: string; // Material/Context written by teacher
  instrumentType: AssessmentInstrumentType | '';
  instrumentId?: string;
  instrumentItemIds: string[];
  order: number;
  status?: 'DRAFT' | 'REVIEWED';

  // Audit 9C.1 Foundation Metadata (all optional, no fake defaults)
  cognitiveDemand?: CognitiveDemand;
  evidenceType?: AssessmentEvidenceType;
  stimulusType?: AssessmentStimulusType;
  difficultyTarget?: AssessmentDifficultyTarget;
  recommendedItemCount?: number;
  estimatedMinutes?: number;
}

// Written Test
export type WrittenAssessmentItemType =
  | 'MULTIPLE_CHOICE'
  | 'MULTIPLE_SELECT'
  | 'TRUE_FALSE'
  | 'SHORT_ANSWER'
  | 'ESSAY'
  | 'MATCHING'
  | 'CATEGORY_RESPONSE';

export type ShortAnswerResponseMode =
  | 'SHORT_RESPONSE'
  | 'COMPLETION';

export interface MatchingAssessmentEntry {
  id: string;
  text: string;
}

export interface MatchingAssessmentPair {
  premiseId: string;
  responseId: string;
}

export interface CategoryResponseStatement {
  id: string;
  text: string;
  /** @deprecated Canonical answer berada pada AssessmentAnswerKey.categoryAnswers. Tidak boleh ada conflicting dual source. */
  correctCategoryId?: string;
}

export interface CategoryResponseCategory {
  id: string;
  label: string;
}

export interface WrittenAssessmentOption {
  id: string;
  label: string;
  text: string;
  isCorrect?: boolean;
}

export interface WrittenAssessmentItem {
  id: string;
  blueprintItemId?: string;
  coverageUnitId?: string;
  itemType: WrittenAssessmentItemType | '';
  prompt: string;
  stimulus?: string;
  stimulusOrigin?: AssessmentStimulusOrigin;
  stimulusSource?: string;
  options?: WrittenAssessmentOption[];
  responseMode?: ShortAnswerResponseMode;
  matchingPremises?: MatchingAssessmentEntry[];
  matchingResponses?: MatchingAssessmentEntry[];
  /** @deprecated Canonical answer berada pada AssessmentAnswerKey.matchingPairs. Tidak boleh ada conflicting dual source. */
  matchingPairs?: MatchingAssessmentPair[];
  categoryResponseStatements?: CategoryResponseStatement[];
  categoryResponseCategories?: CategoryResponseCategory[];
  order: number;
}

export interface WrittenAssessmentInstrument {
  id: string;
  type: 'WRITTEN_TEST';
  title?: string;
  instructions?: string;
  items: WrittenAssessmentItem[];
}

// Oral Test
export interface OralAssessmentItem {
  id: string;
  blueprintItemId?: string;
  prompt: string;
  expectedResponse?: string;
  order: number;
}

export interface OralAssessmentInstrument {
  id: string;
  type: 'ORAL_TEST';
  title?: string;
  instructions?: string;
  items: OralAssessmentItem[];
}

// Performance / Praktik
export interface PerformanceAspect {
  id: string;
  label: string;
  description?: string;
  weight?: number;
}

export interface PerformanceAssessmentInstrument {
  id: string;
  type: 'PERFORMANCE';
  title?: string;
  task: string;
  instructions?: string;
  blueprintItemId?: string;
  rubricId?: string;
  scoringGuideId?: string;
  aspects?: PerformanceAspect[];
}

// Observation
export interface ObservationAspect {
  id: string;
  label: string;
  indicator?: string;
}

export interface ObservationAssessmentInstrument {
  id: string;
  type: 'OBSERVATION';
  title?: string;
  instructions?: string;
  recordingScheme?: string;
  aspects: ObservationAspect[];
}

// Assignment
export interface AssignmentAssessmentInstrument {
  id: string;
  type: 'ASSIGNMENT';
  title?: string;
  instructions: string;
  expectedOutput?: string;
  blueprintItemId?: string;
  scoringGuideId?: string;
  rubricId?: string;
}

// Project
export interface ProjectAssessmentInstrument {
  id: string;
  type: 'PROJECT';
  title?: string;
  projectBrief: string;
  expectedDeliverable?: string;
  blueprintItemId?: string;
  rubricId?: string;
  scoringGuideId?: string;
}

// Product
export interface ProductAssessmentInstrument {
  id: string;
  type: 'PRODUCT';
  title?: string;
  productBrief: string;
  expectedProduct?: string;
  blueprintItemId?: string;
  rubricId?: string;
  scoringGuideId?: string;
}

// Portfolio
export interface PortfolioAssessmentInstrument {
  id: string;
  type: 'PORTFOLIO';
  title?: string;
  instructions?: string;
  evidenceRequirements: string[];
  blueprintItemId?: string;
  rubricId?: string;
  scoringGuideId?: string;
}

// Self / Peer Assessment
export interface SelfPeerAssessmentItem {
  id: string;
  statement: string;
  category?: string;
}

export interface SelfPeerAssessmentInstrument {
  id: string;
  type: 'SELF_ASSESSMENT' | 'PEER_ASSESSMENT';
  title?: string;
  instructions?: string;
  items: SelfPeerAssessmentItem[];
  responseScheme?: string;
}

export type AssessmentInstrument =
  | WrittenAssessmentInstrument
  | OralAssessmentInstrument
  | PerformanceAssessmentInstrument
  | ObservationAssessmentInstrument
  | AssignmentAssessmentInstrument
  | ProjectAssessmentInstrument
  | ProductAssessmentInstrument
  | PortfolioAssessmentInstrument
  | SelfPeerAssessmentInstrument;

// Answer Key
export type AssessmentAnswerType =
  | 'EXACT'
  | 'OPTION'
  | 'MULTIPLE_OPTION'
  | 'EXPECTED_RESPONSE'
  | 'MATCHING'
  | 'CATEGORY_RESPONSE';

export interface AssessmentAnswerKey {
  id: string;
  instrumentId: string;
  instrumentItemId: string;
  answerType: AssessmentAnswerType;
  value?: string;
  optionIds?: string[];
  matchingPairs?: MatchingAssessmentPair[];
  categoryAnswers?: { statementId: string; categoryId: string }[];
  notes?: string;
}

// Scoring Guide
export interface AssessmentScoringGuide {
  id: string;
  title: string;
  instrumentId?: string;
  instrumentItemId?: string;
  guideType: 'OBJECTIVE' | 'MANUAL' | 'ESSAY' | 'RUBRIC_BASED';
  instructions?: string;
  maxScore?: number;
  notes?: string;
}

// Rubric
export interface RubricCriterion {
  id: string;
  label: string;
  indicator?: string;
  weight?: number;
}

export interface RubricScaleLevel {
  id: string;
  label: string;
  score?: number;
  descriptor?: string;
  order: number;
}

export interface AssessmentRubric {
  id: string;
  title: string;
  instrumentId?: string;
  instrumentItemId?: string;
  criteria: RubricCriterion[];
  scale: RubricScaleLevel[];
  status?: 'DRAFT' | 'REVIEWED';
}

// Assessment Package (Audit 9B)
export interface AssessmentPackage {
  id: string;
  assessmentPlanId: string;
  academicSettingId: string;
  workspaceId?: string;

  title: string;

  blueprintItems: AssessmentBlueprintItem[];
  instruments: AssessmentInstrument[];

  answerKeys: AssessmentAnswerKey[];
  scoringGuides: AssessmentScoringGuide[];
  rubrics: AssessmentRubric[];

  workflowStatus: 'DRAFT' | 'PERLU_DILENGKAPI' | 'SIAP';

  needsReview?: boolean;
  reviewReason?: string;

  revision?: number;
  provenance?: DataProvenance;

  createdAt: string;
  updatedAt: string;
}

export type AssessmentType = 'formatif' | 'sumatif_lingkup_materi' | 'sumatif_akhir_semester';

export interface Assessment {
  id: string;
  academicSettingId: string;
  tpId: string; // Terhubung ke TP
  date: string;
  type: AssessmentType;
  title: string;
  description?: string;
  maxScore: number;
  passingScore?: number;
  createdAt: string;
}

export type AssessmentResultStatus = 'belum_tercapai' | 'tercapai' | 'sangat_baik';

export interface AssessmentResult {
  id: string;
  assessmentId: string;
  studentId: string;
  score: number;
  status: AssessmentResultStatus;
  note?: string;
}

// ==========================================
// MODUL C: TINDAK LANJUT
// ==========================================
export type FollowUpStatus = 'planned' | 'ongoing' | 'completed';
export type InterventionType =
  | 'bimbingan_perorangan'
  | 'bimbingan_kelompok'
  | 'pembelajaran_ulang'
  | 'tutor_sebaya'
  | 'penugasan_bermakna';

export interface RemedialRecord {
  id: string;
  academicSettingId: string;
  studentId: string;
  tpId: string;
  sourceAssessmentId?: string;
  reason: string; // Analisis kesulitan belajar / materi belum dikuasai
  intervention: string; // Rencana tindakan / bentuk intervensi
  interventionType?: InterventionType;
  date: string; // Tanggal rencana pelaksanaan
  reassessmentId?: string;
  reassessmentScore?: number;
  reassessmentDate?: string;
  result?: string; // Hasil akhir / evaluasi ketercapaian (misal: "Tuntas (Skor 80)")
  followUpAction?: string; // Tindak lanjut berikutnya
  status: FollowUpStatus;
  updatedAt: string;
}

export interface EnrichmentRecord {
  id: string;
  academicSettingId: string;
  studentId: string;
  tpId: string;
  sourceAssessmentId?: string;
  activity: string; // Bentuk kegiatan pengayaan / pendalaman materi
  date: string;
  result?: string;
  status: FollowUpStatus;
  updatedAt: string;
}

// ==========================================
// MODUL D: KURIKULUM 2013 (K13)
// ==========================================
export interface K13AnalysisItem {
  id: string;
  skl: string;
  ki: string;
  kd: string;
  tujuanPembelajaran?: string; // Penjabaran Tujuan Pembelajaran K13
  indikator: string; // Indikator Pencapaian Kompetensi (IPK)
  materi: string; // Materi Pokok / Esensial
  kegiatan: string; // Kegiatan Pembelajaran
  alokasiJp?: number; // Alokasi JP per KD/Topik
  penilaian?: string;
}

export interface K13Analysis {
  id: string;
  academicSettingId: string;
  items: K13AnalysisItem[];
  updatedAt: string;
}

export interface K13KKMItem {
  id: string;
  kd: string;
  indikator: string;
  kompleksitas: number;
  dayaDukung: number;
  intake: number;
  kkmIndikator: number;
}

export interface K13KKM {
  id: string;
  academicSettingId: string;
  items: K13KKMItem[];
  kkmTotal?: number;
  kkmMataPelajaran?: number;
  predikatA?: number;
  predikatB?: number;
  predikatC?: number;
  updatedAt: string;
}

export interface DocumentSnapshot {
  schoolName: string;
  npsn?: string;
  schoolNpsn?: string;
  schoolAddress?: string;
  schoolVillage?: string;
  schoolDistrict?: string;
  schoolRegency?: string;
  schoolProvince?: string;
  principalName: string;
  principalNip?: string;
  principalSource?: string;
  teacherName: string;
  teacherNip?: string;
  teacherStatus?: string;
  academicYear: string;
  semester: string;
  grade: string;
  subject: string;
  phase?: string;
  curriculum?: string;
  curriculumType?: CurriculumType;
  documentMode?: DocumentMode;
  studentCount?: number;
  generatedAt: string;
  format?: 'docx' | 'pdf' | 'all';
  documentDate?: string;
  formattedDocumentDate?: string;
  assessmentPackageId?: string;
  assessmentPackageRevision?: number;
  sourceVersions?: {
    cpUpdatedAt?: string;
    tpUpdatedAt?: string;
    atpUpdatedAt?: string;
  };
}

export interface AppDocumentRecord {
  id: string;
  type: DocumentType;
  title: string;
  status: 'completed' | 'draft' | 'future_sprint';
  lastGenerated?: string;
  fileName?: string;
  academicSettingId?: string;
  workspaceId?: string;
  sourceUpdatedAt?: string;
  generatedAt?: string;
  generatedFrom?: string;
  format?: 'docx' | 'pdf' | 'all';
  snapshot?: DocumentSnapshot;
}

export interface ProfileWorkspaceData {
  status?: 'RESOLVED' | 'NO_PROFILE';
  profile?: TeacherProfile;
  school?: SchoolData;
  workspace?: AdministrationWorkspace;
  academicSetting?: AcademicSetting;
  context?: ActiveContext;
  cp?: CPData;
  cpAnalysis?: CPAnalysisData;
  tp?: TPData;
  atp?: ATPData;
  documents: AppDocumentRecord[];
  allWorkspaces: AdministrationWorkspace[];
  allWorkspacesForProfile?: AdministrationWorkspace[];
  activeProfile?: TeacherProfile;
  activeSchool?: SchoolData;
  schools: SchoolData[];
  teacherSchoolAssignments?: TeacherSchoolAssignment[];
  assignedSchools?: SchoolData[];
  principalHistories?: PrincipalHistory[];
  activeWorkspace?: AdministrationWorkspace;
  activeAcademicSetting?: AcademicSetting;
  activeContext?: ActiveContext;
  activeCP?: CPData;
  activeTP?: TPData;
  activeATP?: ATPData;
  // New modules scoped strictly to this workspace
  students: Student[];
  calendar?: AcademicCalendar;
  calendarDays: CalendarDay[];
  timeAllocations: TimeAllocation[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
  assessmentCriteria: AssessmentCriterion[];
  assessments: Assessment[];
  assessmentResults: AssessmentResult[];
  remedials: RemedialRecord[];
  enrichments: EnrichmentRecord[];
  k13Analysis?: K13Analysis;
  k13KKM?: K13KKM;
  learningPlans: LearningPlan[];
  assessmentPlans: AssessmentPlan[];
  assessmentPackages?: AssessmentPackage[];
}

export interface AppStorageState {
  version: number;
  activeProfileId: string;
  activeWorkspaceId?: string;
  /** @deprecated Migration-only legacy field. In v4, active school is strictly derived from activeProfile.schoolId */
  activeSchoolId?: string;
  profiles: TeacherProfile[];
  schools: SchoolData[];
  /** @deprecated Migration-only legacy field. Only read during legacy data migration */
  teacherSchoolAssignments?: TeacherSchoolAssignment[];
  principalHistories?: PrincipalHistory[];
  workspaces: AdministrationWorkspace[];
  academicSettings: AcademicSetting[];
  cps: CPData[];
  cpAnalyses?: CPAnalysisData[];
  tps: TPData[];
  atps: ATPData[];
  documents: AppDocumentRecord[];
  // New scoped collections
  students?: Student[];
  academicCalendars?: AcademicCalendar[];
  effectiveDays?: CalendarDay[];
  timeAllocations?: TimeAllocation[];
  attendanceSessions?: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
  assessmentCriteria?: AssessmentCriterion[];
  assessments?: Assessment[];
  assessmentResults?: AssessmentResult[];
  remedialRecords?: RemedialRecord[];
  enrichmentRecords?: EnrichmentRecord[];
  k13Analyses?: K13Analysis[];
  k13KKMs?: K13KKM[];
  learningPlans?: LearningPlan[];
  assessmentPlans?: AssessmentPlan[];
  assessmentPackages?: AssessmentPackage[];
}

export type AppDataStore = AppStorageState;
export type WorkflowStepId =
  | 'profile'
  | 'academic'
  | 'cp'
  | 'cp-analysis'
  | 'tp'
  | 'atp'
  | 'k13-kd'
  | 'k13-indikator'
  | 'k13-tujuan'
  /** @deprecated legacy compatibility only */
  | 'k13-kkm'
  | 'admin';

export interface WorkflowStepInfo {
  id: WorkflowStepId;
  number: string;
  title: string;
  shortLabel: string;
  description: string;
}

export * from './assessmentGeneration';
export * from './assessmentValidation';
export * from './assessmentRegeneration';
export * from './assessmentExport';
export * from './storageV5';
