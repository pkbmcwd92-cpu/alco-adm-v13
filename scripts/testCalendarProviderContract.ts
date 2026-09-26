import assert from 'node:assert';
import {
  CalendarSourceLevel,
  CalendarSearchRequest,
  CalendarSourceCandidate,
  getCalendarSourcePriority,
  normalizeRegionName,
  isUsableCalendarCandidate,
  selectBestCalendarSource,
  evaluateCalendarCandidate,
} from '../src/services/calendarProvider';

console.log('=== RUNNING AUDIT: CALENDAR PROVIDER CONTRACT REGRESSION ===\n');

let totalTests = 0;
let passedTests = 0;

function runTest(name: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

// =========================================================================
// TEST A: Priority ordering (REGENCY: 1, PROVINCE: 2, NATIONAL: 3)
// =========================================================================
runTest('A. Priority ordering: REGENCY = 1, PROVINCE = 2, NATIONAL = 3', () => {
  assert.strictEqual(getCalendarSourcePriority('REGENCY'), 1);
  assert.strictEqual(getCalendarSourcePriority('PROVINCE'), 2);
  assert.strictEqual(getCalendarSourcePriority('NATIONAL'), 3);
  assert(getCalendarSourcePriority('REGENCY') < getCalendarSourcePriority('PROVINCE'));
  assert(getCalendarSourcePriority('PROVINCE') < getCalendarSourcePriority('NATIONAL'));
});

// =========================================================================
// TEST B: Regency wins when exact match exists
// =========================================================================
runTest('B. Best source selection: Regency candidate wins over Province and National', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
  };

  const regencyCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
    academicYear: '2026/2027',
    authority: 'Disdik Kab Bandung',
    documentTitle: 'Kaldik 2026/2027',
    sourceUrl: 'https://example.com/kaldik-bandung',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const provinceCand: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    authority: 'Disdik Jabar',
    documentTitle: 'Kaldik Jabar 2026/2027',
    sourceUrl: 'https://example.com/kaldik-jabar',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const nationalCand: CalendarSourceCandidate = {
    sourceLevel: 'NATIONAL',
    academicYear: '2026/2027',
    authority: 'Kemendikdasmen',
    documentTitle: 'Kaldik Nasional 2026/2027',
    sourceUrl: 'https://example.com/kaldik-nasional',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([provinceCand, nationalCand, regencyCand], req);
  assert.notStrictEqual(selected, null);
  assert.strictEqual(selected?.sourceLevel, 'REGENCY');
  assert.strictEqual(selected?.regency, 'Kabupaten Bandung');
});

// =========================================================================
// TEST C: Province fallback when matching regency is absent
// =========================================================================
runTest('C. Best source selection: Province fallback when matching regency is absent', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kota Cimahi',
  };

  const provinceCand: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Provinsi Jawa Barat',
    academicYear: '2026/2027',
    authority: 'Disdik Jabar',
    documentTitle: 'Kaldik Jabar 2026/2027',
    sourceUrl: 'https://example.com/kaldik-jabar',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const nationalCand: CalendarSourceCandidate = {
    sourceLevel: 'NATIONAL',
    academicYear: '2026/2027',
    authority: 'Kemendikdasmen',
    documentTitle: 'Kaldik Nasional 2026/2027',
    sourceUrl: 'https://example.com/kaldik-nasional',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([nationalCand, provinceCand], req);
  assert.notStrictEqual(selected, null);
  assert.strictEqual(selected?.sourceLevel, 'PROVINCE');
  assert.strictEqual(selected?.province, 'Provinsi Jawa Barat');
});

// =========================================================================
// TEST D: National fallback when both regency and province are absent/unmatched
// =========================================================================
runTest('D. Best source selection: National fallback when regional candidates are absent', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Papua Barat Daya',
    regency: 'Kabupaten Sorong',
  };

  const otherProvCand: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Jawa Tengah',
    academicYear: '2026/2027',
    authority: 'Disdik Jateng',
    documentTitle: 'Kaldik Jateng',
    sourceUrl: 'https://example.com/kaldik-jateng',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const nationalCand: CalendarSourceCandidate = {
    sourceLevel: 'NATIONAL',
    academicYear: '2026/2027',
    authority: 'Kemendikdasmen',
    documentTitle: 'Pedoman Standar Nasional',
    sourceUrl: 'https://example.com/kaldik-nasional',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([otherProvCand, nationalCand], req);
  assert.notStrictEqual(selected, null);
  assert.strictEqual(selected?.sourceLevel, 'NATIONAL');
});

