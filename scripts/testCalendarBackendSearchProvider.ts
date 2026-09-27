import assert from 'node:assert';
import {
  GroundedCalendarSearchProvider,
  GroundedSearchResponse,
  isOfficialCalendarSourceUrl,
  isCandidateBackedByGrounding,
  extractGroundedWebSources,
  parseCalendarSearchResponse,
  buildCalendarSearchPrompt,
} from '../server/calendarProvider';
import { CalendarSearchRequest } from '../src/services/calendarProvider';

console.log('=== RUNNING AUDIT: BACKEND CALENDAR ONLINE SEARCH PROVIDER ===\n');

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
  // =========================================================================
  // TEST A: Search hierarchy short-circuits at REGENCY if valid
  // =========================================================================
  await runTest('A. Search hierarchy: REGENCY hit short-circuits without querying PROVINCE or NATIONAL', async () => {
    let regencyCalled = 0;
    let provinceCalled = 0;
    let nationalCalled = 0;

    const fakeGenerate = async (prompt: string): Promise<GroundedSearchResponse> => {
      if (prompt.includes('Kabupaten/Kota')) {
        regencyCalled++;
        return {
          text: JSON.stringify([
            {
              province: 'Jawa Barat',
              regency: 'Kabupaten Bandung',
              academicYear: '2026/2027',
              authority: 'Dinas Pendidikan Kabupaten Bandung',
              documentTitle: 'Pedoman Kaldik Kab Bandung 2026/2027',
              sourceUrl: 'https://disdik.bandungkab.go.id/kaldik-2026',
              semesterStartDate: '2026-07-13',
              semesterEndDate: '2026-12-18',
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
      if (prompt.includes('tingkat Provinsi')) {
        provinceCalled++;
        return { text: '[]' };
      }
      nationalCalled++;
      return { text: '[]' };
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Jawa Barat',
      regency: 'Kabupaten Bandung',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceLevel, 'REGENCY');
    assert.strictEqual(results[0].regency, 'Kabupaten Bandung');
    assert.strictEqual(regencyCalled, 1, 'REGENCY must be called once');
    assert.strictEqual(provinceCalled, 0, 'PROVINCE must not be called after REGENCY hit');
    assert.strictEqual(nationalCalled, 0, 'NATIONAL must not be called after REGENCY hit');
  });

  // =========================================================================
  // TEST B: Province fallback when REGENCY is empty
  // =========================================================================
  await runTest('B. Province fallback: REGENCY empty falls back to PROVINCE and short-circuits before NATIONAL', async () => {
    let regencyCalled = 0;
    let provinceCalled = 0;
    let nationalCalled = 0;

    const fakeGenerate = async (prompt: string): Promise<GroundedSearchResponse> => {
      if (prompt.includes('Kabupaten/Kota')) {
        regencyCalled++;
        return { text: '[]' }; // empty at regency
      }
      if (prompt.includes('tingkat Provinsi')) {
        provinceCalled++;
        return {
          text: JSON.stringify([
            {
              province: 'Jawa Barat',
              academicYear: '2026/2027',
              authority: 'Dinas Pendidikan Provinsi Jawa Barat',
              documentTitle: 'Kaldik Jabar 2026/2027',
              sourceUrl: 'https://disdik.jabarprov.go.id/kaldik-2026',
            },
          ]),
          candidates: [
            {
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://disdik.jabarprov.go.id/kaldik-2026',
                      title: 'Disdik Jabar',
                    },
                  },
                ],
              },
            },
          ],
        };
      }
      nationalCalled++;
      return { text: '[]' };
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Jawa Barat',
      regency: 'Kabupaten Bandung Barat',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceLevel, 'PROVINCE');
    assert.strictEqual(results[0].province, 'Jawa Barat');
    assert.strictEqual(regencyCalled, 1);
    assert.strictEqual(provinceCalled, 1);
    assert.strictEqual(nationalCalled, 0, 'NATIONAL must not be called after PROVINCE hit');
  });

  // =========================================================================
  // TEST C: National fallback when regional searches yield no candidates
  // =========================================================================
  await runTest('C. National fallback: Regional empty queries fallback to NATIONAL', async () => {
    let regencyCalled = 0;
    let provinceCalled = 0;
    let nationalCalled = 0;

    const fakeGenerate = async (prompt: string): Promise<GroundedSearchResponse> => {
      if (prompt.includes('Kabupaten/Kota')) {
        regencyCalled++;
        return { text: '[]' };
      }
      if (prompt.includes('tingkat Provinsi')) {
        provinceCalled++;
        return { text: '[]' };
      }
      nationalCalled++;
      return {
        text: JSON.stringify([
          {
            academicYear: '2026/2027',
            authority: 'Kementerian Pendidikan Dasar dan Menengah RI',
            documentTitle: 'Pedoman Standar Kaldik Nasional 2026/2027',
            sourceUrl: 'https://kemendikdasmen.go.id/pedoman-kaldik-2026',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://kemendikdasmen.go.id/pedoman-kaldik-2026',
                    title: 'Kemendikdasmen Portal',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Papua Barat Daya',
      regency: 'Kabupaten Tambrauw',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceLevel, 'NATIONAL');
    assert.strictEqual(regencyCalled, 1);
    assert.strictEqual(provinceCalled, 1);
    assert.strictEqual(nationalCalled, 1);
  });

  // =========================================================================
  // TEST D: Hallucinated URL not backed by grounding is discarded
  // =========================================================================
  await runTest('D. Grounding integrity: Hallucinated AI URL without grounding evidence is discarded', () => {
    const rawJson = JSON.stringify([
      {
        province: 'Jawa Barat',
        regency: 'Kabupaten Bandung',
        academicYear: '2026/2027',
        authority: 'Dinas Pendidikan',
        documentTitle: 'Kaldik',
        sourceUrl: 'https://disdik.bandungkab.go.id/hallucinated-doc',
      },
    ]);

    // Grounding contains completely different domain
    const groundedSources = [
      { uri: 'https://other-gov.go.id/article', title: 'Other article' },
    ];

    const results = parseCalendarSearchResponse(
      rawJson,
      'REGENCY',
      { academicYear: '2026/2027', semester: 1, province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
      groundedSources
    );

    assert.strictEqual(results.length, 0, 'Candidate without grounding backing must be discarded');
  });

  // =========================================================================
  // TEST E: Non-government source domain is discarded
  // =========================================================================
  await runTest('E. Official domain requirement: Non-governmental blogs/sites are discarded', () => {
    assert.strictEqual(isOfficialCalendarSourceUrl('https://someblog.wordpress.com/kaldik'), false);
    assert.strictEqual(isOfficialCalendarSourceUrl('https://kaldik-guru.blogspot.com/2026'), false);
    assert.strictEqual(isOfficialCalendarSourceUrl('https://facebook.com/disdik'), false);
    assert.strictEqual(isOfficialCalendarSourceUrl('https://drive.google.com/file/d/123'), false);
    assert.strictEqual(isOfficialCalendarSourceUrl('https://disdik.jabarprov.go.id/kaldik'), true);
    assert.strictEqual(isOfficialCalendarSourceUrl('https://kemendikdasmen.go.id/dokumen'), true);
  });

  // =========================================================================
  // TEST F: HTTP URL is discarded
  // =========================================================================
  await runTest('F. HTTPS enforcement: Insecure HTTP URLs are discarded', () => {
    assert.strictEqual(isOfficialCalendarSourceUrl('http://disdik.jabarprov.go.id/kaldik'), false);
    assert.strictEqual(isOfficialCalendarSourceUrl('javascript:alert(1)'), false);
    assert.strictEqual(isOfficialCalendarSourceUrl('ftp://gov.go.id/file'), false);
  });

  // =========================================================================
  // TEST G: Mismatched academic year is discarded
  // =========================================================================
  await runTest('G. Academic year check: Candidates with different academic year are discarded', () => {
    const rawJson = JSON.stringify([
      {
        province: 'Jawa Barat',
        regency: 'Kabupaten Bandung',
        academicYear: '2025/2026', // Old year
        authority: 'Dinas Pendidikan',
        documentTitle: 'Kaldik 2025/2026',
        sourceUrl: 'https://disdik.bandungkab.go.id/kaldik-2025',
      },
    ]);

    const groundedSources = [{ uri: 'https://disdik.bandungkab.go.id/kaldik-2025' }];

    const results = parseCalendarSearchResponse(
      rawJson,
      'REGENCY',
      { academicYear: '2026/2027', semester: 1, province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
      groundedSources
    );

    assert.strictEqual(results.length, 0, 'Candidate with mismatched academic year must be discarded');
  });

  // =========================================================================
  // TEST H: Wrong regency in REGENCY search is discarded
  // =========================================================================
  await runTest('H. Regency precision: Kota Bandung candidate discarded when request is Kabupaten Bandung', () => {
    const rawJson = JSON.stringify([
      {
        province: 'Jawa Barat',
        regency: 'Kota Bandung',
        academicYear: '2026/2027',
        authority: 'Dinas Pendidikan Kota Bandung',
        documentTitle: 'Kaldik Kota Bandung',
        sourceUrl: 'https://disdik.bandung.go.id/kaldik',
      },
    ]);

    const groundedSources = [{ uri: 'https://disdik.bandung.go.id/kaldik' }];

    const results = parseCalendarSearchResponse(
      rawJson,
      'REGENCY',
      { academicYear: '2026/2027', semester: 1, province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
      groundedSources
    );

    assert.strictEqual(results.length, 0, 'Candidate with wrong regency must be discarded');
  });

  // =========================================================================
  // TEST I: Missing province on REGENCY candidate is discarded
  // =========================================================================
  await runTest('I. Province fail-closed: REGENCY candidate with missing province is discarded', () => {
    const rawJson = JSON.stringify([
      {
        regency: 'Kabupaten Bandung',
        academicYear: '2026/2027',
        authority: 'Dinas Pendidikan',
        documentTitle: 'Kaldik',
        sourceUrl: 'https://disdik.bandungkab.go.id/kaldik',
        // province omitted
      },
    ]);

    const groundedSources = [{ uri: 'https://disdik.bandungkab.go.id/kaldik' }];

    const results = parseCalendarSearchResponse(
      rawJson,
      'REGENCY',
      { academicYear: '2026/2027', semester: 1, province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
      groundedSources
    );

    assert.strictEqual(results.length, 0, 'REGENCY candidate with missing province must be discarded');
  });

  // =========================================================================
  // TEST J: All online candidates are marked PARTIAL (never VERIFIED)
  // =========================================================================
  await runTest('J. Verification policy: Online candidates receive verificationStatus = PARTIAL', () => {
    const rawJson = JSON.stringify([
      {
        province: 'Jawa Barat',
        academicYear: '2026/2027',
        authority: 'Dinas Pendidikan Jabar',
        documentTitle: 'Kaldik Jabar',
        sourceUrl: 'https://disdik.jabarprov.go.id/kaldik',
        verificationStatus: 'VERIFIED', // Even if model tries to claim VERIFIED
      },
    ]);

    const groundedSources = [{ uri: 'https://disdik.jabarprov.go.id/kaldik' }];

    const results = parseCalendarSearchResponse(
      rawJson,
      'PROVINCE',
      { academicYear: '2026/2027', semester: 1, province: 'Jawa Barat' },
      groundedSources
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].verificationStatus, 'PARTIAL', 'Online discovery status must be PARTIAL');
  });

  // =========================================================================
  // TEST K: Malformed AI output / Invalid JSON returns [] without crashing
  // =========================================================================
  await runTest('K. Malformed output: Invalid JSON returns empty array gracefully', () => {
    const malformed1 = 'I found the calendar: [Not valid JSON...';
    const res1 = parseCalendarSearchResponse(malformed1, 'NATIONAL', { academicYear: '2026/2027', semester: 1 }, []);
    assert.deepStrictEqual(res1, []);

    const malformed2 = '```json\n{ "object": "not array" }\n```';
    const res2 = parseCalendarSearchResponse(malformed2, 'NATIONAL', { academicYear: '2026/2027', semester: 1 }, []);
    assert.deepStrictEqual(res2, []);
  });

  // =========================================================================
  // TEST L: Date validation (YYYY-MM-DD preserved, invalid formatted dates omitted)
  // =========================================================================
  await runTest('L. Date parsing: Valid YYYY-MM-DD preserved, arbitrary date strings omitted', () => {
    const rawJson = JSON.stringify([
      {
        academicYear: '2026/2027',
        authority: 'Kemendikdasmen RI',
        documentTitle: 'Pedoman',
        sourceUrl: 'https://kemendikdasmen.go.id/kaldik',
        semesterStartDate: '2026-07-13', // valid
        semesterEndDate: '18 Desember 2026', // invalid format -> omitted
        publicationDate: '2026-06-25', // valid
        effectiveDate: 'invalid date', // invalid -> omitted
      },
    ]);

    const groundedSources = [{ uri: 'https://kemendikdasmen.go.id/kaldik' }];

    const results = parseCalendarSearchResponse(
      rawJson,
      'NATIONAL',
      { academicYear: '2026/2027', semester: 1 },
      groundedSources
    );

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].semesterStartDate, '2026-07-13');
    assert.strictEqual(results[0].semesterEndDate, undefined);
    assert.strictEqual(results[0].publicationDate, '2026-06-25');
    assert.strictEqual(results[0].effectiveDate, undefined);
  });

  // =========================================================================
  // TEST M: Realistic Google Redirect Grounding URL Resolution
  // =========================================================================
  await runTest('M. Google Search Grounding redirect resolved to final official government landing URL', async () => {
    const fakeGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Pemerintah Kota Tangerang',
            documentTitle: 'Kalender Pendidikan Kota Tangerang 2026/2027',
            sourceUrl: 'https://www.tangerangkota.go.id/dokumen/kaldik-2026-2027',
            semesterStartDate: '2026-07-13',
            semesterEndDate: '2026-12-19',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test123',
                    title: 'Website Resmi Pemerintah Kota Tangerang',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const fakeResolver = async (uri: string): Promise<string | null> => {
      if (uri.includes('vertexaisearch.cloud.google.com')) {
        return 'https://www.tangerangkota.go.id/dokumen/kaldik-2026-2027';
      }
      return null;
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
      resolveGroundedUrl: fakeResolver,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1, 'Candidate backed by resolved google redirect must be accepted');
    assert.strictEqual(results[0].sourceLevel, 'REGENCY');
    assert.strictEqual(results[0].sourceUrl, 'https://www.tangerangkota.go.id/dokumen/kaldik-2026-2027');
  });

  // =========================================================================
  // TEST N: Negative Regression - Redirect resolves to non-government site
  // =========================================================================
  await runTest('N. Negative regression: Redirect resolving to non-government site is rejected', async () => {
    const fakeGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Pemerintah Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/123',
                    title: 'Portal',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const fakeResolver = async (): Promise<string | null> => {
      return 'https://example.com/kaldik'; // Non-government site
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
      resolveGroundedUrl: fakeResolver,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 0, 'Candidate with non-government landing redirect must be rejected');
  });

  // =========================================================================
  // TEST O: Negative Regression - Redirect cannot resolve
  // =========================================================================
  await runTest('O. Negative regression: Redirect failing to resolve is rejected', async () => {
    const fakeGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Pemerintah Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/failed',
                    title: 'Broken Redirect',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const fakeResolver = async (): Promise<string | null> => {
      return null; // Failed resolution
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
      resolveGroundedUrl: fakeResolver,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 0, 'Unresolvable grounding redirect must be rejected');
  });

  // =========================================================================
  // TEST P: Negative Regression - Redirect resolves to social/file-hosting URL
  // =========================================================================
  await runTest('P. Negative regression: Redirect resolving to social media or file hosting is rejected', async () => {
    const fakeGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Pemerintah Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/social',
                    title: 'Social Portal',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const fakeResolver = async (): Promise<string | null> => {
      return 'https://facebook.com/disdik.tangerangkota';
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
      resolveGroundedUrl: fakeResolver,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 0, 'Social media redirect landing must be rejected');
  });

  // =========================================================================
  // TEST Q: Negative Regression - Candidate hostname differs from resolved official hostname
  // =========================================================================
  await runTest('Q. Negative regression: Mismatched candidate vs resolved official hostname is rejected', async () => {
    const fakeGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Jawa Tengah',
            regency: 'Kota Surakarta',
            academicYear: '2026/2027',
            authority: 'Pemerintah Kota Surakarta',
            documentTitle: 'Kaldik Kota Surakarta',
            sourceUrl: 'https://www.surakarta.go.id/dokumen/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/surakarta',
                    title: 'Portal',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const fakeResolver = async (): Promise<string | null> => {
      // Grounding redirect resolves to a different city's official domain
      return 'https://www.tangerangkota.go.id/dokumen/kaldik';
    };

    const provider = new GroundedCalendarSearchProvider({
      generateGroundedContent: fakeGenerate,
      resolveGroundedUrl: fakeResolver,
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Jawa Tengah',
      regency: 'Kota Surakarta',
    });

    assert.strictEqual(results.length, 0, 'Mismatched hostname candidate must be rejected');
  });

  // =========================================================================
  // B.4.1D DIAGNOSTIC TESTS
  // =========================================================================

  // TEST R: Case A — No API key
  await runTest('R. Diagnostic Case A: No API key returns NO_API_KEY and aiConfigured = false', async () => {
    // Save original env
    const originalKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const provider = new GroundedCalendarSearchProvider({ apiKey: '' });
      const res = await provider.searchWithDiagnostics({
        academicYear: '2026/2027',
        semester: 1,
        province: 'Banten',
        regency: 'Kota Tangerang',
      });

      assert.strictEqual(res.diagnostic.aiConfigured, false);
      assert.strictEqual(res.diagnostic.reason, 'NO_API_KEY');
      assert.strictEqual(res.candidates.length, 0);
    } finally {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  // TEST S: Case B — Every model errors (MODEL_FAILURE)
  await runTest('S. Diagnostic Case B: Model error across attempts returns MODEL_FAILURE', async () => {
    const errorGenerate = async (): Promise<GroundedSearchResponse> => {
      throw new Error('503 Service Unavailable');
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: errorGenerate,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.aiConfigured, true);
    assert.strictEqual(res.diagnostic.reason, 'MODEL_FAILURE');
    assert.ok(res.diagnostic.stages.length > 0);
    assert.strictEqual(res.diagnostic.stages[0].modelAttempts[0].status, 'ERROR');
    assert.strictEqual(res.diagnostic.stages[0].modelAttempts[0].errorCategory, 'HTTP_503');
  });

  // TEST T: Case C — Model returns text but no grounding
  await runTest('T. Diagnostic Case C: Response with text but no grounding returns NO_GROUNDING', async () => {
    const textNoGroundingGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Pemkot Tangerang',
            documentTitle: 'Kaldik',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [], // Empty grounding
            },
          },
        ],
      };
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: textNoGroundingGenerate,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'NO_GROUNDING');
  });

  // TEST U: Case D — Grounding exists but redirect resolver returns null
  await runTest('U. Diagnostic Case D: Grounding present but redirect unresolvable returns GROUNDING_RESOLUTION_FAILED', async () => {
    const generate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Pemkot Tangerang',
            documentTitle: 'Kaldik',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/broken',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const nullResolver = async (): Promise<string | null> => null;

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: generate,
      resolveGroundedUrl: nullResolver,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'GROUNDING_RESOLUTION_FAILED');
  });

  // TEST V: Case E — Official landing exists but candidate is rejected (e.g. wrong year/mismatched host)
  await runTest('V. Diagnostic Case E: Official landing resolved but candidate rejected returns CANDIDATE_REJECTED', async () => {
    const generate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2025/2026', // Old year -> candidate rejected
            authority: 'Pemkot Tangerang',
            documentTitle: 'Kaldik 2025',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik-2025',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/ok',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const validResolver = async (): Promise<string | null> => 'https://www.tangerangkota.go.id/kaldik-2025';

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: generate,
      resolveGroundedUrl: validResolver,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'CANDIDATE_REJECTED');
  });

  // TEST W: Case F — Successful search returns empty legitimate result
  await runTest('W. Diagnostic Case F: Successful search with empty [] candidate result returns NO_OFFICIAL_SOURCE', async () => {
    const emptyGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: '[]',
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://www.tangerangkota.go.id/portal',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: emptyGenerate,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'NO_OFFICIAL_SOURCE');
  });

  // TEST X: Case G — Tangerang candidate accepted
  await runTest('X. Diagnostic Case G: Accepted Tangerang candidate returns SUCCESS', async () => {
    const successGenerate = async (): Promise<GroundedSearchResponse> => {
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang 2026/2027',
            sourceUrl: 'https://www.tangerangkota.go.id/dokumen/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [
                {
                  web: {
                    uri: 'https://vertexaisearch.cloud.google.com/redirect/tang',
                  },
                },
              ],
            },
          },
        ],
      };
    };

    const resolver = async (): Promise<string | null> => 'https://www.tangerangkota.go.id/dokumen/kaldik';

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: successGenerate,
      resolveGroundedUrl: resolver,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      semester: 1,
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].sourceLevel, 'REGENCY');
  });

  console.log(`\n========================================`);
  console.log(`ALL BACKEND CALENDAR SEARCH PROVIDER TESTS PASSED (${passedTests}/${totalTests})`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('Fatal error in testCalendarBackendSearchProvider:', err);
  process.exit(1);
});
