import { SchoolData } from '../../../../types';
import { INDONESIAN_MONTHS, formatOfficialDate } from '../../docxStyles';

export { INDONESIAN_MONTHS, formatOfficialDate };

export type PdfStyleProfile = 'DEFAULT' | 'FORMAL_NEUTRAL';

export const PDF_FORMAL_NEUTRAL_THEME = {
  colors: {
    primary: [0, 0, 0] as [number, number, number],
    primaryDark: [0, 0, 0] as [number, number, number],
    secondary: [0, 0, 0] as [number, number, number],
    text: [0, 0, 0] as [number, number, number],
    textLight: [50, 50, 50] as [number, number, number],
    border: [0, 0, 0] as [number, number, number],
    tableHeaderBg: [240, 240, 240] as [number, number, number],
    tableAltRowBg: [255, 255, 255] as [number, number, number],
    calloutBg: [248, 248, 248] as [number, number, number],
  },
  fonts: {
    base: 'times',
    bold: 'times',
  },
  sizes: {
    docTitle: 14,
    docSubTitle: 12,
    heading1: 12,
    heading2: 12,
    heading3: 11,
    body: 12,
    small: 10,
    tableHeader: 10,
    tableBody: 10,
    pageNumber: 9,
  },
  margins: {
    portrait: { top: 25, bottom: 25, left: 30, right: 25 },
    landscape: { top: 20, bottom: 20, left: 25, right: 20 },
  },
};

export const PDF_THEME = PDF_FORMAL_NEUTRAL_THEME;
