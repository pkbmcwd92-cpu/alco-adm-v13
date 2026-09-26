import {
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  BorderStyle,
  ShadingType,
  PageOrientation,
} from 'docx';
import { SchoolData, TeacherProfile, AcademicSetting } from '../../types';
import { formatDocumentDate } from '../documentDateService';

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

export const DOCX_FONT = 'Times New Roman';
export const DOCX_COLOR_BLACK = '000000';
export const DOCX_COLOR_MUTED = '333333';
export const DOCX_BG_TABLE_HEADER = 'F1F5F9';

/**
 * Standard Margins (in Twips: 1 cm = 566.929 twips)
 * Left: 3.0 cm = 1701 twips
 * Right: 2.5 cm = 1417 twips
 * Top: 2.5 cm = 1417 twips
 * Bottom: 2.5 cm = 1417 twips
 */
export const DOCX_STANDARD_MARGINS = {
  top: 1417,
  bottom: 1417,
  left: 1701,
  right: 1417,
};

/**
 * A4 Page Sizes in twips:
 * 210mm x 297mm = 11906 x 16838 twips
 */
export const DOCX_PAGE_A4_PORTRAIT = {
  orientation: PageOrientation.PORTRAIT,
  width: 11906,
  height: 16838,
};

export const DOCX_PAGE_A4_LANDSCAPE = {
  orientation: PageOrientation.LANDSCAPE,
  width: 16838,
  height: 11906,
};

/**
 * Creates standard section properties for A4 Portrait or Landscape with standard formal margins.
 */
export function createDocxSectionProperties(orientation: 'portrait' | 'landscape' = 'portrait') {
  const isLandscape = orientation === 'landscape';
  return {
    page: {
      size: isLandscape ? DOCX_PAGE_A4_LANDSCAPE : DOCX_PAGE_A4_PORTRAIT,
      margin: DOCX_STANDARD_MARGINS,
    },
  };
}

export function formatOfficialDate(
  school: SchoolData,
  documentDate?: string
): string {
  const location =
    school.district?.replace(/^Kec\.\s*/i, '') ||
    school.regency ||
    school.village ||
    'Tempat';

  const formatted = formatDocumentDate(documentDate);

  if (!formatted) {
    return '';
  }

  return `${location}, ${formatted}`;
}

/**
 * Creates standard document title and curriculum header (14pt bold center, 12pt bold subtitle, black)
 */
export function createDocumentHeader(title: string, subTitle?: string): Paragraph[] {
  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: subTitle ? 60 : 180 },
      children: [
        new TextRun({
          text: title.toUpperCase(),
          bold: true,
          size: 28, // 14pt
          font: DOCX_FONT,
          color: DOCX_COLOR_BLACK,
        }),
      ],
    }),
  ];

  if (subTitle) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: subTitle.toUpperCase(),
            bold: true,
            size: 24, // 12pt
            font: DOCX_FONT,
            color: DOCX_COLOR_BLACK,
          }),
        ],
      })
    );
  }

  return paragraphs;
}

/**
 * Creates standard section heading (12pt bold black)
 */
export function createSectionHeading(text: string, level: 1 | 2 | 3 = 1): Paragraph {
  const spacingBefore = level === 1 ? 160 : level === 2 ? 120 : 100;
  const spacingAfter = level === 1 ? 80 : 60;

  return new Paragraph({
    spacing: { before: spacingBefore, after: spacingAfter },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24, // 12pt
        font: DOCX_FONT,
        color: DOCX_COLOR_BLACK,
      }),
    ],
  });
}

/**
 * Creates standard narrative prose paragraph:
 * - Justified alignment
 * - First-line indent: 1.25 cm (709 twips)
 * - Line spacing: 1.15 (276 twips)
 * - Space after: 6 pt (120 twips)
 */
export function createProseParagraph(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    firstLineIndent?: boolean;
    spacingAfter?: number;
  } = {}
): Paragraph {
  const {
    bold = false,
    italics = false,
    firstLineIndent = true,
    spacingAfter = 120, // 6pt
  } = options;

  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: firstLineIndent ? { firstLine: 709 } : undefined,
    spacing: { line: 276, after: spacingAfter },
    children: [
      new TextRun({
        text,
        bold,
        italics,
        size: 24, // 12pt
        font: DOCX_FONT,
        color: DOCX_COLOR_BLACK,
      }),
    ],
  });
}

/**
 * Creates standard list paragraph without first-line indent
 */
export function createListParagraph(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    spacingAfter?: number;
  } = {}
): Paragraph {
  const { bold = false, italics = false, spacingAfter = 60 } = options;

  return new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { line: 276, after: spacingAfter },
    children: [
      new TextRun({
        text,
        bold,
        italics,
        size: 24, // 12pt
        font: DOCX_FONT,
        color: DOCX_COLOR_BLACK,
      }),
    ],
  });
}

/**
 * Creates standard two-column identity metadata table (Times New Roman 12pt black)
 */
