/**
 * TYPES DEFINITION: CURRICULUM MASTER (SD - SMP - SMA)
 *
 * Sesuai Regulasi Resmi:
 * - Permendikbudristek No. 12 Tahun 2024
 * - Permendikdasmen No. 13 Tahun 2025
 * - Keputusan BSKAP No. 032/H/KR/2024
 * - Permendikbud No. 37 Tahun 2018 (K13)
 */

export type RegulationSourceType =
  | 'REGULATION'
  | 'OFFICIAL_DECISION'
  | 'OFFICIAL_GUIDE'
  | 'OFFICIAL_EXAMPLE';

export interface RegulationSource {
  id: string;
  title: string;
  number?: string;
  year: number;
  type: RegulationSourceType;
  authority: string;
  legalEffectiveDate?: string | null;
  implementationFromAcademicYear?: string | null;
  effectiveFrom?: string;
  effectiveUntil?: string;
  sourceUrl: string;
  notes?: string;
}

export interface CurriculumRuleEvidence {
  regulationId: string;
  sourceUrl: string;
  locator?: {
    attachment?: string;
    table?: string;
    page?: number;
    section?: string;
    note?: string;
  };
}

export type EducationLevel = 'SD' | 'SMP' | 'SMA';
export type SchoolLevel = EducationLevel;

export type CurriculumType = 'KURIKULUM_MERDEKA' | 'K13';

export type CurriculumPhase = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type CurriculumSubjectType = 'REQUIRED' | 'ELECTIVE' | 'LOCAL_CONTENT';

export type AllocationMode = 'ANNUAL' | 'WEEKLY_EQUIVALENT';

export type VerificationStatus = 'VERIFIED' | 'UNVERIFIED' | 'SUPERSEDED';

export interface CurriculumSubject {
  code: string;
  name: string;
  aliases?: string[];
  defaultLevel?: EducationLevel;
  notes?: string;
}

export interface CurriculumStructureRule {
  id: string;
  curriculumType: 'KURIKULUM_MERDEKA' | 'K13';
  level: EducationLevel;
  grade: number; // 1..12
  phase?: CurriculumPhase;
  subjectCode: string;
  subjectType: CurriculumSubjectType;

  intrakurikulerAnnualJP: number | null;
  kokurikulerAnnualJP: number | null;
  totalAnnualJP: number | null;

  referenceWeeksPerYear: number | null;
  minutesPerJP: number | null;

  /**
   * Ekuivalensi matematis (REFERENCE_EQUIVALENT): intrakurikulerAnnualJP / referenceWeeksPerYear.
   * Bukan klaim jadwal mingguan aktual yang mengikat sekolah.
   */
  derivedWeeklyJP: number | null;
  allocationMode?: AllocationMode;

  selectionGroup?: string;
  selectionGroupRequired?: boolean;
  minSelections?: number;
  maxSelections?: number;

  regulationIds: string[];
  evidence?: CurriculumRuleEvidence[];

  effectiveFrom?: string;
  effectiveUntil?: string;
  implementationFromAcademicYear?: string;

  verificationStatus: VerificationStatus;

  notes?: string;

  // Compatibility fields for legacy consumers
  subject?: string;
  gradeLabel?: string;
  phaseLabel?: string;
  weeklyJP?: number | null;
  annualJP?: number | null;
  kokurikulerJP?: number | null;
  regulation?: string;
  regulationYear?: number;
  source?: string;
  sourceUrl?: string;
}

export interface CurriculumCPEntry {
  id: string;
  subjectCode: string;
  level: EducationLevel;
  phase: CurriculumPhase;
  grades: number[];
  title: string;
  generalDescription?: string;
  elements?: Array<{
    name: string;
    content: string;
  }>;
  regulationIds: string[];
  evidence?: CurriculumRuleEvidence[];
  implementationFromAcademicYear?: string | null;
  implementationUntilAcademicYear?: string | null;
  verificationStatus: VerificationStatus;
  notes?: string;
}

export interface CurriculumContextQuery {
  curriculumType?: 'KURIKULUM_MERDEKA' | 'K13' | string;
  academicYear?: string;
  level?: EducationLevel | string;
  grade?: number | string;
  subjectCode?: string;
  subjectName?: string;
}

export interface ResolvedCurriculumContext {
  level: EducationLevel;
  grade: number;
  phase: CurriculumPhase;

  subject: CurriculumSubject | null;
  structureRule: CurriculumStructureRule | null;
  rule: CurriculumStructureRule | null;

  regulationSources: RegulationSource[];

  verificationStatus: VerificationStatus;

  intrakurikulerAnnualJP: number | null;
  kokurikulerAnnualJP: number | null;
  totalAnnualJP: number | null;

  referenceWeeksPerYear: number | null;
  minutesPerJP: number | null;

  derivedWeeklyJP: number | null;
  allocationMode?: AllocationMode;
  actualAvailableAnnualJP?: number | null;
  actualEffectiveWeeks?: number | null;
  actualWeeksProvenance?: 'CALENDAR' | 'MANUAL_VALIDATED';
  isElective?: boolean;
  effectivePhase?: CurriculumPhase;

  isOfficial: boolean;
  explanation: string;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

export interface ValidationIssue {
  severity: 'ERROR' | 'WARNING';
  ruleId?: string;
  field?: string;
  message: string;
}

export interface ValidationSummary {
  valid: boolean;
  totalRules: number;
  verifiedRules: number;
  unverifiedRules: number;
  supersededRules: number;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
