/**
 * Canonical Document Date Service
 *
 * Single source of truth for administrative document dates.
 * Stores date in canonical format YYYY-MM-DD.
 * Formats official document dates for print/PDF/DOCX without timezone shift.
 */

const ID_MONTHS = [
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

/**
 * Returns today's date in local calendar components as YYYY-MM-DD.
 * Avoids toISOString() to prevent UTC timezone date shifting.
 */
export function getLocalTodayDocumentDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Validates that a string is a valid real calendar date in YYYY-MM-DD format.
 */
export function isValidDocumentDate(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return false;

  return true;
}

/**
 * Formats a canonical YYYY-MM-DD document date to Indonesian format,
 * optionally prefixed with a location (e.g., "Cilandak, 23 September 2026").
 */
export function formatCanonicalDocumentDate(
  rawDate: string,
  location?: string
): {
  rawDate: string;
  formattedDate: string;
} {
  if (!isValidDocumentDate(rawDate)) {
    return {
      rawDate,
      formattedDate: rawDate || '',
    };
  }

  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)!;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  const monthName = ID_MONTHS[month - 1];
  const cleanDate = `${day} ${monthName} ${year}`;
  const cleanLocation = location ? location.trim() : '';

  const formattedDate = cleanLocation ? `${cleanLocation}, ${cleanDate}` : cleanDate;

  return {
    rawDate,
    formattedDate,
  };
}

/**
 * Resolves a valid canonical document date. Returns undefined if missing or invalid (fail-closed).
 */
export function resolveDocumentDate(dateInput?: string | null): string | undefined {
  if (!isValidDocumentDate(dateInput)) {
    return undefined;
  }
  return dateInput as string;
}

/**
 * Formats a document date into formal Indonesian date string.
 * Returns empty string '' if missing or invalid (fail-closed).
 */
export function formatDocumentDate(dateInput?: string | null, location?: string): string {
  if (!isValidDocumentDate(dateInput)) {
    return '';
  }
  return formatCanonicalDocumentDate(dateInput as string, location).formattedDate;
}

