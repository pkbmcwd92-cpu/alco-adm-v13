import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createSignoffBlock,
} from '../docxStyles';

export async function generateModulAjar(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp, tp, cp } = context;

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  docChildren.push(
    ...createDocumentHeader(
      'MODUL AJAR / RPP BERDIFERENSIASI',
      `${academicSetting.curriculum} — ${academicSetting.grade} (${academicSetting.phase})`
    )
  );

  // Identity Table
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Alokasi Waktu', `: ${atp.totalJP || 24} Jam Pelajaran (JP)`],
      ['Moda Pembelajaran', ': Tatap Muka (Luring) / Pembelajaran Aktif'],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section Builder Helper
  const addSectionTitle = (title: string) => {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 24, // 12pt
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );
  };

  const addSubSection = (subTitle: string, content: string) => {
    docChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: subTitle,
            bold: true,
            size: 20,
            font: 'Arial',
            color: '0F172A',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 100 },
        children: [
          new TextRun({
            text: content,
            size: 19,
            font: 'Arial',
            color: '334155',
          }),
        ],
      })
    );
  };

  // Compile TP & P3 items
  const tpList = tp?.items && tp.items.length > 0
    ? tp.items.map((t, idx) => `${idx + 1}. [${t.code || 'TP'}] ${t.statement}`).join('\n')
    : (atp?.items || []).map((a, idx) => `${idx + 1}. [${a.tpCode || 'TP'}] ${a.tpStatement}`).join('\n');

  const allP3 = Array.from(
    new Set(
      (atp?.items || [])
        .flatMap((i) => i.p3Dimensions || [])
        .concat(['Beriman dan Bertakwa', 'Bernalar Kritis', 'Gotong Royong', 'Kreatif', 'Mandiri'])
    )
  ).slice(0, 4);

  const materialsList = (atp?.items || [])
    .map((i) => i.materialScope)
    .filter(Boolean)
    .join(', ') || academicSetting.subject;

  // I. INFORMASI UMUM
  addSectionTitle('I. INFORMASI UMUM');
  addSubSection(
    'A. Kompetensi Awal',
    `Peserta didik telah memiliki pemahaman dasar terkait konsep awal materi ${academicSetting.subject} serta mampu berpartisipasi aktif dalam kegiatan pembelajaran interaktif di kelas.`
  );
  addSubSection(
    'B. Profil Pelajar Pancasila',
    `Selama dan setelah proses pembelajaran, peserta didik diharapkan mengembangkan karakter Profil Pelajar Pancasila: ${allP3.join(', ')}.`
  );
  addSubSection(
    'C. Sarana dan Prasarana',
    `1. Sumber Belajar: Buku Panduan Guru dan Buku Siswa ${academicSetting.subject} ${academicSetting.curriculum}, Lembar Kerja Peserta Didik (LKPD), video pembelajaran kontekstual.\n2. Media/Alat: Proyektor LCD / Papan Tulis, Laptop, kartu materi / media manipulatif, lingkungan sekolah.`
  );
  addSubSection(
    'D. Target Peserta Didik',
    `1. Jumlah Peserta Didik: ${context.students?.length || 0} Siswa (${academicSetting.grade}).\n2. Peserta Didik Reguler/Tipikal: Umum, tidak ada kesulitan dalam mencerna dan memahami materi ajar.\n3. Peserta Didik dengan Kesulitan Belajar: Memiliki gaya belajar tertentu atau membutuhkan bimbingan bertahap (scaffolding).\n4. Peserta Didik dengan Pencapaian Tinggi: Mampu mencerna materi dengan cepat dan terampil memecahkan masalah tingkat tinggi (HOTS).`
  );
  addSubSection(
    'E. Model & Pendekatan Pembelajaran',
    'Pendekatan: Saintifik / Kontekstual (Contextual Teaching and Learning)\nModel Pembelajaran: Problem Based Learning (PBL) / Discovery Learning / Pembelajaran Berdiferensiasi (Konten, Proses, Produk)'
  );

  // II. KOMPONEN INTI
  addSectionTitle('II. KOMPONEN INTI');
  addSubSection(
    'A. Tujuan Pembelajaran (TP)',
    `Melalui serangkaian kegiatan pembelajaran terstruktur, peserta didik mampu:\n${tpList}`
  );
  addSubSection(
    'B. Pemahaman Bermakna',
    `Peserta didik memahami bahwa konsep materi ${materialsList} memiliki aplikasi langsung dan kebermanfaatan nyata dalam kehidupan sehari-hari dan penyelesaian masalah sosial/lingkungan.`
  );
  addSubSection(
    'C. Pertanyaan Pemantik',
    `1. Mengapa materi ${academicSetting.subject} ini penting untuk kita pelajari bersama?\n2. Bagaimana kita dapat menerapkan konsep ini ketika menghadapi tantangan di kehidupan sehari-hari?\n3. Apa yang terjadi jika kita tidak memahami langkah-langkah dalam topik ini dengan benar?`
  );

  // III. KEGIATAN PEMBELAJARAN BERDIFERENSIASI
  addSectionTitle('III. KEGIATAN PEMBELAJARAN BERDIFERENSIASI');

  atp.items.forEach((item, idx) => {
    docChildren.push(
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [
          new TextRun({
            text: `Pertemuan / Unit ${idx + 1}: ${item.materialScope || `Topik ${idx + 1}`} (${item.jp || 4} JP)`,
            bold: true,
            size: 20,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );

    const pertemuanActivities = [
      `1. Kegiatan Pendahuluan (15 Menit):
• Guru menyapa peserta didik dengan salam hangat, berdoa bersama, dan memeriksa kehadiran.
• Apersepsi: Guru mengaitkan materi pertemuan sebelumnya dengan topik "${item.materialScope || item.tpStatement}".
• Motivasi: Guru menyampaikan tujuan pembelajaran (${item.tpCode}) dan manfaat mempelajarinya.`,

      `2. Kegiatan Inti (70 Menit) — Pembelajaran Berdiferensiasi:
• Orientasi Masalah: Guru menampilkan stimulus kontekstual (gambar/cerita/video) terkait materi.
• Diferensiasi Konten: Guru menyediakan bahan ajar dalam beragam format (visual/teks bacaan/media interaktif) sesuai gaya belajar siswa.
• Diferensiasi Proses: Siswa berkolaborasi dalam kelompok terarah. Guru memberikan bimbingan intensif kepada siswa yang membutuhkan bantuan dan memberikan tantangan eksplorasi kepada siswa berkemampuan tinggi.
• Diferensiasi Produk: Peserta didik menyajikan hasil diskusi atau pemahaman melalui media pilihan (laporan ringkas/peta pikiran/presentasi lisan).`,

      `3. Kegiatan Penutup (15 Menit):
• Guru bersama peserta didik merangkum poin-poin utama materi yang telah dipelajari.
• Refleksi: Peserta didik menyampaikan apa yang dirasakan dan hal baru yang dipahami.
• Guru memberikan umpan balik apresiatif dan menyampaikan rencana materi pertemuan berikutnya.
• Doa penutup dan salam.`,
    ];

    pertemuanActivities.forEach((act) => {
      docChildren.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({
              text: act,
              size: 19,
              font: 'Arial',
              color: '1E293B',
            }),
          ],
        })
      );
    });
  });

  // IV. ASESMEN PEMBELAJARAN
  addSectionTitle('IV. ASESMEN PEMBELAJARAN');
  addSubSection(
    'A. Asesmen Diagnostik (Awal Pembelajaran)',
    'Dilakukan di awal untuk mengetahui kesiapan belajar, pemahaman prasyarat, dan minat peserta didik (melalui tanya jawab lisan / kuis apersepsi singkat).'
  );
  addSubSection(
    'B. Asesmen Formatif (Selama Proses Pembelajaran)',
    '1. Penilaian Sikap: Observasi keterlibatan, gotong royong, dan kemandirian siswa saat diskusi kelompok.\n2. Penilaian Performa: Lembar kerja siswa (LKPD) dan kemampuan presentasi/komunikasi.'
  );
  addSubSection(
    'C. Asesmen Sumatif (Akhir Lingkup Materi)',
    'Tes tertulis objektif/uraian atau penugasan proyek terstruktur untuk mengukur ketercapaian Tujuan Pembelajaran secara komprehensif.'
  );

  // V. PENGAYAAN DAN REMEDIAL
  addSectionTitle('V. PENGAYAAN DAN REMEDIAL');
  addSubSection(
    'A. Pengayaan',
    'Diberikan kepada peserta didik dengan capaian tinggi berupa studi kasus tambahan, tugas eksplorasi berbasis HOTS, atau menjadi tutor sebaya bagi rekan sekelas.'
  );
  addSubSection(
    'B. Remedial',
    'Diberikan kepada peserta didik yang belum mencapai Kriteria Ketercapaian Tujuan Pembelajaran (KKTP) berupa bimbingan ulang secara individual/kelompok kecil atau penugasan soal dengan penyederhanaan bertahap.'
  );

  // VI. REFLEKSI
  addSectionTitle('VI. REFLEKSI GURU DAN PESERTA DIDIK');
  addSubSection(
    'A. Refleksi Guru',
    '1. Apakah alokasi waktu kegiatan pembelajaran sudah efektif dan sesuai rancangan?\n2. Apakah seluruh peserta didik terlibat aktif dalam proses pembelajaran berdiferensiasi?\n3. Bagian kegiatan mana yang memerlukan penyesuaian untuk pertemuan mendatang?'
  );
  addSubSection(
    'B. Refleksi Peserta Didik',
    '1. Bagian materi mana yang paling menarik dan kamu sukai pada pertemuan ini?\n2. Hal apa yang masih terasa menantang atau belum kamu pahami sepenuhnya?\n3. Apa yang akan kamu lakukan untuk meningkatkan pemahamanmu pada materi selanjutnya?'
  );

  // VII. LAMPIRAN
  addSectionTitle('VII. LAMPIRAN');
  addSubSection(
    'A. Lembar Kerja Peserta Didik (LKPD)',
    `LKPD terlampir pada modul ini, berisi panduan aktivitas diskusi kelompok, studi kasus terbimbing, dan rubrik penilaian kerja mandiri untuk materi ${materialsList}.`
  );
  addSubSection(
    'B. Glosarium',
    atp.items
      .map((i) => (i.glossary ? `• ${i.glossary}` : ''))
      .filter(Boolean)
      .join('\n') || `• ${academicSetting.subject}: Bidang ilmu terstruktur yang dipelajari pada fase ini.`
  );
  addSubSection(
    'C. Daftar Pustaka',
    `1. Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI. Buku Panduan Guru & Siswa ${academicSetting.subject} ${academicSetting.grade} ${academicSetting.curriculum}. Jakarta: Pusat Kurikulum dan Perbukuan.\n2. Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP). Panduan Pembelajaran dan Asesmen Kurikulum Merdeka.`
  );

  // Signoff Block
  docChildren.push(...createSignoffBlock(school, profile));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `MODUL_AJAR_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'MODUL_AJAR',
    title: 'Modul Ajar / RPP Berdiferensiasi',
    fileName,
    blob,
    record: {
      id: `doc-modul-${Date.now()}`,
      type: 'MODUL_AJAR',
      title: 'Modul Ajar / RPP Berdiferensiasi',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
