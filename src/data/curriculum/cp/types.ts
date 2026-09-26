import { CurriculumPhase, CurriculumRuleEvidence, SchoolLevel, VerificationStatus } from '../types';

export interface CPElement {
  name: string;
  content: string;
}

export interface MasterCPEntry {
  id: string;
  subjectCode: string;
  phase: CurriculumPhase;
  level: SchoolLevel;
  generalDescription: string;
  elements: CPElement[];
  regulationSourceId: string;
  evidence?: CurriculumRuleEvidence[];
  implementationFromAcademicYear?: string | null;
  implementationUntilAcademicYear?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  verificationStatus: VerificationStatus;
  notes?: string;
}
