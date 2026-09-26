import { CurriculumType, AcademicSetting, WorkflowStepId, DocumentType } from '../types';
import { getCurriculumType } from './jpEngine';

export interface WorkflowStepItem {
  id: WorkflowStepId;
  number: string;
  title: string;
  shortLabel: string;
  description: string;
}

/**
 * Single source of truth helper to extract the active CurriculumType
 * from an AcademicSetting or arbitrary object containing curriculumType / curriculum.
 */
export function getCurriculumTypeFromSetting(
  setting?: AcademicSetting | { curriculum?: string; curriculumType?: CurriculumType } | null
): CurriculumType {
  if (!setting) return 'KURIKULUM_MERDEKA';
  if (setting.curriculumType === 'K13' || setting.curriculumType === 'KURIKULUM_MERDEKA') {
    return setting.curriculumType;
  }
  return getCurriculumType(setting.curriculum);
}

/**
 * Returns true if the curriculum is Kurikulum Merdeka
 */
export function isMerdeka(
  setting?: AcademicSetting | { curriculum?: string; curriculumType?: CurriculumType } | null
): boolean {
  return getCurriculumTypeFromSetting(setting) === 'KURIKULUM_MERDEKA';
}

/**
 * Returns true if the curriculum is Kurikulum 2013 (K13)
 */
export function isK13(
  setting?: AcademicSetting | { curriculum?: string; curriculumType?: CurriculumType } | null
): boolean {
  return getCurriculumTypeFromSetting(setting) === 'K13';
}

/**
 * 01 Profil
 * 02 Data Pembelajaran
 * 03 CP
 * 04 Analisis CP
 * 05 TP
 * 06 ATP
 * 07 Administrasi
 */
export const MERDEKA_WORKFLOW_STEPS: WorkflowStepItem[] = [
  {
    id: 'profile',
    number: '01',
    title: 'PROFIL',
    shortLabel: 'Profil',
    description: 'Guru & Satuan Pendidikan',
  },
  {
    id: 'academic',
    number: '02',
    title: 'DATA PEMBELAJARAN',
    shortLabel: 'Data',
    description: 'Kelas, Fase, Mapel & JP',
  },
  {
    id: 'cp',
    number: '03',
    title: 'CP',
    shortLabel: 'CP',
    description: 'Capaian Pembelajaran & Rujukan',
  },
  {
    id: 'cp-analysis',
    number: '04',
    title: 'ANALISIS CP',
    shortLabel: 'Analisis CP',
    description: 'Bedah Kompetensi & Lingkup Materi',
  },
  {
    id: 'tp',
    number: '05',
    title: 'TP',
    shortLabel: 'TP',
    description: 'Tujuan Pembelajaran & KKO',
  },
  {
    id: 'atp',
    number: '06',
    title: 'ATP',
    shortLabel: 'ATP',
    description: 'Alur Tujuan & Alokasi JP',
  },
  {
    id: 'admin',
    number: '07',
    title: 'ADMINISTRASI',
    shortLabel: 'Administrasi',
    description: 'Perencanaan, Asesmen & Dokumen',
  },
];

/**
 * KURIKULUM 2013 (K13) WORKFLOW
 * Struktur berbasis regulasi dan panduan PPA K13:
 * 01 Profil
 * 02 Data Pembelajaran
 * 03 SKL / KI / KD
 * 04 Analisis KD (Telaah KD & Materi Pokok)
 * 05 Tujuan Pembelajaran & Indikator (IPK)
 * 06 Administrasi (Perencanaan Waktu, Kriteria Ketercapaian/KKM, Asesmen & Nilai, Dokumen)
 */
export const K13_WORKFLOW_STEPS: WorkflowStepItem[] = [
  {
    id: 'profile',
    number: '01',
    title: 'PROFIL',
    shortLabel: 'Profil',
    description: 'Guru & Satuan Pendidikan',
  },
  {
    id: 'academic',
    number: '02',
    title: 'DATA PEMBELAJARAN',
    shortLabel: 'Data',
    description: 'Kelas, Mapel & Alokasi JP',
  },
  {
    id: 'k13-kd',
    number: '03',
    title: 'SKL / KI / KD',
    shortLabel: 'SKL / KI / KD',
    description: 'Kompetensi Dasar & Keselarasan',
  },
  {
    id: 'k13-indikator',
    number: '04',
    title: 'ANALISIS KD',
    shortLabel: 'Analisis KD',
    description: 'Telaah KD & Ruang Lingkup Materi',
  },
  {
    id: 'k13-tujuan',
    number: '05',
    title: 'TUJUAN & INDIKATOR',
    shortLabel: 'Tujuan & IPK',
    description: 'Tujuan Pembelajaran & Indikator Pencapaian',
  },
  {
    id: 'admin',
    number: '06',
    title: 'ADMINISTRASI',
    shortLabel: 'Administrasi',
    description: 'Perencanaan, Penilaian & Dokumen',
  },
];

