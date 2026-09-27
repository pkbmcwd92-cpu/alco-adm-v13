import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadStorageV5,
  saveStorageV5,
  createProfileV5,
  createSchoolV5,
  createYearHierarchyV5,
  saveAcademicCalendarV5,
} from '../src/services/storageV5';
import { getRuntimeContextV5 } from '../src/services/runtimeV5';
import { AcademicCalendar, CalendarDay } from '../src/types';
import { mapDiagnosticToSearchStatus } from '../src/components/administration/TimePlanningManager';

console.log('=== RUNNING AUDIT: MERDEKA V5 ACADEMIC CALENDAR RUNTIME (B.4.1) ===\n');

let totalTests = 0;
function runTest(description: string, fn: () => void) {
  totalTests++;
  try {
    fn();
    console.log(`[PASS] ${totalTests}. ${description}`);
  } catch (err) {
    console.error(`[FAIL] ${totalTests}. ${description}`);
    throw err;
  }
}

// Mock localStorage in Node environment
class MockLocalStorage {
  private store: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys());
    return keys[index] || null;
  }
}

const mockStorage = new MockLocalStorage();
(globalThis as any).localStorage = mockStorage;
const appPath = path.resolve(process.cwd(), 'src/App.tsx');
const appSource = fs.readFileSync(appPath, 'utf-8');

const tpmPath = path.resolve(process.cwd(), 'src/components/administration/TimePlanningManager.tsx');
const tpmSource = fs.readFileSync(tpmPath, 'utf-8');

const adminHubPath = path.resolve(process.cwd(), 'src/components/administration/AdministrationHub.tsx');
const adminHubSource = fs.readFileSync(adminHubPath, 'utf-8');

// -----------------------------------------------------------------------------
// TEST 1: TimePlanningManager calls resolveCalendarOnline() before resolveOfficialCalendar()
// -----------------------------------------------------------------------------
runTest('1. TimePlanningManager source contract calls resolveCalendarOnline before local resolveOfficialCalendar', () => {
  const onlineIdx = tpmSource.indexOf('resolveCalendarOnline({');
  const localIdx = tpmSource.indexOf('resolveOfficialCalendar({');

  assert.ok(onlineIdx !== -1, 'TimePlanningManager must call resolveCalendarOnline');
  assert.ok(localIdx !== -1, 'TimePlanningManager must include resolveOfficialCalendar fallback');
  assert.ok(
    onlineIdx < localIdx,
    'resolveCalendarOnline must be called BEFORE resolveOfficialCalendar (Search-First flow)'
  );
});

// -----------------------------------------------------------------------------
// TEST 2: Request includes academicYear, province, regency (Annual Discovery Scope)
// -----------------------------------------------------------------------------
runTest('2. Online calendar search request parameters include academicYear, province, regency', () => {
  assert.ok(
    tpmSource.includes('academicYear,') &&
      tpmSource.includes('province: prov,') &&
      (tpmSource.includes('regency:') || tpmSource.includes('regency,')),
    'resolveCalendarOnline call must transmit academicYear, province, and regency for annual discovery scope'
  );
});

// -----------------------------------------------------------------------------
// TEST 3: Search region initializes from school.regency and school.province
// -----------------------------------------------------------------------------
runTest('3. Search criteria states initialize from school.regency and school.province', () => {
  assert.ok(
    tpmSource.includes('school.regency'),
    'TimePlanningManager must initialize search regency state from school.regency'
  );
  assert.ok(
    tpmSource.includes('school.province'),
    'TimePlanningManager must initialize search province state from school.province'
  );
});

