import { jsPDF } from 'jspdf';
import autoTable, { UserOptions } from 'jspdf-autotable';
import { SchoolData, TeacherProfile, AcademicSetting } from '../../../../types';
import { PDF_THEME, formatOfficialDate } from './pdfTheme';

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
}

/**
 * Direct PDF Document Builder for formal Indonesian Teacher Administration.
 * Output: Pure vector PDF (A4), perfectly formatted without third-party converter dependency.
 */
export class PdfDocumentBuilder {
  private doc: jsPDF;
  private orientation: 'portrait' | 'landscape';
  private pageWidth: number;
  private pageHeight: number;
  private marginLeft: number;
  private marginRight: number;
  private marginTop: number;
  private marginBottom: number;
  private currentY: number;

  constructor(orientation: 'portrait' | 'landscape' = 'portrait') {
    this.orientation = orientation;
    this.doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();

    const margins =
      orientation === 'landscape' ? PDF_THEME.margins.landscape : PDF_THEME.margins.portrait;
    this.marginLeft = margins.left;
    this.marginRight = margins.right;
    this.marginTop = margins.top;
    this.marginBottom = margins.bottom;
    this.currentY = this.marginTop;
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
    this.doc.setFont(PDF_THEME.fonts.bold, 'bold');
    this.doc.setFontSize(PDF_THEME.sizes.docTitle);
    this.doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    this.doc.text(title.toUpperCase(), centerX, this.currentY, { align: 'center' });
    this.currentY += 5.5;

    // Subtitle
    if (subTitle) {
      this.doc.setFont(PDF_THEME.fonts.bold, 'bold');
      this.doc.setFontSize(PDF_THEME.sizes.docSubTitle);
      this.doc.setTextColor(PDF_THEME.colors.secondary[0], PDF_THEME.colors.secondary[1], PDF_THEME.colors.secondary[2]);
      this.doc.text(subTitle.toUpperCase(), centerX, this.currentY, { align: 'center' });
      this.currentY += 5.5;
    }

    // Decorative divider line
    this.doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    this.doc.setLineWidth(0.6);
    this.doc.line(this.marginLeft, this.currentY, this.pageWidth - this.marginRight, this.currentY);
    this.currentY += 5;
  }

