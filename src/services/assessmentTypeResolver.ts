import {
  AssessmentPurpose,
  AssessmentTiming,
  AssessmentScopeType,
  AssessmentInstrumentType,
} from '../types';

export type AssessmentAliasResolutionStatus = 'RESOLVED' | 'AMBIGUOUS' | 'UNRESOLVED';

export interface AssessmentAliasResolutionContext {
  tpCount?: number;
  curriculumType?: string;
  hasSpecificDate?: boolean;
}

export interface AssessmentAliasResolutionResult {
  status: AssessmentAliasResolutionStatus;
  displayLabel: string;
  purpose?: AssessmentPurpose;
  timing?: AssessmentTiming;
  scopeType?: AssessmentScopeType;
  reason?: string;
}

/**
 * Resolver Nomenklatur & Display Alias Asesmen (Audit 9A).
 * Memetakan sebutan operasional (UTS, PAS, UH, Pre-test, dll.)
 * ke dalam model kanonikal semantik (purpose, timing, scopeType)
 * tanpa menebak atau memaksakan pilihan jika data ambigu/kurang.
 */
export function resolveAssessmentAlias(
  rawInput: string,
  context?: AssessmentAliasResolutionContext
): AssessmentAliasResolutionResult {
  if (!rawInput || !rawInput.trim()) {
    return {
      status: 'UNRESOLVED',
      displayLabel: '',
      reason: 'Label/nomenklatur asesmen tidak boleh kosong.',
    };
  }

  const cleaned = rawInput.trim();
  const lower = cleaned.toLowerCase();

  // 1. Istilah khusus 'UK' -> AMBIGUOUS
  if (lower === 'uk' || lower.startsWith('uk ')) {
    return {
      status: 'AMBIGUOUS',
      displayLabel: cleaned,
      reason: 'Istilah "UK" ambigu (dapat bermakna Uji Kompetensi, Ulangan Kelas, dsb.). Harap pilih tujuan, timing, dan cakupan secara eksplisit.',
    };
  }

  // 2. Pre-test / Diagnostik / Awal
  if (
    lower.includes('pre-test') ||
    lower.includes('pretest') ||
    lower.includes('diagnostik') ||
    lower.includes('asesmen awal') ||
    lower.includes('penilaian awal')
  ) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'FORMATIVE',
      timing: 'PRE',
      scopeType: 'TP',
    };
  }

  // 3. Post-test / Tes Akhir Pembelajaran
  if (lower.includes('post-test') || lower.includes('posttest') || lower.includes('tes akhir pembelajaran')) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'FORMATIVE',
      timing: 'POST',
      scopeType: 'TP',
    };
  }

  // 4. Formatif Proses / Harian
  if (lower === 'formatif' || lower.includes('asesmen formatif') || lower.includes('formatif proses') || lower.includes('kuis harian')) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'FORMATIVE',
      timing: 'DURING',
      scopeType: 'TP',
    };
  }

  // 5. Mid Semester (PTS / UTS / STS / Sumatif Tengah Semester)
  if (
    lower.includes('pts') ||
    lower.includes('uts') ||
    lower.includes('sts') ||
    lower.includes('tengah semester') ||
    lower.includes('mid semester')
  ) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'SUMMATIVE',
      timing: 'MID_SEMESTER',
      scopeType: 'SEMESTER',
    };
  }

  // 6. End Semester (PAS / SAS / Sumatif Akhir Semester)
  if (
    lower.includes('pas') ||
    lower.includes('sas') ||
    lower.includes('akhir semester') ||
    lower.includes('uas')
  ) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'SUMMATIVE',
      timing: 'END_SEMESTER',
      scopeType: 'SEMESTER',
    };
  }

  // 7. End Year (PAT / Sumatif Akhir Tahun)
  if (
    lower.includes('pat') ||
    lower.includes('sat') ||
    lower.includes('akhir tahun') ||
    lower.includes('ukp')
  ) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'SUMMATIVE',
      timing: 'END_YEAR',
      scopeType: 'YEAR',
    };
  }

  // 8. End Level (Ujian Sekolah / US / USPBK / Asesmen Akhir Jenjang)
  if (
    lower.includes('ujian sekolah') ||
    lower === 'us' ||
    lower.includes('akhir jenjang') ||
    lower.includes('uspbk')
  ) {
    return {
      status: 'RESOLVED',
      displayLabel: cleaned,
      purpose: 'SUMMATIVE',
      timing: 'END_LEVEL',
      scopeType: 'LEVEL',
    };
  }

  // 9. Ulangan Harian (UH) / Sumatif Lingkup Materi
  if (
    lower.includes('uh') ||
    lower.includes('ulangan harian') ||
    lower.includes('lingkup materi') ||
    lower.includes('sumatif tp')
  ) {
    if (context?.tpCount !== undefined) {
      const scopeType: AssessmentScopeType = context.tpCount > 1 ? 'MULTI_TP' : 'TP';
      return {
        status: 'RESOLVED',
        displayLabel: cleaned,
        purpose: 'SUMMATIVE',
        timing: 'POST',
        scopeType,
      };
    }
    return {
      status: 'AMBIGUOUS',
      displayLabel: cleaned,
      reason: 'Ulangan Harian / Sumatif Lingkup Materi membutuhkan kepastian jumlah Tujuan Pembelajaran (TP) yang diuji untuk menentukan cakupan (TP tunggal atau Multi-TP).',
    };
  }

  // 10. Default / Unresolved
  return {
    status: 'UNRESOLVED',
    displayLabel: cleaned,
    reason: `Label "${cleaned}" tidak cocok dengan pola semantik otomatis. Harap tentukan tujuan, timing, dan cakupan secara manual.`,
  };
}