/**
 * Get active workflow steps for the given curriculum type
 */
export function getWorkflowSteps(curriculumType: CurriculumType): WorkflowStepItem[] {
  return curriculumType === 'K13' ? K13_WORKFLOW_STEPS : MERDEKA_WORKFLOW_STEPS;
}

export const MERDEKA_EXPORT_DOC_TYPES: DocumentType[] = [
  'ANALISIS_CP_TP',
  'ATP',
  'KALENDER_AKADEMIK',
  'ALOKASI_WAKTU',
  'PROTA',
  'PROMES',
  'MODUL_AJAR',
  'KKTP',
  'ASESMEN',
  'DAFTAR_HADIR',
  'DAFTAR_NILAI',
  'JURNAL',
  'REMEDIAL_PENGAYAAN',
];

/**
 * Standard K13 Export Documents.
 * PENETAPAN_KKM is optional and not automatically included unless explicitly chosen or legacy KKM is active.
 */
export const K13_BASE_EXPORT_DOC_TYPES: DocumentType[] = [
  'ANALISIS_SKL_KI_KD',
  'KALENDER_AKADEMIK',
  'ALOKASI_WAKTU',
  'PROTA',
  'PROMES',
  'DAFTAR_HADIR',
  'DAFTAR_NILAI',
  'JURNAL',
  'REMEDIAL_PENGAYAAN',
];

/**
 * @deprecated Use K13_BASE_EXPORT_DOC_TYPES or getCurriculumDocumentTypes(curriculumType, { includeKkm })
 */
export const K13_EXPORT_DOC_TYPES: DocumentType[] = [
  ...K13_BASE_EXPORT_DOC_TYPES,
  'PENETAPAN_KKM',
];

export interface CurriculumDocOptions {
  includeKkm?: boolean;
  criteriaMode?: string;
  hasK13KKM?: boolean;
}

export function getCurriculumDocumentTypes(
  curriculumType: CurriculumType,
  options?: CurriculumDocOptions
): DocumentType[] {
  if (curriculumType === 'KURIKULUM_MERDEKA') {
    return MERDEKA_EXPORT_DOC_TYPES;
  }
  const docs = [...K13_BASE_EXPORT_DOC_TYPES];
  const shouldIncludeKkm =
    options?.includeKkm === true ||
    options?.criteriaMode === 'LEGACY_KKM' ||
    options?.criteriaMode === 'legacy_kkm';

  if (shouldIncludeKkm) {
    docs.push('PENETAPAN_KKM');
  }
  return docs;
}

/**
 * Checks if a WorkflowStepId is valid for the given curriculum type
 */
export function isStepAllowed(stepId: WorkflowStepId, curriculumType: CurriculumType): boolean {
  if (stepId === 'profile' || stepId === 'academic' || stepId === 'admin') return true;
  if (curriculumType === 'KURIKULUM_MERDEKA') {
    return ['cp', 'cp-analysis', 'tp', 'atp'].includes(stepId);
  } else {
    // k13-kkm is allowed only as legacy redirection
    return ['k13-kd', 'k13-indikator', 'k13-tujuan', 'k13-kkm'].includes(stepId);
  }
}

/**
 * Resolves a valid WorkflowStepId when switching between curricula or loading invalid step
 */
export function resolveStep(stepId: WorkflowStepId, curriculumType: CurriculumType): WorkflowStepId {
  if (isStepAllowed(stepId, curriculumType)) {
    // If user lands on legacy k13-kkm step in K13, resolve directly to admin
    if (curriculumType === 'K13' && stepId === 'k13-kkm') {
      return 'admin';
    }
    return stepId;
  }
  if (curriculumType === 'K13') {
    if (stepId === 'cp' || stepId === 'cp-analysis') return 'k13-kd';
    if (stepId === 'tp') return 'k13-indikator';
    if (stepId === 'atp') return 'k13-tujuan';
    return 'k13-kd';
  } else {
    if (stepId === 'k13-kd') return 'cp';
    if (stepId === 'k13-indikator') return 'cp-analysis';
    if (stepId === 'k13-tujuan' || stepId === 'k13-kkm') return 'tp';
    return 'cp';
  }
}
