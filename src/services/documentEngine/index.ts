import JSZip from 'jszip';
import saveAs from 'file-saver';
import { DocumentType, DocumentGenerationContext, DocumentValidationResult, GeneratedDocumentResult, DocumentCatalogItem } from './types';
import { DocumentSnapshot, AppDocumentRecord, LearningPlan } from '../../types';
import { getCurriculumTypeFromSetting } from '../curriculumRouter';
import { resolveEffectiveContext, createDocumentSnapshot } from './snapshot';
import { generateAnalisisCpTp } from './generators/analisisCpTpGenerator';
import { generateCP } from './generators/cpGenerator';
import { generateTP } from './generators/tpGenerator';
import { generateATP } from './generators/atpGenerator';
import { generatePROTA } from './generators/protaGenerator';
import { generatePROMES } from './generators/promesGenerator';
import { generateModulAjar } from './generators/modulAjarGenerator';
import { generateAssessment } from './generators/assessmentGenerator';
import { generateJurnal } from './generators/jurnalGenerator';
import { generateKalenderAkademik } from './generators/kalenderGenerator';
import { generateAlokasiWaktu } from './generators/alokasiWaktuGenerator';
import { generateDaftarHadir } from './generators/daftarHadirGenerator';
import { generateKKTP } from './generators/kktpGenerator';
import { generateDaftarNilai } from './generators/daftarNilaiGenerator';
import { generateRemedialPengayaan } from './generators/remedialPengayaanGenerator';
import { generateAnalisisK13, generatePenetapanKKM } from './generators/k13Generator';
import { generatePdfDocument } from './renderers/pdf/pdfDocGenerators';
import { PdfDocumentBuilder, buildPdfFromOptions } from './renderers/pdf/pdfRenderer';
import { PDF_THEME } from './renderers/pdf/pdfTheme';

import { validateLearningPlan } from '../learningPlanService';
import { isValidDocumentDate } from '../documentDateService';
import { validateKKTPData } from '../cpWorkflowService';
import { checkAssessmentExportEligibility, isAssessmentDocumentSnapshot } from './assessmentExportService';

export * from './types';
export * from './snapshot';
export * from './docxStyles';
export * from './renderers/pdf/pdfRenderer';
export * from './renderers/pdf/pdfTheme';
export * from './renderers/pdf/pdfDocGenerators';
export * from './assessmentExportService';
export * from './zipBundle';
export {
  generateCP,
  generateTP,
  generateAnalisisCpTp,
  generateATP,
  generatePROTA,
  generatePROMES,
  generateModulAjar,
  generateAssessment,
  generateJurnal,
  generateKalenderAkademik,
  generateAlokasiWaktu,
  generateDaftarHadir,
  generateKKTP,
  generateDaftarNilai,
  generateRemedialPengayaan,
  generateAnalisisK13,
  generatePenetapanKKM,
  generatePdfDocument,
  PdfDocumentBuilder,
  buildPdfFromOptions,
  PDF_THEME,
};