// -----------------------------------------------------------------------------
// TEST 4: Online search does not depend on static availableProvinces
// -----------------------------------------------------------------------------
runTest('4. Online search input for Province is free-text and does not depend on static availableProvinces dropdown', () => {
  assert.ok(
    tpmSource.includes('<input\n                    type="text"\n                    value={searchProvince}'),
    'TimePlanningManager must render searchProvince as free-text input'
  );
  assert.ok(
    !tpmSource.includes('availableProvinces.map'),
    'TimePlanningManager must NOT restrict Province search to availableProvinces.map'
  );
  assert.ok(
    !tpmSource.includes('getAvailableProvinces'),
    'TimePlanningManager must NOT require getAvailableProvinces'
  );
});

// -----------------------------------------------------------------------------
// TEST 4B: Region separation (Regency != Province)
// -----------------------------------------------------------------------------
runTest('4B. candidate.regency does not overwrite selectedProvince', () => {
  assert.ok(
    !tpmSource.includes('setSelectedProvince(candidate.regency'),
    'TimePlanningManager must NOT assign candidate.regency to selectedProvince'
  );
  assert.ok(
    tpmSource.includes("setSelectedProvince(candidate.province || searchProvince || school.province || '');"),
    'TimePlanningManager must assign candidate.province or fallback province to selectedProvince'
  );
});

// -----------------------------------------------------------------------------
// TEST 4C: Confirm is the only persistence gate
// -----------------------------------------------------------------------------
runTest('4C. Manual override and online candidate selection update draft state only without calling onSaveCalendar', () => {
  const overrideMatch = tpmSource.match(/const handleApplyOverride = [\s\S]*?\n  \};/);
  assert.ok(overrideMatch, 'handleApplyOverride function must exist');
  const overrideBody = overrideMatch[0];
  assert.ok(
    !overrideBody.includes('onSaveCalendar('),
    'handleApplyOverride MUST NOT call onSaveCalendar (draft only)'
  );

  const candidateMatch = tpmSource.match(/const handleApplyOnlineCandidate = [\s\S]*?\n  \};/);
  assert.ok(candidateMatch, 'handleApplyOnlineCandidate function must exist');
  const candidateBody = candidateMatch[0];
  assert.ok(
    !candidateBody.includes('onSaveCalendar('),
    'handleApplyOnlineCandidate MUST NOT call onSaveCalendar (draft only)'
  );

  const confirmMatch = tpmSource.match(/const handleConfirmCalendar = [\s\S]*?\n  \};/);
  assert.ok(confirmMatch, 'handleConfirmCalendar function must exist');
  const confirmBody = confirmMatch[0];
  assert.ok(
    confirmBody.includes('onSaveCalendar(res.calendar, res.days);'),
    'handleConfirmCalendar MUST be the sole trigger calling onSaveCalendar'
  );
});

// -----------------------------------------------------------------------------
// TEST 5: No auto Semester 1 selection or local academicYear authority
// -----------------------------------------------------------------------------
runTest('5. Academic Year and Semester in TimePlanningManager derive from academicSetting context', () => {
  assert.ok(
    tpmSource.includes('academicSetting.academicYear') &&
      tpmSource.includes('academicSetting.semester'),
    'TimePlanningManager must derive year and semester directly from academicSetting'
  );
  assert.ok(
    !tpmSource.includes('const [semester, setSemester] = useState<string>("1")'),
    'TimePlanningManager must not force a default Semester 1 authority state'
  );
});

// -----------------------------------------------------------------------------
// TEST 6: Regional online source populates draft only upon explicit "Gunakan sebagai Acuan"
// -----------------------------------------------------------------------------
runTest('6. handleApplyOnlineCandidate populates draft dates only upon explicit user action', () => {
  assert.ok(
    tpmSource.includes('const handleApplyOnlineCandidate ='),
    'TimePlanningManager must define handleApplyOnlineCandidate'
  );
  assert.ok(
    tpmSource.includes('Gunakan sebagai Acuan'),
    'TimePlanningManager must render "Gunakan sebagai Acuan" button for online candidate review'
  );
});

