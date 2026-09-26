export type CurriculumType = 'KURIKULUM_MERDEKA' | 'K13';
export type DocumentMode = 'data' | 'blank';

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

export interface AdministrationWorkspace {
  id: string;
  profileId: string;
  schoolId: string;
  academicSettingId: string;
  name: string; // e.g. "PJOK — Kelas 1 — Semester 1 — 2026/2027"
  createdAt: string;
  updatedAt: string;
}

export interface AcademicSetting {
  id: string;
  profileId: string;
  curriculum: string; // e.g. "Kurikulum Merdeka" or "Kurikulum 2013"
  curriculumType?: CurriculumType;
  academicYear: string; // e.g. "2025/2026"
  semester: '1 (Ganjil)' | '2 (Genap)';
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
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

export type CPVerificationStatus = 'verified' | 'unverified' | 'local_reference';

export interface CPSource {
  title: string;
  institution: string;
  documentYear?: string;
  url?: string;
  page?: string;
  retrievedAt: string;
  verificationStatus: CPVerificationStatus;
}

export interface CPElem {
  id: string;
  name: string; // e.g. "Menyimak", "Membaca dan Memirsa", "Berbicara dan Mempresentasikan", "Menulis"
  content: string;
}

export interface CPData {
  id: string;
  academicSettingId: string;
  generalDescription: string;
  elements: CPElem[];
  source?: CPSource;
  aiNotes?: string;
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
  generalSummary?: string;
  items: CPAnalysisItem[];
  sourceCPVersion?: string;
  basedOnCpUpdatedAt?: string;
  revision?: number;
  status?: 'DRAFT' | 'FINAL';
  provenance?: DataProvenance;
  updatedAt: string;
}

export interface TPItem {
  id: string;
  code: string; // e.g. "TP 1.1", "TP 4.1"
  cpAnalysisId?: string; // Lineage reference to CPAnalysisItem.id
  elementName?: string;
  statement: string; // Pernyataan Tujuan Pembelajaran
  competence: string; // Kompetensi / KKO yang dituju (misal: "Menganalisis", "Menjelaskan")
  contentScope: string; // Lingkup Materi / Konsep Inti
  p3Dimensions: string[]; // Dimensi Profil Pelajar Pancasila
  order: number;
  sequence?: number;
  status?: 'DRAFT' | 'FINAL';
  provenance?: DataProvenance;
}

export interface TPData {
  id: string;
  academicSettingId: string;
  workspaceId?: string;
  items: TPItem[];
  basedOnCpUpdatedAt?: string;
  basedOnAnalysisUpdatedAt?: string;
  sourceAnalysisRevision?: number;
  revision?: number;
  status?: 'DRAFT' | 'FINAL';
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
  jp?: number; // Compatibility field
  semester?: 1 | 2 | null;
  p3Dimensions?: string[]; // Profil Pelajar Pancasila
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
  rationale?: string; // Rasionalisasi Alur Pembelajaran
  items: ATPItem[];
  totalJP?: number;
  basedOnTpUpdatedAt?: string;
  sourceTpRevision?: number;
  revision?: number;
  status?: 'DRAFT' | 'FINAL';
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
export type CalendarSourceType = 'REGIONAL_CALENDAR' | 'SCHOOL_CALENDAR' | 'MANUAL';

export interface AcademicCalendar {
  id: string;
  academicSettingId: string;
  academicYear: string;
  semester: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  schoolDaysPerWeek: number; // 5 atau 6 hari sekolah per minggu
  sourceType?: CalendarSourceType;
  sourceName?: string;
  sourceUrl?: string;
  /** @deprecated Compatibility alias. Prefer setting.subjectWeeklyJP */
  jpPerWeek?: number;
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
}

export interface TimeAllocation {
  id: string;
  academicSettingId: string;
  sourceType?: 'ATP_ITEM' | 'TP' | 'KD' | 'K13_OBJECTIVE' | 'ASSESSMENT' | 'RESERVE' | 'LEGACY' | 'UNKNOWN';
  sourceId?: string;
  tpId?: string;
  atpItemId?: string;
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
  level: string; // "Perlu Bimbingan", "Cukup", "Baik", "Sangat Baik"
  label: string;
  description: string;
  scoreRange?: string; // "0 - 65", "66 - 75", "76 - 85", "86 - 100"
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
  passingThreshold?: number | null; // Nilai KKM/Interval minimum tercapai jika dipilih
  notes?: string;
  sourceTpRevision?: number;
  basedOnTpUpdatedAt?: string;
  provenance?: DataProvenance;
  updatedAt: string;
}

// ==========================================
// MODEL GENERIK PERENCANAAN PEMBELAJARAN
// (Permendikbudristek 12/2024 & Permendikdasmen 13/2025)
// ==========================================
export interface LearningPlanObjective {
  id: string;
  code?: string;
  statement: string;
  materialScope?: string;
}

export interface LearningPlanStep {
  stepName: 'Pendahuluan' | 'Kegiatan Inti' | 'Penutup' | string;
  durationMinutes?: number;
  description: string;
}

export interface LearningPlanAssessment {
  technique: string; // e.g. "Tes Tertulis", "Kinerja", "Observasi"
  instrument: string; // e.g. "Rubrik", "Daftar Cek", "Soal Uraian"
  type: 'formatif' | 'sumatif' | 'diagnostik' | string;
}

/**
 * Model generik internal perencanaan pembelajaran.
 * Komponen minimal sesuai regulasi:
 * 1. Tujuan Pembelajaran
 * 2. Langkah/Kegiatan Pembelajaran
 * 3. Asesmen / Rencana Penilaian
 */
export interface LearningPlan {
  id: string;
  academicSettingId: string;
  curriculumType: CurriculumType;
  title: string;
  objectives: LearningPlanObjective[];
  learningSteps: LearningPlanStep[];
  assessmentPlan: LearningPlanAssessment[];
  materials?: string[];
  resources?: string[];
  differentiation?: {
    content?: string;
    process?: string;
    product?: string;
  };
  reflection?: {
    teacherReflection?: string;
    studentReflection?: string;
  };
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
  profile: TeacherProfile;
  school: SchoolData;
  workspace: AdministrationWorkspace;
  academicSetting: AcademicSetting;
  context: ActiveContext;
  cp: CPData;
  cpAnalysis?: CPAnalysisData;
  tp: TPData;
  atp: ATPData;
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
