import { AcademicSetting, CurriculumType } from '../types';
import { getCurriculumTypeFromSetting } from './curriculumRouter';
import {
  GRADE_PHASE_MAP,
  getPhaseFromGrade,
} from '../data/curriculumDefaults';

export interface AcademicSettingReadinessResult {
  valid: boolean;
  curriculumType?: CurriculumType;
  errors: string[];
}

export interface AcademicSettingReadinessOptions {
  requireSemester?: boolean;
}

/**
 * Validates whether an AcademicSetting meets the requirements for the Kurikulum Merdeka
 * annual workflow (YearPlan -> CP -> Analisis CP -> TP -> ATP).
 * Semester is NOT an annual readiness requirement.
 *
 * Required:
 * - curriculum = KURIKULUM_MERDEKA
 * - valid academicYear (YYYY/YYYY sequential)
 * - valid canonical level (SD, SMP, SMA)
 * - valid grade compatible with level
 * - derived phase from grade & level
 * - non-empty subject
 *
 * NOT required:
 * - semester (must be valid when semester === '' or undefined)
 */
export function validateAnnualMerdekaSettingReadiness(
  setting?: AcademicSetting | null
): AcademicSettingReadinessResult {
  const errors: string[] = [];
  if (!setting) {
    return {
      valid: false,
      errors: ['Data Pembelajaran belum diisi.'],
    };
  }

  const curriculumType = getCurriculumTypeFromSetting(setting);
  if (!curriculumType || curriculumType !== 'KURIKULUM_MERDEKA') {
    errors.push('Kurikulum Merdeka diperlukan untuk alur administrasi tahunan.');
  }

  const rawAcademicYear = (setting.academicYear || '').trim();
  const yearMatch = rawAcademicYear.match(/^(\d{4})\/(\d{4})$/);
  if (!yearMatch) {
    errors.push('Tahun ajaran harus menggunakan format YYYY/YYYY yang berurutan.');
  } else {
    const firstYear = parseInt(yearMatch[1], 10);
    const secondYear = parseInt(yearMatch[2], 10);
    if (secondYear !== firstYear + 1) {
      errors.push('Tahun ajaran harus menggunakan format YYYY/YYYY yang berurutan.');
    }
  }

  // Invariant: Semester is NOT required for annual Merdeka workflow.
  // semester === '' or undefined is strictly valid.
  // If explicitly provided and non-empty, ensure it's not a corrupt value.
  const rawSemester = (setting.semester || '').trim();
  if (rawSemester && rawSemester !== '1 (Ganjil)' && rawSemester !== '2 (Genap)') {
    errors.push('Pilih semester yang valid (1 (Ganjil) atau 2 (Genap)).');
  }

  const rawLevel = (setting.level || '').trim();
  const canonicalLevels = ['SD', 'SMP', 'SMA'];
  let isLevelValid = false;
  if (!rawLevel) {
    errors.push('Pilih jenjang pendidikan terlebih dahulu.');
  } else if (rawLevel === 'SMK') {
    errors.push('Jenjang SMK saat ini belum didukung dalam resolusi kurikulum standar.');
  } else if (!canonicalLevels.includes(rawLevel)) {
    errors.push('Pilih jenjang pendidikan yang valid (SD, SMP, atau SMA).');
  } else {
    isLevelValid = true;
  }

  const rawGrade = (setting.grade || '').trim();
  if (!rawGrade) {
    errors.push('Pilih tingkat/kelas terlebih dahulu.');
  } else if (isLevelValid) {
    const levelGrades = GRADE_PHASE_MAP[rawLevel];
    const isGradeValidForLevel = levelGrades && levelGrades.some((g) => g.grade === rawGrade);
    if (!isGradeValidForLevel) {
      errors.push(`Tingkat/kelas '${rawGrade}' tidak valid untuk jenjang ${rawLevel}.`);
    }
  } else {
    errors.push(`Tingkat/kelas '${rawGrade}' tidak valid karena jenjang belum valid.`);
  }

  if (curriculumType === 'KURIKULUM_MERDEKA' && isLevelValid && rawGrade) {
    const derivedPhase = getPhaseFromGrade(rawLevel, rawGrade);
    if (!derivedPhase || !derivedPhase.trim()) {
      errors.push('Fase pembelajaran tidak dapat ditentukan untuk jenjang dan kelas ini.');
    }
  }

  const rawSubject = (setting.subject || '').trim();
  if (!rawSubject) {
    errors.push('Mata pelajaran tidak boleh kosong.');
  }

  return {
    valid: errors.length === 0,
    curriculumType: errors.length === 0 ? curriculumType : undefined,
    errors,
  };
}