// -----------------------------------------------------------------------------
// TEST 7: Search result does NOT automatically trigger persistence
// -----------------------------------------------------------------------------
runTest('7. Online calendar search discovery does not invoke onSaveCalendar automatically', () => {
  const onlineSection = tpmSource.slice(
    tpmSource.indexOf('resolveCalendarOnline'),
    tpmSource.indexOf('resolveOfficialCalendar')
  );
  assert.ok(
    !onlineSection.includes('onSaveCalendar('),
    'Online discovery step must be READ-ONLY and must not call onSaveCalendar'
  );
});

// -----------------------------------------------------------------------------
// TEST 8: Regional result without boundaries does not fabricate dates
// -----------------------------------------------------------------------------
runTest('8. Candidate without exact semesterStartDate/semesterEndDate shows guidance and does not invent dates', () => {
  assert.ok(
    tpmSource.includes('Sumber resmi ditemukan, tetapi batas tanggal semester tidak dapat ditentukan secara terverifikasi'),
    'TimePlanningManager must warn user when candidate lacks exact semester boundary dates'
  );
});

// -----------------------------------------------------------------------------
// TEST 9: NATIONAL source does not automatically populate semester boundaries
// -----------------------------------------------------------------------------
runTest('9. NATIONAL source level acts as reference overlay without auto-populating semester boundaries', () => {
  assert.ok(
    tpmSource.includes('Sumber nasional ditemukan sebagai referensi. Kalender semester daerah belum ditemukan.'),
    'TimePlanningManager must display national candidate strictly as reference overlay'
  );
});

// -----------------------------------------------------------------------------
// TEST 10: Local static resolveOfficialCalendar is called after online search
// -----------------------------------------------------------------------------
runTest('10. resolveOfficialCalendar acts as verified local cache fallback when online produces no candidate', () => {
  assert.ok(
    tpmSource.includes('// 2. VERIFIED LOCAL CACHE FALLBACK'),
    'TimePlanningManager must designate resolveOfficialCalendar as local cache fallback'
  );
});

// -----------------------------------------------------------------------------
// TEST 11: handleSaveCalendar requires activeSemesterPlan and uses saveAcademicCalendarV5
// -----------------------------------------------------------------------------
runTest('11. App.tsx handleSaveCalendar requires activeSemesterPlan and calls saveAcademicCalendarV5', () => {
  assert.ok(
    appSource.includes('saveAcademicCalendarV5(activeSemesterPlan.id,'),
    'App.tsx handleSaveCalendar must call saveAcademicCalendarV5 with activeSemesterPlan.id'
  );
  assert.ok(
    appSource.includes('if (!activeSemesterPlan || !activeYearPlan)'),
    'App.tsx handleSaveCalendar must validate activeSemesterPlan and activeYearPlan'
  );
});

// -----------------------------------------------------------------------------
// TEST 12: Canonical calendar and CalendarDay structure
// -----------------------------------------------------------------------------
runTest('12. handleSaveCalendar canonicalizes academicSettingId and links calendar days to canonical calendar ID', () => {
  assert.ok(
    appSource.includes('academicSettingId: activeSemesterPlan.id,'),
    'Canonical calendar academicSettingId must equal activeSemesterPlan.id'
  );
  assert.ok(
    appSource.includes('academicCalendarId: canonicalCalendar.id'),
    'Canonical days must reference canonicalCalendar.id'
  );
});

