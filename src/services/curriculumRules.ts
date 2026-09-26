import { CurriculumType } from '../types';
import { getSubjectJP, MASTER_CURRICULUM_STRUCTURE } from './jpEngine';

export * from './jpEngine';

export interface OfficialJPRule {
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  grade: string;
  subject: string;
  weeklyJP: number;
  annualJP?: number;
  regulationReference: string;
  curriculumType: CurriculumType;
}

export interface JPRuleLookupResult {
  weeklyJP: number | null;
  annualJP?: number;
  isOfficial: boolean;
  regulationReference?: string;
  curriculumType?: CurriculumType;
}

/**
 * Standard Official Structure of Curriculum for Indonesia (Backwards-compatible view)
 */
export const OFFICIAL_JP_DATABASE: OfficialJPRule[] = MASTER_CURRICULUM_STRUCTURE.map((item) => ({
  level: item.level as 'SD' | 'SMP' | 'SMA' | 'SMK',
  grade: item.grade,
  subject: item.subject,
  weeklyJP: item.intrakurikulerWeeklyJP ?? item.weeklyJP ?? 0,
  annualJP: item.intrakurikulerAnnualJP ?? item.annualJP,
  regulationReference: item.regulation,
  curriculumType: item.curriculumType,
}));

/**
 * Looks up official weekly hours per week (JP) based on level, grade, subject, and curriculum.
 * Delegates to centralized getSubjectJP in jpEngine.ts.
 */
export function lookupOfficialWeeklyJP(
  curriculum?: string,
  level?: string,
  grade?: string,
  subject?: string
): JPRuleLookupResult {
  if (!curriculum || !level || !grade || !subject) {
    return {
      weeklyJP: null,
      annualJP: undefined,
      isOfficial: false,
      regulationReference: undefined,
      curriculumType: undefined,
    };
  }

  const result = getSubjectJP({
    curriculum,
    level,
    grade,
    subject,
  });

  return {
    weeklyJP: result.weeklyJP ?? null,
    annualJP: result.annualJP,
    isOfficial: result.isOfficial,
    regulationReference: result.isOfficial ? result.regulation : undefined,
    curriculumType: result.curriculumType,
  };
}

/**
 * Normalizes curriculum string or type to canonical CurriculumType
 */
export function getCurriculumType(curriculum?: string, curriculumType?: CurriculumType): CurriculumType | undefined {
  if (curriculumType === 'K13' || curriculumType === 'KURIKULUM_MERDEKA') {
    return curriculumType;
  }
  const curr = (curriculum || '').toLowerCase();
  if (curr.includes('k13') || curr.includes('2013') || curr.includes('k-13') || curr.includes('k 13')) {
    return 'K13';
  }
  if (curr.includes('merdeka')) {
    return 'KURIKULUM_MERDEKA';
  }
  return undefined;
}


