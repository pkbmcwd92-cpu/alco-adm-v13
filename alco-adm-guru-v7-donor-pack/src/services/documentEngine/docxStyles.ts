import {
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  HeadingLevel,
  ShadingType,
} from 'docx';
import { SchoolData, TeacherProfile, AcademicSetting } from '../../types';

export type AlignmentTypeValue = (typeof AlignmentType)[keyof typeof AlignmentType];

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export function formatOfficialDate(school: SchoolData): string {
  const today = new Date();
  const location = school.district?.replace(/^Kec\.\s*/i, '') || school.regency || school.village || 'Tempat';
  const day = today.getDate();
  const month = INDONESIAN_MONTHS[today.getMonth()];
  const year = today.getFullYear();
  return `${location}, ${day} ${month} ${year}`;
}

/**
 * Creates standard document title and curriculum header
 */
export function createDocumentHeader(title: string, subTitle: string): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 28, // 14pt
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: subTitle.toUpperCase(),
          bold: true,
          size: 22, // 11pt
          font: 'Arial',
          color: '475569',
        }),
      ],
    }),
  ];
}

/**
 * Creates standard two-column identity metadata table
 */
export function createIdentityMetadataTable(
  school: SchoolData,
  profile: TeacherProfile,
  academicSetting: AcademicSetting,
  extraRows: [string, string][] = []
): Table {
  const isK13Curriculum =
    academicSetting.curriculumType === 'K13' ||
    (academicSetting.curriculum &&
      (academicSetting.curriculum.includes('2013') || academicSetting.curriculum.includes('K13')));

  const classRow: [string, string] = isK13Curriculum
    ? ['Kelas', `: ${academicSetting.grade || '-'}`]
    : ['Fase / Kelas', `: ${academicSetting.phase || '-'} / ${academicSetting.grade || '-'}`];

  const baseRows: [string, string][] = [
    ['Satuan Pendidikan', `: ${school.name || '-'}`],
    ['NPSN', `: ${school.npsn || '-'}`],
    ['Alamat', `: ${school.address || '-'}`],
    ['Kurikulum', `: ${academicSetting.curriculum || 'Kurikulum Merdeka'}`],
    ['Mata Pelajaran', `: ${academicSetting.subject || '-'}`],
    classRow,
    ['Tahun Ajaran / Semester', `: ${academicSetting.academicYear || '-'} / ${academicSetting.semester || '-'}`],
    ['Guru Mata Pelajaran', `: ${profile.name || '-'}`],
    ['NIP Guru', `: ${profile.nip || '-'}`],
    ...extraRows,
  ];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: baseRows.map(
      ([label, val]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: val, size: 20, font: 'Arial' })],
                }),
              ],
            }),
          ],
        })
    ),
  });
}

/**
 * Standard table header cell creator with bold text and soft gray/blue shading
 */
export function createTableHeaderCell(
  text: string,
  widthPercent: number,
  alignment: AlignmentTypeValue = AlignmentType.CENTER
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 19,
            font: 'Arial',
            color: '0F172A',
          }),
        ],
      }),
    ],
  });
}

/**
 * Standard table data cell creator
 */
export function createTableDataCell(
  text: string,
  widthPercent: number,
  alignment: AlignmentTypeValue = AlignmentType.LEFT,
  bold: boolean = false
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment,
        children: [
          new TextRun({
            text,
            size: 19,
            font: 'Arial',
            bold,
            color: '1E293B',
          }),
        ],
      }),
    ],
  });
}

/**
 * Creates standard official sign-off block with Principal on left and Teacher on right
 */
export function createSignoffBlock(
  school: SchoolData,
  profile: TeacherProfile,
  isBlankMode: boolean = false
): (Paragraph | Table)[] {
  const dateStr = formatOfficialDate(school);

  const principalTitle = 'Kepala Sekolah';
  const teacherTitle = 'Guru Mata Pelajaran';

  const principalNameText = isBlankMode
    ? '(........................)'
    : school.principalName
    ? school.principalName
    : '(........................)';

  const principalNipText = isBlankMode
    ? 'NIP. ....................'
    : school.principalNip
    ? `NIP. ${school.principalNip}`
    : 'NIP. ....................';

  const teacherNameText = isBlankMode
    ? '(........................)'
    : profile.name
    ? profile.name
    : '(........................)';

  const teacherNipText = isBlankMode
    ? 'NIP. ....................'
    : profile.nip
    ? `NIP. ${profile.nip}`
    : 'NIP. ....................';

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Mengetahui,', size: 20, font: 'Arial' })],
              }),
              new Paragraph({
                children: [new TextRun({ text: principalTitle, size: 20, font: 'Arial' })],
              }),
              new Paragraph({ spacing: { after: 720 } }), // space for physical signature
              new Paragraph({
                children: [
                  new TextRun({
                    text: principalNameText,
                    bold: !isBlankMode && !!school.principalName,
                    size: 20,
                    font: 'Arial',
                    underline: !isBlankMode && school.principalName ? {} : undefined,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: principalNipText,
                    size: 20,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              isBlankMode
                ? new Paragraph({ children: [] })
                : new Paragraph({
                    children: [new TextRun({ text: dateStr, size: 20, font: 'Arial' })],
                  }),
              new Paragraph({
                children: [new TextRun({ text: teacherTitle, size: 20, font: 'Arial' })],
              }),
              new Paragraph({ spacing: { after: 720 } }), // space for physical signature
              new Paragraph({
                children: [
                  new TextRun({
                    text: teacherNameText,
                    bold: !isBlankMode && !!profile.name,
                    size: 20,
                    font: 'Arial',
                    underline: !isBlankMode && profile.name ? {} : undefined,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: teacherNipText,
                    size: 20,
                    font: 'Arial',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [new Paragraph({ spacing: { before: 240, after: 120 } }), table];
}