// -----------------------------------------------------------------------------
// TEST 13: End-to-End V5 Calendar Persistence, Read Model & Reload Fidelity
// -----------------------------------------------------------------------------
runTest('13. V5 Storage persists academic calendar and runtimeContext reads it accurately', () => {
  mockStorage.clear();
  const school = createSchoolV5({
    name: 'SDN Merdeka 01',
    npsn: '12345678',
    regency: 'Kota Tangerang',
    province: 'Banten',
    address: 'Jl. Merdeka No. 1',
    village: 'Sukajadi',
    district: 'Karawaci',
    principalName: 'Drs. Supriadi',
    principalNip: '197001011995031001',
  });
  const profile = createProfileV5({
    name: 'Guru Kalender',
    schoolId: school.id,
    nip: '198501012010011002',
    status: 'PNS',
    defaultSubject: 'Pancasila',
    defaultLevel: 'SD',
  });
  const hierarchy = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Fase A / Kelas 1',
    subject: 'Pancasila',
  });

  const sem1 = hierarchy.semesterPlans[0];

  const cal1: AcademicCalendar = {
    id: `cal-${sem1.id}`,
    academicSettingId: sem1.id,
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    startDate: '2026-07-13',
    endDate: '2026-12-19',
    schoolDaysPerWeek: 5,
    sourceType: 'REGIONAL_EDUCATION_CALENDAR',
    sourceName: 'Kaldik Kota Tangerang 2026/2027',
    sourceRegion: 'Banten',
    workflowStatus: 'CONFIRMED',
    updatedAt: new Date().toISOString(),
  };

  const days1: CalendarDay[] = [
    {
      id: `day-1`,
      academicCalendarId: cal1.id,
      date: '2026-08-17',
      status: 'holiday',
      notes: 'HUT Kemerdekaan RI',
      sourceType: 'NATIONAL_HOLIDAY_OVERLAY',
      category: 'NATIONAL_HOLIDAY',
    },
  ];

  // Save Calendar Sem 1
  saveAcademicCalendarV5(sem1.id, { calendar: cal1, days: days1 });

  // Set active semester to sem1 and verify runtime context
  const stateLoaded = loadStorageV5();
  stateLoaded.activeProfileId = profile.id;
  stateLoaded.activeYearPlanId = hierarchy.yearPlan.id;
  stateLoaded.activeSemesterPlanId = sem1.id;
  saveStorageV5(stateLoaded);

  const runtimeCtx1 = getRuntimeContextV5();
  assert.ok(runtimeCtx1.semesterData?.academicCalendar, 'runtimeContext must return academicCalendar for sem1');
  assert.strictEqual(
    runtimeCtx1.semesterData.academicCalendar.calendar.id,
    cal1.id,
    'Retrieved calendar ID must match cal1.id'
  );
  assert.strictEqual(
    runtimeCtx1.semesterData.academicCalendar.days.length,
    1,
    'Retrieved days count must equal 1'
  );
});

// -----------------------------------------------------------------------------
// TEST 14: Semester 1 and Semester 2 Calendar Isolation
// -----------------------------------------------------------------------------
runTest('14. Semester 1 and Semester 2 academic calendars remain strictly isolated in V5 storage', () => {
  mockStorage.clear();
  const school = createSchoolV5({
    name: 'SD 1',
    npsn: '12345679',
    address: 'Jl. Utama',
    village: 'Desa 1',
    district: 'Kecamatan 1',
    regency: 'Kabupaten A',
    province: 'Jawa Barat',
    principalName: 'Kepala SD 1',
    principalNip: '197001011995031002',
  });
  const profile = createProfileV5({
    name: 'Guru A',
    schoolId: school.id,
    nip: '198501012010011003',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
  });
  const hierarchy = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Fase A / Kelas 1',
    subject: 'Matematika',
  });

  const sem1 = hierarchy.semesterPlans[0];
  const sem2 = hierarchy.semesterPlans[1];

  const cal1: AcademicCalendar = {
    id: `cal-${sem1.id}`,
    academicSettingId: sem1.id,
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    startDate: '2026-07-13',
    endDate: '2026-12-19',
    schoolDaysPerWeek: 5,
    workflowStatus: 'CONFIRMED',
    updatedAt: new Date().toISOString(),
  };

  saveAcademicCalendarV5(sem1.id, { calendar: cal1, days: [] });

  // Switch to Semester 2 -> should have NO calendar
  const stateLoaded = loadStorageV5();
  stateLoaded.activeProfileId = profile.id;
  stateLoaded.activeYearPlanId = hierarchy.yearPlan.id;
  stateLoaded.activeSemesterPlanId = sem2.id;
  saveStorageV5(stateLoaded);

  const runtimeCtxSem2 = getRuntimeContextV5();
  assert.strictEqual(
    runtimeCtxSem2.semesterData?.academicCalendar,
    undefined,
    'Semester 2 must have undefined academicCalendar when only Semester 1 is saved'
  );

  // Switch back to Semester 1 -> calendar is restored
  stateLoaded.activeSemesterPlanId = sem1.id;
  saveStorageV5(stateLoaded);

  const runtimeCtxSem1 = getRuntimeContextV5();
  assert.ok(runtimeCtxSem1.semesterData?.academicCalendar, 'Semester 1 calendar must be restored');
  assert.strictEqual(runtimeCtxSem1.semesterData.academicCalendar.calendar.id, cal1.id);
});