// =========================================================================
// TEST E: Wrong regency must NOT win even in the same province
// =========================================================================
runTest('E. Geographic precision: Wrong regency in same province must not be selected as REGENCY', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
  };

  const bogorCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kabupaten Bogor',
    academicYear: '2026/2027',
    authority: 'Disdik Bogor',
    documentTitle: 'Kaldik Bogor',
    sourceUrl: 'https://example.com/kaldik-bogor',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const provinceCand: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    authority: 'Disdik Jabar',
    documentTitle: 'Kaldik Jabar',
    sourceUrl: 'https://example.com/kaldik-jabar',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([bogorCand, provinceCand], req);
  assert.notStrictEqual(selected, null);
  // Must fallback to Province, NOT pick Bogor!
  assert.strictEqual(selected?.sourceLevel, 'PROVINCE');
  assert.notStrictEqual(selected?.regency, 'Kabupaten Bogor');
});

// =========================================================================
// TEST F: Wrong academic year must be filtered out
// =========================================================================
runTest('F. Academic year strictness: Candidates with mismatched academic year are discarded', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
  };

  const oldYearCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
    academicYear: '2025/2026',
    authority: 'Disdik Kab Bandung',
    documentTitle: 'Kaldik 2025/2026',
    sourceUrl: 'https://example.com/kaldik-old',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([oldYearCand], req);
  assert.strictEqual(selected, null);
});

// =========================================================================
// TEST G: UNVERIFIED candidate must NOT be selected
// =========================================================================
runTest('G. Verification check: UNVERIFIED candidate is discarded', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
  };

  const unverifiedCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
    academicYear: '2026/2027',
    authority: 'Disdik Kab Bandung',
    documentTitle: 'Draft Kaldik',
    sourceUrl: 'https://example.com/draft',
    verificationStatus: 'UNVERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  assert.strictEqual(isUsableCalendarCandidate(unverifiedCand), false);
  const selected = selectBestCalendarSource([unverifiedCand], req);
  assert.strictEqual(selected, null);
});

// =========================================================================
// TEST H: National candidate with missing dates evaluates to PARTIALLY_RESOLVED
// =========================================================================
runTest('H. National semantics: Verified candidate without date bounds evaluates to PARTIALLY_RESOLVED', () => {
  const nationalPartial: CalendarSourceCandidate = {
    sourceLevel: 'NATIONAL',
    academicYear: '2026/2027',
    authority: 'Kemendikdasmen RI',
    documentTitle: 'Pedoman Standar Kaldik',
    sourceUrl: 'https://kemendikdasmen.go.id/pedoman',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
    // semesterStartDate and semesterEndDate omitted
  };

  const status = evaluateCalendarCandidate(nationalPartial);
  assert.strictEqual(status, 'PARTIALLY_RESOLVED');

  const completeCand: CalendarSourceCandidate = {
    ...nationalPartial,
    semesterStartDate: '2026-07-13',
    semesterEndDate: '2026-12-18',
  };
  assert.strictEqual(evaluateCalendarCandidate(completeCand), 'RESOLVED');
});

