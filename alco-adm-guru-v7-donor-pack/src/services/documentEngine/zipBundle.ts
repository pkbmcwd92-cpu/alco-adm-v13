import JSZip from 'jszip';
import saveAs from 'file-saver';
import {
  DocumentType,
  DocumentGenerationContext,
  DocumentSnapshot,
  AppDocumentRecord,
  ZipExportFormat,
  ZipExportOptions,
  ZipExportResult,
} from './types';
import { getCurriculumType } from '../curriculumRules';
import { resolveEffectiveContext, createDocumentSnapshot } from './snapshot';
import { validateDocumentRequirements, generateDocument } from './index';
import { generatePdfDocument } from './renderers/pdf/pdfDocGenerators';

export const MERDEKA_DOC_TYPES: DocumentType[] = [
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

export const K13_DOC_TYPES: DocumentType[] = [
  'ANALISIS_SKL_KI_KD',
  'PENETAPAN_KKM',
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
 * Returns the official administration category folder based on document catalog.
 * Structure:
 * 01_Kurikulum
 * 02_Perencanaan
 * 03_Asesmen
 * 04_Pelaksanaan
 * 05_Tindak_Lanjut
 * 06_Format_Kosong
 */
export function getDocumentZipFolder(type: DocumentType, isBlankMode: boolean = false): string {
  if (isBlankMode) {
    return '06_Format_Kosong';
  }

  switch (type) {
    case 'ANALISIS_CP_TP':
    case 'ANALISIS_SKL_KI_KD':
    case 'PENETAPAN_KKM':
    case 'CP':
    case 'TP':
      return '01_Kurikulum';

    case 'ATP':
    case 'KALENDER_AKADEMIK':
    case 'ALOKASI_WAKTU':
    case 'PROTA':
    case 'PROMES':
    case 'MODUL_AJAR':
      return '02_Perencanaan';

    case 'KKTP':
    case 'ASESMEN':
    case 'DAFTAR_NILAI':
      return '03_Asesmen';

    case 'DAFTAR_HADIR':
    case 'JURNAL':
      return '04_Pelaksanaan';

    case 'REMEDIAL_PENGAYAAN':
      return '05_Tindak_Lanjut';

    default:
      return '02_Perencanaan';
  }
}

/**
 * Returns specific sub-category name inside 06_Format_Kosong if needed.
 */
export function getBlankSubCategoryFolder(type: DocumentType): string {
  switch (type) {
    case 'ANALISIS_CP_TP':
    case 'ANALISIS_SKL_KI_KD':
    case 'PENETAPAN_KKM':
      return '01_Kurikulum';

    case 'ATP':
    case 'KALENDER_AKADEMIK':
    case 'ALOKASI_WAKTU':
    case 'PROTA':
    case 'PROMES':
    case 'MODUL_AJAR':
      return '02_Perencanaan';

    case 'KKTP':
    case 'ASESMEN':
    case 'DAFTAR_NILAI':
      return '03_Asesmen';

    case 'DAFTAR_HADIR':
    case 'JURNAL':
      return '04_Pelaksanaan';

    case 'REMEDIAL_PENGAYAAN':
      return '05_Tindak_Lanjut';

    default:
      return '02_Perencanaan';
  }
}

/**
 * Returns consistent sequence number within each category.
 */
export function getDocumentSequenceNumber(type: DocumentType): number {
  const sequenceMap: Record<DocumentType, number> = {
    ANALISIS_CP_TP: 1,
    ANALISIS_SKL_KI_KD: 1,
    PENETAPAN_KKM: 2,
    CP: 1,
    TP: 2,

    ATP: 1,
    KALENDER_AKADEMIK: 2,
    ALOKASI_WAKTU: 3,
    PROTA: 4,
    PROMES: 5,
    MODUL_AJAR: 6,

    KKTP: 1,
    ASESMEN: 2,
    DAFTAR_NILAI: 3,

    DAFTAR_HADIR: 1,
    JURNAL: 2,

    REMEDIAL_PENGAYAAN: 1,
    HARI_EFEKTIF: 3,
  };

  return sequenceMap[type] || 1;
}

/**
 * Formats a clean, consistent filename for packaging inside ZIP.
 */
export function formatDocumentZipFileName(
  type: DocumentType,
  ext: 'pdf' | 'docx',
  context: DocumentGenerationContext,
  indexPrefix?: number
): string {
  const isBlank = context.documentMode === 'blank';
  const cleanSubject = (context.academicSetting?.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (context.academicSetting?.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const seqStr = String(indexPrefix ?? getDocumentSequenceNumber(type)).padStart(2, '0');

  const baseNames: Record<DocumentType, string> = {
    ANALISIS_CP_TP: 'Analisis_CP_TP',
    ATP: 'ATP',
    KALENDER_AKADEMIK: 'Kalender_Pendidikan',
    ALOKASI_WAKTU: 'Alokasi_Waktu',
    PROTA: 'Program_Tahunan_PROTA',
    PROMES: 'Program_Semester_PROMES',
    MODUL_AJAR: 'Modul_Ajar_RPP',
    KKTP: 'KKTP',
    ASESMEN: 'Instrumen_Asesmen_Rubrik',
    DAFTAR_HADIR: 'Daftar_Hadir_Siswa',
    DAFTAR_NILAI: 'Buku_Daftar_Nilai',
    JURNAL: 'Jurnal_Harian_Mengajar',
    REMEDIAL_PENGAYAAN: 'Program_Remedial_Pengayaan',
    ANALISIS_SKL_KI_KD: 'Analisis_SKL_KI_KD',
    PENETAPAN_KKM: 'Penetapan_KKM',
    CP: 'Capaian_Pembelajaran',
    TP: 'Tujuan_Pembelajaran',
    HARI_EFEKTIF: 'Rincian_Hari_Efektif',
  };

  const name = baseNames[type] || type;
  const blankTag = isBlank ? '_Format_Kosong' : '';

  return `${seqStr}_${name}_${cleanSubject}_${cleanGrade}${blankTag}.${ext}`;
}

/**
 * Main ZIP Bundle Generator supporting:
 * 1. ZIP PDF (via PDF Renderer)
 * 2. ZIP Word (via DOCX Renderer)
 * 3. ZIP PDF + Word (Combination of both)
 * Organized into standard administration folders:
 * 01_Kurikulum, 02_Perencanaan, 03_Asesmen, 04_Pelaksanaan, 05_Tindak_Lanjut, 06_Format_Kosong
 */
export async function generateZipBundle(
  typesOrOptions: DocumentType[] | ZipExportOptions,
  rawContext: DocumentGenerationContext,
  formatParam: ZipExportFormat = 'pdf',
  onProgressParam?: (current: number, total: number, docTitle: string) => void,
  existingRecordsParam?: AppDocumentRecord[]
): Promise<ZipExportResult> {
  // Normalize options
  let targetTypes: DocumentType[];
  let exportFormat: ZipExportFormat = formatParam;
  let onProgress = onProgressParam;
  let existingRecords = existingRecordsParam;
  let documentMode = rawContext.documentMode || 'data';

  if (!Array.isArray(typesOrOptions) && typeof typesOrOptions === 'object') {
    const opts = typesOrOptions as ZipExportOptions;
    exportFormat = opts.format || 'pdf';
    documentMode = opts.documentMode || rawContext.documentMode || 'data';
    onProgress = opts.onProgress || onProgressParam;
    existingRecords = opts.existingRecords || existingRecordsParam;
    targetTypes = opts.types && opts.types.length > 0 ? opts.types : [];
  } else {
    targetTypes = typesOrOptions as DocumentType[];
  }

  const curType = getCurriculumType(
    rawContext.academicSetting?.curriculumType || rawContext.academicSetting?.curriculum
  );

  // If no explicit types specified, use curriculum-appropriate catalog
  if (!targetTypes || targetTypes.length === 0) {
    targetTypes = curType === 'K13' ? [...K13_DOC_TYPES] : [...MERDEKA_DOC_TYPES];
  } else {
    // Filter out types incompatible with current curriculum
    targetTypes = targetTypes.filter((type) => {
      if (curType === 'K13') {
        return (
          type !== 'ANALISIS_CP_TP' &&
          type !== 'ATP' &&
          type !== 'MODUL_AJAR' &&
          type !== 'KKTP' &&
          type !== 'ASESMEN' &&
          type !== 'CP' &&
          type !== 'TP'
        );
      } else {
        return type !== 'ANALISIS_SKL_KI_KD' && type !== 'PENETAPAN_KKM';
      }
    });
  }

  const zip = new JSZip();
  let exportedCount = 0;
  let pdfCount = 0;
  let docxCount = 0;
  const foldersCreatedSet = new Set<string>();
  const snapshots: DocumentSnapshot[] = [];

  const isBlank = documentMode === 'blank';
  const effectiveContextBase: DocumentGenerationContext = {
    ...rawContext,
    documentMode,
    skipDownload: true, // Crucial: prevents individual browser download prompts
  };

  const safeSubject = (rawContext.academicSetting?.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const safeGrade = (rawContext.academicSetting?.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const safeSem = (rawContext.academicSetting?.semester || '1').replace(/[^a-zA-Z0-9]/g, '_');
  const safeCur = curType.toUpperCase();

  const formatTag = exportFormat === 'both' ? 'PDF_Word' : exportFormat === 'pdf' ? 'PDF' : 'Word';
  const modeTag = isBlank ? 'Format_Kosong_' : '';
  const zipFileName = `Paket_Administrasi_${modeTag}${safeSubject}_${safeGrade}_Sem${safeSem}_${safeCur}_${formatTag}.zip`;

  // Track item counts for ordering within folders
  const folderItemCount: Record<string, number> = {};

  const totalSteps = targetTypes.length * (exportFormat === 'both' ? 2 : 1);
  let currentStep = 0;

  for (let i = 0; i < targetTypes.length; i++) {
    const type = targetTypes[i];

    // Check existing snapshot
    const existingRec = existingRecords?.find(
      (r) => r.type === type && (!r.workspaceId || r.workspaceId === rawContext.workspace?.id)
    );
    const effectiveContext = existingRec?.snapshot
      ? resolveEffectiveContext(effectiveContextBase, existingRec.snapshot)
      : resolveEffectiveContext(effectiveContextBase);

    // Strict validation check
    const validation = validateDocumentRequirements(type, effectiveContext);
    if (!validation.isValid) {
      continue;
    }

    const folderCategory = getDocumentZipFolder(type, isBlank);
    let targetFolder = zip.folder(folderCategory);
    if (!targetFolder) {
      targetFolder = zip;
    }
    foldersCreatedSet.add(folderCategory);

    folderItemCount[folderCategory] = (folderItemCount[folderCategory] || 0) + 1;
    const seqNum = folderItemCount[folderCategory];

    // 1. PDF Export (using PDF Renderer)
    if (exportFormat === 'pdf' || exportFormat === 'both') {
      try {
        currentStep++;
        if (onProgress) {
          onProgress(currentStep, totalSteps, `PDF: ${type}`);
        }
        const pdfResult = await generatePdfDocument(type, effectiveContext);
        if (pdfResult.blob && pdfResult.blob.size > 0) {
          const pdfFileName = formatDocumentZipFileName(type, 'pdf', effectiveContext, seqNum);
          targetFolder.file(pdfFileName, pdfResult.blob);
          pdfCount++;
          if (exportFormat === 'pdf') {
            exportedCount++;
          }
          if (pdfResult.snapshot) {
            snapshots.push(pdfResult.snapshot);
          }
        }
      } catch (err) {
        console.warn(`[ZIP Engine] Error rendering PDF for ${type}:`, err);
      }
    }

    // 2. DOCX Export (using DOCX Renderer)
    if (exportFormat === 'docx' || exportFormat === 'both') {
      try {
        currentStep++;
        if (onProgress) {
          onProgress(currentStep, totalSteps, `Word: ${type}`);
        }
        const docxResult = await generateDocument(type, {
          ...effectiveContext,
          skipDownload: true,
        });

        if (docxResult.blob && docxResult.blob.size > 0) {
          const docxFileName = formatDocumentZipFileName(type, 'docx', effectiveContext, seqNum);
          targetFolder.file(docxFileName, docxResult.blob);
          docxCount++;
          if (exportFormat === 'docx') {
            exportedCount++;
          }
          if (docxResult.record?.snapshot) {
            snapshots.push(docxResult.record.snapshot);
          }
        }
      } catch (err) {
        console.warn(`[ZIP Engine] Error rendering DOCX for ${type}:`, err);
      }
    }

    if (exportFormat === 'both' && (pdfCount > 0 || docxCount > 0)) {
      exportedCount = Math.max(pdfCount, docxCount);
    }
  }

  const totalFiles = pdfCount + docxCount;
  if (totalFiles === 0) {
    throw new Error(
      isBlank
        ? 'Tidak ada format dokumen kosong yang berhasil dibuat untuk kurikulum saat ini.'
        : 'Tidak ada dokumen administrasi yang memenuhi syarat kelengkapan data untuk diekspor ke dalam arsip ZIP.'
    );
  }

  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  saveAs(zipBlob, zipFileName);

  return {
    success: true,
    zipFileName,
    exportedCount,
    pdfCount,
    docxCount,
    foldersCreated: Array.from(foldersCreatedSet),
    snapshots,
  };
}
