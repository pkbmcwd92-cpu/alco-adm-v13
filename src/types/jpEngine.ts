import { CurriculumType } from './index';

export type JPVerificationStatus = 'VERIFIED' | 'UNVERIFIED';
export type JPSourceType = 'OFFICIAL' | 'USER_OVERRIDE' | 'UNVERIFIED' | 'LEGACY_VALUE';

/**
 * Metadata Sumber Regulasi Resmi
 */
export interface RegulatorySource {
  id: string;
  title: string;
  regulationNumber?: string;
  year?: number;
  sourceUrl?: string;
  verifiedAt?: string;
  description?: string;
}

/**
 * Model Master Struktur Kurikulum Resmi Pemerintah (Permendikbudristek 12/2024 jo Permendikdasmen 13/2025 & Permendikbud 37/2018)
 */
export interface CurriculumStructureRule {
  id: string;
  curriculumType: 'KURIKULUM_MERDEKA' | 'K13';
  level: string; // 'PAUD' | 'SD' | 'SMP' | 'SMA' | 'SMK'
  phase?: string; // e.g. "Fase A", "Fase D", "Fase E"
  grade: string; // e.g. "Kelas 1", "Kelas 7", "Kelas 10"
  subject: string; // e.g. "Pendidikan Pancasila", "Bahasa Indonesia", "PJOK"

  intrakurikulerWeeklyJP?: number; // JP Intrakurikuler Mapel per Minggu
  intrakurikulerAnnualJP?: number; // JP Intrakurikuler Mapel per Tahun
  kokurikulerAnnualJP?: number; // JP Kokurikuler / P5 per Tahun
  totalAnnualJP?: number; // Total Tahunan (Intrakurikuler + Kokurikuler)

  regulation: string; // e.g. "Permendikbudristek No. 12 Tahun 2024 jo Permendikdasmen No. 13 Tahun 2025"
  regulationYear: number;
  source: string; // e.g. "BSKAP Kemendikdasmen RI"
  sourceUrl?: string;
  effectiveFrom?: string; // YYYY-MM-DD
  effectiveUntil?: string; // YYYY-MM-DD
  verificationStatus: 'VERIFIED' | 'UNVERIFIED';
  notes?: string;

  /** @deprecated Compatibility alias. Use intrakurikulerWeeklyJP */
  weeklyJP?: number;
  /** @deprecated Compatibility alias. Use intrakurikulerAnnualJP */
  annualJP?: number;
  /** @deprecated Compatibility alias. Use kokurikulerAnnualJP */
  kokurikulerJP?: number;
  /** @deprecated Compatibility alias. Use curriculumType */
  curriculum?: string;
}

/** @deprecated Compatibility alias for CurriculumStructureRule */
export type MasterCurriculumStructure = CurriculumStructureRule;

/**
 * Parameter Query Pencarian JP Mata Pelajaran
 */
export interface SubjectJPQuery {
  curriculum?: string;
  curriculumType?: CurriculumType;
  level?: string;
  grade?: string;
  subject?: string;
  academicYear?: string;
}

/**
 * Hasil Lookup JP Mata Pelajaran
 */
export interface SubjectJPResult {
  weeklyJP: number | null;
  intrakurikulerWeeklyJP?: number | null;
  intrakurikulerAnnualJP?: number;
  kokurikulerAnnualJP?: number;
  totalAnnualJP?: number;
  isOfficial: boolean;
  verificationStatus: JPVerificationStatus;
  statusLabel: string; // "Terverifikasi Resmi" | "Belum diverifikasi" | "Override Manual"
  sourceType: JPSourceType;
  regulation?: string;
  regulationYear?: number;
  source?: string;
  sourceUrl?: string;
  effectiveFrom?: string;
  curriculumType?: CurriculumType;
  matchedRule?: CurriculumStructureRule;
  explanation: string;

  /** @deprecated Compatibility alias for intrakurikulerAnnualJP */
  annualJP?: number;
  /** @deprecated Compatibility alias for kokurikulerAnnualJP */
  kokurikulerJP?: number;
}

/**
 * Penugasan Mengajar Guru per Rombel / Kelas
 */
export interface TeachingAssignment {
  id?: string;
  subject: string;
  level: 'PAUD' | 'SD' | 'SMP' | 'SMA' | 'SMK' | string;
  grade: string; // e.g. "Kelas 4A", "Kelas 7B"
  curriculum?: string;
  weeklyJP: number; // JP per minggu per rombel dari struktur kurikulum (atau override resmi)
  classCount: number; // Jumlah rombel kelas (default 1)
  isCertifiedSubject?: boolean; // Linier dengan sertifikat pendidik
  notes?: string;
}

/**
 * Tugas Tambahan Guru dan Ekuivalensi Beban Mengajarnya (Permendikdasmen No. 11 Tahun 2025)
 */
export interface AdditionalDuty {
  id?: string;
  role: string; // e.g. "Wakil Kepala Sekolah", "Wali Kelas", "Kepala Perpustakaan", "Pembina OSIS/Ekskul", "Koordinator P5"
  equivalentWeeklyJP: number; // Ekuivalensi JP per minggu
  decreeNumber?: string; // Nomor SK Penugasan
  notes?: string;
}

/**
 * Hasil Validasi Beban Mengajar Guru (Permendikdasmen No. 11 Tahun 2025)
 */