export const DOCUMENT_CATALOG: DocumentCatalogItem[] = [
  {
    id: 'CP',
    type: 'CP',
    category: 'Perencanaan Utama',
    title: 'Capaian Pembelajaran (CP)',
    description: 'Dokumen Capaian Pembelajaran resmi per fase dan elemen sesuai Keputusan Kepala BSKAP.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik (Fase/Kelas/Mapel)', 'Capaian Pembelajaran (CP)'],
  },
  {
    id: 'TP',
    type: 'TP',
    category: 'Perencanaan Utama',
    title: 'Tujuan Pembelajaran (TP)',
    description: 'Rumusan Tujuan Pembelajaran turunan Capaian Pembelajaran memuat kompetensi, lingkup materi, dan dimensi profil lulusan.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Tujuan Pembelajaran (TP)'],
  },
  {
    id: 'ANALISIS_CP_TP',
    type: 'ANALISIS_CP_TP',
    category: 'Perencanaan Utama',
    title: 'Analisis Capaian Pembelajaran → Tujuan Pembelajaran',
    description: 'Dokumen telaah penurunan Capaian Pembelajaran (CP) menjadi rumusan Tujuan Pembelajaran (TP) berdasarkan analisis kompetensi dan lingkup materi esensial.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik (Fase/Kelas/Mapel)', 'Capaian Pembelajaran (CP)'],
  },
  {
    id: 'ATP',
    type: 'ATP',
    category: 'Perencanaan Utama',
    title: 'Alur Tujuan Pembelajaran (ATP)',
    description: 'Dokumen turunan CP & TP yang memuat alur langkah pembelajaran bertahap, alokasi JP, Dimensi Profil Lulusan, rencana asesmen, dan glosarium.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Tujuan Pembelajaran (TP)', 'Matriks ATP'],
  },
  {
    id: 'KALENDER_AKADEMIK',
    type: 'KALENDER_AKADEMIK',
    category: 'Perencanaan Utama',
    title: 'Kalender Pendidikan & Hari Efektif Belajar',
    description: 'Rincian kalender akademik satuan pendidikan, estimasi hari dan pekan efektif belajar, serta agenda libur dan asesmen semester.',
    requiredSources: ['Data Profil & Sekolah', 'Konteks Akademik', 'Pengaturan Kalender'],
  },
  {
    id: 'ALOKASI_WAKTU',
    type: 'ALOKASI_WAKTU',
    category: 'Perencanaan Utama',
    title: 'Distribusi Alokasi Waktu Pembelajaran',
    description: 'Pemetaan rinci beban jam pelajaran (JP) per tujuan pembelajaran dan distribusi waktu pekan mengajar dalam semester.',
    requiredSources: ['Data Akademik', 'Alur Tujuan Pembelajaran (ATP)', 'Kalender Akademik'],
  },
  {
    id: 'PROTA',
    type: 'PROTA',
    category: 'Perencanaan Utama',
    title: 'Program Tahunan (PROTA)',
    description: 'Pemetaan distribusi alokasi waktu dan lingkup materi pembelajaran per tujuan pembelajaran selama 1 tahun ajaran (Semester Ganjil & Genap).',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Alur Tujuan Pembelajaran (ATP)'],
  },
  {
    id: 'PROMES',
    type: 'PROMES',
    category: 'Perencanaan Utama',
    title: 'Program Semester (PROMES)',
    description: 'Penjabaran distribusi jam pembelajaran efektif mingguan per bulan dalam satu semester aktif sesuai alur materi.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Alur Tujuan Pembelajaran (ATP)'],
  },
  {
    id: 'MODUL_AJAR',
    type: 'MODUL_AJAR',
    category: 'Perangkat Pembelajaran',
    title: 'Modul Ajar / RPP Berdiferensiasi',
    description: 'Perangkat ajar lengkap memuat Informasi Umum, Pemahaman Bermakna, Pertanyaan Pemantik, Kegiatan Berdiferensiasi, LKPD, dan Glosarium.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Tujuan Pembelajaran (TP)', 'Alur Tujuan Pembelajaran (ATP)'],
  },
  {
    id: 'KKTP',
    type: 'KKTP',
    category: 'Pelaksanaan & Asesmen',
    title: 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)',
    description: 'Matriks kriteria penentuan ketercapaian kompetensi per Tujuan Pembelajaran menggunakan pendekatan deskripsi, rubrik performa, dan interval nilai.',
    requiredSources: ['Tujuan Pembelajaran (TP)', 'Data Akademik'],
  },
  {
    id: 'DAFTAR_HADIR',
    type: 'DAFTAR_HADIR',
    category: 'Pelaksanaan & Asesmen',
    title: 'Daftar Hadir Siswa & Rekap Presensi',
    description: 'Daftar presensi kehadiran tatap muka siswa per pertemuan lengkap dengan rekapitulasi Hadir, Sakit, Izin, Alpa, dan persentase kehadiran.',
    requiredSources: ['Data Siswa', 'Data Akademik', 'Sesi Pertemuan'],
  },
  {
    id: 'ASESMEN',
    type: 'ASESMEN',
    category: 'Pelaksanaan & Asesmen',
    title: 'Instrumen Asesmen & Rubrik Penilaian',
    description: 'Panduan asesmen formatif, kisi-kisi penilaian sumatif lingkup materi, lembar observasi sikap Dimensi Profil Lulusan, dan rubrik ketercapaian.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Tujuan Pembelajaran (TP)', 'Alur Tujuan Pembelajaran (ATP)'],
  },
  {
    id: 'DAFTAR_NILAI',
    type: 'DAFTAR_NILAI',
    category: 'Pelaksanaan & Asesmen',
    title: 'Buku Daftar Nilai & Rekapitulasi Asesmen',
    description: 'Buku daftar nilai guru berisi perolehan asesmen formatif, sumatif lingkup materi, sumatif akhir semester (SAS), dan nilai akhir.',
    requiredSources: ['Data Siswa', 'Data Asesmen', 'Hasil Penilaian'],
  },
  {
    id: 'JURNAL',
    type: 'JURNAL',
    category: 'Pelaksanaan & Asesmen',
    title: 'Jurnal Harian Pelaksanaan Pembelajaran',
    description: 'Format jurnal operasional mengajar harian, pencatatan aktivitas tatap muka, kehadiran siswa, refleksi pembelajaran, dan tindak lanjut.',
    requiredSources: ['Data Profil & Sekolah', 'Data Akademik', 'Tujuan Pembelajaran (TP) / ATP'],
  },
  {
    id: 'REMEDIAL_PENGAYAAN',
    type: 'REMEDIAL_PENGAYAAN',
    category: 'Tindak Lanjut',
    title: 'Program & Laporan Remedial dan Pengayaan',
    description: 'Dokumentasi terstruktur rencana dan pelaksanaan bimbingan remedial bagi siswa belum tuntas serta kegiatan pengayaan bagi siswa berpencapaian tinggi.',
    requiredSources: ['Daftar Nilai / Hasil Asesmen', 'Tujuan Pembelajaran (TP)'],
  },
  {
    id: 'ANALISIS_SKL_KI_KD',
    type: 'ANALISIS_SKL_KI_KD',
    category: 'Kurikulum 2013',
    title: 'Analisis Keterkaitan SKL, KI, dan KD (K13)',
    description: 'Dokumen telaah keselarasan Standar Kompetensi Lulusan, Kompetensi Inti, Kompetensi Dasar, Indikator (IPK), dan rencana pembelajaran Kurikulum 2013.',
    requiredSources: ['Data Profil & Sekolah', 'Kompetensi Dasar (KD)'],
  },
  {
    id: 'PENETAPAN_KKM',
    type: 'PENETAPAN_KKM',
    category: 'Kurikulum 2013',
    title: 'Penetapan Kriteria Ketuntasan Minimal / KKM (K13)',
    description: 'Format resmi penentuan KKM mata pelajaran berdasarkan perhitungan kompleksitas materi, daya dukung sarana prasarana, dan intake siswa.',
    requiredSources: ['Data Profil & Sekolah', 'Kompetensi Dasar (KD)', 'Aspek KKM'],
  },
];

