import { CurriculumPhase, SchoolLevel } from '../types';
import { MasterCPEntry } from './types';
import { SD_CP_ENTRIES } from './sd';
import { SMP_CP_ENTRIES } from './smp';
import { SMA_CP_ENTRIES } from './sma';
import { findSubjectByNameOrAlias, findSubjectByCode } from '../subjects';

export * from './types';
export { SD_CP_ENTRIES } from './sd';
export { SMP_CP_ENTRIES } from './smp';
export { SMA_CP_ENTRIES } from './sma';

export const ALL_MASTER_CP_ENTRIES: MasterCPEntry[] = [
  ...SD_CP_ENTRIES,
  ...SMP_CP_ENTRIES,
  ...SMA_CP_ENTRIES,
];

export interface ResolveCPOptions {
  subjectCode?: string;
  subjectInput?: string;
  subjectCodeOrName?: string;
  phase: CurriculumPhase;
  academicYear?: string;
  level?: SchoolLevel;
  entriesPool?: MasterCPEntry[];
}

export interface CPResolutionResult {
  cp: MasterCPEntry | null;
  entry?: MasterCPEntry | null;
  status: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
  candidates?: MasterCPEntry[];
  reason?: string;
}

/**
 * Helper to parse starting integer year from academic year string strictly.
 * Format must be YYYY/YYYY where the second year is exactly startYear + 1.
 * Returns null if invalid or format mismatch.
 */
export function parseAcademicYearStart(ay?: string | null): number | null {
  if (!ay || typeof ay !== 'string') return null;
  const match = ay.trim().match(/^(\d{4})\/(\d{4})$/);
  if (!match) return null;
  const startYear = parseInt(match[1], 10);
  const endYear = parseInt(match[2], 10);
  if (endYear !== startYear + 1) return null;
  return startYear;
}

/**
 * Memeriksa apakah suatu tahun ajaran target masuk dalam masa berlaku CP.
 * Menggunakan semantik murni metadata tahun ajaran (implementationFromAcademicYear & implementationUntilAcademicYear)
 * tanpa menurunkan/menebak dari effectiveFrom, effectiveUntil, legalEffectiveDate, atau tanggal kalender sintetis.
 */
export function isCPApplicableForAcademicYear(
  cp: MasterCPEntry,
  targetAcademicYear: string
): boolean {
  const targetYear = parseAcademicYearStart(targetAcademicYear);
  const fromYear = parseAcademicYearStart(cp.implementationFromAcademicYear);

  if (targetYear === null || fromYear === null) {
    return false;
  }

  if (targetYear < fromYear) {
    return false;
  }

  if (cp.implementationUntilAcademicYear) {
    const untilYear = parseAcademicYearStart(cp.implementationUntilAcademicYear);
    if (untilYear === null) {
      return false;
    }
    if (targetYear > untilYear) {
      return false;
    }
  }

  return true;
}

/**
 * Menyelesaikan Capaian Pembelajaran resmi berdasarkan mata pelajaran dan fase.
 * Mencegah pengembalian kandidat pertama saat terjadi ambiguitas (status AMBIGUOUS jika > 1).
 * Mendukung baik pemanggilan dengan positional arguments maupun options object.
 */
