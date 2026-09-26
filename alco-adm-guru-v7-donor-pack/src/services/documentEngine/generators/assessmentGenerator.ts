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
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
} from '../docxStyles';

export async function generateAssessment(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp, tp } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // 1. Header
  docChildren.push(
    ...createDocumentHeader(
      isBlankMode ? 'PANDUAN, INSTRUMEN ASESMEN & RUBRIK PENILAIAN (FORMAT KOSONG)' : 'PANDUAN, INSTRUMEN ASESMEN & RUBRIK PENILAIAN',
      `${academicSetting.curriculum} — ${academicSetting.subject} ${academicSetting.grade}`
    )
  );

  // 2. Identity Metadata
  docChildren.push(createIdentityMetadataTable(school, profile, academicSetting));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Helper Section Heading
  const addSectionHeading = (title: string) => {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );
  };

  // I. KISI-KISI ASESMEN
  addSectionHeading('I. KISI-KISI ASESMEN PEMBELAJARAN (IKTP & TEKNIK PENILAIAN)');

  const kisiHeader = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 6),
      createTableHeaderCell('Kode & Tujuan Pembelajaran', 34, AlignmentType.LEFT),
      createTableHeaderCell('Indikator Ketercapaian TP (IKTP)', 30, AlignmentType.LEFT),
      createTableHeaderCell('Teknik Asesmen', 15),
      createTableHeaderCell('Bentuk Instrumen', 15),
    ],
  });

  const tpItems = tp?.items && tp.items.length > 0 ? tp.items : (atp?.items || []).map((a) => ({
    code: a.tpCode,
    statement: a.tpStatement,
    competence: 'Memahami & Mengaplikasikan',
    contentScope: a.materialScope,
  }));

  const kisiRows = isBlankMode
    ? Array.from({ length: 8 }, (_, idx) =>
        new TableRow({
          children: [
            createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
            createTableDataCell(`[TP ${idx + 1}] .....................................................................`, 34),
            createTableDataCell('..........................................................................................', 30),
            createTableDataCell('....................', 15, AlignmentType.CENTER),
            createTableDataCell('....................', 15, AlignmentType.CENTER),
          ],
        })
      )
    : tpItems.map((item, idx) => {
        return new TableRow({
          children: [
            createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
            new TableCell({
              width: { size: 34, type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `[${item.code}] `, bold: true, size: 19, font: 'Arial', color: '1E3A8A' }),
                    new TextRun({ text: item.statement, size: 19, font: 'Arial' }),
                  ],
                }),
              ],
            }),
            createTableDataCell(
              `Peserta didik mampu menunjukkan pemahaman mengenai ${item.contentScope || 'materi pokok'} dan menerapkannya dengan tepat.`,
              30
            ),
            createTableDataCell('Tes Tulis & Kinerja', 15, AlignmentType.CENTER),
            createTableDataCell('Soal Uraian / Lembar Observasi', 15, AlignmentType.CENTER),
          ],
        });
      });

  const kisiTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [kisiHeader, ...kisiRows],
  });

  docChildren.push(kisiTable);

  // II. INSTRUMEN ASESMEN FORMATIF
  addSectionHeading('II. INSTRUMEN ASESMEN FORMATIF (LEMBAR OBSERVASI SIKAP & KINERJA)');
  docChildren.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({
          text: 'Petunjuk: Lembar ini digunakan oleh guru selama proses pembelajaran untuk mengamati perkembangan karakter dan keaktifan peserta didik.',
          size: 19,
          font: 'Arial',
          italics: true,
          color: '475569',
        }),
      ],
    })
  );

  const formatifHeader = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 6),
      createTableHeaderCell('Nama Peserta Didik', 30, AlignmentType.LEFT),
      createTableHeaderCell('Bernalar Kritis', 16),
      createTableHeaderCell('Gotong Royong', 16),
      createTableHeaderCell('Kemandirian', 16),
      createTableHeaderCell('Catatan Kejadian Khusus', 16, AlignmentType.LEFT),
    ],
  });

  const studentCount = isBlankMode ? 15 : Math.max(context.students?.length || 0, 4);
  const formatifRows = Array.from({ length: studentCount }, (_, idx) => {
    const studentName = !isBlankMode && context.students?.[idx]
      ? context.students[idx].name
      : `${idx + 1}. ........................................`;
    return new TableRow({
      children: [
        createTableDataCell(`${idx + 1}`, 6, AlignmentType.CENTER),
        createTableDataCell(studentName, 30),
        createTableDataCell(isBlankMode ? '' : 'SB / B / C / K', 16, AlignmentType.CENTER),
        createTableDataCell(isBlankMode ? '' : 'SB / B / C / K', 16, AlignmentType.CENTER),
        createTableDataCell(isBlankMode ? '' : 'SB / B / C / K', 16, AlignmentType.CENTER),
        createTableDataCell('', 16),
      ],
    });
  });

  const formatifTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [formatifHeader, ...formatifRows],
  });

  docChildren.push(formatifTable);

  // III. RUBRIK PENILAIAN & KRITERIA KETERCAPAIAN (KKTP)
  addSectionHeading('III. RUBRIK KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)');

  const rubrikHeader = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('Kategori Capaian', 22),
      createTableHeaderCell('Rentang Interval', 18),
      createTableHeaderCell('Deskripsi Kriteria Kualitatif', 40, AlignmentType.LEFT),
      createTableHeaderCell('Intervensi / Tindak Lanjut Guru', 20, AlignmentType.LEFT),
    ],
  });

  const rubrikRows = [
    new TableRow({
      children: [
        createTableDataCell('Perlu Bimbingan', 22, AlignmentType.CENTER, true),
        createTableDataCell('0% - 60%', 18, AlignmentType.CENTER),
        createTableDataCell('Peserta didik belum mampu memahami konsep esensial dan belum dapat menyelesaikan latihan secara mandiri.', 40),
        createTableDataCell('Remedial intensif secara individual dari awal konsep materi.', 20),
      ],
    }),
    new TableRow({
      children: [
        createTableDataCell('Cukup', 22, AlignmentType.CENTER, true),
        createTableDataCell('61% - 70%', 18, AlignmentType.CENTER),
        createTableDataCell('Peserta didik telah memahami sebagian konsep dasar namun masih sering ragu dalam menyelesaikan soal penerapan.', 40),
        createTableDataCell('Remedial pada bagian indikator yang belum tuntas dengan tutor sebaya.', 20),
      ],
    }),
    new TableRow({
      children: [
        createTableDataCell('Baik', 22, AlignmentType.CENTER, true),
        createTableDataCell('71% - 85%', 18, AlignmentType.CENTER),
        createTableDataCell('Peserta didik telah mencapai tujuan pembelajaran secara menyeluruh dan mampu menyelesaikan tugas dengan tepat.', 40),
        createTableDataCell('Diberikan apresiasi dan melanjutkan ke materi pembelajaran berikutnya.', 20),
      ],
    }),
    new TableRow({
      children: [
        createTableDataCell('Sangat Baik', 22, AlignmentType.CENTER, true),
        createTableDataCell('86% - 100%', 18, AlignmentType.CENTER),
        createTableDataCell('Peserta didik menguasai materi secara mendalam dan mampu menganalisis serta mengaitkan konsep secara kreatif (HOTS).', 40),
        createTableDataCell('Pengayaan berupa pemecahan masalah kompleks atau studi kasus mandiri.', 20),
      ],
    }),
  ];

  const rubrikTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [rubrikHeader, ...rubrikRows],
  });

  docChildren.push(rubrikTable);

  // 4. Signoff Block
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode));

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
  const fileName = isBlankMode
    ? `[Format_Kosong]_Asesmen_Rubrik_${cleanSubject}_${cleanGrade}.docx`
    : `ASESMEN_DAN_RUBRIK_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'ASESMEN',
    title: isBlankMode ? 'Instrumen Asesmen & Rubrik Penilaian (Format Kosong)' : 'Instrumen Asesmen & Rubrik Penilaian',
    fileName,
    blob,
    record: {
      id: `doc-asesmen-${Date.now()}`,
      type: 'ASESMEN',
      title: isBlankMode ? 'Instrumen Asesmen & Rubrik Penilaian (Format Kosong)' : 'Instrumen Asesmen & Rubrik Penilaian',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