/**
 * Resolves the canonical LearningPlan according to strict exactness rules:
 * - If activeLearningPlanId is provided: exact ID must exist and be SIAP.
 * - If activeLearningPlanId is NOT provided: exactly 1 SIAP plan must exist.
 * - 0 SIAP or >1 SIAP without activeLearningPlanId will block export.
 */
export function resolveCanonicalLearningPlan(context: DocumentGenerationContext): {
  plan?: LearningPlan;
  error?: string;
} {
  const plans = (context.learningPlans || []).filter(
    (p) => !context.academicSetting?.id || p.academicSettingId === context.academicSetting.id
  );

  if (context.activeLearningPlanId) {
    const exactPlan = (context.learningPlans || []).find((p) => p.id === context.activeLearningPlanId);
    if (!exactPlan) {
      return { error: `Rancangan Pembelajaran dengan ID '${context.activeLearningPlanId}' tidak ditemukan.` };
    }
    if (exactPlan.status !== 'SIAP') {
      return { error: `Rancangan Pembelajaran '${exactPlan.title || exactPlan.topic || exactPlan.id}' berstatus '${exactPlan.status}'. Harus diverifikasi dan dikonfirmasi SIAP terlebih dahulu.` };
    }
    return { plan: exactPlan };
  }

  const siapPlans = plans.filter((p) => p.status === 'SIAP');
  if (siapPlans.length === 0) {
    return { error: 'Tidak ada Rancangan Pembelajaran (Modul Ajar) yang berstatus SIAP untuk kelas/mapel ini.' };
  }
  if (siapPlans.length > 1) {
    return { error: `Terdapat ${siapPlans.length} Rancangan Pembelajaran berstatus SIAP. Silakan pilih satu Modul Ajar secara spesifik (activeLearningPlanId) untuk diekspor.` };
  }

  return { plan: siapPlans[0] };
}

