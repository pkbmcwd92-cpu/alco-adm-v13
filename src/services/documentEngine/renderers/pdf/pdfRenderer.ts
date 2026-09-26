import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { SchoolData, TeacherProfile, AcademicSetting } from '../../../../types';
import {
  PDF_THEME,
  PDF_FORMAL_NEUTRAL_THEME,
  formatOfficialDate,
} from './pdfTheme';
import type { PdfStyleProfile } from './pdfTheme';

export type { PdfStyleProfile };

export interface PdfTableColumn {
  header: string;
  dataKey: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
}

export interface PdfSectionTable {
  type: 'table';
  columns: (string | PdfTableColumn)[];
  rows: (string | number | boolean)[][];
  title?: string;
  columnStyles?: Record<number, { cellWidth?: number | 'auto'; halign?: 'left' | 'center' | 'right' }>;
}

export interface PdfSectionParagraph {
  type: 'paragraph';
  text: string;
  bold?: boolean;
  color?: [number, number, number];
  align?: 'left' | 'center' | 'right' | 'justify';
  spacingAfter?: number;
}

export interface PdfSectionHeading {
  type: 'heading';
  text: string;
  level?: 1 | 2 | 3;
}

export interface PdfSectionCallout {
  type: 'callout';
  title?: string;
  text: string;
}

export interface PdfSectionKeyValue {
  type: 'key-value';
  items: [string, string][];
}

export type PdfDocumentSection =
  | PdfSectionTable
  | PdfSectionParagraph
  | PdfSectionHeading
  | PdfSectionCallout
  | PdfSectionKeyValue;

export interface PdfDocumentOptions {
  orientation?: 'portrait' | 'landscape';
  styleProfile?: PdfStyleProfile;
  title: string;
  subTitle?: string;
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  extraIdentityRows?: [string, string][];
  sections: PdfDocumentSection[];
  showSignature?: boolean;
  dateString?: string;
  isBlankMode?: boolean;
  scope?: 'YEAR' | 'SEMESTER';
  hideSemester?: boolean;
}

/**
 * Direct PDF Document Builder for formal Indonesian Teacher Administration.
 * Output: Pure vector PDF (A4), perfectly formatted without third-party converter dependency.
 */
export class PdfDocumentBuilder {
  private doc: jsPDF;
  private orientation: 'portrait' | 'landscape';
  private styleProfile: PdfStyleProfile;
  private theme: typeof PDF_THEME | typeof PDF_FORMAL_NEUTRAL_THEME;
  private pageWidth: number;
  private pageHeight: number;
  private marginLeft: number;
  private marginRight: number;
  private marginTop: number;
  private marginBottom: number;
  private currentY: number;

  constructor(
    orientation: 'portrait' | 'landscape' = 'portrait',
    styleProfile: PdfStyleProfile = 'FORMAL_NEUTRAL'
  ) {
    this.orientation = orientation;
    this.styleProfile = styleProfile;
    this.theme = styleProfile === 'DEFAULT' ? PDF_THEME : PDF_FORMAL_NEUTRAL_THEME;

    this.doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();

    const margins =
      orientation === 'landscape' ? this.theme.margins.landscape : this.theme.margins.portrait;
    this.marginLeft = margins.left;
    this.marginRight = margins.right;
    this.marginTop = margins.top;
    this.marginBottom = margins.bottom;
    this.currentY = this.marginTop;
  }

  public getStyleProfile(): PdfStyleProfile {
    return this.styleProfile;
  }

  public getTheme(): typeof PDF_THEME | typeof PDF_FORMAL_NEUTRAL_THEME {
    return this.theme;
  }

  public getContentWidth(): number {
    return this.pageWidth - this.marginLeft - this.marginRight;
  }

  private checkPageBreak(requiredHeight: number) {
    if (this.currentY + requiredHeight > this.pageHeight - this.marginBottom) {
      this.doc.addPage();
      this.currentY = this.marginTop;
    }
  }