export function resolveCPContext(
  subjectOrOptions: string | ResolveCPOptions,
  phaseArg?: CurriculumPhase,
  academicYearArg?: string
): CPResolutionResult {
  let subjectInput = '';
  let phase: CurriculumPhase;
  let academicYear: string | undefined;
  let levelFilter: SchoolLevel | undefined;
  let sourcePool = ALL_MASTER_CP_ENTRIES;

  if (typeof subjectOrOptions === 'object' && subjectOrOptions !== null) {
    subjectInput =
      subjectOrOptions.subjectCode ||
      subjectOrOptions.subjectInput ||
      subjectOrOptions.subjectCodeOrName ||
      '';
    phase = subjectOrOptions.phase;
    academicYear = subjectOrOptions.academicYear;
    levelFilter = subjectOrOptions.level;
    if (subjectOrOptions.entriesPool) {
      sourcePool = subjectOrOptions.entriesPool;
    }
  } else {
    subjectInput = typeof subjectOrOptions === 'string' ? subjectOrOptions : '';
    phase = phaseArg!;
    academicYear = academicYearArg;
  }

  if (!subjectInput || !phase) {
    return {
      cp: null,
      entry: null,
      status: 'UNRESOLVED',
      candidates: [],
      reason: 'Parameter subjectInput atau phase tidak valid/kosong.',
    };
  }

  const subject =
    findSubjectByCode(subjectInput) || findSubjectByNameOrAlias(subjectInput);
  const code = subject ? subject.code : subjectInput.toUpperCase().trim();

  let baseCandidates = sourcePool.filter(
    (cp) => cp.subjectCode === code && cp.phase === phase
  );

  if (levelFilter) {
    baseCandidates = baseCandidates.filter((cp) => cp.level === levelFilter);
  }

  if (baseCandidates.length === 0) {
    return {
      cp: null,
      entry: null,
      status: 'UNRESOLVED',
      candidates: [],
      reason: `Tidak ditemukan Capaian Pembelajaran untuk mata pelajaran ${code} pada Fase ${phase}.`,
    };
  }

  let candidates: MasterCPEntry[] = [];

  if (academicYear) {
    candidates = baseCandidates.filter((cp) => {
      return isCPApplicableForAcademicYear(cp, academicYear);
    });
  } else {
    // Tanpa filter tahun ajaran spesifik: utamakan kandidat yang aktif dan open-ended
    const openEnded = baseCandidates.filter(
      (c) => c.verificationStatus !== 'SUPERSEDED' && !c.implementationUntilAcademicYear
    );
    if (openEnded.length === 1) {
      candidates = openEnded;
    } else if (openEnded.length > 1) {
      candidates = openEnded;
    } else {
      candidates = baseCandidates.filter((c) => c.verificationStatus !== 'SUPERSEDED');
    }
  }

  if (candidates.length === 1) {
    return {
      cp: candidates[0],
      entry: candidates[0],
      status: 'RESOLVED',
      candidates,
    };
  }

  if (candidates.length > 1) {
    return {
      cp: null,
      entry: null,
      status: 'AMBIGUOUS',
      candidates,
      reason: `Ditemukan ${candidates.length} Capaian Pembelajaran aktif untuk ${code} Fase ${phase}. Memerlukan spesifikasi tahun ajaran/regulasi lebih spesifik agar tidak menggunakan first-candidate sembarangan.`,
    };
  }

  return {
    cp: null,
    entry: null,
    status: 'UNRESOLVED',
    candidates: [],
    reason: `Tidak ditemukan Capaian Pembelajaran untuk ${code} Fase ${phase}${academicYear ? ` pada TA ${academicYear}` : ''}.`,
  };
}

/**
 * Cari Capaian Pembelajaran resmi berdasarkan mata pelajaran dan fase (serta tahun ajaran jika tersedia).
 * Mengembalikan undefined jika tidak ditemukan atau jika terdapat ambiguitas (tidak mengembalikan first match sembarangan).
 */
export function findCPBySubjectAndPhase(
  subjectCodeOrName: string,
  phase: CurriculumPhase,
  academicYear?: string
): MasterCPEntry | undefined {
  const res = resolveCPContext(subjectCodeOrName, phase, academicYear);
  return res.status === 'RESOLVED' && res.cp ? res.cp : undefined;
}

/**
 * Ambil seluruh CP resmi berdasarkan jenjang
 */
export function getCPsByLevel(level: SchoolLevel): MasterCPEntry[] {
  return ALL_MASTER_CP_ENTRIES.filter((cp) => cp.level === level);
}