/**
 * Validates whether all prerequisites for generating the document are met.
 * Per-document validation logic so each document only requires its true prerequisites.
 */
export function validateDocumentRequirements(
  type: DocumentType,
  context: Partial<DocumentGenerationContext>
): DocumentValidationResult {
  const missingFields: string[] = [];

  // Common: School & Teacher Profile
  if (!context.school?.name?.trim()) {
    missingFields.push('Nama Satuan Pendidikan belum diisi');
  }
  if (!context.profile?.name?.trim()) {
    missingFields.push('Nama Guru Penyusun belum diisi');
  }
  if (!context.academicSetting?.subject?.trim()) {
    missingFields.push('Mata Pelajaran belum dipilih');
  }
  if (!context.academicSetting?.grade?.trim()) {
    missingFields.push('Kelas/Tingkat belum dipilih');
  }
  if (!context.academicSetting?.semester?.trim()) {
    missingFields.push('Semester belum dipilih');
  }
  if (!context.academicSetting?.academicYear?.trim()) {
    missingFields.push('Tahun Pelajaran belum diisi');
  }

  // Document Date check for official mode (blank mode bypasses)
  if (context.documentMode !== 'blank') {
    const rawDate =
      context.snapshot
        ? context.snapshot.documentDate
        : (
            context.documentDate ??
            context.workspace?.documentDate
          );

    if (!isValidDocumentDate(rawDate)) {
      missingFields.push(
        'Tanggal Dokumen belum ditetapkan pada Pengaturan Administrasi.'
      );
    }
  }

  const curType = getCurriculumTypeFromSetting(context.academicSetting);
  if (!curType) {
    return {
      isValid: false,
      missingFields: ['Kurikulum belum ditentukan / tidak dikenali.'],
      message: 'Dokumen belum dapat dibuat karena kurikulum belum ditentukan / tidak dikenali.',
      targetStep: 'academic',
    };
  }

  // Curriculum isolation check for both modes:
  if (curType === 'K13') {
    if (
      type === 'ANALISIS_CP_TP' ||
      type === 'ATP' ||
      type === 'MODUL_AJAR' ||
      type === 'KKTP' ||
      type === 'ASESMEN' ||
      type === 'CP' ||
      type === 'TP'
    ) {
      return {
        isValid: false,
        missingFields: [
          `Dokumen ${type} adalah komponen Kurikulum Merdeka dan tidak berlaku untuk Kurikulum 2013 (K13).`,
        ],
        message: `Dokumen ${type} khusus Kurikulum Merdeka. Pengaturan kelas Anda saat ini menggunakan Kurikulum 2013 (K13).`,
        targetStep: 'academic',
      };
    }
  } else {
    if (type === 'ANALISIS_SKL_KI_KD' || type === 'PENETAPAN_KKM') {
      return {
        isValid: false,
        missingFields: [
          `Dokumen ${type} adalah komponen Kurikulum 2013 (K13) dan tidak berlaku untuk Kurikulum Merdeka.`,
        ],
        message: `Dokumen ${type} khusus Kurikulum 2013 (K13). Pengaturan kelas Anda saat ini menggunakan Kurikulum Merdeka.`,
        targetStep: 'academic',
      };
    }
  }

  // If document mode is 'blank' (Format Kosong Siap Cetak/Tulis), data presence (CP/TP/ATP/Students) is NOT required.
  if (context.documentMode === 'blank') {
    return {
      isValid: true,
      missingFields: [],
    };
  }

  if (curType === 'K13') {
    const k13AnalysisCount = context.k13Analysis?.items?.length || 0;
    const k13KkmCount = context.k13KKM?.items?.length || 0;

    switch (type) {
      case 'ANALISIS_SKL_KI_KD':
        if (k13AnalysisCount === 0) {
          missingFields.push('Data Analisis SKL, KI, dan KD K13 belum terisi');
        }
        break;

      case 'PENETAPAN_KKM':
        if (k13KkmCount === 0) {
          missingFields.push('Data Penetapan KKM K13 belum terisi');
        }
        break;

      case 'PROTA':
      case 'PROMES':
        if (k13AnalysisCount === 0) {
          missingFields.push('Data Analisis KI/KD K13 belum terisi');
        }
        break;
    }

    if (missingFields.length > 0) {
      let targetStep: DocumentValidationResult['targetStep'] = 'profile';
      if (!context.school?.name || !context.profile?.name) {
        targetStep = 'profile';
      } else {
        targetStep = 'academic';
      }

      return {
        isValid: false,
        missingFields,
        message: `Dokumen K13 belum dapat dibuat karena:\n• ${missingFields.join('\n• ')}`,
        targetStep,
      };
    }
  } else {
    // Kurikulum Merdeka
    const cpHasContent = !!(
      context.cp?.generalDescription?.trim() ||
      (context.cp?.elements && context.cp.elements.length > 0)
    );
    const tpCount = context.tp?.items?.length || 0;
    const atpCount = context.atp?.items?.length || 0;

    switch (type) {
      case 'CP':
        if (!cpHasContent) {
          missingFields.push('Capaian Pembelajaran (CP) belum tersedia');
        }
        break;

      case 'TP':
        if (tpCount === 0) {
          missingFields.push('Tujuan Pembelajaran (TP) belum disusun');
        }
        break;

      case 'ANALISIS_CP_TP':
        if (!cpHasContent) {
          missingFields.push('Capaian Pembelajaran (CP) belum tersedia');
        }
        break;

      case 'ATP':
        if (tpCount === 0) {
          missingFields.push('Tujuan Pembelajaran (TP) belum disusun');
        }
        if (atpCount === 0) {
          missingFields.push('Matriks Alur Tujuan Pembelajaran (ATP) masih kosong');
        }
        break;

      case 'PROTA':
      case 'PROMES':
        if (atpCount === 0) {
          missingFields.push('Alur Tujuan Pembelajaran (ATP) belum disusun');
        }
        break;

      case 'MODUL_AJAR': {
        const resolved = resolveCanonicalLearningPlan(context as DocumentGenerationContext);
        if (resolved.error) {
          missingFields.push(resolved.error);
        } else if (resolved.plan) {
          const planVal = validateLearningPlan(resolved.plan, {
            academicSetting: context.academicSetting,
            tp: context.tp,
            atp: context.atp,
            k13Analysis: context.k13Analysis,
            timeAllocations: context.timeAllocations,
            assessmentCriteria: context.assessmentCriteria,
          });
          if (!planVal.valid) {
            missingFields.push(...planVal.errors);
          }
        }
        break;
      }

      case 'ASESMEN': {
        if (isAssessmentDocumentSnapshot(context.snapshot)) {
          break;
        }

        const eligibility = checkAssessmentExportEligibility(context);
        if (!eligibility.eligible) {
          missingFields.push(...eligibility.blockers);
        }
        break;
      }

      case 'KKTP':
        {
          const kktpValidation = validateKKTPData(
            context.assessmentCriteria || [],
            context.tp,
            context.academicSetting,
            context.k13Analysis
          );
          if (!kktpValidation.isSiap) {
            if (kktpValidation.issues.length > 0) {
              missingFields.push(...kktpValidation.issues);
            } else {
              missingFields.push('Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) belum berstatus SIAP.');
            }
          }
        }
        break;

      case 'JURNAL':
        if (tpCount === 0 && atpCount === 0 && !cpHasContent) {
          missingFields.push('Data rancangan pembelajaran (CP/TP/ATP) belum tersedia');
        }
        break;
    }

    if (missingFields.length > 0) {
      let targetStep: DocumentValidationResult['targetStep'] = 'profile';
      if (!context.school?.name || !context.profile?.name) {
        targetStep = 'profile';
      } else if (!context.academicSetting?.subject || !context.academicSetting?.grade) {
        targetStep = 'academic';
      } else if (!cpHasContent) {
        targetStep = 'cp';
      } else if (tpCount === 0 && (type === 'ATP' || type === 'MODUL_AJAR' || type === 'ASESMEN' || type === 'KKTP')) {
        targetStep = 'tp';
      } else if (atpCount === 0 && (type === 'PROTA' || type === 'PROMES' || type === 'ATP' || type === 'MODUL_AJAR' || type === 'ASESMEN')) {
        targetStep = 'atp';
      }

      return {
        isValid: false,
        missingFields,
        message: `Dokumen belum dapat dibuat karena:\n• ${missingFields.join('\n• ')}`,
        targetStep,
      };
    }
  }

  return {
    isValid: true,
    missingFields: [],
  };
}