  public renderHeader(title: string, subTitle?: string): void {
    const centerX = this.pageWidth / 2;

    // Document Title
    this.doc.setFont(this.theme.fonts.bold, 'bold');
    this.doc.setFontSize(this.theme.sizes.docTitle);
    this.doc.setTextColor(this.theme.colors.primary[0], this.theme.colors.primary[1], this.theme.colors.primary[2]);
    this.doc.text(title.toUpperCase(), centerX, this.currentY, { align: 'center' });
    this.currentY += this.styleProfile === 'FORMAL_NEUTRAL' ? 6 : 5.5;

    // Subtitle
    if (subTitle) {
      this.doc.setFont(this.theme.fonts.bold, 'bold');
      this.doc.setFontSize(this.theme.sizes.docSubTitle);
      this.doc.setTextColor(this.theme.colors.secondary[0], this.theme.colors.secondary[1], this.theme.colors.secondary[2]);
      this.doc.text(subTitle.toUpperCase(), centerX, this.currentY, { align: 'center' });
      this.currentY += this.styleProfile === 'FORMAL_NEUTRAL' ? 6 : 5.5;
    }

    // Divider line
    this.doc.setDrawColor(this.theme.colors.primary[0], this.theme.colors.primary[1], this.theme.colors.primary[2]);
    this.doc.setLineWidth(this.styleProfile === 'FORMAL_NEUTRAL' ? 0.4 : 0.6);
    this.doc.line(this.marginLeft, this.currentY, this.pageWidth - this.marginRight, this.currentY);
    this.currentY += 5;
  }

  public renderIdentityBlock(
    school: SchoolData,
    profile: TeacherProfile,
    academicSetting: AcademicSetting,
    extraRows: [string, string][] = [],
    options?: { scope?: 'YEAR' | 'SEMESTER'; hideSemester?: boolean }
  ): void {
    const isK13Curriculum =
      academicSetting.curriculumType === 'K13' ||
      (academicSetting.curriculum &&
        (academicSetting.curriculum.includes('2013') || academicSetting.curriculum.includes('K13')));

    const classLabel = isK13Curriculum ? 'Tingkat / Kelas' : 'Fase / Kelas';
    const classValue = isK13Curriculum
      ? `: ${academicSetting.grade || '-'}`
      : `: ${academicSetting.phase || '-'} / ${academicSetting.grade || '-'}`;

    const hideSemester = options?.scope === 'YEAR' || options?.hideSemester;
    const academicYearValue = hideSemester
      ? `: ${academicSetting.academicYear || '-'}`
      : `: ${academicSetting.academicYear || '-'} (${academicSetting.semester || '-'})`;

    const rows: [string, string, string, string][] = [
      [
        'Satuan Pendidikan',
        `: ${school.name || '-'}`,
        'Mata Pelajaran',
        `: ${academicSetting.subject || '-'}`,
      ],
      [
        'NPSN',
        `: ${school.npsn || '-'}`,
        classLabel,
        classValue,
      ],
      [
        'Alamat',
        `: ${school.address || '-'}`,
        'Tahun Ajaran',
        academicYearValue,
      ],
      [
        'Guru Pengampu',
        `: ${profile.name || '-'}`,
        'Kurikulum',
        `: ${academicSetting.curriculum || '-'}`,
      ],
      [
        'NIP Guru',
        `: ${profile.nip || '-'}`,
        '',
        '',
      ],
    ];

    if (extraRows && extraRows.length > 0) {
      for (let i = 0; i < extraRows.length; i += 2) {
        const first = extraRows[i];
        const second = extraRows[i + 1];
        rows.push([
          first ? first[0] : '',
          first ? `: ${first[1]}` : '',
          second ? second[0] : '',
          second ? `: ${second[1]}` : '',
        ]);
      }
    }

    const tableOptions: UserOptions = {
      startY: this.currentY,
      margin: { left: this.marginLeft, right: this.marginRight },
      body: rows,
      theme: 'plain',
      styles: {
        font: this.theme.fonts.base,
        fontSize: this.theme.sizes.body,
        cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 },
        textColor: this.theme.colors.text as [number, number, number],
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { font: this.theme.fonts.bold, fontStyle: 'bold', cellWidth: 36 },
        1: { cellWidth: this.orientation === 'landscape' ? 95 : 55 },
        2: { font: this.theme.fonts.bold, fontStyle: 'bold', cellWidth: 34 },
        3: { cellWidth: 'auto' },
      },
    };

