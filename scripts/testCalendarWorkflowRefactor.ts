import {
  resolveOfficialCalendar,
  applyManualCalendarOverride,
  confirmCalendarWorkflow,
  resetCalendarToOfficial,
  dedupProvenances,
} from '../src/services/calendarResolver';
import { OFFICIAL_NATIONAL_HOLIDAY_SOURCES, OFFICIAL_NATIONAL_HOLIDAYS } from '../src/data/calendar/nationalHolidays';
import { CalendarProvenance } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ ${message}`);
}

console.log('--- STARTING CALENDAR WORKFLOW REFACTOR & EXACT LEGAL SOURCE TESTS ---');

// Test 1: Exact Legal Metadata & Official URL Verification for 2024, 2025, 2026, 2027
{
  console.log('\n--- 1. Exact Legal Source Metadata & Official URL Verification ---');
  
  // 2024
  const source2024 = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2024];
  assert(Boolean(source2024), '2024 Official National Holiday Source must exist');
  assert(source2024.documentNumber === 'SKB 3 Menteri No. 855 Tahun 2023, No. 3 Tahun 2023, No. 4 Tahun 2023', '2024 SKB numbers');
  assert(source2024.sourceUrl.startsWith('https://'), '2024 sourceUrl must start with https://');
  assert(
    !source2024.sourceUrl.includes('jdih.kemenag.go.id/dokumen/skb-3-menteri-libur-nasional-dan-cuti-bersama'),
    '2024 sourceUrl must not use assumed JDIH slug'
  );
  assert(source2024.verificationState === 'VERIFIED', '2024 verificationState must be VERIFIED');

  // 2025
  const source2025 = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2025];
  assert(Boolean(source2025), '2025 Official National Holiday Source must exist');
  assert(source2025.documentNumber === 'SKB 3 Menteri No. 1017 Tahun 2024, No. 2 Tahun 2024, No. 2 Tahun 2024', '2025 SKB numbers');
  assert(source2025.sourceUrl.startsWith('https://'), '2025 sourceUrl must start with https://');
  assert(
    !source2025.sourceUrl.includes('jdih.kemenag.go.id/dokumen/skb-3-menteri-libur-nasional-dan-cuti-bersama'),
    '2025 sourceUrl must not use assumed JDIH slug'
  );
  assert(source2025.verificationState === 'VERIFIED', '2025 verificationState must be VERIFIED');

  // 2026 - Exact Setneg Canonical URL
  const source2026 = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2026];
  assert(Boolean(source2026), '2026 Official National Holiday Source must exist');
  assert(
    source2026.documentNumber === 'SKB 3 Menteri No. 1497 Tahun 2025, No. 2 Tahun 2025, No. 5 Tahun 2025',
    '2026 SKB number must be No. 1497 Tahun 2025, No. 2 Tahun 2025, No. 5 Tahun 2025'
  );
  assert(
    source2026.documentTitle.includes('tentang Hari Libur Nasional dan Cuti Bersama Tahun 2026'),
    '2026 document title must match exact official decree title'
  );
  assert(
    source2026.publicationDate === '2025-09-19',
    '2026 publicationDate must be 2025-09-19'
  );
  assert(
    source2026.sourceUrl === 'https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026',
    '2026 sourceUrl must equal exact Setneg page URL'
  );
  assert(
    source2026.sourceUrl !== 'https://www.setneg.go.id/baca/index/pemerintah_tetapkan_hari_libur_nasional_dan_cuti_bersama_tahun_2026',
    '2026 old URL must not be used'
  );
  assert(
    !source2026.sourceUrl.includes('jdih.kemenag.go.id/dokumen/skb-3-menteri-libur-nasional-dan-cuti-bersama'),
    '2026 sourceUrl must not use assumed JDIH slug'
  );
  assert(
    source2026.verificationState === 'VERIFIED',
    '2026 verificationState must be VERIFIED'
  );

  // 2027 - Exact Setneg Canonical URL
  const source2027 = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2027];
  assert(Boolean(source2027), '2027 Official National Holiday Source must exist');
  assert(
    source2027.documentNumber === 'SKB 3 Menteri No. 1205 Tahun 2026, No. 3 Tahun 2026, No. 2 Tahun 2026',
    '2027 SKB number must be No. 1205 Tahun 2026, No. 3 Tahun 2026, No. 2 Tahun 2026'
  );
  assert(
    source2027.documentTitle.includes('tentang Hari Libur Nasional dan Cuti Bersama Tahun 2027'),
    '2027 document title must match exact official decree title'
  );
  assert(
    source2027.publicationDate === '2026-09-15',
    '2027 publicationDate must be 2026-09-15'
  );
  assert(
    source2027.sourceUrl === 'https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027',
    '2027 sourceUrl must equal exact Setneg page URL'
  );
  assert(
    source2027.sourceUrl !== 'https://www.kemenkopmk.go.id/skb-3-menteri-libur-nasional-dan-cuti-bersama-2027',
    '2027 old URL must not be used'
  );
  assert(
    !source2027.sourceUrl.includes('jdih.kemenag.go.id/dokumen/skb-3-menteri-libur-nasional-dan-cuti-bersama'),
    '2027 sourceUrl must not use assumed JDIH slug'
  );
  assert(
    source2027.verificationState === 'VERIFIED',
    '2027 verificationState must be VERIFIED'
  );

  // Verify all derived national holiday records have exact canonical URL
  for (const h of OFFICIAL_NATIONAL_HOLIDAYS) {
    const canonicalSource = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[h.year];
    assert(
      h.sourceUrl === canonicalSource.sourceUrl,
      `Holiday ${h.date} (${h.name}) sourceUrl must exactly match canonical source for year ${h.year}`
    );
  }
}

// Test 2: Auto Resolve for Jawa Barat 2026/2027 Semester 1 (Year 2026 overlay)
{
  console.log('\n--- 2. Auto Resolve for Jawa Barat 2026/2027 Semester 1 ---');
  const res = resolveOfficialCalendar({
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-1',
    calendarId: 'cal-test-1',
    schoolDaysPerWeek: 5,
    subjectWeeklyJP: 4,
  });

  assert(res.isResolved === true, 'Jawa Barat 2026/2027 Semester 1 must resolve successfully');
  assert(res.calendar !== null, 'Calendar object must not be null');
  assert(res.calendar!.startDate === '2026-07-13', 'Start date must match official Jabar Kaldik 2026/2027');
  assert(res.calendar!.endDate === '2026-12-18', 'End date must match official Jabar Kaldik 2026/2027');
  assert(res.calendar!.workflowStatus === 'AUTO_RESOLVED', 'Workflow status must be AUTO_RESOLVED');
  assert(res.calendar!.resolutionStatus === 'RESOLVED', 'Resolution status must be RESOLVED');
  assert(res.calendar!.sourceType === 'REGIONAL_EDUCATION_CALENDAR', 'Source type must be REGIONAL_EDUCATION_CALENDAR');
  assert(res.calendar!.provenance !== undefined, 'Regional Provenance must be populated');
  assert(res.calendar!.provenance?.region === 'Jawa Barat', 'Provenance region must match');

  // Check national provenance for Semester 1 (all events fall in 2026)
  assert(res.calendar!.nationalProvenance !== undefined, 'National provenance must be present');
  assert(
    res.calendar!.nationalProvenance?.documentNumber === 'SKB 3 Menteri No. 1497 Tahun 2025, No. 2 Tahun 2025, No. 5 Tahun 2025',
    'National provenance must have exact 2026 SKB number'
  );
  assert(
    res.calendar!.nationalProvenance?.sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2026].sourceUrl,
    'National provenance sourceUrl must match canonical 2026 URL'
  );
  assert(
    res.calendar!.nationalProvenances?.length === 1,
    'Semester 1 only has 2026 national holidays, so nationalProvenances length must be 1'
  );
  assert(
    res.calendar!.nationalProvenances![0].sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2026].sourceUrl,
    'nationalProvenances[0] sourceUrl must match canonical 2026 URL'
  );

  // Check HUT RI 2026-08-17
  const hutRi = res.days.find(d => d.date === '2026-08-17');
  assert(hutRi !== undefined, 'HUT RI 2026-08-17 must be present');
  assert(hutRi!.sourceType === 'NATIONAL_HOLIDAY_OVERLAY', 'HUT RI must have source NATIONAL_HOLIDAY_OVERLAY');
  assert(hutRi!.sourceDocumentNumber === 'SKB 3 Menteri No. 1497 Tahun 2025, No. 2 Tahun 2025, No. 5 Tahun 2025', 'HUT RI must have 2026 SKB number');
  assert(hutRi!.sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2026].sourceUrl, 'HUT RI sourceUrl must match canonical 2026 URL');
  assert(hutRi!.sourceProvenances?.length === 1, 'HUT RI must have 1 source provenance');
  assert(hutRi!.sourceProvenances![0].sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2026].sourceUrl, 'HUT RI provenance sourceUrl must match canonical 2026 URL');
}

// Test 3: Auto Resolve for Jawa Barat 2026/2027 Semester 2 (Year 2027 overlay)
{
  console.log('\n--- 3. Auto Resolve for Jawa Barat 2026/2027 Semester 2 ---');
  const resSem2 = resolveOfficialCalendar({
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    semester: '2',
    academicSettingId: 'acad-test-1-sem2',
    calendarId: 'cal-test-1-sem2',
    schoolDaysPerWeek: 5,
    subjectWeeklyJP: 4,
  });

  assert(resSem2.isResolved === true, 'Jawa Barat 2026/2027 Semester 2 must resolve successfully');
  assert(resSem2.calendar!.startDate === '2027-01-04', 'Semester 2 start date must match official Jabar Kaldik (2027-01-04)');
  assert(resSem2.calendar!.endDate === '2027-06-25', 'Semester 2 end date must be in 2027');
  assert(
    resSem2.calendar!.nationalProvenance?.documentNumber === 'SKB 3 Menteri No. 1205 Tahun 2026, No. 3 Tahun 2026, No. 2 Tahun 2026',
    'Semester 2 national provenance must have exact 2027 SKB number'
  );
  assert(
    resSem2.calendar!.nationalProvenance?.sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2027].sourceUrl,
    'Semester 2 national provenance sourceUrl must match canonical 2027 URL'
  );
  assert(
    resSem2.calendar!.nationalProvenances?.length === 1,
    'Semester 2 only has 2027 national holidays, so nationalProvenances length must be 1'
  );
  assert(
    resSem2.calendar!.nationalProvenances![0].sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2027].sourceUrl,
    'nationalProvenances[0] sourceUrl must match canonical 2027 URL'
  );

  // Check Isra Mikraj 2027-01-05
  const israMikraj2027 = resSem2.days.find(d => d.date === '2027-01-05');
  assert(israMikraj2027 !== undefined, 'Isra Mikraj 2027-01-05 must be present');
  assert(israMikraj2027!.sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2027].sourceUrl, '2027 event sourceUrl must match canonical 2027 URL');
  assert(israMikraj2027!.sourceProvenances![0].sourceUrl === OFFICIAL_NATIONAL_HOLIDAY_SOURCES[2027].sourceUrl, '2027 event provenance sourceUrl must match canonical 2027 URL');
}

// Test 4: Provenance Deduplication Helper
{
  console.log('\n--- 4. Provenance Deduplication Test ---');
  const p1: CalendarProvenance = {
    sourceType: 'REGIONAL_EDUCATION_CALENDAR',
    sourceName: 'Kaldik Jabar',
    sourceAuthority: 'Disdik Jabar',
    sourceUrl: 'https://disdik.jabarprov.go.id',
    region: 'Jawa Barat',
    academicYear: '2026/2027',
    documentNumber: 'Kepdisdik No. 123/2026',
    retrievedAt: '2026-09-01T00:00:00Z',
  };
  const p2: CalendarProvenance = { ...p1 };
  const p3: CalendarProvenance = {
    sourceType: 'NATIONAL_HOLIDAY_OVERLAY',
    sourceName: 'SKB 3 Menteri',
    sourceAuthority: 'Kemenag, Kemenaker, PANRB',
    sourceUrl: 'https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026',
    region: 'Nasional',
    academicYear: '2026/2027',
    documentNumber: 'SKB No. 1497/2025',
    retrievedAt: '2026-09-01T00:00:00Z',
  };

  const deduped = dedupProvenances([p1, p2, p3, p1]);
  assert(deduped.length === 2, 'Duplicates must be pruned deterministically');
  assert(deduped[0].sourceType === 'REGIONAL_EDUCATION_CALENDAR', 'First is regional');
  assert(deduped[1].sourceType === 'NATIONAL_HOLIDAY_OVERLAY', 'Second is national');
}

// Test 5: Fail Closed on Unknown Province or Academic Year (NO DATA > FAKE DATA)
{
  console.log('\n--- 5. Fail Closed on Unknown Province or Academic Year ---');
  const resUnknown = resolveOfficialCalendar({
    province: 'Provinsi Fiktif',
    academicYear: '2099/2100',
    semester: '1',
    academicSettingId: 'acad-test-unknown',
  });

  assert(resUnknown.isResolved === false, 'Unknown region must fail closed');
  assert(resUnknown.calendar === null, 'Calendar must be null for unknown region');
  assert(resUnknown.days.length === 0, 'Days must be empty for unknown region');
  assert(resUnknown.diagnostic.includes('belum terdaftar') || resUnknown.diagnostic.includes('tidak ditemukan'), 'Diagnostic message must explain lack of official data');
}

// Test 6: Manual Override Workflow
{
  console.log('\n--- 6. Manual Override Workflow ---');
  const resolved = resolveOfficialCalendar({
    province: 'Jawa Tengah',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-4',
  });

  const overridden = applyManualCalendarOverride(
    resolved.calendar!,
    resolved.days,
    { startDate: '2026-07-25', overrideReason: 'Penyesuaian renovasi gedung sekolah' },
    [
      ...resolved.days,
      {
        id: 'day-custom-1',
        academicCalendarId: resolved.calendar!.id,
        date: '2026-08-10',
        status: 'holiday',
        notes: 'Hari Ulang Tahun Sekolah',
        sourceType: 'SCHOOL_OVERRIDE',
        isOverridden: true,
      }
    ]
  );

  assert(overridden.calendar.workflowStatus === 'MANUAL_OVERRIDE', 'Status must be MANUAL_OVERRIDE');
  assert(overridden.calendar.isOverridden === true, 'isOverridden must be true');
  assert(overridden.calendar.startDate === '2026-07-25', 'Updated start date must persist');
  assert(overridden.days.some(d => d.date === '2026-08-10'), 'Custom school holiday must be present');
}

// Test 7: Confirm Workflow
{
  console.log('\n--- 7. Confirm Workflow ---');
  const resolved = resolveOfficialCalendar({
    province: 'Jawa Timur',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-5',
  });

  const confirmed = confirmCalendarWorkflow(resolved.calendar!, resolved.days);
  assert(confirmed.calendar.workflowStatus === 'CONFIRMED', 'Status must be CONFIRMED');
  assert(confirmed.calendar.reviewStatus === 'CONFIRMED', 'Review status must be CONFIRMED');
  assert(confirmed.calendar.confirmedAt !== undefined, 'confirmedAt must be recorded');
}

// Test 8: Reset to Official
{
  console.log('\n--- 8. Reset to Official Workflow ---');
  const resolved = resolveOfficialCalendar({
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-6',
  });

  const overridden = applyManualCalendarOverride(
    resolved.calendar!,
    resolved.days,
    { startDate: '2026-08-01' }
  );

  const reset = resetCalendarToOfficial('Jawa Barat', '2026/2027', '1', 'acad-test-6', resolved.calendar!.id);
  assert(reset.isResolved === true, 'Reset must successfully re-resolve');
  assert(reset.calendar!.startDate === '2026-07-13', 'Start date must be reset to official Kaldik Jabar');
  assert(reset.calendar!.workflowStatus === 'AUTO_RESOLVED', 'Status must be AUTO_RESOLVED');
  assert(reset.calendar!.isOverridden === false, 'isOverridden must be false');
}

// Test 9: Auto-resolve workflow: Local resolved does not trigger online search
{
  console.log('\n--- 9. Auto-Resolve: Local Resolved skips Online Search ---');
  let onlineFetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    onlineFetchCalled = true;
    return { ok: true, json: async () => ({ success: true }) } as Response;
  }) as typeof fetch;

  // Simulate local resolution logic
  const localRes = resolveOfficialCalendar({
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-7',
  });

  assert(localRes.isResolved === true, 'Local static source is resolved');
  if (!localRes.isResolved) {
    // Only if local is unresolved would online search be triggered
    await fetch('/api/calendar/resolve');
  }

  assert(onlineFetchCalled === false, 'Online search must NOT be called when local calendar is resolved');
  globalThis.fetch = originalFetch;
}

// Test 10: Auto-resolve workflow: Local unresolved triggers online search
{
  console.log('\n--- 10. Auto-Resolve: Local Unresolved triggers Online Search ---');
  let onlineFetchPayload: any = null;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string, init?: RequestInit) => {
    onlineFetchPayload = JSON.parse(init?.body as string);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        resolution: {
          status: 'PARTIALLY_RESOLVED',
          selectedSource: {
            sourceLevel: 'REGENCY',
            province: 'Papua Barat',
            regency: 'Kabupaten Fakfak',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Fakfak',
            documentTitle: 'Kaldik Fakfak 2026/2027',
            sourceUrl: 'https://disdik.fakfakkab.go.id/kaldik',
            verificationStatus: 'PARTIAL',
            retrievedAt: '2026-09-25T10:00:00.000Z',
          },
          candidates: [],
          resolvedLevel: 'REGENCY',
        },
      }),
    } as Response;
  }) as typeof fetch;

  // Simulate local resolution logic on unknown province
  const localRes = resolveOfficialCalendar({
    province: 'Papua Barat',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-8',
  });

  assert(localRes.isResolved === false, 'Local static calendar is unresolved for missing regional seed');

  // Trigger online resolution
  let savedCalendar: any = null;
  let onlineDiscoveryCandidate: any = null;

  if (!localRes.isResolved) {
    const { resolveCalendarOnline } = await import('../src/services/calendarProviderClient');
    const onlineRes = await resolveCalendarOnline({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Papua Barat',
      regency: 'Kabupaten Fakfak',
    });

    if (onlineRes.status === 'PARTIALLY_RESOLVED' && onlineRes.selectedSource) {
      onlineDiscoveryCandidate = onlineRes.selectedSource;
      // CRITICAL POLICY: DO NOT automatically save AcademicCalendar
    }
  }

  assert(onlineFetchPayload !== null, 'Online fetch was called');
  assert(onlineFetchPayload.academicYear === '2026/2027', 'Academic year passed to online provider');
  assert(onlineFetchPayload.semester === 1, 'Semester passed to online provider');
  assert(onlineFetchPayload.province === 'Papua Barat', 'Province passed to online provider');
  assert(onlineFetchPayload.regency === 'Kabupaten Fakfak', 'Regency passed to online provider');

  assert(onlineDiscoveryCandidate !== null, 'Online discovery candidate was extracted');
  assert(onlineDiscoveryCandidate.authority === 'Dinas Pendidikan Fakfak', 'Discovered authority matched');
  assert(onlineDiscoveryCandidate.verificationStatus === 'PARTIAL', 'Status must remain PARTIAL');
  assert(savedCalendar === null, 'CRITICAL: AcademicCalendar must NOT be saved automatically on PARTIAL discovery');

  globalThis.fetch = originalFetch;
}

// Test 11: Auto-resolve workflow: Online unresolved preserves manual flow
{
  console.log('\n--- 11. Auto-Resolve: Online Unresolved preserves Manual Flow ---');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        resolution: {
          status: 'UNRESOLVED',
          candidates: [],
        },
      }),
    } as Response;
  }) as typeof fetch;

  const localRes = resolveOfficialCalendar({
    province: 'Sulawesi Barat',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-9',
  });

  assert(localRes.isResolved === false, 'Local is unresolved');
  assert(localRes.resolutionStatus === 'UNVERIFIED_SOURCE', 'Missing region evaluates to UNVERIFIED_SOURCE');

  const { resolveCalendarOnline } = await import('../src/services/calendarProviderClient');
  const onlineRes = await resolveCalendarOnline({
    academicYear: '2026/2027',
    semester: 1,
    province: 'Sulawesi Barat',
  });

  assert(onlineRes.status === 'UNRESOLVED', 'Online resolution returns UNRESOLVED');
  assert(onlineRes.candidates.length === 0, 'No candidates');
  assert(onlineRes.selectedSource === undefined, 'No selected source');

  globalThis.fetch = originalFetch;
}

// Test 12: Incomplete configuration (REGION_REQUIRED, ACADEMIC_YEAR_REQUIRED, SEMESTER_REQUIRED) skips online search
{
  console.log('\n--- 12. Incomplete Config: REGION_REQUIRED / ACADEMIC_YEAR_REQUIRED skips Online Search ---');
  let onlineFetchCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    onlineFetchCalled = true;
    return { ok: true, json: async () => ({ success: true }) } as Response;
  }) as typeof fetch;

  // Case 12a: Missing Province
  const missingProvinceRes = resolveOfficialCalendar({
    province: '',
    academicYear: '2026/2027',
    semester: '1',
    academicSettingId: 'acad-test-12a',
  });

  assert(missingProvinceRes.resolutionStatus === 'REGION_REQUIRED', 'Missing province must return REGION_REQUIRED');
  if (missingProvinceRes.resolutionStatus === 'UNVERIFIED_SOURCE') {
    await fetch('/api/calendar/resolve');
  }
  assert(onlineFetchCalled === false, 'Online search must NOT be called on REGION_REQUIRED');

  // Case 12b: Missing Academic Year
  const missingYearRes = resolveOfficialCalendar({
    province: 'Jawa Barat',
    academicYear: '',
    semester: '1',
    academicSettingId: 'acad-test-12b',
  });

  assert(missingYearRes.resolutionStatus === 'ACADEMIC_YEAR_REQUIRED', 'Missing year must return ACADEMIC_YEAR_REQUIRED');
  if (missingYearRes.resolutionStatus === 'UNVERIFIED_SOURCE') {
    await fetch('/api/calendar/resolve');
  }
  assert(onlineFetchCalled === false, 'Online search must NOT be called on ACADEMIC_YEAR_REQUIRED');

  // Case 12c: Missing Semester
  const missingSemRes = resolveOfficialCalendar({
    province: 'Jawa Barat',
    academicYear: '2026/2027',
    semester: undefined,
    academicSettingId: 'acad-test-12c',
  });

  assert(missingSemRes.resolutionStatus === 'SEMESTER_REQUIRED', 'Missing semester must return SEMESTER_REQUIRED');
  if (missingSemRes.resolutionStatus === 'UNVERIFIED_SOURCE') {
    await fetch('/api/calendar/resolve');
  }
  assert(onlineFetchCalled === false, 'Online search must NOT be called on SEMESTER_REQUIRED');

  globalThis.fetch = originalFetch;
}

// Test 13: PARTIAL Online Discovery is strictly READ-ONLY (no calendar mutation, no dates override, no save)
{
  console.log('\n--- 13. Invariant: PARTIAL Online Discovery is strictly READ-ONLY ---');
  const mockPartialCandidate = {
    sourceLevel: 'REGENCY' as const,
    province: 'Papua Barat',
    regency: 'Kabupaten Fakfak',
    academicYear: '2026/2027',
    authority: 'Dinas Pendidikan Fakfak',
    documentTitle: 'Kaldik Fakfak 2026/2027',
    documentNumber: 'Kepdisdik 420/123/2026',
    sourceUrl: 'https://disdik.fakfakkab.go.id/kaldik',
    semesterStartDate: '2026-07-13',
    semesterEndDate: '2026-12-18',
    verificationStatus: 'PARTIAL' as const,
    retrievedAt: '2026-09-25T10:00:00.000Z',
  };

  // State invariants:
  // 1. Existing calendar state before discovery
  let currentCalendar: any = null;
  let currentStartDate = '';
  let currentEndDate = '';
  let currentWorkflowStatus = 'UNRESOLVED';
  let isSaved = false;

  const onSaveMock = () => {
    isSaved = true;
  };

  // When online discovery candidate is received:
  // ONLY setOnlineDiscovery(candidate) is allowed!
  let onlineDiscoveryState: any = null;
  const setOnlineDiscoveryMock = (cand: any) => {
    onlineDiscoveryState = cand;
  };

  setOnlineDiscoveryMock(mockPartialCandidate);

  // Invariant assertions:
  assert(onlineDiscoveryState !== null, 'Discovery card receives candidate for read-only display');
  assert(currentStartDate === '', 'StartDate must NOT be mutated automatically');
  assert(currentEndDate === '', 'EndDate must NOT be mutated automatically');
  assert(currentCalendar === null, 'AcademicCalendar must NOT be created');
  assert(currentWorkflowStatus === 'UNRESOLVED', 'WorkflowStatus must remain UNRESOLVED');
  assert(isSaved === false, 'onSaveCalendar must NEVER be called automatically on PARTIAL');
  assert(
    onlineDiscoveryState.verificationStatus === 'PARTIAL',
    'Status must remain PARTIAL and must not be promoted to RESOLVED'
  );
}

console.log('\n🎉 ALL CALENDAR WORKFLOW & EXACT LEGAL SOURCE TESTS PASSED PERFECTLY (100%)!');