/**
 * Validates whether an AcademicSetting has all mandatory fields completed and resolved.
 * Must be resolved to either 'K13' or 'KURIKULUM_MERDEKA'. Unknown/unsupported are invalid.
 *
 * For Kurikulum Merdeka annual workflow:
 * - semester is NOT required (semester === '' is valid).
 * For legacy / K13 or when requireSemester is explicitly requested:
 * - semester must be strictly '1 (Ganjil)' or '2 (Genap)'.
 */
export function validateAcademicSettingReadiness(
  setting?: AcademicSetting | null,
  options?: AcademicSettingReadinessOptions
): AcademicSettingReadinessResult {
  const errors: string[] = [];
  if (!setting) {
    return {
      valid: false,
      errors: ['Data Pembelajaran belum diisi.'],
    };
  }

  const curriculumType = getCurriculumTypeFromSetting(setting);
  if (!curriculumType || (curriculumType !== 'K13' && curriculumType !== 'KURIKULUM_MERDEKA')) {
    errors.push('Pilih kurikulum terlebih dahulu.');
  }

  const rawAcademicYear = (setting.academicYear || '').trim();
  const yearMatch = rawAcademicYear.match(/^(\d{4})\/(\d{4})$/);
  if (!yearMatch) {
    errors.push('Tahun ajaran harus menggunakan format YYYY/YYYY yang berurutan.');
  } else {
    const firstYear = parseInt(yearMatch[1], 10);
    const secondYear = parseInt(yearMatch[2], 10);
    if (secondYear !== firstYear + 1) {
      errors.push('Tahun ajaran harus menggunakan format YYYY/YYYY yang berurutan.');
    }
  }

  const rawSemester = (setting.semester || '').trim();
  const requireSemester = options?.requireSemester ?? (curriculumType === 'K13');
  if (requireSemester) {
    if (rawSemester !== '1 (Ganjil)' && rawSemester !== '2 (Genap)') {
      errors.push('Pilih semester yang valid (1 (Ganjil) atau 2 (Genap)).');
    }
  } else if (rawSemester && rawSemester !== '1 (Ganjil)' && rawSemester !== '2 (Genap)') {
    errors.push('Pilih semester yang valid (1 (Ganjil) atau 2 (Genap)).');
  }

  const rawLevel = (setting.level || '').trim();
  const canonicalLevels = ['SD', 'SMP', 'SMA'];
  let isLevelValid = false;
  if (!rawLevel) {
    errors.push('Pilih jenjang pendidikan terlebih dahulu.');
  } else if (rawLevel === 'SMK') {
    errors.push('Jenjang SMK saat ini belum didukung dalam resolusi kurikulum standar.');
  } else if (!canonicalLevels.includes(rawLevel)) {
    errors.push('Pilih jenjang pendidikan yang valid (SD, SMP, atau SMA).');
  } else {
    isLevelValid = true;
  }

  const rawGrade = (setting.grade || '').trim();
  if (!rawGrade) {
    errors.push('Pilih tingkat/kelas terlebih dahulu.');
  } else if (isLevelValid) {
    const levelGrades = GRADE_PHASE_MAP[rawLevel];
    const isGradeValidForLevel = levelGrades && levelGrades.some((g) => g.grade === rawGrade);
    if (!isGradeValidForLevel) {
      errors.push(`Tingkat/kelas '${rawGrade}' tidak valid untuk jenjang ${rawLevel}.`);
    }
  } else if (rawLevel === 'SMK') {
    const levelGrades = GRADE_PHASE_MAP['SMK'];
    const isGradeValidForLevel = levelGrades && levelGrades.some((g) => g.grade === rawGrade);
    if (!isGradeValidForLevel) {
      errors.push(`Tingkat/kelas '${rawGrade}' tidak valid untuk jenjang SMK.`);
    }
  } else {
    errors.push(`Tingkat/kelas '${rawGrade}' tidak valid karena jenjang belum valid.`);
  }

  if (curriculumType === 'KURIKULUM_MERDEKA' && isLevelValid && rawGrade) {
    const derivedPhase = getPhaseFromGrade(rawLevel, rawGrade);
    if (!derivedPhase || !derivedPhase.trim()) {
      errors.push('Fase pembelajaran tidak dapat ditentukan untuk jenjang dan kelas ini.');
    }
  }

  const rawSubject = (setting.subject || '').trim();
  if (!rawSubject) {
    errors.push('Mata pelajaran tidak boleh kosong.');
  }

  return {
    valid: errors.length === 0,
    curriculumType: errors.length === 0 ? curriculumType : undefined,
    errors,
  };
}

/**
 * Legacy semester-aware validator that strictly requires a semester
 * for all curriculum types, preserved for legacy/K13 compatibility.
 */
export function validateLegacyAcademicSettingReadiness(
  setting?: AcademicSetting | null
): AcademicSettingReadinessResult {
  return validateAcademicSettingReadiness(setting, { requireSemester: true });
}