    autoTable(this.doc, tableOptions);
    const finalY = (this.doc as any).lastAutoTable?.finalY;
    this.currentY = (finalY || this.currentY) + 5;

    // Line below identity
    this.doc.setDrawColor(this.theme.colors.border[0], this.theme.colors.border[1], this.theme.colors.border[2]);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.marginLeft, this.currentY - 2, this.pageWidth - this.marginRight, this.currentY - 2);
    this.currentY += 2;
  }

  public renderNormalizedIdentityBlock(
    metadata: {
      schoolName?: string;
      npsn?: string;
      schoolAddress?: string;
      curriculum?: string;
      subject?: string;
      grade?: string;
      phase?: string;
      academicYear?: string;
      semester?: string;
      teacherName?: string;
      teacherNip?: string;
    },
    extraRows: [string, string][] = []
  ): void {
    const isK13Curriculum =
      metadata.curriculum &&
      (metadata.curriculum.includes('2013') || metadata.curriculum.includes('K13'));

    const classLabel = isK13Curriculum ? 'Tingkat / Kelas' : 'Fase / Kelas';
    const classValue = isK13Curriculum
      ? `: ${metadata.grade || '-'}`
      : metadata.phase
      ? `: ${metadata.phase} / ${metadata.grade || '-'}`
      : `: ${metadata.grade || '-'}`;

    const academicYearSemester =
      metadata.academicYear && metadata.semester
        ? `${metadata.academicYear} (${metadata.semester})`
        : metadata.academicYear || metadata.semester || '-';

    const rows: [string, string, string, string][] = [
      [
        'Satuan Pendidikan',
        `: ${metadata.schoolName || '-'}`,
        'Mata Pelajaran',
        `: ${metadata.subject || '-'}`,
      ],
      [
        'NPSN',
        `: ${metadata.npsn || '-'}`,
        classLabel,
        classValue,
      ],
      [
        'Alamat',
        `: ${metadata.schoolAddress || '-'}`,
        'Tahun Ajaran',
        `: ${academicYearSemester}`,
      ],
      [
        'Guru Pengampu',
        `: ${metadata.teacherName || '-'}`,
        'Kurikulum',
        `: ${metadata.curriculum || '-'}`,
      ],
      [
        'NIP Guru',
        `: ${metadata.teacherNip || '-'}`,
        '',
        '',
      ],
    ];

    if (extraRows && extraRows.length > 0) {
      for (let i = 0; i < extraRows.length; i += 2) {
        const first = extraRows[i];
        const second = extraRows[i + 1];
        rows.push([
          first ? first[0] : '',
          first ? (first[1].startsWith(':') ? first[1] : `: ${first[1]}`) : '',
          second ? second[0] : '',
          second ? (second[1].startsWith(':') ? second[1] : `: ${second[1]}`) : '',
        ]);
      }
    }

    const tableOptions: UserOptions = {
      startY: this.currentY,
      margin: { left: this.marginLeft, right: this.marginRight },
      body: rows,
      theme: 'plain',
      styles: {
        font: this.theme.fonts.base,
        fontSize: this.theme.sizes.body,
        cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 },
        textColor: this.theme.colors.text as [number, number, number],
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { font: this.theme.fonts.bold, fontStyle: 'bold', cellWidth: 36 },
        1: { cellWidth: this.orientation === 'landscape' ? 95 : 55 },
        2: { font: this.theme.fonts.bold, fontStyle: 'bold', cellWidth: 34 },
        3: { cellWidth: 'auto' },
      },
    };

    autoTable(this.doc, tableOptions);
    const finalY = (this.doc as any).lastAutoTable?.finalY;
    this.currentY = (finalY || this.currentY) + 5;

    // Line below identity
    this.doc.setDrawColor(this.theme.colors.border[0], this.theme.colors.border[1], this.theme.colors.border[2]);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.marginLeft, this.currentY - 2, this.pageWidth - this.marginRight, this.currentY - 2);
    this.currentY += 2;
  }

  public renderNormalizedSignatureBlock(signoff: {
    locationAndDate: string;
    principalTitle: string;
    principalName: string;
    principalNip?: string;
    teacherTitle: string;
    teacherName: string;
    teacherNip?: string;
    isBlankMode: boolean;
  }): void {
    this.checkPageBreak(40);

    const leftColX = this.marginLeft + 10;
    const rightColX = this.pageWidth - this.marginRight - 70;
    let sigY = this.currentY + 6;

    this.doc.setFont(this.theme.fonts.base, 'normal');
    this.doc.setFontSize(this.theme.sizes.body);
    this.doc.setTextColor(this.theme.colors.text[0], this.theme.colors.text[1], this.theme.colors.text[2]);

    if (signoff.isBlankMode) {
      // Right Column: Date placeholder
      this.doc.text('....................., .................... 20....', rightColX, sigY);
      sigY += 4.5;

      this.doc.text('Mengetahui,', leftColX, sigY);
      this.doc.text(signoff.teacherTitle || 'Guru Mata Pelajaran', rightColX, sigY);
      sigY += 4.5;

      this.doc.text(signoff.principalTitle || 'Kepala Sekolah', leftColX, sigY);
      sigY += 22;

      this.doc.setFont(this.theme.fonts.bold, 'bold');
      this.doc.text('(................................................)', leftColX, sigY);
      this.doc.text('(................................................)', rightColX, sigY);
      sigY += 4.5;

      this.doc.setFont(this.theme.fonts.base, 'normal');
      this.doc.setFontSize(this.theme.sizes.small);
      this.doc.setTextColor(this.theme.colors.textLight[0], this.theme.colors.textLight[1], this.theme.colors.textLight[2]);
      this.doc.text('NIP. ....................', leftColX, sigY);
      this.doc.text('NIP. ....................', rightColX, sigY);
    } else {
      // Right Column: Date
      this.doc.text(signoff.locationAndDate, rightColX, sigY);
      sigY += 4.5;

      // Titles
      this.doc.text('Mengetahui,', leftColX, sigY);
      this.doc.text(signoff.teacherTitle || 'Guru Mata Pelajaran', rightColX, sigY);
      sigY += 4.5;

      this.doc.text(signoff.principalTitle || 'Kepala Sekolah', leftColX, sigY);
      sigY += 22; // Space for physical signature

      // Names (Underlined / Bold)
      this.doc.setFont(this.theme.fonts.bold, 'bold');
      this.doc.text(signoff.principalName || '(........................)', leftColX, sigY);
      this.doc.text(signoff.teacherName || '(........................)', rightColX, sigY);
      sigY += 4.5;

      // NIPs
      this.doc.setFont(this.theme.fonts.base, 'normal');
      this.doc.setFontSize(this.theme.sizes.small);
      this.doc.setTextColor(this.theme.colors.textLight[0], this.theme.colors.textLight[1], this.theme.colors.textLight[2]);
      this.doc.text(signoff.principalNip ? `NIP. ${signoff.principalNip}` : 'NIP. ....................', leftColX, sigY);
      this.doc.text(signoff.teacherNip ? `NIP. ${signoff.teacherNip}` : 'NIP. ....................', rightColX, sigY);
    }

    this.currentY = sigY + 8;
  }

  public renderHeading(text: string, level: 1 | 2 | 3 = 1): void {
    this.checkPageBreak(12);

    this.doc.setFont(this.theme.fonts.bold, 'bold');
    if (level === 1) {
      this.doc.setFontSize(this.theme.sizes.heading1);
      this.doc.setTextColor(this.theme.colors.primary[0], this.theme.colors.primary[1], this.theme.colors.primary[2]);
    } else if (level === 2) {
      this.doc.setFontSize(this.theme.sizes.heading2);
      this.doc.setTextColor(this.theme.colors.primaryDark[0], this.theme.colors.primaryDark[1], this.theme.colors.primaryDark[2]);
    } else {
      this.doc.setFontSize(this.theme.sizes.body);
      this.doc.setTextColor(this.theme.colors.secondary[0], this.theme.colors.secondary[1], this.theme.colors.secondary[2]);
    }

    this.doc.text(text, this.marginLeft, this.currentY);
    this.currentY += level === 1 ? 5.5 : 4.5;
  }

  public renderParagraph(
    text: string,
    options: {
      bold?: boolean;
      align?: 'left' | 'center' | 'right' | 'justify';
      spacingAfter?: number;
    } = {}
  ): void {
    const { bold = false, align = 'left', spacingAfter = 3.5 } = options;
    this.checkPageBreak(10);

    this.doc.setFont(bold ? this.theme.fonts.bold : this.theme.fonts.base, bold ? 'bold' : 'normal');
    this.doc.setFontSize(this.theme.sizes.body);
    this.doc.setTextColor(this.theme.colors.text[0], this.theme.colors.text[1], this.theme.colors.text[2]);

    const contentWidth = this.getContentWidth();
    const splitLines = this.doc.splitTextToSize(text, contentWidth);
    const lineSpacing = 5.2;

    if (align === 'justify' && splitLines.length > 1) {
      for (let i = 0; i < splitLines.length; i++) {
        this.checkPageBreak(lineSpacing + 1);
        const line = splitLines[i];
        const isLastLine = i === splitLines.length - 1;
        if (isLastLine) {
          this.doc.text(line, this.marginLeft, this.currentY, { align: 'left' });
        } else {
          this.doc.text(line, this.marginLeft, this.currentY, {
            maxWidth: contentWidth,
            align: 'justify',
          });
        }
        this.currentY += lineSpacing;
      }
    } else {
      for (const line of splitLines) {
        this.checkPageBreak(lineSpacing + 1);
        const xPos =
          align === 'center'
            ? this.marginLeft + contentWidth / 2
            : align === 'right'
            ? this.marginLeft + contentWidth
            : this.marginLeft;
        this.doc.text(line, xPos, this.currentY, {
          align: align === 'justify' ? 'left' : align,
        });
        this.currentY += lineSpacing;
      }
    }

    this.currentY += spacingAfter;
  }

  public renderCallout(text: string, title?: string): void {
    this.checkPageBreak(18);

    const contentWidth = this.getContentWidth();
    const splitLines = this.doc.splitTextToSize(text, contentWidth - 8);
    const boxHeight = splitLines.length * 4.5 + (title ? 9 : 6);

    this.checkPageBreak(boxHeight + 4);

    // Callout box background
    this.doc.setFillColor(this.theme.colors.calloutBg[0], this.theme.colors.calloutBg[1], this.theme.colors.calloutBg[2]);
    this.doc.setDrawColor(this.theme.colors.primary[0], this.theme.colors.primary[1], this.theme.colors.primary[2]);
    this.doc.setLineWidth(0.4);
    this.doc.roundedRect(this.marginLeft, this.currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    let innerY = this.currentY + 4;
    if (title) {
      this.doc.setFont(this.theme.fonts.bold, 'bold');
      this.doc.setFontSize(this.theme.sizes.body);
      this.doc.setTextColor(this.theme.colors.primary[0], this.theme.colors.primary[1], this.theme.colors.primary[2]);
      this.doc.text(title, this.marginLeft + 4, innerY);
      innerY += 4.5;
    }

    this.doc.setFont(this.theme.fonts.base, 'normal');
    this.doc.setFontSize(this.theme.sizes.small);
    this.doc.setTextColor(this.theme.colors.text[0], this.theme.colors.text[1], this.theme.colors.text[2]);

    for (const line of splitLines) {
      this.doc.text(line, this.marginLeft + 4, innerY);
      innerY += 4;
    }

    this.currentY += boxHeight + 4;
  }

  public renderTable(section: PdfSectionTable): void {
    if (section.title) {
      this.renderHeading(section.title, 2);
    }

    const headers: string[] = section.columns.map((c) =>
      typeof c === 'string' ? c : c.header
    );

    const columnStylesMap: Record<number, any> = {};
    section.columns.forEach((c, idx) => {
      if (typeof c !== 'string') {
        columnStylesMap[idx] = {
          cellWidth: c.width || 'auto',
          halign: c.align || 'left',
        };
      }
    });

    if (section.columnStyles) {
      Object.assign(columnStylesMap, section.columnStyles);
    }

    autoTable(this.doc, {
      startY: this.currentY,
      margin: { left: this.marginLeft, right: this.marginRight },
      head: [headers],
      body: section.rows as any[][],
      theme: 'grid',
      headStyles: {
        fillColor: this.theme.colors.tableHeaderBg as [number, number, number],
        textColor: (this.styleProfile === 'FORMAL_NEUTRAL' ? [0, 0, 0] : [255, 255, 255]) as [number, number, number],
        font: this.theme.fonts.bold,
        fontStyle: 'bold',
        fontSize: this.theme.sizes.tableHeader,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: this.theme.colors.border as [number, number, number],
      },
      styles: {
        font: this.theme.fonts.base,
        fontSize: this.theme.sizes.tableBody,
        textColor: this.theme.colors.text as [number, number, number],
        cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
        lineWidth: 0.15,
        lineColor: this.theme.colors.border as [number, number, number],
        valign: 'top',
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: this.theme.colors.tableAltRowBg as [number, number, number],
      },
      columnStyles: columnStylesMap,
      showHead: 'everyPage',
    });

    const finalY = (this.doc as any).lastAutoTable?.finalY;
    this.currentY = (finalY || this.currentY) + 6;
  }

  public renderSignatureBlock(
    school: SchoolData,
    profile: TeacherProfile,
    dateString?: string,
    isBlankMode: boolean = false
  ): void {
    const blockHeight = 42;
    this.checkPageBreak(blockHeight);

    const fullDate = dateString || formatOfficialDate(school);
    const contentWidth = this.getContentWidth();
    const halfWidth = contentWidth / 2;

    const leftColX = this.marginLeft;
    const rightColX = this.marginLeft + halfWidth + 10;

    let sigY = this.currentY + 2;

    this.doc.setFont(this.theme.fonts.base, 'normal');
    this.doc.setFontSize(this.theme.sizes.body);
    this.doc.setTextColor(this.theme.colors.text[0], this.theme.colors.text[1], this.theme.colors.text[2]);

    if (isBlankMode) {
      this.doc.text('Mengetahui,', leftColX, sigY);
      sigY += 4.5;

      this.doc.text('Kepala Sekolah', leftColX, sigY);
      this.doc.text('Guru Mata Pelajaran', rightColX, sigY);
      sigY += 22; // Space for physical signature

      this.doc.text('(........................)', leftColX, sigY);
      this.doc.text('(........................)', rightColX, sigY);
      sigY += 4.5;

      this.doc.setFontSize(this.theme.sizes.small);
      this.doc.setTextColor(this.theme.colors.textLight[0], this.theme.colors.textLight[1], this.theme.colors.textLight[2]);
      this.doc.text('NIP. ....................', leftColX, sigY);
      this.doc.text('NIP. ....................', rightColX, sigY);
    } else {
      // Right Column: Date
      this.doc.text(fullDate, rightColX, sigY);
      sigY += 4.5;

      // Titles
      this.doc.text('Mengetahui,', leftColX, sigY);
      this.doc.text('Guru Mata Pelajaran', rightColX, sigY);
      sigY += 4.5;

      this.doc.text('Kepala Sekolah', leftColX, sigY);
      sigY += 22; // Space for physical signature

      // Names (Underlined / Bold)
      this.doc.setFont(this.theme.fonts.bold, 'bold');
      this.doc.text(school.principalName || '(........................)', leftColX, sigY);
      this.doc.text(profile.name || '(........................)', rightColX, sigY);
      sigY += 4.5;

      // NIPs
      this.doc.setFont(this.theme.fonts.base, 'normal');
      this.doc.setFontSize(this.theme.sizes.small);
      this.doc.setTextColor(this.theme.colors.textLight[0], this.theme.colors.textLight[1], this.theme.colors.textLight[2]);
      this.doc.text(school.principalNip ? `NIP. ${school.principalNip}` : 'NIP. ....................', leftColX, sigY);
      this.doc.text(profile.nip ? `NIP. ${profile.nip}` : 'NIP. ....................', rightColX, sigY);
    }

    this.currentY = sigY + 8;
  }

  public finalizePageNumbers(): void {
    const totalPages = (this.doc as any).internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFont(this.theme.fonts.base, 'normal');
      this.doc.setFontSize(this.theme.sizes.pageNumber);
      this.doc.setTextColor(this.theme.colors.textLight[0], this.theme.colors.textLight[1], this.theme.colors.textLight[2]);

      // Footer divider
      this.doc.setDrawColor(this.theme.colors.border[0], this.theme.colors.border[1], this.theme.colors.border[2]);
      this.doc.setLineWidth(0.2);
      this.doc.line(this.marginLeft, this.pageHeight - 12, this.pageWidth - this.marginRight, this.pageHeight - 12);

      // Right footer: Page X of Y (neutral official pagination)
      this.doc.text(
        `Halaman ${i} dari ${totalPages}`,
        this.pageWidth - this.marginRight,
        this.pageHeight - 8,
        { align: 'right' }
      );
    }
  }

  public save(fileName: string): void {
    this.finalizePageNumbers();
    this.doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`);
  }

  public getBlob(): Blob {
    this.finalizePageNumbers();
    try {
      const outputBlob = this.doc.output('blob');
      if (outputBlob && typeof outputBlob.size === 'number') {
        return outputBlob;
      }
    } catch {
      // Fallback for Node/headless test runtimes
    }
    const arrayBuffer = this.doc.output('arraybuffer');
    return new Blob([arrayBuffer], { type: 'application/pdf' });
  }

  public getDataUri(): string {
    this.finalizePageNumbers();
    return this.doc.output('datauristring');
  }
}

/**
 * High-level helper to generate and download a standard formal PDF document.
 */
export function buildPdfFromOptions(options: PdfDocumentOptions): PdfDocumentBuilder {
  const builder = new PdfDocumentBuilder(options.orientation || 'portrait', options.styleProfile || 'FORMAL_NEUTRAL');

  // 1. Header
  builder.renderHeader(options.title, options.subTitle);

  // 2. Identity Block
  builder.renderIdentityBlock(
    options.school,
    options.profile,
    options.academicSetting,
    options.extraIdentityRows,
    { scope: options.scope, hideSemester: options.hideSemester }
  );

  // 3. Render Sections
  for (const section of options.sections) {
    if (section.type === 'heading') {
      builder.renderHeading(section.text, section.level);
    } else if (section.type === 'paragraph') {
      builder.renderParagraph(section.text, {
        bold: section.bold,
        align: section.align,
        spacingAfter: section.spacingAfter,
      });
    } else if (section.type === 'callout') {
      builder.renderCallout(section.text, section.title);
    } else if (section.type === 'table') {
      builder.renderTable(section);
    }
  }

  // 4. Signature Block
  if (options.showSignature !== false) {
    builder.renderSignatureBlock(options.school, options.profile, options.dateString, options.isBlankMode);
  }

  return builder;
}