/**
 * Unified Document Generator dispatcher.
 */
export async function generateDocument(
  type: DocumentType,
  rawContext: DocumentGenerationContext
): Promise<GeneratedDocumentResult> {
  const context = resolveEffectiveContext(rawContext);
  const validation = validateDocumentRequirements(type, context);
  if (!validation.isValid) {
    throw new Error(validation.message || 'Prasyarat dokumen belum terpenuhi.');
  }

  const snapshot = context.snapshot || createDocumentSnapshot(context, 'docx', context.documentMode);

  let result: GeneratedDocumentResult;
  switch (type) {
    case 'CP':
      result = await generateCP(context);
      break;
    case 'TP':
      result = await generateTP(context);
      break;
    case 'ANALISIS_CP_TP':
      result = await generateAnalisisCpTp(context);
      break;
    case 'ATP':
      result = await generateATP(context);
      break;
    case 'KALENDER_AKADEMIK':
      result = await generateKalenderAkademik(context);
      break;
    case 'ALOKASI_WAKTU':
      result = await generateAlokasiWaktu(context);
      break;
    case 'PROTA':
      result = await generatePROTA(context);
      break;
    case 'PROMES':
      result = await generatePROMES(context);
      break;
    case 'MODUL_AJAR':
      result = await generateModulAjar(context);
      break;
    case 'KKTP':
      result = await generateKKTP(context);
      break;
    case 'DAFTAR_HADIR':
      result = await generateDaftarHadir(context);
      break;
    case 'ASESMEN':
      result = await generateAssessment(context);
      break;
    case 'DAFTAR_NILAI':
      result = await generateDaftarNilai(context);
      break;
    case 'JURNAL':
      result = await generateJurnal(context);
      break;
    case 'REMEDIAL_PENGAYAAN':
      result = await generateRemedialPengayaan(context);
      break;
    case 'ANALISIS_SKL_KI_KD':
      result = await generateAnalisisK13(context);
      break;
    case 'PENETAPAN_KKM':
      result = await generatePenetapanKKM(context);
      break;
    default:
      throw new Error(`Tipe dokumen ${type} belum didukung.`);
  }

  if (result.record) {
    if (type !== 'ASESMEN' || !result.record.snapshot) {
      result.record.snapshot = snapshot;
      result.record.lastGenerated = snapshot.generatedAt;
    }
  }
  return result;
}