// =========================================================================
// TEST I: Missing provenance (authority or sourceUrl) evaluates to UNRESOLVED
// =========================================================================
runTest('I. Provenance check: Missing authority or sourceUrl evaluates to UNRESOLVED', () => {
  const noUrl: CalendarSourceCandidate = {
    sourceLevel: 'NATIONAL',
    academicYear: '2026/2027',
    authority: 'Kemendikdasmen RI',
    documentTitle: 'Pedoman Standar Kaldik',
    sourceUrl: '',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  assert.strictEqual(isUsableCalendarCandidate(noUrl), false);
  assert.strictEqual(evaluateCalendarCandidate(noUrl), 'UNRESOLVED');

  const noAuthority: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    authority: '   ',
    documentTitle: 'Kaldik',
    sourceUrl: 'https://example.com/kaldik',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  assert.strictEqual(isUsableCalendarCandidate(noAuthority), false);
  assert.strictEqual(evaluateCalendarCandidate(noAuthority), 'UNRESOLVED');
});

// =========================================================================
// TEST J: Normalization helper handles tolerant region naming & preserves Kab/Kota distinction
// =========================================================================
runTest('J. Region normalization: Tolerant matching for Kab, Kota, Prov prefixes', () => {
  assert.strictEqual(normalizeRegionName('Kabupaten Bandung'), 'kabupaten bandung');
  assert.strictEqual(normalizeRegionName('kab. bandung'), 'kabupaten bandung');
  assert.strictEqual(normalizeRegionName('Kab Bandung'), 'kabupaten bandung');
  assert.strictEqual(normalizeRegionName('Kota Bandung'), 'kota bandung');
  assert.strictEqual(normalizeRegionName('Provinsi Jawa Barat'), 'jawa barat');
  assert.strictEqual(normalizeRegionName('prov. jawa barat'), 'jawa barat');
  assert.strictEqual(normalizeRegionName('Jawa Barat'), 'jawa barat');
  assert.strictEqual(normalizeRegionName('Bandung'), 'bandung');
});

// =========================================================================
// TEST K: Kabupaten vs Kota collision (Request Kabupaten Bandung -> picks Kabupaten, not Kota)
// =========================================================================
runTest('K. Regency vs City distinction: Request for Kabupaten Bandung selects Kabupaten, not Kota Bandung', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
  };

  const kotaCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kota Bandung',
    academicYear: '2026/2027',
    authority: 'Disdik Kota Bandung',
    documentTitle: 'Kaldik Kota Bandung',
    sourceUrl: 'https://example.com/kaldik-kota-bandung',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const kabCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
    academicYear: '2026/2027',
    authority: 'Disdik Kab Bandung',
    documentTitle: 'Kaldik Kab Bandung',
    sourceUrl: 'https://example.com/kaldik-kab-bandung',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const provCand: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    authority: 'Disdik Jabar',
    documentTitle: 'Kaldik Jabar',
    sourceUrl: 'https://example.com/kaldik-jabar',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([kotaCand, kabCand, provCand], req);
  assert.notStrictEqual(selected, null);
  assert.strictEqual(selected?.regency, 'Kabupaten Bandung');
});

// =========================================================================
// TEST L: Kota vs Kabupaten collision (Request Kota Bandung -> picks Kota, not Kabupaten)
// =========================================================================
runTest('L. City vs Regency distinction: Request for Kota Bandung selects Kota, not Kabupaten Bandung', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kota Bandung',
  };

  const kabCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
    academicYear: '2026/2027',
    authority: 'Disdik Kab Bandung',
    documentTitle: 'Kaldik Kab Bandung',
    sourceUrl: 'https://example.com/kaldik-kab-bandung',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const kotaCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    province: 'Jawa Barat',
    regency: 'Kota Bandung',
    academicYear: '2026/2027',
    authority: 'Disdik Kota Bandung',
    documentTitle: 'Kaldik Kota Bandung',
    sourceUrl: 'https://example.com/kaldik-kota-bandung',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([kabCand, kotaCand], req);
  assert.notStrictEqual(selected, null);
  assert.strictEqual(selected?.regency, 'Kota Bandung');
});

// =========================================================================
// TEST M: Missing candidate province fails closed when request has province
// =========================================================================
runTest('M. Fail-closed province matching: REGENCY candidate with missing province is rejected and falls back to PROVINCE', () => {
  const req: CalendarSearchRequest = {
    academicYear: '2026/2027',
    semester: 1,
    province: 'Jawa Barat',
    regency: 'Kabupaten Bandung',
  };

  const noProvRegencyCand: CalendarSourceCandidate = {
    sourceLevel: 'REGENCY',
    regency: 'Kabupaten Bandung',
    province: undefined,
    academicYear: '2026/2027',
    authority: 'Disdik Kab Bandung',
    documentTitle: 'Kaldik Kab Bandung',
    sourceUrl: 'https://example.com/kaldik-kab-bandung',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const provCand: CalendarSourceCandidate = {
    sourceLevel: 'PROVINCE',
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    authority: 'Disdik Jabar',
    documentTitle: 'Kaldik Jabar',
    sourceUrl: 'https://example.com/kaldik-jabar',
    verificationStatus: 'VERIFIED',
    retrievedAt: '2026-07-20T08:00:00Z',
  };

  const selected = selectBestCalendarSource([noProvRegencyCand, provCand], req);
  assert.notStrictEqual(selected, null);
  // Must reject the regency candidate with missing province and fallback to PROVINCE
  assert.strictEqual(selected?.sourceLevel, 'PROVINCE');
  assert.strictEqual(selected?.province, 'Jawa Barat');
});

console.log(`\n========================================`);
console.log(`ALL CALENDAR PROVIDER CONTRACT TESTS PASSED (${passedTests}/${totalTests})`);
console.log(`========================================\n`);
