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

export async function generateDaftarNilai(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, students, assessments, assessmentResults } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  const headerTitle = isBlankMode
    ? 'BUKU DAFTAR NILAI & REKAPITULASI ASESMEN (FORMAT KOSONG)'
    : 'BUKU DAFTAR NILAI & REKAPITULASI ASESMEN';
  docChildren.push(
    ...createDocumentHeader(headerTitle, academicSetting.curriculum)
  );

  const studentList = students || [];
  const assessmentList = assessments || [];
  const resultsList = assessmentResults || [];

  // Metadata Table
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Jumlah Siswa', isBlankMode ? ': .......... Orang' : `: ${studentList.length} Orang`],
      ['Jumlah Instrumen Asesmen', isBlankMode ? ': .......... Penilaian' : `: ${assessmentList.length} Penilaian`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 1: Daftar Nilai Rinci
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'A. Daftar Perolehan Nilai Formatif & Sumatif Siswa',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  const tableRows: TableRow[] = [
    new TableRow({
      children: [
        createTableHeaderCell('No', 6, AlignmentType.CENTER),
        createTableHeaderCell('NISN', 14, AlignmentType.CENTER),
        createTableHeaderCell('Nama Siswa', 32, AlignmentType.LEFT),
        createTableHeaderCell('Formatif Rata2', 12, AlignmentType.CENTER),
        createTableHeaderCell('Sumatif LM', 12, AlignmentType.CENTER),
        createTableHeaderCell('Sumatif SAS', 12, AlignmentType.CENTER),
        createTableHeaderCell('Nilai Akhir', 12, AlignmentType.CENTER),
      ],
    }),
  ];

  if (isBlankMode || studentList.length === 0) {
    for (let i = 0; i < 20; i++) {
      tableRows.push(
        new TableRow({
          children: [
            createTableDataCell((i + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell('....................', 14, AlignmentType.CENTER),
            createTableDataCell('', 32),
            createTableDataCell('', 12, AlignmentType.CENTER),
            createTableDataCell('', 12, AlignmentType.CENTER),
            createTableDataCell('', 12, AlignmentType.CENTER),
            createTableDataCell('', 12, AlignmentType.CENTER),
          ],
        })
      );
    }
  } else {
    studentList.forEach((std, index) => {
      const studentRes = resultsList.filter((r) => r.studentId === std.id);
      const formatifScores = studentRes
        .filter((r) => {
          const a = assessmentList.find((x) => x.id === r.assessmentId);
          return a?.type === 'formatif';
        })
        .map((r) => r.score);

      const sumatifLMScores = studentRes
        .filter((r) => {
          const a = assessmentList.find((x) => x.id === r.assessmentId);
          return a?.type === 'sumatif_lingkup_materi';
        })
        .map((r) => r.score);

      const sumatifSAS = studentRes
        .filter((r) => {
          const a = assessmentList.find((x) => x.id === r.assessmentId);
          return a?.type === 'sumatif_akhir_semester';
        })
        .map((r) => r.score);

      const avgFormatif = formatifScores.length > 0 ? Math.round(formatifScores.reduce((a, b) => a + b, 0) / formatifScores.length) : 80;
      const avgSumatifLM = sumatifLMScores.length > 0 ? Math.round(sumatifLMScores.reduce((a, b) => a + b, 0) / sumatifLMScores.length) : 82;
      const valSAS = sumatifSAS.length > 0 ? sumatifSAS[0] : 84;
      const finalGrade = Math.round((avgFormatif + avgSumatifLM * 2 + valSAS * 2) / 5);

      tableRows.push(
        new TableRow({
          children: [
            createTableDataCell((index + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(std.nisn || '-', 14, AlignmentType.CENTER),
            createTableDataCell(std.name, 32),
            createTableDataCell(avgFormatif.toString(), 12, AlignmentType.CENTER),
            createTableDataCell(avgSumatifLM.toString(), 12, AlignmentType.CENTER),
            createTableDataCell(valSAS.toString(), 12, AlignmentType.CENTER),
            createTableDataCell(finalGrade.toString(), 12, AlignmentType.CENTER),
          ],
        })
      );
    });
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 2: Daftar Instrumen Asesmen
  if (isBlankMode || assessmentList.length > 0) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 80 },
        children: [
          new TextRun({
            text: 'B. Rincian Pelaksanaan Instrumen Asesmen',
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );

    const aRows: TableRow[] = [
      new TableRow({
        children: [
          createTableHeaderCell('No', 8, AlignmentType.CENTER),
          createTableHeaderCell('Judul Asesmen', 36, AlignmentType.LEFT),
          createTableHeaderCell('Jenis Asesmen', 26, AlignmentType.LEFT),
          createTableHeaderCell('Tanggal', 18, AlignmentType.CENTER),
          createTableHeaderCell('Batas Tuntas', 12, AlignmentType.CENTER),
        ],
      }),
    ];

    if (isBlankMode) {
      const defaultBlankAssessments = [
        ['1', 'Asesmen Formatif TP 1', 'Formatif (Observasi/Tulis)', '..../..../20....', '75'],
        ['2', 'Asesmen Formatif TP 2', 'Formatif (Kinerja/Produk)', '..../..../20....', '75'],
        ['3', 'Sumatif Lingkup Materi 1', 'Sumatif Lingkup Materi', '..../..../20....', '75'],
        ['4', 'Sumatif Lingkup Materi 2', 'Sumatif Lingkup Materi', '..../..../20....', '75'],
        ['5', 'Sumatif Akhir Semester (SAS)', 'Sumatif Akhir Semester', '..../..../20....', '75'],
      ];
      defaultBlankAssessments.forEach(([no, title, type, date, kkm]) => {
        aRows.push(
          new TableRow({
            children: [
              createTableDataCell(no, 8, AlignmentType.CENTER),
              createTableDataCell(title, 36),
              createTableDataCell(type, 26),
              createTableDataCell(date, 18, AlignmentType.CENTER),
              createTableDataCell(kkm, 12, AlignmentType.CENTER),
            ],
          })
        );
      });
    } else {
      assessmentList.forEach((a, i) => {
        const typeLabel =
          a.type === 'formatif'
            ? 'Formatif'
            : a.type === 'sumatif_lingkup_materi'
            ? 'Sumatif Lingkup Materi'
            : 'Sumatif Akhir Semester (SAS)';

        aRows.push(
          new TableRow({
            children: [
              createTableDataCell((i + 1).toString(), 8, AlignmentType.CENTER),
              createTableDataCell(a.title, 36),
              createTableDataCell(typeLabel, 26),
              createTableDataCell(a.date, 18, AlignmentType.CENTER),
              createTableDataCell((a.passingScore || 75).toString(), 12, AlignmentType.CENTER),
            ],
          })
        );
      });
    }

    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: aRows }));
    docChildren.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Signatures
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const safeGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = isBlankMode
    ? `[Format_Kosong]_Daftar_Nilai_${safeSubject}_${safeGrade}.docx`
    : `Daftar_Nilai_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'DAFTAR_NILAI',
    title: isBlankMode
      ? `Daftar Nilai (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
      : `Daftar Nilai - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-nilai-${Date.now()}`,
      type: 'DAFTAR_NILAI',
      title: isBlankMode
        ? `Daftar Nilai (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
        : `Daftar Nilai - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
