import assert from 'node:assert';
import { resolveCalendarOnline } from '../src/services/calendarProviderClient';
import {
  CalendarSearchRequest,
  CalendarProviderResolution,
  selectBestCalendarSource,
  evaluateCalendarCandidate,
} from '../src/services/calendarProvider';
import { GroundedCalendarSearchProvider, GroundedSearchResponse } from '../server/calendarProvider';

console.log('=== RUNNING AUDIT: CALENDAR ENDPOINT & CLIENT CONTRACT ===\n');

let totalTests = 0;
let passedTests = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  totalTests++;
  try {
    await fn();
    console.log(`[PASS] ${totalTests}. ${name}`);
    passedTests++;
  } catch (err: any) {
    console.error(`[FAIL] ${totalTests}. ${name}:`, err.message);
    throw err;
  }
}

async function main() {
  const originalFetch = globalThis.fetch;

  // =========================================================================
  // TEST 1: Client calls /api/calendar/resolve with correct POST payload
  // =========================================================================
  await runTest('1. Client contract: calls /api/calendar/resolve with academicYear, semester, province, regency', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any = null;

    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      capturedBody = JSON.parse(init?.body as string);

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          resolution: {
            status: 'PARTIALLY_RESOLVED',
            selectedSource: {
              sourceLevel: 'REGENCY',
              province: 'Jawa Barat',
              regency: 'Kabupaten Bandung',
              academicYear: '2026/2027',
              authority: 'Dinas Pendidikan Kabupaten Bandung',
              documentTitle: 'Kaldik 2026/2027',
              sourceUrl: 'https://disdik.bandungkab.go.id/kaldik-2026',
              verificationStatus: 'PARTIAL',
              retrievedAt: '2026-09-25T10:00:00.000Z',
            },
            candidates: [
              {
                sourceLevel: 'REGENCY',
                province: 'Jawa Barat',
                regency: 'Kabupaten Bandung',
                academicYear: '2026/2027',
                authority: 'Dinas Pendidikan Kabupaten Bandung',
                documentTitle: 'Kaldik 2026/2027',
                sourceUrl: 'https://disdik.bandungkab.go.id/kaldik-2026',
                verificationStatus: 'PARTIAL',
                retrievedAt: '2026-09-25T10:00:00.000Z',
              },
            ],
            resolvedLevel: 'REGENCY',
          },
        }),
      } as Response;
    }) as typeof fetch;

    const request: CalendarSearchRequest = {
      academicYear: '2026/2027',
      semester: 1,
      province: 'Jawa Barat',
      regency: 'Kabupaten Bandung',
    };

    const res = await resolveCalendarOnline(request);

    assert.strictEqual(capturedUrl, '/api/calendar/resolve');
    assert.strictEqual(capturedMethod, 'POST');
    assert.strictEqual(capturedBody.academicYear, '2026/2027');
    assert.strictEqual(capturedBody.semester, 1);
    assert.strictEqual(capturedBody.province, 'Jawa Barat');
    assert.strictEqual(capturedBody.regency, 'Kabupaten Bandung');

    assert.strictEqual(res.status, 'PARTIALLY_RESOLVED');
    assert.strictEqual(res.resolvedLevel, 'REGENCY');
    assert.strictEqual(res.selectedSource?.authority, 'Dinas Pendidikan Kabupaten Bandung');
    assert.strictEqual(res.selectedSource?.verificationStatus, 'PARTIAL');
    assert.strictEqual(res.candidates.length, 1);
  });

  // =========================================================================
  // TEST 2: Client fails closed on network / HTTP 500 error -> UNRESOLVED
  // =========================================================================
  await runTest('2. Client fail-closed: Network failure or 500 error returns UNRESOLVED with empty candidates', async () => {
    // Sub-case 2a: HTTP 500
    globalThis.fetch = (async () => {
      return {
        ok: false,
        status: 500,
        json: async () => ({ success: false, error: 'Internal server error' }),
      } as Response;
    }) as typeof fetch;

    const res500 = await resolveCalendarOnline({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Jawa Barat',
    });

    assert.strictEqual(res500.status, 'UNRESOLVED');
    assert.deepStrictEqual(res500.candidates, []);
    assert.strictEqual(res500.selectedSource, undefined);
    assert(res500.message && res500.message.includes('Internal server error'));

    // Sub-case 2b: Network exception (fetch throws)
    globalThis.fetch = (async () => {
      throw new Error('Failed to fetch');
    }) as typeof fetch;

    const resNetworkErr = await resolveCalendarOnline({
      academicYear: '2026/2027',
      semester: 2,
    });

    assert.strictEqual(resNetworkErr.status, 'UNRESOLVED');
    assert.deepStrictEqual(resNetworkErr.candidates, []);
    assert.strictEqual(resNetworkErr.selectedSource, undefined);
    assert(resNetworkErr.message && resNetworkErr.message.includes('Failed to fetch'));
  });

  // =========================================================================
  // TEST 3: Client fails closed on invalid client-side arguments without making fetch call
  // =========================================================================
  await runTest('3. Client validation: Rejects missing academicYear or invalid semester without network call', async () => {
    let fetchCalled = false;
    globalThis.fetch = (async () => {
      fetchCalled = true;
      return { ok: true } as Response;
    }) as typeof fetch;

    // Empty academicYear
    const resEmptyYear = await resolveCalendarOnline({
      academicYear: '',
      semester: 1,
    });
    assert.strictEqual(resEmptyYear.status, 'UNRESOLVED');
    assert.strictEqual(fetchCalled, false);

    // Invalid semester (e.g. 3)
    const resInvalidSem = await resolveCalendarOnline({
      academicYear: '2026/2027',
      semester: 3 as any,
    });
    assert.strictEqual(resInvalidSem.status, 'UNRESOLVED');
    assert.strictEqual(fetchCalled, false);
  });

  // =========================================================================
  // TEST 4: Client handles malformed or unexpected response payload safely
  // =========================================================================
  await runTest('4. Malformed response: Returns UNRESOLVED when server returns invalid format', async () => {
    globalThis.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ notSuccess: true, somethingElse: 123 }),
      } as Response;
    }) as typeof fetch;

    const resMalformed = await resolveCalendarOnline({
      academicYear: '2026/2027',
      semester: 1,
    });
    assert.strictEqual(resMalformed.status, 'UNRESOLVED');
    assert.deepStrictEqual(resMalformed.candidates, []);
  });

  // =========================================================================
  // TEST 4B: Client rejects invalid resolution status (e.g. BROKEN) -> UNRESOLVED
  // =========================================================================
  await runTest('4B. Invalid resolution status: Rejects invalid status like BROKEN and fails closed to UNRESOLVED', async () => {
    globalThis.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          resolution: {
            status: 'BROKEN',
            candidates: [
              {
                sourceLevel: 'REGENCY',
                academicYear: '2026/2027',
                authority: 'Bad Source',
                documentTitle: 'Bad Title',
                sourceUrl: 'https://bad.go.id',
                verificationStatus: 'PARTIAL',
                retrievedAt: '2026-09-25T10:00:00.000Z',
              },
            ],
          },
        }),
      } as Response;
    }) as typeof fetch;

    const resBroken = await resolveCalendarOnline({
      academicYear: '2026/2027',
      semester: 1,
    });

    assert.strictEqual(resBroken.status, 'UNRESOLVED');
    assert.deepStrictEqual(resBroken.candidates, []);
    assert.strictEqual(resBroken.selectedSource, undefined);
  });

  // =========================================================================
  // TEST 5: Backend Endpoint Resolution Logic: Grounded provider integrated with selectBestCalendarSource
  // =========================================================================
  await runTest('5. Backend contract logic: GroundedCalendarSearchProvider integrates with selectBestCalendarSource', async () => {
    const fakeGenerate = async (prompt: string): Promise<GroundedSearchResponse> => {
      if (prompt.includes('Kabupaten/Kota')) {
        return {
          text: JSON.stringify([
            {
              province: 'Jawa Barat',
              regency: 'Kabupaten Bandung',
              academicYear: '2026/2027',
              authority: 'Dinas Pendidikan Kabupaten Bandung',
              documentTitle: 'Pedoman Kaldik Kab Bandung 2026/2027',
              sourceUrl: 'https://disdik.bandungkab.go.id/kaldik-2026',
            },
          ]),
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://disdik.bandungkab.go.id/kaldik-2026',
                      title: 'Disdik Kab Bandung Kaldik',
                    },
                  },
                ],
              },
            },
          ],
        };
      }
      return { text: '[]' };
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
    });

    const searchRequest: CalendarSearchRequest = {
      academicYear: '2026/2027',
      semester: 1,
      province: 'Jawa Barat',
      regency: 'Kabupaten Bandung',
    };

    const candidates = await provider.search(searchRequest);
    const selectedSource = selectBestCalendarSource(candidates, searchRequest);

    assert(selectedSource !== null);
    const status = evaluateCalendarCandidate(selectedSource);

    // Online discovery candidate is PARTIAL -> evaluate returns PARTIALLY_RESOLVED
    assert.strictEqual(status, 'PARTIALLY_RESOLVED');
    assert.strictEqual(selectedSource.sourceLevel, 'REGENCY');
    assert.strictEqual(selectedSource.verificationStatus, 'PARTIAL');

    const resolution: CalendarProviderResolution = {
      status,
      selectedSource,
      candidates,
      resolvedLevel: selectedSource.sourceLevel,
    };

    assert.strictEqual(resolution.status, 'PARTIALLY_RESOLVED');
    assert.strictEqual(resolution.resolvedLevel, 'REGENCY');
    assert.strictEqual(resolution.candidates.length, 1);
  });

  // =========================================================================
  // TEST 6: Backend contract: Empty search yields UNRESOLVED with zero fabricated fallback
  // =========================================================================
  await runTest('6. Backend contract: Empty search results yield status UNRESOLVED without fabricated data', async () => {
    const fakeGenerate = async (): Promise<GroundedSearchResponse> => ({
      text: '[]',
    });

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
    });

    const searchRequest: CalendarSearchRequest = {
      academicYear: '2026/2027',
      semester: 1,
      province: 'Daerah Khusus Ibukota Jakarta',
      regency: 'Kota Administrasi Jakarta Pusat',
    };

    const candidates = await provider.search(searchRequest);
    const selectedSource = selectBestCalendarSource(candidates, searchRequest);

    assert.strictEqual(selectedSource, null);
    const resolution: CalendarProviderResolution = {
      status: 'UNRESOLVED',
      selectedSource: undefined,
      candidates,
      resolvedLevel: undefined,
    };

    assert.strictEqual(resolution.status, 'UNRESOLVED');
    assert.strictEqual(resolution.selectedSource, undefined);
    assert.deepStrictEqual(resolution.candidates, []);
  });

  // Restore fetch
  globalThis.fetch = originalFetch;

  console.log(`\n========================================`);
  console.log(`ALL CALENDAR ENDPOINT CONTRACT TESTS PASSED (${passedTests}/${totalTests})`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('Fatal error in testCalendarEndpointContract:', err);
  process.exit(1);
});
