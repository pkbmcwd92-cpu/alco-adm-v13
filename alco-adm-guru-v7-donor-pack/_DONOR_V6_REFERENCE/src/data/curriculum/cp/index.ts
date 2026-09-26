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
  phase?: CurriculumPhase | string;
  academicYear?: string;
  curriculumType?: string;
  level?: SchoolLevel;
  grade?: number | string;
  entriesPool?: MasterCPEntry[];
}

export interface CPResolutionResult {
  cp: MasterCPEntry | null;
  entry?: MasterCPEntry | null;
  status: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS';
  candidates?: MasterCPEntry[];
  reason?: string;
}

export function derivePhaseFromGrade(grade: number | string): CurriculumPhase | undefined {
  const gNum = typeof grade === 'number' ? grade : parseInt(String(grade).replace(/\D/g, ''), 10);
  if (isNaN(gNum)) return undefined;
  if (gNum === 1 || gNum === 2) return 'A';
  if (gNum === 3 || gNum === 4) return 'B';
  if (gNum === 5 || gNum === 6) return 'C';
  if (gNum >= 7 && gNum <= 9) return 'D';
  if (gNum === 10) return 'E';
  if (gNum === 11 || gNum === 12) return 'F';
  return undefined;
}

function cleanPhase(p?: string): CurriculumPhase | undefined {
  if (!p) return undefined;
  const upper = p.trim().toUpperCase();
  if (upper === 'A' || upper === 'FASE A') return 'A';
  if (upper === 'B' || upper === 'FASE B') return 'B';
  if (upper === 'C' || upper === 'FASE C') return 'C';
  if (upper === 'D' || upper === 'FASE D') return 'D';
  if (upper === 'E' || upper === 'FASE E') return 'E';
  if (upper === 'F' || upper === 'FASE F') return 'F';
  return undefined;
}

/**
 * Menyelesaikan Capaian Pembelajaran resmi berdasarkan mata pelajaran, fase/kelas, dan tahun ajaran.
 * Mencegah pengembalian kandidat pertama saat terjadi ambiguitas (status AMBIGUOUS jika > 1).
 * Mendukung pemanggilan dengan options object maupun positional arguments.
 */
export function resolveCPContext(
  subjectOrOptions: string | ResolveCPOptions,
  phaseArg?: CurriculumPhase | string,
  academicYearArg?: string
): CPResolutionResult {
  let subjectInput = '';
  let phase: CurriculumPhase | undefined;
  let academicYear: string | undefined;
  let levelFilter: SchoolLevel | undefined;
  let sourcePool = ALL_MASTER_CP_ENTRIES;

  if (typeof subjectOrOptions === 'object' && subjectOrOptions !== null) {
    subjectInput =
      subjectOrOptions.subjectCode ||
      subjectOrOptions.subjectInput ||
      subjectOrOptions.subjectCodeOrName ||
      '';
    phase = cleanPhase(subjectOrOptions.phase as string);
    if (!phase && subjectOrOptions.grade !== undefined) {
      phase = derivePhaseFromGrade(subjectOrOptions.grade);
    }
    academicYear = subjectOrOptions.academicYear;
    levelFilter = subjectOrOptions.level;
    if (subjectOrOptions.entriesPool) {
      sourcePool = subjectOrOptions.entriesPool;
    }
  } else {
    subjectInput = typeof subjectOrOptions === 'string' ? subjectOrOptions : '';
    phase = cleanPhase(phaseArg);
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
    const yearMatch = academicYear.match(/\d{4}/);
    const startYear = yearMatch ? parseInt(yearMatch[0], 10) : null;
    if (startYear) {
      const yearDate = `${startYear}-07-01`;
      candidates = baseCandidates.filter((cp) => {
        const from = cp.effectiveFrom || '1970-01-01';
        const until = cp.effectiveUntil || '9999-12-31';

        // 1. Cek kesesuaian rentang tanggal berlaku
        const inDateRange = from <= yearDate && yearDate <= until;
        if (inDateRange) {
          return true;
        }

        // 2. Jika tidak ada batasan tanggal eksplisit, gunakan implementationFromAcademicYear
        if (!cp.effectiveFrom && !cp.effectiveUntil && cp.implementationFromAcademicYear) {
          return cp.implementationFromAcademicYear === academicYear;
        }

        return false;
      });
    }
  } else {
    // Tanpa filter tahun ajaran spesifik: hanya ambil kandidat yang aktif saat ini (tidak superseded dan belum kedaluwarsa)
    candidates = baseCandidates.filter((c) => {
      if (c.verificationStatus === 'SUPERSEDED') return false;
      if (c.effectiveUntil && c.effectiveUntil < '2026-07-01') return false;
      return true;
    });
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

export const resolveCP = resolveCPContext;

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