  public renderIdentityBlock(
    school: SchoolData,
    profile: TeacherProfile,
    academicSetting: AcademicSetting,
    extraRows: [string, string][] = []
  ): void {
    const isK13Curriculum =
      academicSetting.curriculumType === 'K13' ||
      (academicSetting.curriculum &&
        (academicSetting.curriculum.includes('2013') || academicSetting.curriculum.includes('K13')));

    const classLabel = isK13Curriculum ? 'Tingkat / Kelas' : 'Fase / Kelas';
    const classValue = isK13Curriculum
      ? `: ${academicSetting.grade || '-'}`
      : `: ${academicSetting.phase || '-'} / ${academicSetting.grade || '-'}`;

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
        `: ${academicSetting.academicYear || '-'} (${academicSetting.semester || '-'})`,
      ],
      [
        'Guru Pengampu',
        `: ${profile.name || '-'}`,
        'Kurikulum',
        `: ${academicSetting.curriculum || 'Kurikulum Merdeka'}`,
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
        fontSize: PDF_THEME.sizes.body,
        cellPadding: { top: 0.8, bottom: 0.8, left: 1, right: 1 },
        textColor: [30, 41, 59],
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 36 },
        1: { cellWidth: this.orientation === 'landscape' ? 95 : 55 },
        2: { fontStyle: 'bold', cellWidth: 34 },
        3: { cellWidth: 'auto' },
      },
    };

    autoTable(this.doc, tableOptions);
    const finalY = (this.doc as any).lastAutoTable?.finalY;
    this.currentY = (finalY || this.currentY) + 5;

    // Subtle line below identity
    this.doc.setDrawColor(PDF_THEME.colors.border[0], PDF_THEME.colors.border[1], PDF_THEME.colors.border[2]);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.marginLeft, this.currentY - 2, this.pageWidth - this.marginRight, this.currentY - 2);
    this.currentY += 2;
  }

  public renderHeading(text: string, level: 1 | 2 | 3 = 1): void {
    this.checkPageBreak(12);

    this.doc.setFont(PDF_THEME.fonts.bold, 'bold');
    if (level === 1) {
      this.doc.setFontSize(PDF_THEME.sizes.heading1);
      this.doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    } else if (level === 2) {
      this.doc.setFontSize(PDF_THEME.sizes.heading2);
      this.doc.setTextColor(PDF_THEME.colors.primaryDark[0], PDF_THEME.colors.primaryDark[1], PDF_THEME.colors.primaryDark[2]);
    } else {
      this.doc.setFontSize(PDF_THEME.sizes.body);
      this.doc.setTextColor(PDF_THEME.colors.secondary[0], PDF_THEME.colors.secondary[1], PDF_THEME.colors.secondary[2]);
    }

    this.doc.text(text, this.marginLeft, this.currentY);
    this.currentY += level === 1 ? 5 : 4;
  }

  public renderParagraph(text: string, options: { bold?: boolean; align?: 'left' | 'center' | 'right' | 'justify'; spacingAfter?: number } = {}): void {
    const { bold = false, align = 'left', spacingAfter = 3.5 } = options;
    this.checkPageBreak(10);

    this.doc.setFont(bold ? PDF_THEME.fonts.bold : PDF_THEME.fonts.base, bold ? 'bold' : 'normal');
    this.doc.setFontSize(PDF_THEME.sizes.body);
    this.doc.setTextColor(PDF_THEME.colors.text[0], PDF_THEME.colors.text[1], PDF_THEME.colors.text[2]);

    const contentWidth = this.getContentWidth();
    const splitLines = this.doc.splitTextToSize(text, contentWidth);

    for (const line of splitLines) {
      this.checkPageBreak(5);
      this.doc.text(line, this.marginLeft, this.currentY, {
        align: align === 'justify' ? 'left' : align,
      });
      this.currentY += 4.5;
    }

    this.currentY += spacingAfter;
  }

  public renderCallout(text: string, title?: string): void {
    this.checkPageBreak(18);

    const contentWidth = this.getContentWidth();
    const splitLines = this.doc.splitTextToSize(text, contentWidth - 8);
    const boxHeight = (splitLines.length * 4.5) + (title ? 9 : 6);

    this.checkPageBreak(boxHeight + 4);

    // Callout box background
    this.doc.setFillColor(PDF_THEME.colors.calloutBg[0], PDF_THEME.colors.calloutBg[1], PDF_THEME.colors.calloutBg[2]);
    this.doc.setDrawColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
    this.doc.setLineWidth(0.4);
    this.doc.roundedRect(this.marginLeft, this.currentY, contentWidth, boxHeight, 1.5, 1.5, 'FD');

    let innerY = this.currentY + 4;
    if (title) {
      this.doc.setFont(PDF_THEME.fonts.bold, 'bold');
      this.doc.setFontSize(PDF_THEME.sizes.body);
      this.doc.setTextColor(PDF_THEME.colors.primary[0], PDF_THEME.colors.primary[1], PDF_THEME.colors.primary[2]);
      this.doc.text(title, this.marginLeft + 4, innerY);
      innerY += 4.5;
    }

    this.doc.setFont(PDF_THEME.fonts.base, 'normal');
    this.doc.setFontSize(PDF_THEME.sizes.small);
    this.doc.setTextColor(PDF_THEME.colors.text[0], PDF_THEME.colors.text[1], PDF_THEME.colors.text[2]);

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
        fillColor: PDF_THEME.colors.tableHeaderBg as [number, number, number],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: PDF_THEME.sizes.tableHeader,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.2,
        lineColor: [203, 213, 225],
      },
      styles: {
        fontSize: PDF_THEME.sizes.tableBody,
        textColor: [30, 41, 59],
        cellPadding: { top: 2, bottom: 2, left: 2.5, right: 2.5 },
        lineWidth: 0.15,
        lineColor: [203, 213, 225],
        valign: 'top',
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: PDF_THEME.colors.tableAltRowBg as [number, number, number],
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

    this.doc.setFont(PDF_THEME.fonts.base, 'normal');
    this.doc.setFontSize(PDF_THEME.sizes.body);
    this.doc.setTextColor(PDF_THEME.colors.text[0], PDF_THEME.colors.text[1], PDF_THEME.colors.text[2]);

    if (isBlankMode) {
      this.doc.setFont(PDF_THEME.fonts.base, 'normal');
      this.doc.setFontSize(PDF_THEME.sizes.body);
      this.doc.setTextColor(PDF_THEME.colors.text[0], PDF_THEME.colors.text[1], PDF_THEME.colors.text[2]);

      this.doc.text('Mengetahui,', leftColX, sigY);
      sigY += 4.5;

      this.doc.text('Kepala Sekolah', leftColX, sigY);
      this.doc.text('Guru Mata Pelajaran', rightColX, sigY);
      sigY += 22; // Space for physical signature

      this.doc.text('(........................)', leftColX, sigY);
      this.doc.text('(........................)', rightColX, sigY);
      sigY += 4.5;

      this.doc.setFontSize(PDF_THEME.sizes.small);
      this.doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
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
      this.doc.setFont(PDF_THEME.fonts.bold, 'bold');
      this.doc.text(school.principalName || '(........................)', leftColX, sigY);
      this.doc.text(profile.name || '(........................)', rightColX, sigY);
      sigY += 4.5;

      // NIPs
      this.doc.setFont(PDF_THEME.fonts.base, 'normal');
      this.doc.setFontSize(PDF_THEME.sizes.small);
      this.doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);
      this.doc.text(school.principalNip ? `NIP. ${school.principalNip}` : 'NIP. ....................', leftColX, sigY);
      this.doc.text(profile.nip ? `NIP. ${profile.nip}` : 'NIP. ....................', rightColX, sigY);
    }

    this.currentY = sigY + 8;
  }

  public finalizePageNumbers(): void {
    const totalPages = (this.doc as any).internal.getNumberOfPages();

    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.doc.setFont(PDF_THEME.fonts.base, 'normal');
      this.doc.setFontSize(PDF_THEME.sizes.pageNumber);
      this.doc.setTextColor(PDF_THEME.colors.textLight[0], PDF_THEME.colors.textLight[1], PDF_THEME.colors.textLight[2]);

      // Footer divider
      this.doc.setDrawColor(PDF_THEME.colors.border[0], PDF_THEME.colors.border[1], PDF_THEME.colors.border[2]);
      this.doc.setLineWidth(0.2);
      this.doc.line(this.marginLeft, this.pageHeight - 12, this.pageWidth - this.marginRight, this.pageHeight - 12);

      // Left footer: System tag
      this.doc.text(
        'Administrasi Guru AI — Standar Kurikulum Merdeka (PPA Kemendikdasmen)',
        this.marginLeft,
        this.pageHeight - 8
      );

      // Right footer: Page X of Y
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
    return this.doc.output('blob');
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
  const builder = new PdfDocumentBuilder(options.orientation || 'portrait');

  // 1. Header
  builder.renderHeader(options.title, options.subTitle);

  // 2. Identity Block
  builder.renderIdentityBlock(
    options.school,
    options.profile,
    options.academicSetting,
    options.extraIdentityRows
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