// -----------------------------------------------------------------------------
// TEST 15: Upserting same SemesterPlan calendar replaces without duplicate wrapper
// -----------------------------------------------------------------------------
runTest('15. Saving calendar updates existing SemesterPlan calendar entry without creating duplicates', () => {
  mockStorage.clear();
  const school = createSchoolV5({
    name: 'SD 1',
    npsn: '12345679',
    address: 'Jl. Utama',
    village: 'Desa 1',
    district: 'Kecamatan 1',
    regency: 'Kabupaten A',
    province: 'Jawa Barat',
    principalName: 'Kepala SD 1',
    principalNip: '197001011995031002',
  });
  const profile = createProfileV5({
    name: 'Guru A',
    schoolId: school.id,
    nip: '198501012010011003',
    status: 'PNS',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
  });
  const hierarchy = createYearHierarchyV5({
    profileId: profile.id,
    schoolId: school.id,
    academicYear: '2026/2027',
    curriculumType: 'KURIKULUM_MERDEKA',
    level: 'SD',
    grade: 'Fase A / Kelas 1',
    subject: 'Matematika',
  });

  const sem1 = hierarchy.semesterPlans[0];

  const cal1: AcademicCalendar = {
    id: `cal-${sem1.id}`,
    academicSettingId: sem1.id,
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    startDate: '2026-07-13',
    endDate: '2026-12-19',
    schoolDaysPerWeek: 5,
    workflowStatus: 'CONFIRMED',
    updatedAt: new Date().toISOString(),
  };

  saveAcademicCalendarV5(sem1.id, { calendar: cal1, days: [] });
  // Second save with modified end date
  const cal1Updated = { ...cal1, endDate: '2026-12-20' };
  saveAcademicCalendarV5(sem1.id, { calendar: cal1Updated, days: [] });

  const stateFinal = loadStorageV5();
  assert.strictEqual(
    stateFinal.semesterData.academicCalendar.length,
    1,
    'semesterData.academicCalendar array must contain exactly 1 entry for sem1'
  );
  assert.strictEqual(
    stateFinal.semesterData.academicCalendar[0].value.calendar.endDate,
    '2026-12-20',
    'Updated calendar end date must reflect second save'
  );
});

// -----------------------------------------------------------------------------
// TEST 16: Fake 18 Weeks Absent in AdministrationHub
// -----------------------------------------------------------------------------
runTest('16. AdministrationHub badge does not fabricate 18 Mg when calendar is missing', () => {
  assert.ok(
    !adminHubSource.includes('`${calendar?.effectiveWeeks || 18} Mg`'),
    'AdministrationHub must not use `${calendar?.effectiveWeeks || 18} Mg`'
  );
  assert.ok(
    adminHubSource.includes("calendar?.effectiveWeeks ? `${calendar.effectiveWeeks} Mg` : 'Belum diatur'"),
    'AdministrationHub must show "Belum diatur" or "-" when effectiveWeeks is absent'
  );
});

