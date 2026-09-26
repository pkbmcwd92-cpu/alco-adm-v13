import {
  DocumentType,
  DocumentGenerationContext,
  DocumentSnapshot,
} from '../../types';
import {
  PdfDocumentBuilder,
  PdfDocumentSection,
  buildPdfFromOptions,
} from './pdfRenderer';
import { formatOfficialDate, PdfStyleProfile } from './pdfTheme';
import { resolveEffectiveContext, createDocumentSnapshot } from '../../snapshot';
import { exportAssessmentPdf } from '../../assessmentExportService';
import { normalizeSemester } from '../../../academicScope';

export async function generatePdfDocument(
  type: DocumentType,
  rawContext: DocumentGenerationContext
): Promise<{ blob: Blob; fileName: string; title: string; snapshot: DocumentSnapshot }> {
  const context = resolveEffectiveContext(rawContext);

  if (type === 'ASESMEN') {
    const result = await exportAssessmentPdf(context, {
      documentMode: context.documentMode,
      documentDate: context.documentDate,
    });
    return {
      blob: result.blob,
      fileName: result.fileName,
      title: result.title,
      snapshot: result.snapshot,
    };
  }

  const snapshot = context.snapshot || createDocumentSnapshot(context, 'pdf', context.documentMode);
  const { school, profile, academicSetting, cp, tp, atp, students, calendarDays, timeAllocations } = context;
  const isBlankMode = context.documentMode === 'blank';

  const subject = academicSetting?.subject || '-';
  const grade = academicSetting?.grade || '-';
  const semester = academicSetting?.semester || '-';
  const academicYear = academicSetting?.academicYear || '-';
  const cleanSubject = (subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');

  let title = '';
  let subTitle = '';
  let fileName = '';
  let orientation: 'portrait' | 'landscape' = 'portrait';
  const sections: PdfDocumentSection[] = [];

  switch (type) {
    case 'CP': {
      title = 'Capaian Pembelajaran (CP) Resmi';
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'})`;
      fileName = `CP_${cleanSubject}_${cleanGrade}.pdf`;

      if (cp?.source && !isBlankMode) {
        sections.push({
          type: 'callout',
          title: 'Sumber Rujukan Resmi',
          text: `${cp.source.title || 'Salinan Keputusan BSKAP'} (${cp.source.institution || 'Kemendikdasmen RI'}, ${cp.source.documentYear || '2024'})${cp.source.url ? ` — ${cp.source.url}` : ''}`,
        });
      }

      sections.push({
        type: 'heading',
        text: 'A. Deskripsi Capaian Pembelajaran Fase',
        level: 1,
      });

      sections.push({
        type: 'paragraph',
        text: isBlankMode
          ? '........................................................................................................................................................................................................................................................................................'
          : cp?.generalDescription || 'Teks capaian pembelajaran belum diisi.',
        align: 'justify',
      });

      sections.push({
        type: 'heading',
        text: 'B. Capaian Pembelajaran per Elemen',
        level: 1,
      });

      const rows = isBlankMode
        ? Array.from({ length: 12 }, (_, idx) => [idx + 1, '....................', '..........................................................................................'])
        : (cp?.elements && cp.elements.length > 0)
        ? cp.elements.map((elem, idx) => [
            idx + 1,
            elem.name || '—',
            elem.content || '—',
          ])
        : [[1, 'Semua Elemen', cp?.generalDescription || 'Capaian Pembelajaran belum diisi']];

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'Elemen', dataKey: 'elem', width: 45 },
          { header: 'Capaian Pembelajaran Elemen', dataKey: 'content', width: 130 },
        ],
        rows,
      });
      break;
    }

    case 'ANALISIS_CP_TP': {
      title = 'Analisis Capaian Pembelajaran Menjadi Tujuan Pembelajaran';
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'})`;
      fileName = `Analisis_CP_TP_${cleanSubject}_${cleanGrade}.pdf`;

      sections.push({
        type: 'heading',
        text: 'A. Rasional & Capaian Pembelajaran Umum',
        level: 1,
      });

      sections.push({
        type: 'paragraph',
        text: isBlankMode
          ? '................................................................................................................................................................................................................................'
          : cp?.generalDescription || 'Capaian pembelajaran umum menjadi fondasi penurunan kompetensi dan materi.',
        align: 'justify',
      });

      sections.push({
        type: 'heading',
        text: 'B. Matriks Telaah Penurunan CP ke Tujuan Pembelajaran',
        level: 1,
      });

      const rows: (string | number)[][] = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            '....................',
            '....................',
            '....................',
            '........................................',
            '....................',
          ])
        : (tp?.items || []).length > 0
        ? (tp?.items || []).map((it, idx) => [
            idx + 1,
            it.elementName || '—',
            it.competence || '—',
            it.contentScope || '—',
            it.statement || '—',
            (it.p3Dimensions || []).join(', ') || '-',
          ])
        : [[1, '—', '—', '—', 'Belum ada data analisis CP ke Tujuan Pembelajaran', '—']];

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Elemen CP', dataKey: 'elem', width: 28 },
          { header: 'Kompetensi (KKO)', dataKey: 'comp', width: 28 },
          { header: 'Lingkup Materi', dataKey: 'mat', width: 34 },
          { header: 'Rumusan Tujuan Pembelajaran (TP)', dataKey: 'tp', width: 55 },
          { header: 'Dimensi P3', dataKey: 'p3', width: 32 },
        ],
        rows,
      });
      break;
    }

    case 'TP': {
      title = 'Dokumen Perumusan Tujuan Pembelajaran (TP)';
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'}) — Tahun Ajaran ${academicYear}`;
      fileName = `Tujuan_Pembelajaran_${cleanSubject}_${cleanGrade}.pdf`;

      sections.push({
        type: 'heading',
        text: 'Daftar Tujuan Pembelajaran yang Telah Dirumuskan',
        level: 1,
      });

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `TP ${idx + 1}`,
            '..........................................................................................',
            '....................',
            '....................',
          ])
        : (tp?.items || []).length > 0
        ? (tp?.items || []).map((it, idx) => [
            idx + 1,
            it.code || `TP ${idx + 1}`,
            it.statement || '-',
            it.contentScope || '-',
            (it.p3Dimensions || []).join(', ') || '-',
          ])
        : [[1, '—', 'Belum ada data Tujuan Pembelajaran', '—', '—']];

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Kode TP', dataKey: 'code', width: 22, align: 'center' },
          { header: 'Pernyataan Tujuan Pembelajaran', dataKey: 'statement', width: 85 },
          { header: 'Lingkup Materi', dataKey: 'mat', width: 40 },
          { header: 'Dimensi Profil Lulusan', dataKey: 'p3', width: 30 },
        ],
        rows,
      });
      break;
    }

    case 'ATP': {
      title = 'Alur Tujuan Pembelajaran (ATP)';
      const atpItemsList = atp?.items || [];
      const knownJPItems = atpItemsList.filter(
        (item) => (item.allocatedJP ?? item.jp) != null
      );
      const unknownJPCount = atpItemsList.length - knownJPItems.length;
      const knownTotalJP = knownJPItems.reduce(
        (sum, item) => sum + Number(item.allocatedJP ?? item.jp ?? 0),
        0
      );

      let totalAllocationStatus = 'Total Alokasi: Belum ditetapkan';
      if (atpItemsList.length === 0) {
        totalAllocationStatus = 'Total Alokasi: —';
      } else if (unknownJPCount === 0) {
        totalAllocationStatus = `Total Alokasi: ${knownTotalJP} JP`;
      } else if (unknownJPCount > 0 && knownTotalJP > 0) {
        totalAllocationStatus = `JP Teralokasi Sementara: ${knownTotalJP} JP — Alokasi belum lengkap`;
      } else {
        totalAllocationStatus = 'Total Alokasi: Belum ditetapkan';
      }

      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'}) — ${totalAllocationStatus}`;
      fileName = `ATP_${cleanSubject}_${cleanGrade}.pdf`;
      orientation = 'landscape';

      if (atp?.rationale && !isBlankMode) {
        sections.push({
          type: 'heading',
          text: 'Rasional Alur Pembelajaran',
          level: 1,
        });
        sections.push({
          type: 'paragraph',
          text: atp.rationale,
          align: 'justify',
        });
      }

      sections.push({
        type: 'heading',
        text: 'Matriks Alur Tujuan Pembelajaran',
        level: 1,
      });

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `TP ${idx + 1}`,
            '..........................................................................................',
            '....................',
            '..... JP',
            '....................',
            '....................',
            '....................',
          ])
        : atpItemsList.map((it, idx) => {
            const itJp = it.allocatedJP ?? it.jp;
            const itJpDisplay = itJp != null ? `${itJp} JP` : '—';
            return [
              it.stepNumber || idx + 1,
              it.tpCode || `TP ${idx + 1}`,
              it.tpStatement || '-',
              it.materialScope || '-',
              itJpDisplay,
              (it.p3Dimensions || []).join(', ') || '-',
              it.assessmentPlan || '-',
              it.glossary || '-',
            ];
          });

      sections.push({
        type: 'table',
        columns: [
          { header: 'Alur', dataKey: 'step', width: 14, align: 'center' },
          { header: 'Kode', dataKey: 'code', width: 20, align: 'center' },
          { header: 'Capaian & Tujuan Pembelajaran', dataKey: 'tp', width: 68 },
          { header: 'Lingkup Materi Inti', dataKey: 'mat', width: 45 },
          { header: 'JP', dataKey: 'jp', width: 16, align: 'center' },
          { header: 'Profil Pancasila', dataKey: 'p3', width: 38 },
          { header: 'Rencana Asesmen', dataKey: 'asm', width: 40 },
          { header: 'Kata Kunci / Glosarium', dataKey: 'gls', width: 26 },
        ],
        rows,
      });
      break;
    }

    case 'PROTA': {
      title = 'Program Tahunan (PROTA)';
      subTitle = `${subject} — ${grade} — Tahun Ajaran ${academicYear}`;
      fileName = `PROTA_${cleanSubject}_${cleanGrade}.pdf`;

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            '...............',
            `TP ${idx + 1}`,
            '..........................................................................................',
            '....................',
            '..... JP',
          ])
        : (atp?.items || []).map((it, idx) => {
            const itJp = it.allocatedJP ?? it.jp;
            const itJpDisplay = itJp != null ? `${itJp} JP` : '—';
            const itSem = normalizeSemester((it as any).semester);
            const semDisplay = itSem === 1 ? 'Semester 1' : itSem === 2 ? 'Semester 2' : '—';
            return [
              idx + 1,
              semDisplay,
              it.tpCode || `TP ${idx + 1}`,
              it.tpStatement || '-',
              it.materialScope || '-',
              itJpDisplay,
            ];
          });

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'Semester', dataKey: 'sem', width: 25, align: 'center' },
          { header: 'Kode TP', dataKey: 'code', width: 22, align: 'center' },
          { header: 'Tujuan Pembelajaran', dataKey: 'tp', width: 65 },
          { header: 'Lingkup Materi', dataKey: 'mat', width: 45 },
          { header: 'Alokasi Waktu', dataKey: 'jp', width: 20, align: 'center' },
        ],
        rows,
      });
      break;
    }

    case 'PROMES': {
      title = 'Program Semester (PROMES)';
      subTitle = `${subject} — ${grade} — Semester ${semester} — T.A ${academicYear}`;
      fileName = `PROMES_${cleanSubject}_${cleanGrade}.pdf`;
      orientation = 'landscape';

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `TP ${idx + 1}`,
            '..........................................................................................',
            '....................',
            '..... JP',
            '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
          ])
        : (atp?.items || []).map((it, idx) => {
            const itJp = it.allocatedJP ?? it.jp;
            const itJpDisplay = itJp != null ? `${itJp} JP` : '—';
            return [
              idx + 1,
              it.tpCode || `TP ${idx + 1}`,
              it.tpStatement || '-',
              it.materialScope || '-',
              itJpDisplay,
              '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
            ];
          });

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'Kode', dataKey: 'code', width: 18, align: 'center' },
          { header: 'Tujuan Pembelajaran', dataKey: 'tp', width: 65 },
          { header: 'Materi', dataKey: 'mat', width: 45 },
          { header: 'JP', dataKey: 'jp', width: 15, align: 'center' },
          { header: 'B1-1', dataKey: 'm1', width: 9, align: 'center' },
          { header: 'B1-2', dataKey: 'm2', width: 9, align: 'center' },
          { header: 'B1-3', dataKey: 'm3', width: 9, align: 'center' },
          { header: 'B1-4', dataKey: 'm4', width: 9, align: 'center' },
          { header: 'B2-1', dataKey: 'm5', width: 9, align: 'center' },
          { header: 'B2-2', dataKey: 'm6', width: 9, align: 'center' },
          { header: 'B2-3', dataKey: 'm7', width: 9, align: 'center' },
          { header: 'B2-4', dataKey: 'm8', width: 9, align: 'center' },
          { header: 'B3-1', dataKey: 'm9', width: 9, align: 'center' },
          { header: 'B3-2', dataKey: 'm10', width: 9, align: 'center' },
          { header: 'B3-3', dataKey: 'm11', width: 9, align: 'center' },
          { header: 'B3-4', dataKey: 'm12', width: 9, align: 'center' },
          { header: 'B4-1', dataKey: 'm13', width: 9, align: 'center' },
          { header: 'B4-2', dataKey: 'm14', width: 9, align: 'center' },
          { header: 'B4-3', dataKey: 'm15', width: 9, align: 'center' },
          { header: 'B4-4', dataKey: 'm16', width: 9, align: 'center' },
        ],
        rows,
      });
      break;
    }

    case 'MODUL_AJAR': {
      // Resolve canonical LearningPlan
      const matchedPlan =
        (context.learningPlans || []).find((lp) => lp.id === context.activeLearningPlanId) ||
        (context.learningPlans || []).find((lp) => lp.academicSettingId === academicSetting?.id && lp.status === 'SIAP') ||
        (context.learningPlans || []).find((lp) => lp.academicSettingId === academicSetting?.id) ||
        (context.learningPlans || [])[0];

      if (!isBlankMode) {
        if (!matchedPlan) {
          throw new Error('PDF Modul Ajar gagal diekspor: Rancangan Pembelajaran (LearningPlan) tidak ditemukan. Silakan buat Modul Ajar di menu Perencanaan Pembelajaran.');
        }
        if (matchedPlan.status !== 'SIAP') {
          throw new Error(`PDF Modul Ajar gagal diekspor: Status Perencanaan Pembelajaran masih '${matchedPlan.status}'. Harus berstatus 'SIAP' untuk ekspor dokumen final.`);
        }
      }

      title = isBlankMode ? 'Format Kosong Modul Ajar / RPP Berdiferensiasi' : 'Modul Ajar / RPP Berdiferensiasi';
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || '-'}) — Semester ${semester}`;
      fileName = `Modul_Ajar_${cleanSubject}_${cleanGrade}.pdf`;

      // Compile TP string strictly from canonical objectives or resolved TPs
      let tpStatements = '-';
      if (matchedPlan?.objectives && matchedPlan.objectives.length > 0) {
        tpStatements = matchedPlan.objectives.map((o, idx) => `${idx + 1}. ${o.code ? `[${o.code}] ` : ''}${o.statement}`).join('\n');
      } else if (matchedPlan?.tpIds && matchedPlan.tpIds.length > 0 && tp?.items) {
        const resolved = matchedPlan.tpIds.map((id) => tp.items.find((t) => t.id === id)).filter(Boolean);
        if (resolved.length > 0) {
          tpStatements = resolved.map((t, idx) => `${idx + 1}. [${t!.code || `TP ${idx + 1}`}] ${t!.statement}`).join('\n');
        }
      }

      const dimensionsList =
        matchedPlan?.graduateProfileDimensions && matchedPlan.graduateProfileDimensions.length > 0
          ? matchedPlan.graduateProfileDimensions
          : matchedPlan?.p3Dimensions && matchedPlan.p3Dimensions.length > 0
          ? matchedPlan.p3Dimensions
          : [];
      const dimensionsStr = dimensionsList.length > 0 ? dimensionsList.join(', ') : '-';

      const resourcesStr = matchedPlan?.resources && matchedPlan.resources.length > 0
        ? matchedPlan.resources.map((r, i) => `${i + 1}. ${r.title}${r.source ? ` (${r.source})` : ''}`).join('\n')
        : '-';

      const infoUmumLines: string[] = [];
      if (isBlankMode) {
        infoUmumLines.push('Kompetensi Awal: ........................................................');
        infoUmumLines.push('Dimensi Profil Lulusan: ........................................................');
        infoUmumLines.push('Sarana & Prasarana: ........................................................');
        infoUmumLines.push('Model Pembelajaran: ........................................................');
      } else {
        infoUmumLines.push(`Kompetensi Awal: ${matchedPlan?.initialCompetency || '-'}`);
        infoUmumLines.push(`Dimensi Profil Lulusan: ${dimensionsStr}`);
        infoUmumLines.push(`Sarana & Prasarana: ${resourcesStr}`);
        if (matchedPlan?.targetStudents && matchedPlan.targetStudents.trim().length > 0) {
          infoUmumLines.push(`Karakteristik/Kebutuhan Belajar Murid: ${matchedPlan.targetStudents.trim()}`);
        }
        infoUmumLines.push(`Model/Praktik Pembelajaran: ${matchedPlan?.learningModel || '-'}`);
      }

      sections.push({
        type: 'heading',
        text: 'I. INFORMASI UMUM',
        level: 1,
      });
      sections.push({
        type: 'paragraph',
        text: infoUmumLines.join('\n'),
      });

      sections.push({
        type: 'heading',
        text: 'II. KOMPONEN INTI',
        level: 1,
      });
      sections.push({
        type: 'paragraph',
        text: isBlankMode
          ? 'Tujuan Pembelajaran: ........................................................................................................................................................\n\nPemahaman Bermakna: ........................................................................................................................................................\n\nPertanyaan Pemantik: ........................................................................................................................................................'
          : `Tujuan Pembelajaran:\n${tpStatements}\n\nPemahaman Bermakna:\n${matchedPlan?.meaningfulUnderstanding || '-'}\n\nPertanyaan Pemantik:\n${matchedPlan?.triggerQuestions && matchedPlan.triggerQuestions.length > 0 ? matchedPlan.triggerQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : '-'}`,
      });

      const experiences = matchedPlan?.learningExperiences || [];
      const hasExperiences = experiences.length > 0;
      const isMerdekaCurriculum = !academicSetting?.curriculumType || academicSetting.curriculumType === 'KURIKULUM_MERDEKA';

      if (hasExperiences || (isBlankMode && isMerdekaCurriculum)) {
        sections.push({
          type: 'heading',
          text: 'III. PENGALAMAN BELAJAR',
          level: 1,
        });

        const understandStr = experiences.filter((e) => e.phase === 'UNDERSTAND').map((s) => `• ${s.description}${s.durationMinutes ? ` (${s.durationMinutes} Menit)` : ''}`).join('\n') || '-';
        const applyStr = experiences.filter((e) => e.phase === 'APPLY').map((s) => `• ${s.description}${s.durationMinutes ? ` (${s.durationMinutes} Menit)` : ''}`).join('\n') || '-';
        const reflectStr = experiences.filter((e) => e.phase === 'REFLECT').map((s) => `• ${s.description}${s.durationMinutes ? ` (${s.durationMinutes} Menit)` : ''}`).join('\n') || '-';

        sections.push({
          type: 'paragraph',
          text: isBlankMode
            ? '1. Memahami (Understand): ........................................................................................................................................................\n2. Mengaplikasi (Apply): ........................................................................................................................................................\n3. Merefleksi (Reflect): ........................................................................................................................................................'
            : `1. Memahami (Understand):\n${understandStr}\n\n2. Mengaplikasi (Apply):\n${applyStr}\n\n3. Merefleksi (Reflect):\n${reflectStr}`,
        });
      } else {
        sections.push({
          type: 'heading',
          text: 'III. KEGIATAN PEMBELAJARAN',
          level: 1,
        });

        const openingStr = (matchedPlan?.learningSteps?.opening || []).map((s) => `• ${s.description}${s.durationMinutes ? ` (${s.durationMinutes} Menit)` : ''}`).join('\n') || '-';
        const coreStr = (matchedPlan?.learningSteps?.core || []).map((s) => `• ${s.description}${s.durationMinutes ? ` (${s.durationMinutes} Menit)` : ''}`).join('\n') || '-';
        const closingStr = (matchedPlan?.learningSteps?.closing || []).map((s) => `• ${s.description}${s.durationMinutes ? ` (${s.durationMinutes} Menit)` : ''}`).join('\n') || '-';

        sections.push({
          type: 'paragraph',
          text: isBlankMode
            ? '1. Kegiatan Pendahuluan: ........................................................................................................................................................\n2. Kegiatan Inti: ........................................................................................................................................................\n3. Kegiatan Penutup: ........................................................................................................................................................'
            : `1. Kegiatan Pendahuluan:\n${openingStr}\n\n2. Kegiatan Inti:\n${coreStr}\n\n3. Kegiatan Penutup:\n${closingStr}`,
        });
      }

      if (matchedPlan?.assessmentPlan || isBlankMode) {
        sections.push({
          type: 'heading',
          text: 'IV. ASESMEN PEMBELAJARAN',
          level: 1,
        });
        const initialAsm = (matchedPlan?.assessmentPlan?.initial || []).map((a) => `• ${a.description || a.technique || 'Asesmen Awal'}`).join('\n') || '-';
        const formativeAsm = (matchedPlan?.assessmentPlan?.formative || []).map((a) => `• ${a.description || a.technique || 'Asesmen Formatif'}`).join('\n') || '-';
        const summativeAsm = (matchedPlan?.assessmentPlan?.summative || []).map((a) => `• ${a.description || a.technique || 'Asesmen Sumatif'}`).join('\n') || '-';

        sections.push({
          type: 'paragraph',
          text: isBlankMode
            ? '1. Asesmen Awal (Diagnostik): ........................................................\n2. Asesmen Formatif: ........................................................\n3. Asesmen Sumatif: ........................................................'
            : `1. Asesmen Awal (Diagnostik):\n${initialAsm}\n\n2. Asesmen Formatif:\n${formativeAsm}\n\n3. Asesmen Sumatif:\n${summativeAsm}`,
        });
      }
      break;
    }

    case 'KKTP': {
      title = 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)';
      subTitle = `${subject} — ${grade} — Semester ${semester}`;
      fileName = `KKTP_${cleanSubject}_${cleanGrade}.pdf`;

      const criteria = context.assessmentCriteria || [];
      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `TP ${idx + 1}`,
            '..........................................................................................',
            '....................',
            '..........................................................................................',
          ])
        : criteria.length > 0
        ? criteria.map((c, idx) => {
            const matchingTp = (tp?.items || []).find((t) => t.id === c.tpId);
            const approachLabel = c.approach === 'rubrik' ? 'Rubrik Deskripsi' : c.approach === 'skala_interval' ? 'Interval Nilai' : 'Deskripsi Kriteria';
            return [
              idx + 1,
              matchingTp?.code || `TP ${idx + 1}`,
              matchingTp?.statement || c.description || '-',
              approachLabel,
              c.levels && c.levels.length > 0
                ? c.levels.map((l) => `${l.label || l.level}: ${l.description}`).join(' | ')
                : 'Perlu Bimbingan (0-69) | Cukup (70-79) | Baik (80-89) | Sangat Baik (90-100)',
            ];
          })
        : (tp?.items || []).map((t, idx) => [
            idx + 1,
            t.code || `TP ${idx + 1}`,
            t.statement,
            'Rubrik Deskripsi',
            'Kriteria: Siswa mampu mendemonstrasikan kompetensi dengan tepat dan mandiri (Ketercapaian: Min. Kategori Cukup/75%)',
          ]);

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Kode TP', dataKey: 'code', width: 22, align: 'center' },
          { header: 'Tujuan Pembelajaran', dataKey: 'tp', width: 65 },
          { header: 'Pendekatan', dataKey: 'app', width: 30 },
          { header: 'Kriteria & Rubrik Ketercapaian', dataKey: 'crit', width: 60 },
        ],
        rows,
      });
      break;
    }

    case 'DAFTAR_NILAI': {
      title = 'Buku Daftar Nilai & Rekap Capaian Hasil Belajar';
      subTitle = `${subject} — ${grade} — Semester ${semester}`;
      fileName = `Daftar_Nilai_${cleanSubject}_${cleanGrade}.pdf`;
      orientation = 'landscape';

      const studentList = students || [];
      const resultsList = context.assessmentResults || [];
      const rows = isBlankMode
        ? Array.from({ length: 20 }, (_, idx) => [
            idx + 1,
            '....................',
            '..........................................................................................',
            '....',
            '', '', '', '', '', '',
          ])
        : studentList.map((st, idx) => {
            const studentResults = resultsList.filter((r) => r.studentId === st.id);
            const hasResults = studentResults.length > 0;
            const avgScore = hasResults
              ? Math.round(studentResults.reduce((acc, curr) => acc + curr.score, 0) / studentResults.length)
              : null;
            const tp1Score = studentResults[0]?.score ?? (avgScore !== null ? avgScore : '-');
            const tp2Score = studentResults[1]?.score ?? (avgScore !== null ? avgScore : '-');
            const tp3Score = studentResults[2]?.score ?? (avgScore !== null ? avgScore : '-');
            const sasScore = studentResults[3]?.score ?? (avgScore !== null ? avgScore : '-');

            return [
              idx + 1,
              st.nisn || '-',
              st.name,
              st.gender || 'L',
              tp1Score,
              tp2Score,
              tp3Score,
              sasScore,
              avgScore !== null ? avgScore : '-',
              avgScore !== null ? (avgScore >= 75 ? 'Tercapai' : 'Perlu Bimbingan') : 'Belum Ada Nilai',
            ];
          });

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'NISN', dataKey: 'nisn', width: 28, align: 'center' },
          { header: 'Nama Peserta Didik', dataKey: 'name', width: 70 },
          { header: 'L/P', dataKey: 'jk', width: 14, align: 'center' },
          { header: 'TP 1', dataKey: 'tp1', width: 18, align: 'center' },
          { header: 'TP 2', dataKey: 'tp2', width: 18, align: 'center' },
          { header: 'TP 3', dataKey: 'tp3', width: 18, align: 'center' },
          { header: 'SAS', dataKey: 'sas', width: 18, align: 'center' },
          { header: 'Nilai Akhir', dataKey: 'na', width: 25, align: 'center' },
          { header: 'Capaian Kompetensi', dataKey: 'cap', width: 45 },
        ],
        rows,
      });
      break;
    }

    case 'DAFTAR_HADIR': {
      title = 'Daftar Presensi & Kehadiran Siswa';
      subTitle = `${subject} — ${grade} — Semester ${semester} — T.A ${academicYear}`;
      fileName = `Daftar_Hadir_${cleanSubject}_${cleanGrade}.pdf`;
      orientation = 'landscape';

      const studentList = students || [];
      const recordsList = context.attendanceRecords || [];
      const rows = isBlankMode
        ? Array.from({ length: 20 }, (_, idx) => [
            idx + 1,
            '....................',
            '..........................................................................................',
            '....',
            '', '', '', '', '', '', '', '', '', '', '', '',
            '', '', '', '',
          ])
        : studentList.map((st, idx) => {
            const studentRecs = recordsList.filter((r) => r.studentId === st.id);
            const sCount = studentRecs.filter((r) => r.status === 'S').length;
            const iCount = studentRecs.filter((r) => r.status === 'I').length;
            const aCount = studentRecs.filter((r) => r.status === 'A').length;
            const total = studentRecs.length;
            const hCount = total > 0 ? studentRecs.filter((r) => r.status === 'H' || r.status === 'D').length : 0;
            const pct = total > 0 ? `${Math.round((hCount / total) * 100)}%` : '-';
            const presenceMarks = total > 0
              ? Array.from({ length: 12 }, (_, pIdx) => studentRecs[pIdx]?.status || '-')
              : Array.from({ length: 12 }, () => '-');

            return [
              idx + 1,
              st.nisn || '-',
              st.name,
              st.gender || 'L',
              ...presenceMarks,
              sCount, iCount, aCount, pct,
            ];
          });

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'NISN', dataKey: 'nisn', width: 24, align: 'center' },
          { header: 'Nama Peserta Didik', dataKey: 'name', width: 60 },
          { header: 'L/P', dataKey: 'jk', width: 12, align: 'center' },
          { header: 'P1', dataKey: 'p1', width: 10, align: 'center' },
          { header: 'P2', dataKey: 'p2', width: 10, align: 'center' },
          { header: 'P3', dataKey: 'p3', width: 10, align: 'center' },
          { header: 'P4', dataKey: 'p4', width: 10, align: 'center' },
          { header: 'P5', dataKey: 'p5', width: 10, align: 'center' },
          { header: 'P6', dataKey: 'p6', width: 10, align: 'center' },
          { header: 'P7', dataKey: 'p7', width: 10, align: 'center' },
          { header: 'P8', dataKey: 'p8', width: 10, align: 'center' },
          { header: 'P9', dataKey: 'p9', width: 10, align: 'center' },
          { header: 'P10', dataKey: 'p10', width: 10, align: 'center' },
          { header: 'P11', dataKey: 'p11', width: 10, align: 'center' },
          { header: 'P12', dataKey: 'p12', width: 10, align: 'center' },
          { header: 'S', dataKey: 's', width: 9, align: 'center' },
          { header: 'I', dataKey: 'i', width: 9, align: 'center' },
          { header: 'A', dataKey: 'a', width: 9, align: 'center' },
          { header: '%', dataKey: 'pct', width: 14, align: 'center' },
        ],
        rows,
      });
      break;
    }

    case 'KALENDER_AKADEMIK':
    case 'HARI_EFEKTIF': {
      title = type === 'KALENDER_AKADEMIK' ? 'Kalender Pendidikan Satuan Pendidikan' : 'Rincian Hari & Minggu Efektif Belajar';
      subTitle = `${school?.name || 'Sekolah'} — Semester ${semester} — T.A ${academicYear}`;
      fileName = `${type === 'KALENDER_AKADEMIK' ? 'Kalender_Akademik' : 'Hari_Efektif'}_${cleanSubject}_${cleanGrade}.pdf`;

      const days = calendarDays || [];
      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            '.... / .... / 20...',
            '....................',
            '..........................................................................................',
          ])
        : days.length > 0
        ? days.map((d, idx) => [
            idx + 1,
            d.date,
            d.status === 'schoolEvent' ? 'Kegiatan Sekolah' : d.status === 'holiday' ? 'Hari Libur' : 'Hari Efektif',
            d.notes || '-',
          ])
        : [
            [1, '—', '—', 'Belum ada agenda kalender akademik yang ditetapkan'],
          ];

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'Tanggal', dataKey: 'date', width: 35 },
          { header: 'Status Agenda', dataKey: 'status', width: 45 },
          { header: 'Uraian Kegiatan / Agenda Sekolah', dataKey: 'notes', width: 95 },
        ],
        rows,
      });
      break;
    }

    case 'ALOKASI_WAKTU': {
      title = 'Distribusi Alokasi Waktu Pembelajaran';
      subTitle = `${subject} — ${grade} — Semester ${semester}`;
      fileName = `Alokasi_Waktu_${cleanSubject}_${cleanGrade}.pdf`;

      const allocs = timeAllocations || [];
      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `TP ${idx + 1}`,
            '..........................................................................................',
            '...............',
            '..... JP',
            '....................',
          ])
        : allocs.length > 0
        ? allocs.map((a, idx) => {
            const matchingTp = (tp?.items || []).find((t) => t.id === a.tpId);
            return [
              idx + 1,
              matchingTp?.code || `TP ${idx + 1}`,
              matchingTp?.contentScope || matchingTp?.statement || a.notes || '—',
              a.weekNumber ? `Pekan ke-${a.weekNumber}` : '—',
              a.jp != null ? `${a.jp} JP` : '—',
              a.notes || a.monthName || '—',
            ];
          })
        : (atp?.items || []).map((it, idx) => {
            const itJp = it.allocatedJP ?? it.jp;
            const itJpDisplay = itJp != null ? `${itJp} JP` : '—';
            return [
              idx + 1,
              it.tpCode || `TP ${idx + 1}`,
              it.materialScope || it.tpStatement || '—',
              '—',
              itJpDisplay,
              'Belum dialokasikan',
            ];
          });

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'Kode TP', dataKey: 'code', width: 22, align: 'center' },
          { header: 'Lingkup Materi / Topik', dataKey: 'topic', width: 70 },
          { header: 'Alokasi Pekan', dataKey: 'wks', width: 25, align: 'center' },
          { header: 'Jam Pelajaran', dataKey: 'jp', width: 25, align: 'center' },
          { header: 'Distribusi Waktu Mengajar', dataKey: 'dist', width: 35 },
        ],
        rows,
      });
      break;
    }

    case 'JURNAL': {
      title = 'Jurnal Harian Pelaksanaan Pembelajaran & Refleksi Guru';
      subTitle = `${subject} — ${grade} — Semester ${semester}`;
      fileName = `Jurnal_Mengajar_${cleanSubject}_${cleanGrade}.pdf`;
      orientation = 'landscape';

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `Pertemuan ${idx + 1}`,
            `TP ${idx + 1}`,
            '..........................................................................................',
            '..........................................................................................',
            '....................................................',
            '.......',
          ])
        : (atp?.items || []).map((it, idx) => [
            idx + 1,
            `Pertemuan ${idx + 1}`,
            it.tpCode || `TP ${idx + 1}`,
            it.materialScope || '-',
            'Diskusi interaktif, observasi, dan latihan terbimbing di kelas.',
            'Siswa berpartisipasi aktif dan mampu menyelesaikan tugas tepat waktu.',
            'Tuntas',
          ]);

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 12, align: 'center' },
          { header: 'Pertemuan', dataKey: 'meet', width: 25, align: 'center' },
          { header: 'Kode TP', dataKey: 'code', width: 22, align: 'center' },
          { header: 'Materi Pembelajaran', dataKey: 'mat', width: 60 },
          { header: 'Aktivitas Pembelajaran', dataKey: 'act', width: 75 },
          { header: 'Catatan Refleksi & Kendala', dataKey: 'ref', width: 50 },
          { header: 'Status', dataKey: 'stat', width: 20, align: 'center' },
        ],
        rows,
      });
      break;
    }

    case 'REMEDIAL_PENGAYAAN': {
      title = 'Program Tindak Lanjut Remedial dan Pengayaan';
      subTitle = `${subject} — ${grade} — Semester ${semester}`;
      fileName = `Remedial_Pengayaan_${cleanSubject}_${cleanGrade}.pdf`;

      const remedials = context.remedials || [];
      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            '..........................................................................................',
            '..........',
            '....................',
            '..........................................................................................',
            '..........',
            '..........',
          ])
        : remedials.length > 0
        ? remedials.map((r, idx) => {
            const student = (context.students || []).find((s) => s.id === r.studentId);
            const matchingTp = (tp?.items || []).find((t) => t.id === r.tpId);
            return [
              idx + 1,
              student?.name || 'Peserta Didik',
              matchingTp?.code || 'TP',
              r.reason || '< KKM / Perlu Bimbingan',
              r.intervention || 'Bimbingan Khusus / Penugasan Terbimbing',
              r.reassessmentScore || (r.status === 'completed' ? 78 : '-'),
              r.status === 'completed' ? 'Tuntas' : 'Berjalan',
            ];
          })
        : [
            [1, 'Belum ada data remedial', '—', '—', '—', '—', '—'],
          ];

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Nama Siswa', dataKey: 'name', width: 45 },
          { header: 'Kode TP', dataKey: 'code', width: 20, align: 'center' },
          { header: 'Kondisi Awal', dataKey: 'init', width: 25, align: 'center' },
          { header: 'Bentuk Kegiatan Tindak Lanjut', dataKey: 'act', width: 45 },
          { header: 'Nilai Akhir', dataKey: 'fin', width: 20, align: 'center' },
          { header: 'Keterangan', dataKey: 'stat', width: 22, align: 'center' },
        ],
        rows,
      });
      break;
    }

    case 'ANALISIS_SKL_KI_KD': {
      title = 'Analisis Standar Kompetensi Lulusan (SKL), KI, dan KD';
      subTitle = `${subject} — ${grade} — Kurikulum 2013 (K13)`;
      fileName = `Analisis_SKL_KI_KD_${cleanSubject}_${cleanGrade}.pdf`;

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            '....................',
            '....................',
            '....................',
            '..........................................................................................',
            '....................',
          ])
        : (context.k13Analysis?.items || []).map((it, idx) => [
            idx + 1,
            it.skl || 'Sikap / Pengetahuan',
            it.ki || `KI-${idx + 1}`,
            it.kd || `KD 3.${idx + 1}`,
            it.indikator || '-',
            it.materi || '-',
          ]);

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Domain SKL', dataKey: 'skl', width: 30 },
          { header: 'Kode KI', dataKey: 'ki', width: 20, align: 'center' },
          { header: 'Kode KD', dataKey: 'kd', width: 22, align: 'center' },
          { header: 'Indikator Pencapaian (IPK)', dataKey: 'ipk', width: 75 },
          { header: 'Lingkup Materi', dataKey: 'mat', width: 35 },
        ],
        rows,
      });
      break;
    }

    case 'PENETAPAN_KKM': {
      title = 'Penetapan Kriteria Ketuntasan Minimal (KKM)';
      subTitle = `${subject} — ${grade} — Kurikulum 2013 (K13)`;
      fileName = `Penetapan_KKM_${cleanSubject}_${cleanGrade}.pdf`;

      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            `KD 3.${idx + 1}`,
            '..........................................................................................',
            '.......... %',
            '.......... %',
            '.......... %',
            '.......... %',
          ])
        : (context.k13KKM?.items || []).map((it, idx) => [
            idx + 1,
            it.kd || `KD 3.${idx + 1}`,
            it.indikator || '-',
            it.kompleksitas != null ? `${it.kompleksitas}%` : '-',
            it.dayaDukung != null ? `${it.dayaDukung}%` : '-',
            it.intake != null ? `${it.intake}%` : '-',
            it.kkmIndikator != null ? `${it.kkmIndikator}%` : '-',
          ]);

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Kode KD', dataKey: 'kd', width: 22, align: 'center' },
          { header: 'Indikator Pencapaian Kompetensi', dataKey: 'ind', width: 75 },
          { header: 'Kompleksitas', dataKey: 'c1', width: 22, align: 'center' },
          { header: 'Daya Dukung', dataKey: 'c2', width: 22, align: 'center' },
          { header: 'Intake Siswa', dataKey: 'c3', width: 22, align: 'center' },
          { header: 'Nilai KKM', dataKey: 'kkm', width: 20, align: 'center' },
        ],
        rows,
      });
      break;
    }

    default: {
      const typeStr = String(type);
      title = `Dokumen ${typeStr.replace(/_/g, ' ')}`;
      subTitle = `${subject} — ${grade}`;
      fileName = `Dokumen_${typeStr}_${cleanSubject}_${cleanGrade}.pdf`;

      sections.push({
        type: 'paragraph',
        text: `Dokumen resmi administrasi guru: ${typeStr.replace(/_/g, ' ')}. Data terlampir sesuai dengan kurikulum dan profil pengajar.`,
      });
      break;
    }
  }

  if (isBlankMode) {
    title += ' (FORMAT KOSONG)';
    subTitle += ' — Format Kosong Siap Cetak / Tulis Manual';
    fileName = `[Format_Kosong]_${fileName}`;
  }

  const styleProfile: PdfStyleProfile = 'FORMAL_NEUTRAL';
  const dateString = formatOfficialDate(school, context.documentDate);

  const isAnnualScopeDoc =
    type === 'CP' ||
    type === 'TP' ||
    type === 'ATP' ||
    type === 'PROTA' ||
    type === 'ANALISIS_CP_TP';

  const builder = buildPdfFromOptions({
    orientation,
    styleProfile,
    title,
    subTitle,
    school,
    profile,
    academicSetting,
    sections,
    showSignature: true,
    isBlankMode,
    dateString,
    scope: isAnnualScopeDoc ? 'YEAR' : 'SEMESTER',
  });

  const blob = builder.getBlob();
  return { blob, fileName, title, snapshot };
}