/**
 * Generates document in requested format ('docx' or direct 'pdf')
 */
export async function generateDocumentFormatted(
  type: DocumentType,
  rawContext: DocumentGenerationContext,
  format: 'docx' | 'pdf' = 'docx'
): Promise<GeneratedDocumentResult & { format: 'docx' | 'pdf'; snapshot: DocumentSnapshot }> {
  const context = resolveEffectiveContext(rawContext);
  const validation = validateDocumentRequirements(type, context);
  if (!validation.isValid) {
    throw new Error(validation.message || 'Prasyarat dokumen belum terpenuhi.');
  }

  const snapshot = context.snapshot || createDocumentSnapshot(context, format, context.documentMode);

  if (format === 'pdf') {
    const pdfRes = await generatePdfDocument(type, context);
    const finalSnapshot = (type === 'ASESMEN' && pdfRes.snapshot ? pdfRes.snapshot : snapshot);
    const record: AppDocumentRecord = {
      id: `doc-${type.toLowerCase()}-${context.workspace?.id || 'ws'}-${Date.now()}`,
      type,
      title: pdfRes.title,
      status: 'completed',
      format: 'pdf',
      lastGenerated: finalSnapshot.generatedAt,
      fileName: pdfRes.fileName,
      academicSettingId: context.academicSetting?.id,
      workspaceId: context.workspace?.id,
      snapshot: finalSnapshot,
    };

    return {
      success: true,
      type,
      title: pdfRes.title,
      fileName: pdfRes.fileName,
      record,
      blob: pdfRes.blob,
      format: 'pdf',
      snapshot: finalSnapshot,
    };
  }

  const docxRes = await generateDocument(type, context);
  const finalSnapshot = (type === 'ASESMEN' && docxRes.record?.snapshot ? docxRes.record.snapshot : snapshot);
  const record: AppDocumentRecord = {
    ...docxRes.record,
    format: 'docx',
    snapshot: finalSnapshot,
  };

  return {
    ...docxRes,
    record,
    format: 'docx',
    snapshot: finalSnapshot,
  };
}