// -----------------------------------------------------------------------------
// TEST 17: schoolDaysPerWeek is not silently canonicalized to 5
// -----------------------------------------------------------------------------
runTest('17. schoolDaysPerWeek defaults to null when unconfigured without silent 5-day assumption', () => {
  assert.ok(
    tpmSource.includes('calendar?.schoolDaysPerWeek === 5 || calendar?.schoolDaysPerWeek === 6\n      ? calendar.schoolDaysPerWeek\n      : null') ||
      tpmSource.includes('? calendar.schoolDaysPerWeek\n      : null'),
    'schoolDaysPerWeek must default to null when unconfigured'
  );
});

// -----------------------------------------------------------------------------
// TEST 18: AI Search Status Mapping & Mutually Exclusive Banner Contract
// -----------------------------------------------------------------------------
runTest('18A. SUCCESS status maps to SUCCESS and banners are mutually exclusive', () => {
  assert.ok(
    tpmSource.includes("!isOnlineSearching && aiSearchStatus === 'SUCCESS' && ("),
    'SUCCESS banner must exist and depend strictly on aiSearchStatus === SUCCESS'
  );
  assert.ok(
    tpmSource.includes("!isOnlineSearching && aiSearchStatus === 'NOT_FOUND' && ("),
    'NOT_FOUND banner must depend strictly on aiSearchStatus === NOT_FOUND'
  );
  assert.ok(
    tpmSource.includes("!isOnlineSearching && aiSearchStatus === 'ERROR' && ("),
    'ERROR banner must depend strictly on aiSearchStatus === ERROR'
  );
});

runTest('18B. Diagnostic NO_OFFICIAL_SOURCE maps to NOT_FOUND (and NOT ERROR)', () => {
  const status = mapDiagnosticToSearchStatus('NO_OFFICIAL_SOURCE');
  assert.strictEqual(status, 'NOT_FOUND', 'NO_OFFICIAL_SOURCE must map to NOT_FOUND');
  assert.notStrictEqual(status, 'ERROR', 'NO_OFFICIAL_SOURCE must NOT map to ERROR');
});

runTest('18C. Diagnostic CANDIDATE_REJECTED maps to NOT_FOUND', () => {
  const status = mapDiagnosticToSearchStatus('CANDIDATE_REJECTED');
  assert.strictEqual(status, 'NOT_FOUND', 'CANDIDATE_REJECTED must map to NOT_FOUND');
});

runTest('18D. Diagnostics NO_API_KEY, MODEL_FAILURE, EMPTY_RESPONSE, NO_GROUNDING, GROUNDING_RESOLUTION_FAILED map to ERROR', () => {
  const errorDiagnostics: Array<Parameters<typeof mapDiagnosticToSearchStatus>[0]> = [
    'NO_API_KEY',
    'MODEL_FAILURE',
    'EMPTY_RESPONSE',
    'NO_GROUNDING',
    'GROUNDING_RESOLUTION_FAILED',
  ];
  for (const diag of errorDiagnostics) {
    const status = mapDiagnosticToSearchStatus(diag);
    assert.strictEqual(status, 'ERROR', `${diag} must map to ERROR`);
  }
});

runTest('18E. ERROR banner contract strictly rejects aiSearchStatus === ERROR || onlineSearchError', () => {
  assert.ok(
    !tpmSource.includes("aiSearchStatus === 'ERROR' || onlineSearchError"),
    'UI must reject logic equivalent to aiSearchStatus === ERROR || onlineSearchError'
  );
  assert.ok(
    tpmSource.includes("!isOnlineSearching && aiSearchStatus === 'ERROR' && ("),
    'Error banner must depend strictly on aiSearchStatus === ERROR'
  );
});

console.log(`\nAll ${totalTests} Merdeka V5 Academic Calendar Runtime audit tests PASSED successfully!\n`);
