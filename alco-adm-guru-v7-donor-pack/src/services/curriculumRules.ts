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
  weeklyJP: number;
  annualJP?: number;
  isOfficial: boolean;
  regulationReference?: string;
  curriculumType: CurriculumType;
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
  curriculum: string,
  level: string = 'SD',
  grade: string = 'Kelas 1',
  subject: string = 'Bahasa Indonesia'
): JPRuleLookupResult {
  const result = getSubjectJP({
    curriculum,
    level,
    grade,
    subject,
  });

  return {
    weeklyJP: result.weeklyJP ?? 0,
    annualJP: result.annualJP,
    isOfficial: result.isOfficial,
    regulationReference: result.isOfficial ? result.regulation : undefined,
    curriculumType: result.curriculumType,
  };
}

/**
 * Normalizes curriculum string or type to canonical CurriculumType
 */
export function getCurriculumType(curriculum?: string, curriculumType?: CurriculumType): CurriculumType {
  if (curriculumType === 'K13' || curriculumType === 'KURIKULUM_MERDEKA') {
    return curriculumType;
  }
  const curr = (curriculum || '').toLowerCase();
  if (curr.includes('k13') || curr.includes('2013')) {
    return 'K13';
  }
  return 'KURIKULUM_MERDEKA';
}


