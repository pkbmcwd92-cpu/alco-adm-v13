import { SemesterNumber } from '../types';

/**
 * Canonical hierarchy for calendar provenance level.
 * Single canonical vocabulary representing governance scopes.
 */
export type CalendarSourceLevel =
  | 'REGENCY'
  | 'PROVINCE'
  | 'NATIONAL';

/**
 * Calendar verification state for external candidates.
 */
export type CalendarVerificationStatus =
  | 'VERIFIED'
  | 'PARTIAL'
  | 'UNVERIFIED';

/**
 * Search criteria for calendar resolution.
 */
export interface CalendarSearchRequest {
  academicYear: string;
  semester: SemesterNumber;
  province?: string;
  regency?: string;
}

/**
 * Data contract for a discovered or referenced calendar source candidate.
 */
export interface CalendarSourceCandidate {
  sourceLevel: CalendarSourceLevel;

  province?: string;
  regency?: string;

  academicYear: string;

  authority: string;
  documentTitle: string;
  documentNumber?: string;

  sourceUrl: string;

  publicationDate?: string;
  effectiveDate?: string;

  semesterStartDate?: string;
  semesterEndDate?: string;

  verificationStatus: CalendarVerificationStatus;

  retrievedAt: string;
}

/**
 * Resolution status representing completeness and reliability of resolved calendar.
 */
export type CalendarProviderStatus =
  | 'RESOLVED'
  | 'PARTIALLY_RESOLVED'
  | 'UNRESOLVED';

/**
 * Complete outcome of a calendar provider search or resolution process.
 */
export interface CalendarProviderResolution {
  status: CalendarProviderStatus;
  selectedSource?: CalendarSourceCandidate;
  candidates: CalendarSourceCandidate[];
  resolvedLevel?: CalendarSourceLevel;
  message?: string;
}

/**
 * Pure interface for calendar data provider services.
 * Real search/network engines must implement this interface without modifying domain caller contracts.
 */
export interface CalendarDataProvider {
  search(
    request: CalendarSearchRequest
  ): Promise<CalendarSourceCandidate[]>;
}

/**
 * Canonical ordering priority for calendar source levels.
 * Smaller value = higher priority.
 * REGENCY (1) > PROVINCE (2) > NATIONAL (3)
 */
export function getCalendarSourcePriority(
  level: CalendarSourceLevel
): number {
  switch (level) {
    case 'REGENCY':
      return 1;
    case 'PROVINCE':
      return 2;
    case 'NATIONAL':
      return 3;
    default:
      return 999;
  }
}

/**
 * Normalizes administrative region names for tolerant string matching.
 * Preserves the distinction between 'kabupaten' and 'kota' while standardizing abbreviation variants.
 * Removes 'provinsi' prefix for province names.
 */
export function normalizeRegionName(value?: string): string {
  if (!value) return '';
  let str = value.trim().toLowerCase().replace(/\s+/g, ' ');

  // Standardize province prefixes: remove 'provinsi', 'prov.', 'prov '
  str = str
    .replace(/^provinsi\s+/i, '')
    .replace(/^prov\.\s*/i, '')
    .replace(/^prov\s+/i, '');

  // Standardize regency prefixes to canonical 'kabupaten '
  if (/^kabupaten\s+/i.test(str)) {
    str = 'kabupaten ' + str.replace(/^kabupaten\s+/i, '');
  } else if (/^kab\.\s*/i.test(str)) {
    str = 'kabupaten ' + str.replace(/^kab\.\s*/i, '');
  } else if (/^kab\s+/i.test(str)) {
    str = 'kabupaten ' + str.replace(/^kab\s+/i, '');
  }

  // Standardize city prefixes
  if (/^kota\.\s*/i.test(str)) {
    str = 'kota ' + str.replace(/^kota\.\s*/i, '');
  }

  return str.trim().replace(/\s+/g, ' ');
}

