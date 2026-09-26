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
import { getSubjectJP, calculateAvailableJP, calculateEffectiveDays } from '../../jpEngine';

export async function generateKalenderAkademik(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, calendar, calendarDays } = context;

  const docChildren: (Paragraph | Table)[] = [];

  // Look up official JP
  const officialRule = getSubjectJP({
    curriculum: academicSetting.curriculum,
    level: academicSetting.level,
    grade: academicSetting.grade,
    subject: academicSetting.subject,
  });

  const weeklyJP = academicSetting.subjectWeeklyJP || calendar?.jpPerWeek || academicSetting.totalHoursPerWeek || officialRule.weeklyJP || null;

  // Header
  docChildren.push(...createDocumentHeader('KALENDER AKADEMIK & JADWAL PENDIDIKAN', academicSetting.curriculum));

  // Metadata Table
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Rentang Waktu Semester', `: ${calendar?.startDate || '-'} s/d ${calendar?.endDate || '-'}`],
      ['Hari Sekolah / Minggu', `: ${calendar?.schoolDaysPerWeek ? `${calendar.schoolDaysPerWeek} Hari Kerja` : 'Belum diatur'}`],
      ['Beban Jam Pelajaran (JP)', `: ${weeklyJP !== null ? `${weeklyJP} JP / Minggu` : 'Input Manual Diperlukan'}`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 1: Ringkasan Hari Efektif
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'A. Ringkasan Hari & Minggu Efektif Pembelajaran',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  const daysList = calendarDays || [];
  const holidayCount = daysList.filter((d) => d.status === 'holiday').length;
  const eventCount = daysList.filter((d) => d.status === 'schoolEvent').length;

  let effectiveDaysCount = 0;
  let effectiveWeeksCount = 0;
  let availableJPCount: number | null = null;

  if (calendar?.startDate && calendar?.endDate) {
    const eff = calculateEffectiveDays(calendar, daysList);
    effectiveDaysCount = eff.effectiveLearningDays;
    const avail = calculateAvailableJP({
      subjectWeeklyJP: weeklyJP || 0,
      effectiveLearningDays: effectiveDaysCount,
      schoolDaysPerWeek: calendar.schoolDaysPerWeek,
      semester: calendar.semester,
      academicYear: calendar.academicYear,
    });
    effectiveWeeksCount = avail.effectiveWeeksRounded ?? 0;
    availableJPCount = weeklyJP !== null ? avail.availableJP : null;
  }

  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          createTableHeaderCell('No', 10, AlignmentType.CENTER),
          createTableHeaderCell('Komponen Perhitungan', 60, AlignmentType.LEFT),
          createTableHeaderCell('Keterangan / Jumlah', 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('1', 10, AlignmentType.CENTER),
          createTableDataCell('Tahun Ajaran / Semester Aktif', 60),
          createTableDataCell(`${calendar?.academicYear || '2026/2027'} (Semester ${calendar?.semester || '1'})`, 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('2', 10, AlignmentType.CENTER),
          createTableDataCell('Hari Sekolah per Minggu', 60),
          createTableDataCell(`${calendar?.schoolDaysPerWeek ? `${calendar.schoolDaysPerWeek} Hari` : 'Belum diatur'}`, 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('3', 10, AlignmentType.CENTER),
          createTableDataCell('Jumlah Hari Efektif Belajar (HE)', 60),
          createTableDataCell(`${effectiveDaysCount} Hari`, 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('4', 10, AlignmentType.CENTER),
          createTableDataCell('Jumlah Minggu Efektif (ME)', 60),
          createTableDataCell(`${effectiveWeeksCount} Minggu`, 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('5', 10, AlignmentType.CENTER),
          createTableDataCell('Total Alokasi Waktu Mata Pelajaran', 60),
          createTableDataCell(availableJPCount !== null ? `${availableJPCount} JP / Semester` : 'Belum Diverifikasi', 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('6', 10, AlignmentType.CENTER),
          createTableDataCell('Jumlah Hari Libur Nasional & Khusus Tercatat', 60),
          createTableDataCell(`${holidayCount} Hari`, 30, AlignmentType.CENTER),
        ],
      }),
      new TableRow({
        children: [
          createTableDataCell('7', 10, AlignmentType.CENTER),
          createTableDataCell('Jumlah Agenda Kegiatan Sekolah / Asesmen', 60),
          createTableDataCell(`${eventCount} Kegiatan`, 30, AlignmentType.CENTER),
        ],
      }),
    ],
  });

  docChildren.push(summaryTable);
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section 2: Agenda Kegiatan Khusus & Libur
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'B. Matriks Agenda & Catatan Kalender Pendidikan',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  const eventRows: TableRow[] = [
    new TableRow({
      children: [
        createTableHeaderCell('No', 8, AlignmentType.CENTER),
        createTableHeaderCell('Tanggal', 22, AlignmentType.CENTER),
        createTableHeaderCell('Status / Kategori', 22, AlignmentType.CENTER),
        createTableHeaderCell('Uraian Agenda / Keterangan Libur', 48, AlignmentType.LEFT),
      ],
    }),
  ];

  if (daysList.length === 0) {
    eventRows.push(
      new TableRow({
        children: [
          createTableDataCell('1', 8, AlignmentType.CENTER),
          createTableDataCell('-', 22, AlignmentType.CENTER),
          createTableDataCell('Hari Efektif Standar', 22, AlignmentType.CENTER),
          createTableDataCell('Belum ada tanggal libur khusus atau agenda khusus yang ditambahkan pada kalender satuan pendidikan.', 48),
        ],
      })
    );
  } else {
    daysList.forEach((d, idx) => {
      const typeLabel = d.status === 'holiday' ? 'Libur' : d.status === 'schoolEvent' ? 'Kegiatan Sekolah' : 'Hari Efektif';
      eventRows.push(
        new TableRow({
          children: [
            createTableDataCell((idx + 1).toString(), 8, AlignmentType.CENTER),
            createTableDataCell(d.date, 22, AlignmentType.CENTER),
            createTableDataCell(typeLabel, 22, AlignmentType.CENTER),
            createTableDataCell(d.notes || '-', 48),
          ],
        })
      );
    });
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: eventRows }));
  docChildren.push(new Paragraph({ spacing: { after: 240 } }));

  // Signatures
  docChildren.push(...createSignoffBlock(school, profile));

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
  const fileName = `Kalender_Pendidikan_${academicSetting.academicYear ? academicSetting.academicYear.replace('/', '_') : '2026_2027'}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'KALENDER_AKADEMIK',
    title: 'Kalender Pendidikan & Jadwal',
    fileName,
    blob,
    record: {
      id: `doc-kalender-${Date.now()}`,
      type: 'KALENDER_AKADEMIK',
      title: 'Kalender Pendidikan & Jadwal',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
