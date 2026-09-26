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
import { formatOfficialDate } from './pdfTheme';
import { resolveEffectiveContext, createDocumentSnapshot } from '../../snapshot';

export async function generatePdfDocument(
  type: DocumentType,
  rawContext: DocumentGenerationContext
): Promise<{ blob: Blob; fileName: string; title: string; snapshot: DocumentSnapshot }> {
  const context = resolveEffectiveContext(rawContext);
  const snapshot = context.snapshot || createDocumentSnapshot(context, 'pdf', context.documentMode);
  const { school, profile, academicSetting, cp, tp, atp, students, calendarDays, timeAllocations } = context;
  const isBlankMode = context.documentMode === 'blank';

  const subject = academicSetting?.subject || 'Mata Pelajaran';
  const grade = academicSetting?.grade || 'Kelas 1';
  const semester = academicSetting?.semester || '1 (Ganjil)';
  const academicYear = academicSetting?.academicYear || '2026/2027';
  const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = grade.replace(/[^a-zA-Z0-9]/g, '_');

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
      });

      sections.push({
        type: 'heading',
        text: 'B. Capaian Pembelajaran per Elemen',
        level: 1,
      });

      const rows = isBlankMode
        ? Array.from({ length: 12 }, (_, idx) => [idx + 1, '....................', '..........................................................................................'])
        : (cp?.elements || []).map((elem, idx) => [
            idx + 1,
            elem.name,
            elem.content,
          ]);

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
            it.elementName || 'Elemen Pembelajaran',
            it.competence || 'Kompetensi',
            it.contentScope || 'Lingkup Materi',
            it.statement || 'Pernyataan TP',
            (it.p3Dimensions || []).join(', ') || 'Mandiri, Bernalar Kritis',
          ])
        : [[1, 'Menyimak/Membaca', 'Memahami', 'Teks Narasi', 'Peserta didik mampu memahami ide pokok teks narasi', 'Bernalar Kritis']];

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
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'}) — Semester ${semester}`;
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
        : (tp?.items || []).map((it, idx) => [
            idx + 1,
            it.code || `TP ${idx + 1}`,
            it.statement || '-',
            it.contentScope || '-',
            (it.p3Dimensions || []).join(', ') || 'Bernalar Kritis',
          ]);

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Kode TP', dataKey: 'code', width: 22, align: 'center' },
          { header: 'Pernyataan Tujuan Pembelajaran', dataKey: 'statement', width: 85 },
          { header: 'Lingkup Materi', dataKey: 'mat', width: 40 },
          { header: 'Profil Pelajar Pancasila', dataKey: 'p3', width: 30 },
        ],
        rows,
      });
      break;
    }

    case 'ATP': {
      title = 'Alur Tujuan Pembelajaran (ATP)';
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'}) — Alokasi: ${atp?.totalJP || 72} JP`;
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
        : (atp?.items || []).map((it, idx) => [
            it.stepNumber || idx + 1,
            it.tpCode || `TP ${idx + 1}`,
            it.tpStatement || '-',
            it.materialScope || '-',
            `${it.jp || 6} JP`,
            (it.p3Dimensions || []).join(', ') || 'Bernalar Kritis',
            it.assessmentPlan || 'Formatif & Sumatif',
            it.glossary || '-',
          ]);

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
        : (atp?.items || []).map((it, idx) => [
            idx + 1,
            semester,
            it.tpCode || `TP ${idx + 1}`,
            it.tpStatement || '-',
            it.materialScope || '-',
            `${it.jp || 6} JP`,
          ]);

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
        : (atp?.items || []).map((it, idx) => [
            idx + 1,
            it.tpCode || `TP ${idx + 1}`,
            it.tpStatement || '-',
            it.materialScope || '-',
            `${it.jp || 6} JP`,
            'v', '', '', '', 'v', '', '', '', 'v', '', '', '', 'v', '', '', '',
          ]);

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
      title = 'Modul Ajar / RPP Berdiferensiasi';
      subTitle = `${subject} — ${grade} (${academicSetting?.phase || 'Fase A'}) — Semester ${semester}`;
      fileName = `Modul_Ajar_${cleanSubject}_${cleanGrade}.pdf`;

      sections.push({
        type: 'heading',
        text: 'I. INFORMASI UMUM',
        level: 1,
      });
      sections.push({
        type: 'paragraph',
        text: isBlankMode
          ? 'Target Peserta Didik: ........................................................\nJumlah Peserta Didik: .......... siswa.\nModel Pembelajaran: ........................................................\nSarana & Prasarana: ........................................................'
          : `Target Peserta Didik: Peserta didik reguler/tipikal.\nJumlah Peserta Didik: ${students?.length || 28} siswa.\nModel Pembelajaran: Tatap muka, Problem-Based Learning (PBL) & Project-Based Learning (PjBL).\nSarana & Prasarana: Buku Panduan Guru & Siswa, LKPD, LCD Proyektor, Alat Peraga Kontekstual.`,
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
          : `Tujuan Pembelajaran: ${tp?.items[0]?.statement || 'Peserta didik memahami materi dan menerapkan dalam kehidupan sehari-hari.'}\n\nPemahaman Bermakna: Pembelajaran bermakna yang menghubungkan konsep materi dengan pengalaman konkret siswa di lingkungan sekitar.\n\nPertanyaan Pemantik: Bagaimana kita dapat memanfaatkan pemahaman ini untuk memecahkan persoalan nyata?`,
      });

      sections.push({
        type: 'heading',
        text: 'III. KEGIATAN PEMBELAJARAN BERDIFERENSIASI',
        level: 1,
      });
      sections.push({
        type: 'paragraph',
        text: isBlankMode
          ? '1. Kegiatan Pendahuluan: ........................................................................................................................................................\n2. Kegiatan Inti: ........................................................................................................................................................\n3. Kegiatan Penutup: ........................................................................................................................................................'
          : `1. Kegiatan Pendahuluan (10 Menit): Orientasi salam, doa, apersepsi, dan penyampaian tujuan pembelajaran.\n2. Kegiatan Inti (50 Menit): Eksplorasi konsep berdiferensiasi konten & proses, diskusi kelompok, presentasi hasil karya.\n3. Kegiatan Penutup (10 Menit): Refleksi bersama, penguatan kesimpulan, dan tindak lanjut tugas mandiri.`,
      });
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

    case 'ASESMEN': {
      title = 'Kisi-Kisi dan Instrumen Asesmen Pembelajaran';
      subTitle = `${subject} — ${grade} — Semester ${semester}`;
      fileName = `Instrumen_Asesmen_${cleanSubject}_${cleanGrade}.pdf`;

      const assessments = context.assessments || [];
      const rows = isBlankMode
        ? Array.from({ length: 15 }, (_, idx) => [
            idx + 1,
            '..........................................................................................',
            '....................',
            '....................',
            '..........',
            '....................................................',
          ])
        : assessments.length > 0
        ? assessments.map((a, idx) => {
            const typeLabel =
              a.type === 'formatif'
                ? 'Formatif'
                : a.type === 'sumatif_lingkup_materi'
                ? 'Sumatif LM'
                : 'Sumatif SAS';
            return [
              idx + 1,
              a.title,
              typeLabel,
              a.description || 'Tes Tertulis / Observasi',
              a.maxScore ? `${a.maxScore} Poin` : '100',
              a.passingScore ? `KKM / Kriteria Minimum: ${a.passingScore}` : 'Pedoman Penskoran & Rubrik Performa',
            ];
          })
        : [
            [1, 'Asesmen Formatif 1: Unjuk Kerja', 'Formatif', 'Unjuk Kerja / Observasi', '100 Poin', 'Rubrik performa proses'],
            [2, 'Asesmen Sumatif Lingkup Materi 1', 'Sumatif LM', 'Tes Tertulis', '100 Poin', 'Pilihan Ganda & Uraian'],
            [3, 'Asesmen Sumatif Akhir Semester (SAS)', 'Sumatif SAS', 'Tes Tertulis & Portofolio', '100 Poin', 'Soal Standar Evaluasi'],
          ];

      sections.push({
        type: 'table',
        columns: [
          { header: 'No', dataKey: 'no', width: 10, align: 'center' },
          { header: 'Nama Asesmen', dataKey: 'name', width: 55 },
          { header: 'Jenis', dataKey: 'type', width: 25, align: 'center' },
          { header: 'Teknik / Bentuk', dataKey: 'tech', width: 35 },
          { header: 'Skor Max', dataKey: 'weight', width: 20, align: 'center' },
          { header: 'Pedoman Penskoran', dataKey: 'rubric', width: 45 },
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
            const avgScore = studentResults.length > 0
              ? Math.round(studentResults.reduce((acc, curr) => acc + curr.score, 0) / studentResults.length)
              : 80;
            const tp1Score = studentResults[0]?.score ?? avgScore;
            const tp2Score = studentResults[1]?.score ?? avgScore;
            const tp3Score = studentResults[2]?.score ?? avgScore;
            const sasScore = studentResults[3]?.score ?? avgScore;

            return [
              idx + 1,
              st.nisn || '-',
              st.name,
              st.gender || 'L',
              tp1Score,
              tp2Score,
              tp3Score,
              sasScore,
              avgScore,
              avgScore >= 75 ? 'Tercapai' : 'Perlu Bimbingan',
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
            const hCount = total > 0 ? studentRecs.filter((r) => r.status === 'H' || r.status === 'D').length : 12;
            const pct = total > 0 ? `${Math.round((hCount / total) * 100)}%` : '100%';

            return [
              idx + 1,
              st.nisn || '-',
              st.name,
              st.gender || 'L',
              'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H',
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
            [1, '13 Juli 2026', 'Kegiatan Sekolah', 'Hari Pertama Masuk Sekolah / MPLS'],
            [2, '17 Agustus 2026', 'Hari Libur', 'HUT Kemerdekaan RI Ke-81'],
            [3, '21 September 2026', 'Kegiatan Sekolah', 'Penilaian Tengah Semester (PTS/STS)'],
            [4, '25 November 2026', 'Kegiatan Sekolah', 'Hari Guru Nasional'],
            [5, '07 Desember 2026', 'Kegiatan Sekolah', 'Penilaian Akhir Semester (PAS/SAS)'],
            [6, '19 Desember 2026', 'Kegiatan Sekolah', 'Pembagian Rapor Semester 1'],
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
              matchingTp?.contentScope || matchingTp?.statement || a.notes || 'Materi Pokok',
              a.weekNumber ? `Pekan ke-${a.weekNumber}` : '1 Pekan Efektif',
              `${a.jp || 4} JP`,
              a.notes || `${a.monthName || 'Bulan Berjalan'} - Tatap Muka`,
            ];
          })
        : (atp?.items || []).map((it, idx) => [
            idx + 1,
            it.tpCode || `TP ${idx + 1}`,
            it.materialScope || it.tpStatement,
            '2 Pekan Efektif',
            `${it.jp || 6} JP`,
            `Minggu ke-${idx * 2 + 1} s.d ${idx * 2 + 2}`,
          ]);

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
        : (context.students || []).length > 0
        ? (context.students || []).slice(0, 2).map((st, idx) => [
            idx + 1,
            st.name,
            'TP 1.1',
            'Perlu Bimbingan',
            'Bimbingan Terbimbing Guru / Tutor Sebaya',
            78,
            'Berjalan',
          ])
        : [
            [1, 'Belum ada data remedial', '-', '-', '-', '-', '-'],
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
            `${it.kompleksitas || 75}%`,
            `${it.dayaDukung || 80}%`,
            `${it.intake || 75}%`,
            `${it.kkmIndikator || 77}%`,
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

  const builder = buildPdfFromOptions({
    orientation,
    title,
    subTitle,
    school,
    profile,
    academicSetting,
    sections,
    showSignature: true,
    isBlankMode,
  });

  const blob = builder.getBlob();
  return { blob, fileName, title, snapshot };
}