/**
 * Checks whether a candidate possesses basic validity and required provenance.
 * Source URL, authority, academicYear are mandatory; UNVERIFIED status is discarded.
 */
export function isUsableCalendarCandidate(
  candidate: CalendarSourceCandidate
): boolean {
  if (!candidate) return false;
  if (!candidate.sourceUrl || candidate.sourceUrl.trim() === '') return false;
  if (!candidate.authority || candidate.authority.trim() === '') return false;
  if (!candidate.academicYear || candidate.academicYear.trim() === '') return false;
  if (candidate.verificationStatus === 'UNVERIFIED') return false;
  return true;
}

/**
 * Selects the best calendar candidate according to geographic hierarchy:
 * 1. Exact academicYear matching
 * 2. Usable candidates only (VERIFIED or PARTIAL with valid sourceUrl & authority)
 * 3. Priority: Matching REGENCY > Matching PROVINCE > NATIONAL
 */
export function selectBestCalendarSource(
  candidates: CalendarSourceCandidate[],
  request: CalendarSearchRequest
): CalendarSourceCandidate | null {
  if (!candidates || candidates.length === 0 || !request) {
    return null;
  }

  const reqYear = request.academicYear.trim();
  const reqProvince = normalizeRegionName(request.province);
  const reqRegency = normalizeRegionName(request.regency);

  const usable = candidates.filter((c) => {
    if (!isUsableCalendarCandidate(c)) return false;
    return c.academicYear.trim() === reqYear;
  });

  if (usable.length === 0) {
    return null;
  }

  // 1. REGENCY check
  if (reqRegency) {
    const regencyCandidates = usable.filter((c) => {
      if (c.sourceLevel !== 'REGENCY') return false;
      const cRegency = normalizeRegionName(c.regency);
      if (!cRegency || cRegency !== reqRegency) return false;

      if (reqProvince) {
        const cProvince = normalizeRegionName(c.province);
        if (!cProvince || cProvince !== reqProvince) return false;
      }
      return true;
    });

    if (regencyCandidates.length > 0) {
      // Prioritize VERIFIED over PARTIAL
      const verified = regencyCandidates.find((c) => c.verificationStatus === 'VERIFIED');
      return verified || regencyCandidates[0];
    }
  }

  // 2. PROVINCE check
  if (reqProvince) {
    const provinceCandidates = usable.filter((c) => {
      if (c.sourceLevel !== 'PROVINCE') return false;
      const cProvince = normalizeRegionName(c.province);
      return cProvince === reqProvince;
    });

    if (provinceCandidates.length > 0) {
      const verified = provinceCandidates.find((c) => c.verificationStatus === 'VERIFIED');
      return verified || provinceCandidates[0];
    }
  }

  // 3. NATIONAL check
  const nationalCandidates = usable.filter((c) => c.sourceLevel === 'NATIONAL');
  if (nationalCandidates.length > 0) {
    const verified = nationalCandidates.find((c) => c.verificationStatus === 'VERIFIED');
    return verified || nationalCandidates[0];
  }

  return null;
}

/**
 * Evaluates candidate completeness into canonical resolution status.
 * Complete with boundaries -> RESOLVED
 * Valid but incomplete boundaries -> PARTIALLY_RESOLVED
 * Missing provenance / unverified -> UNRESOLVED
 */
export function evaluateCalendarCandidate(
  candidate: CalendarSourceCandidate
): CalendarProviderStatus {
  if (!isUsableCalendarCandidate(candidate)) {
    return 'UNRESOLVED';
  }

  if (
    candidate.verificationStatus === 'VERIFIED' &&
    candidate.semesterStartDate &&
    candidate.semesterStartDate.trim() !== '' &&
    candidate.semesterEndDate &&
    candidate.semesterEndDate.trim() !== ''
  ) {
    return 'RESOLVED';
  }

  return 'PARTIALLY_RESOLVED';
}