export interface TeacherLoadValidationResult {
  teacherName?: string;
  totalDirectTeachingJP: number; // Total JP tatap muka riil (Σ classCount × weeklyJP)
  totalAdditionalDutiesJP: number; // Total JP tugas tambahan
  totalWorkloadJP: number; // Total Beban Pembelajaran Guru (tatap muka + tugas tambahan)
  minimumRequirementJP: number; // Standar minimal: 24 JP/minggu
  maximumRequirementJP: number; // Standar maksimal: 40 JP/minggu
  isMinimumFulfilled: boolean; // totalWorkloadJP >= 24
  isWithinMaximum: boolean; // totalWorkloadJP <= 40
  status: 'BELUM_MEMENUHI' | 'MEMENUHI' | 'MELEBIHI_BATAS_MAKSIMAL';
  statusLabel: string;
  statusDescription: string;
  breakdown: {
    assignments: Array<{
      subject: string;
      grade: string;
      weeklyJP: number;
      classCount: number;
      subtotalJP: number;
    }>;
    additionalDuties: Array<{
      role: string;
      equivalentWeeklyJP: number;
      decreeNumber?: string;
    }>;
  };
  regulatoryBasis: string; // "Permendikdasmen Nomor 11 Tahun 2025 tentang Pemenuhan Beban Kerja Guru"
}

/**
 * Status Kanonikal Hari Kalender Akademik
 */
export type CanonicalDayStatus =
  | 'EFFECTIVE_LEARNING'
  | 'HOLIDAY'
  | 'SCHOOL_EVENT'
  | 'ASSESSMENT'
  | 'BREAK'
  | 'NON_LEARNING'
  | 'UNKNOWN';

/**
 * Hasil Validasi Kelengkapan Kalender Akademik
 */
export interface CalendarCompletenessResult {
  complete: boolean;
  missingScheduledDates: string[];
  totalScheduledDays: number;
  recordedScheduledDays: number;
  diagnostic?: string;
}

/**
 * Hasil Perhitungan Hari Efektif Kalender
 */
export interface EffectiveDayResult {
  status?: 'RESOLVED' | 'UNRESOLVED' | 'PARTIAL';
  totalCalendarDays: number;
  scheduledSchoolDays: number;
  effectiveLearningDays: number;
  holidayDays: number;
  schoolEventDays: number;
  assessmentDays: number;
  nonLearningDays: number;
  unknownDays?: number;
  completeness?: CalendarCompletenessResult;
  breakdown: {
    holidays: Array<{ date: string; notes?: string }>;
    events: Array<{ date: string; notes?: string }>;
    assessments: Array<{ date: string; notes?: string }>;
    nonLearning: Array<{ date: string; notes?: string }>;
    unknown?: Array<{ date: string; notes?: string }>;
  };
  monthlyBreakdown?: Array<{
    monthName: string;
    effectiveDays: number;
    effectiveWeeks: number;
  }>;
}

/**
 * Hasil Perhitungan Minggu Efektif Ekuivalen
 */
export interface EffectiveWeeksResult {
  status: 'RESOLVED' | 'UNRESOLVED';
  effectiveWeeksEquivalent: number | null;
  effectiveWeeksRounded: number | null;
  unresolvedReason?: string;
}

/**
 * Hasil Perhitungan JP Tersedia
 */
export interface AvailableJPResult {
  status?: 'RESOLVED' | 'UNRESOLVED';
  subjectWeeklyJP?: number | null;
  effectiveLearningDays?: number | null;
  schoolDaysPerWeek?: number | null;
  effectiveWeeksEquivalent?: number | null;
  effectiveWeeksRounded?: number | null;
  availableJP: number | null;
  formula: string;
  formulaCalculation: string;
  isCapacityExceeded?: boolean;
  capacityWarning?: string;
  officialAnnualJP?: number;
  unresolvedReason?: string;
  details?: {
    semester?: string;
    academicYear?: string;
    level?: string;
    grade?: string;
    subject?: string;
  };

  /** @deprecated Compatibility alias */
  jpPerWeek?: number | null;
  /** @deprecated Compatibility alias */
  effectiveWeeks?: number | null;
}

/** @deprecated Compatibility alias for AvailableJPResult */
export type AvailableJPCalculation = AvailableJPResult;

export type TimeAllocationSourceType =
  | 'ATP_ITEM'
  | 'TP'
  | 'KD'
  | 'K13_OBJECTIVE'
  | 'ASSESSMENT'
  | 'RESERVE'
  | 'LEGACY'
  | 'UNKNOWN';

/**
 * Model Shared Distribusi Alokasi Waktu Pembelajaran (Merdeka & K13)
 */
export interface LearningTimeAllocation {
  id: string;
  academicSettingId: string;
  sourceType: TimeAllocationSourceType;
  sourceId: string;
  semester: '1' | '2' | string;
  allocatedJP: number;
  startWeek?: number;
  endWeek?: number;
  month?: number; // 1 to 6 (Bulan ke-n pada semester)
  monthName?: string; // "Juli", "Agustus", dsb.
  notes?: string;

  /** @deprecated Compatibility alias */
  tpId?: string;
  /** @deprecated Compatibility alias */
  atpItemId?: string;
  /** @deprecated Compatibility alias */
  weekNumber?: number;
  /** @deprecated Compatibility alias */
  jp?: number;
}

export type TimeAllocationStatus = 'UNDER_ALLOCATED' | 'BALANCED' | 'OVER_ALLOCATED';

export interface TimeAllocationValidationResult {
  availableJP: number;
  totalAllocatedJP: number;
  remainingJP: number; // Sisa JP Belum Dialokasikan (positif jika under, negatif jika over)
  status: TimeAllocationStatus;
  statusLabel: string;
  statusDescription: string;
  allocationsCount: number;
}

export interface EffectiveWeekInfo {
  weekIndex: number;
  startDate: string;
  endDate: string;
  effectiveDaysCount: number;
  month: number;
  year: number;
}

