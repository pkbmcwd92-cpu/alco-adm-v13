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

export async function generateDaftarHadir(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, students, attendanceSessions, attendanceRecords } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  const headerTitle = isBlankMode
    ? 'DAFTAR HADIR SISWA & REKAPITULASI PRESENSI (FORMAT KOSONG)'
    : 'DAFTAR HADIR SISWA & REKAPITULASI PRESENSI';
  docChildren.push(...createDocumentHeader(headerTitle, academicSetting.curriculum));

  // Metadata Table
  const studentList = students || [];
  const sessionList = attendanceSessions || [];
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Jumlah Siswa Terdaftar', isBlankMode ? ': .......... Siswa' : `: ${studentList.length} Siswa`],
      ['Total Pertemuan Tercatat', isBlankMode ? ': .......... Pertemuan' : `: ${sessionList.length} Kali Pertemuan`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 1: Daftar Presensi Siswa & Rekap
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'A. Rekapitulasi Presensi Siswa per Pertemuan',
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
        createTableHeaderCell('Nama Lengkap Siswa', 36, AlignmentType.LEFT),
        createTableHeaderCell('L/P', 8, AlignmentType.CENTER),
        createTableHeaderCell('H', 7, AlignmentType.CENTER),
        createTableHeaderCell('S', 7, AlignmentType.CENTER),
        createTableHeaderCell('I', 7, AlignmentType.CENTER),
        createTableHeaderCell('A', 7, AlignmentType.CENTER),
        createTableHeaderCell('% Hadir', 8, AlignmentType.CENTER),
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
            createTableDataCell('', 36),
            createTableDataCell('', 8, AlignmentType.CENTER),
            createTableDataCell('', 7, AlignmentType.CENTER),
            createTableDataCell('', 7, AlignmentType.CENTER),
            createTableDataCell('', 7, AlignmentType.CENTER),
            createTableDataCell('', 7, AlignmentType.CENTER),
            createTableDataCell('', 8, AlignmentType.CENTER),
          ],
        })
      );
    }
  } else {
    studentList.forEach((std, index) => {
      const studentRecords = (attendanceRecords || []).filter((r) => r.studentId === std.id);
      const hCount = studentRecords.filter((r) => r.status === 'H' || r.status === 'D').length;
      const sCount = studentRecords.filter((r) => r.status === 'S').length;
      const iCount = studentRecords.filter((r) => r.status === 'I').length;
      const aCount = studentRecords.filter((r) => r.status === 'A').length;
      const totalRecorded = studentRecords.length;
      const pct = totalRecorded > 0 ? Math.round((hCount / totalRecorded) * 100) : 100;

      tableRows.push(
        new TableRow({
          children: [
            createTableDataCell((index + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(std.nisn || '-', 14, AlignmentType.CENTER),
            createTableDataCell(std.name, 36),
            createTableDataCell(std.gender || 'L', 8, AlignmentType.CENTER),
            createTableDataCell(hCount.toString(), 7, AlignmentType.CENTER),
            createTableDataCell(sCount.toString(), 7, AlignmentType.CENTER),
            createTableDataCell(iCount.toString(), 7, AlignmentType.CENTER),
            createTableDataCell(aCount.toString(), 7, AlignmentType.CENTER),
            createTableDataCell(`${pct}%`, 8, AlignmentType.CENTER),
          ],
        })
      );
    });
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: tableRows }));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 2: Jurnal Pertemuan Presensi
  if (isBlankMode || sessionList.length > 0) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 80 },
        children: [
          new TextRun({
            text: 'B. Catatan Agenda & Tanggal Pertemuan',
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );

    const sessionRows: TableRow[] = [
      new TableRow({
        children: [
          createTableHeaderCell('Pertemuan', 14, AlignmentType.CENTER),
          createTableHeaderCell('Tanggal', 20, AlignmentType.CENTER),
          createTableHeaderCell('Topik / Materi Pembelajaran', 46, AlignmentType.LEFT),
          createTableHeaderCell('Catatan', 20, AlignmentType.LEFT),
        ],
      }),
    ];

    if (isBlankMode) {
      for (let i = 0; i < 8; i++) {
        sessionRows.push(
          new TableRow({
            children: [
              createTableDataCell(`Pertemuan ${i + 1}`, 14, AlignmentType.CENTER),
              createTableDataCell('..../..../20....', 20, AlignmentType.CENTER),
              createTableDataCell('', 46),
              createTableDataCell('', 20),
            ],
          })
        );
      }
    } else {
      sessionList.forEach((s) => {
        sessionRows.push(
          new TableRow({
            children: [
              createTableDataCell(`Pertemuan ${s.meetingNumber}`, 14, AlignmentType.CENTER),
              createTableDataCell(s.date, 20, AlignmentType.CENTER),
              createTableDataCell(s.topic || 'Aktivitas Pembelajaran Reguler', 46),
              createTableDataCell(s.notes || '-', 20),
            ],
          })
        );
      });
    }

    docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: sessionRows }));
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
    ? `[Format_Kosong]_Daftar_Hadir_${safeSubject}_${safeGrade}.docx`
    : `Daftar_Hadir_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'DAFTAR_HADIR',
    title: isBlankMode
      ? `Daftar Hadir (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
      : `Daftar Hadir - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-hadir-${Date.now()}`,
      type: 'DAFTAR_HADIR',
      title: isBlankMode
        ? `Daftar Hadir (Format Kosong) - ${academicSetting.subject} ${academicSetting.grade}`
        : `Daftar Hadir - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
