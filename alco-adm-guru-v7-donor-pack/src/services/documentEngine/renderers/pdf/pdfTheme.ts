import { SchoolData } from '../../../../types';
import { INDONESIAN_MONTHS, formatOfficialDate } from '../../docxStyles';

export { INDONESIAN_MONTHS, formatOfficialDate };

export const PDF_THEME = {
  colors: {
    primary: [30, 58, 138], // Deep Royal Navy #1E3A8A
    primaryDark: [15, 23, 42], // Slate 900 #0F172A
    secondary: [71, 85, 105], // Slate 600 #475569
    text: [30, 41, 59], // Slate 800 #1E293B
    textLight: [100, 116, 139], // Slate 500 #64748B
    border: [203, 213, 225], // Slate 300 #CBD5E1
    tableHeaderBg: [30, 58, 138], // Navy header
    tableAltRowBg: [248, 250, 252], // Slate 50 #F8FAFC
    calloutBg: [241, 245, 249], // Slate 100
  },
  fonts: {
    base: 'helvetica',
    bold: 'helvetica',
  },
  sizes: {
    docTitle: 13,
    docSubTitle: 10,
    heading1: 11,
    heading2: 10,
    body: 9,
    small: 8,
    tableHeader: 8.5,
    tableBody: 8,
    pageNumber: 7.5,
  },
  margins: {
    portrait: { top: 20, bottom: 20, left: 20, right: 20 },
    landscape: { top: 15, bottom: 18, left: 15, right: 15 },
  },
};
