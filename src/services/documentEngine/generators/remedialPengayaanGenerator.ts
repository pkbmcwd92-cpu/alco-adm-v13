import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  AlignmentType,
  WidthType,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
  createSectionHeading,
  createDocxSectionProperties,
} from '../docxStyles';

export async function generateRemedialPengayaan(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, students, remedials, enrichments } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  const headerTitle = isBlankMode
    ? 'PROGRAM & LAPORAN PELAKSANAAN REMEDIAL DAN PENGAYAAN (FORMAT KOSONG)'
    : 'PROGRAM & LAPORAN PELAKSANAAN REMEDIAL DAN PENGAYAAN';
  docChildren.push(
    ...createDocumentHeader(headerTitle, academicSetting.curriculum)
  );

  const studentList = students || [];
  const remedialList = remedials || [];
  const enrichmentList = enrichments || [];

  // Metadata Table
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Jumlah Siswa Terfasilitasi Remedial', isBlankMode ? ': .......... Orang' : `: ${remedialList.length} Orang`],
      ['Jumlah Siswa Diberi Pengayaan', isBlankMode ? ': .......... Orang' : `: ${enrichmentList.length} Orang`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 1: Pelaksanaan Remedial
  docChildren.push(
    createSectionHeading('A. Daftar & Pelaksanaan Kegiatan Pembelajaran Remedial', 1)
  );

  const remRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6, AlignmentType.CENTER),
        createTableHeaderCell('Nama Siswa', 24, AlignmentType.LEFT),
        createTableHeaderCell('Indikator Belum Tercapai', 26, AlignmentType.LEFT),
        createTableHeaderCell('Bentuk Intervensi Bimbingan', 24, AlignmentType.LEFT),
        createTableHeaderCell('Tgl / Nilai Akhir', 20, AlignmentType.CENTER),
      ],
    }),
  ];

  if (isBlankMode) {
    for (let i = 0; i < 15; i++) {
      remRows.push(
        new TableRow({
          children: [
            createTableDataCell((i + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell('', 24),
            createTableDataCell('', 26),
            createTableDataCell('', 24),
            createTableDataCell('..../..../20...\nNilai: .....', 20, AlignmentType.CENTER),
          ],
        })
      );
    }
  } else if (remedialList.length === 0) {
    remRows.push(
      new TableRow({
        children: [
          createTableDataCell('-', 6, AlignmentType.CENTER),
          createTableDataCell('Seluruh siswa mencapai KKTP', 24),
          createTableDataCell('Tuntas sesuai kriteria ketercapaian', 26),
          createTableDataCell('Penguatan reguler di kelas', 24),
          createTableDataCell('Tercapai', 20, AlignmentType.CENTER),
        ],
      })
    );
  } else {
    remedialList.forEach((r, i) => {
      const std = studentList.find((s) => s.id === r.studentId);
      remRows.push(
        new TableRow({
          children: [
            createTableDataCell((i + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(std?.name || 'Siswa', 24),
            createTableDataCell(r.reason || 'Perlu bimbingan konsep inti', 26),
            createTableDataCell(r.intervention || 'Bimbingan khusus perorangan', 24),
            createTableDataCell(`${r.date || '-'}\nNilai: ${r.reassessmentScore || 78}`, 20, AlignmentType.CENTER),
          ],
        })
      );
    });
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: remRows }));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 2: Pelaksanaan Pengayaan
  docChildren.push(
    createSectionHeading('B. Daftar & Pelaksanaan Kegiatan Pembelajaran Pengayaan', 1)
  );

  const enrRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6, AlignmentType.CENTER),
        createTableHeaderCell('Nama Siswa', 26, AlignmentType.LEFT),
        createTableHeaderCell('Bentuk Kegiatan Pengayaan', 38, AlignmentType.LEFT),
        createTableHeaderCell('Tanggal / Hasil', 30, AlignmentType.CENTER),
      ],
    }),
  ];

  if (isBlankMode) {
    for (let i = 0; i < 15; i++) {
      enrRows.push(
        new TableRow({
          children: [
            createTableDataCell((i + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell('', 26),
            createTableDataCell('', 38),
            createTableDataCell('..../..../20...', 30, AlignmentType.CENTER),
          ],
        })
      );
    }
  }

  if (!isBlankMode) {
    if (enrichmentList.length === 0) {
      enrRows.push(
        new TableRow({
          children: [
            createTableDataCell('1', 6, AlignmentType.CENTER),
            createTableDataCell(studentList[0]?.name || 'Siswa Berprestasi', 26),
            createTableDataCell('Eksplorasi soal penalaran tinggi (HOTS) & tutor sebaya', 38),
            createTableDataCell('Terlaksana dengan sangat baik', 30, AlignmentType.CENTER),
          ],
        })
      );
    } else {
      enrichmentList.forEach((e, i) => {
        const std = studentList.find((s) => s.id === e.studentId);
        enrRows.push(
          new TableRow({
            children: [
              createTableDataCell((i + 1).toString(), 6, AlignmentType.CENTER),
              createTableDataCell(std?.name || 'Siswa', 26),
              createTableDataCell(e.activity || 'Penugasan studi kasus mandiri', 38),
              createTableDataCell(`${e.date || '-'}\n${e.result || 'Sangat Baik'}`, 30, AlignmentType.CENTER),
            ],
          })
        );
      });
    }
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: enrRows }));
  docChildren.push(new Paragraph({ spacing: { after: 220 } }));

  // Signatures
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode, context.documentDate));

  // Build Document (Portrait A4)
  const doc = new Document({
    sections: [
      {
        properties: createDocxSectionProperties('portrait'),
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const safeGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = isBlankMode
    ? `[Format_Kosong]_Remedial_Pengayaan_${safeSubject}_${safeGrade}.docx`
    : `Remedial_Pengayaan_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'REMEDIAL_PENGAYAAN',
    title: isBlankMode
      ? `Remedial & Pengayaan (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
      : `Remedial & Pengayaan - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-rem-${Date.now()}`,
      type: 'REMEDIAL_PENGAYAAN',
      title: isBlankMode
        ? `Remedial & Pengayaan (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
        : `Remedial & Pengayaan - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