export function createIdentityMetadataTable(
  school: SchoolData,
  profile: TeacherProfile,
  academicSetting: AcademicSetting,
  extraRows: [string, string][] = [],
  options?: { scope?: 'YEAR' | 'SEMESTER'; hideSemester?: boolean }
): Table {
  const isK13Curriculum =
    academicSetting.curriculumType === 'K13' ||
    (academicSetting.curriculum &&
      (academicSetting.curriculum.includes('2013') || academicSetting.curriculum.includes('K13')));

  const classRow: [string, string] = isK13Curriculum
    ? ['Kelas', `: ${academicSetting.grade || '-'}`]
    : ['Fase / Kelas', `: ${academicSetting.phase || '-'} / ${academicSetting.grade || '-'}`];

  const hideSemester = options?.scope === 'YEAR' || options?.hideSemester;
  const periodRow: [string, string] = hideSemester
    ? ['Tahun Ajaran', `: ${academicSetting.academicYear || '-'}`]
    : ['Tahun Ajaran / Semester', `: ${academicSetting.academicYear || '-'} / ${academicSetting.semester || '-'}`];

  const baseRows: [string, string][] = [
    ['Satuan Pendidikan', `: ${school.name || '-'}`],
    ['NPSN', `: ${school.npsn || '-'}`],
    ['Alamat', `: ${school.address || '-'}`],
    ['Kurikulum', `: ${academicSetting.curriculum || '-'}`],
    ['Mata Pelajaran', `: ${academicSetting.subject || '-'}`],
    classRow,
    periodRow,
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
                  spacing: { line: 276, after: 40 },
                  children: [
                    new TextRun({
                      text: label,
                      bold: true,
                      size: 24, // 12pt
                      font: DOCX_FONT,
                      color: DOCX_COLOR_BLACK,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { line: 276, after: 40 },
                  children: [
                    new TextRun({
                      text: val,
                      size: 24, // 12pt
                      font: DOCX_FONT,
                      color: DOCX_COLOR_BLACK,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
    ),
  });
}

/**
 * Standard table header cell creator with bold text and soft gray shading (Times New Roman 10pt black)
 */
export function createTableHeaderCell(
  text: string,
  widthPercent: number,
  alignment: AlignmentTypeValue = AlignmentType.CENTER
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: DOCX_BG_TABLE_HEADER },
    margins: { top: 120, bottom: 120, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment,
        spacing: { line: 240, after: 0 },
        children: [
          new TextRun({
            text,
            bold: true,
            size: 20, // 10pt
            font: DOCX_FONT,
            color: DOCX_COLOR_BLACK,
          }),
        ],
      }),
    ],
  });
}

/**
 * Standard table data cell creator (Times New Roman 10pt black)
 */
export function createTableDataCell(
  text: string,
  widthPercent: number,
  alignment: AlignmentTypeValue = AlignmentType.LEFT,
  bold: boolean = false,
  italics: boolean = false
): TableCell {
  return new TableCell({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    margins: { top: 100, bottom: 100, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment,
        spacing: { line: 240, after: 0 },
        children: [
          new TextRun({
            text,
            size: 20, // 10pt
            font: DOCX_FONT,
            bold,
            italics,
            color: DOCX_COLOR_BLACK,
          }),
        ],
      }),
    ],
  });
}

/**
 * Creates standard official sign-off block with Principal on left and Teacher on right (Times New Roman 12pt black)
 */
export function createSignoffBlock(
  school: SchoolData,
  profile: TeacherProfile,
  isBlankMode: boolean = false,
  customDateString?: string
): (Paragraph | Table)[] {
  const location =
    school.district?.replace(/^Kec\.\s*/i, '') ||
    school.regency ||
    school.village ||
    'Tempat';

  const formattedOfficialDate = formatOfficialDate(school, customDateString);

  const dateStr = formattedOfficialDate || `${location}, ....................`;

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
                spacing: { line: 276, after: 40 },
                children: [new TextRun({ text: 'Mengetahui,', size: 24, font: DOCX_FONT, color: DOCX_COLOR_BLACK })],
              }),
              new Paragraph({
                spacing: { line: 276, after: 40 },
                children: [new TextRun({ text: principalTitle, size: 24, font: DOCX_FONT, color: DOCX_COLOR_BLACK })],
              }),
              new Paragraph({ spacing: { after: 720 } }), // space for physical signature
              new Paragraph({
                spacing: { line: 276, after: 20 },
                children: [
                  new TextRun({
                    text: principalNameText,
                    bold: !isBlankMode && !!school.principalName,
                    size: 24,
                    font: DOCX_FONT,
                    color: DOCX_COLOR_BLACK,
                    underline: !isBlankMode && school.principalName ? {} : undefined,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 276, after: 20 },
                children: [
                  new TextRun({
                    text: principalNipText,
                    size: 24,
                    font: DOCX_FONT,
                    color: DOCX_COLOR_BLACK,
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
                    spacing: { line: 276, after: 40 },
                    children: [new TextRun({ text: dateStr, size: 24, font: DOCX_FONT, color: DOCX_COLOR_BLACK })],
                  }),
              new Paragraph({
                spacing: { line: 276, after: 40 },
                children: [new TextRun({ text: teacherTitle, size: 24, font: DOCX_FONT, color: DOCX_COLOR_BLACK })],
              }),
              new Paragraph({ spacing: { after: 720 } }), // space for physical signature
              new Paragraph({
                spacing: { line: 276, after: 20 },
                children: [
                  new TextRun({
                    text: teacherNameText,
                    bold: !isBlankMode && !!profile.name,
                    size: 24,
                    font: DOCX_FONT,
                    color: DOCX_COLOR_BLACK,
                    underline: !isBlankMode && profile.name ? {} : undefined,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { line: 276, after: 20 },
                children: [
                  new TextRun({
                    text: teacherNipText,
                    size: 24,
                    font: DOCX_FONT,
                    color: DOCX_COLOR_BLACK,
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
