import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { jsPDF } from 'jspdf';
import {
  GroundedCalendarSearchProvider,
  GroundedSearchResponse,
  isOfficialCalendarSourceUrl,
  isCandidateBackedByGrounding,
  extractGroundedWebSources,
  parseCalendarSearchResponse,
  buildCalendarSearchPrompt,
  TrustedCalendarSearchProvider,
  verifySourceContentRelevance,
  generateDeterministicOfficialUrls,
  generateOfficialSeedRoots,
  extractOfficialLinksFromHtml,
  isDateSupportedBySource,
  extractTextFromPdfBuffer,
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
      { academicYear: '2026/2027', province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
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
      { academicYear: '2026/2027', province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
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
      { academicYear: '2026/2027', province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
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
      { academicYear: '2026/2027', province: 'Jawa Barat', regency: 'Kabupaten Bandung' },
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
      { academicYear: '2026/2027', province: 'Jawa Barat' },
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
    const res1 = parseCalendarSearchResponse(malformed1, 'NATIONAL', { academicYear: '2026/2027' }, []);
    assert.deepStrictEqual(res1, []);

    const malformed2 = '```json\n{ "object": "not array" }\n```';
    const res2 = parseCalendarSearchResponse(malformed2, 'NATIONAL', { academicYear: '2026/2027' }, []);
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
      { academicYear: '2026/2027' },
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
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].sourceLevel, 'REGENCY');
  });

  // =========================================================================
  // PROVIDER RESILIENCE REGRESSION TESTS
  // =========================================================================

  // TEST Y: Provider Resilience A — Failure at REGENCY stops geography fallback immediately
  await runTest('Y. Provider Resilience A: Real Failure Shape - REGENCY failure stops geography fallback immediately', async () => {
    let callCount = 0;
    const errorGenerate = async (): Promise<GroundedSearchResponse> => {
      callCount++;
      throw new Error('429 Too Many Requests');
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: errorGenerate,
      sleep: async () => {},
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'MODEL_FAILURE');
    assert.strictEqual(res.diagnostic.stages.length, 1, 'Must stop at REGENCY stage and not query PROVINCE or NATIONAL');
    assert.strictEqual(res.diagnostic.stages[0].level, 'REGENCY');
  });

  // TEST Z: Provider Resilience B — Transient 429 retries same model and succeeds
  await runTest('Z. Provider Resilience B: Transient 429 retries same model and succeeds without model fallback', async () => {
    let generateAttempts = 0;
    const sleptMs: number[] = [];

    const retryGenerate = async (): Promise<GroundedSearchResponse> => {
      generateAttempts++;
      if (generateAttempts < 3) {
        throw new Error('429 Resource Exhausted');
      }
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            sourceUrl: 'https://www.tangerangkota.go.id/kaldik',
          },
        ]),
        candidates: [
          {
            groundingMetadata: {
              groundingChunks: [{ web: { uri: 'https://www.tangerangkota.go.id/kaldik' } }],
            },
          },
        ],
      };
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: retryGenerate,
      resolveGroundedUrl: async () => 'https://www.tangerangkota.go.id/kaldik',
      sleep: async (ms) => { sleptMs.push(ms); },
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(generateAttempts, 3, 'Primary model must be retried 3 times');
    assert.deepStrictEqual(sleptMs, [800, 1600], 'Exponential backoff delays must be passed to sleep');
  });

  // TEST AA: Provider Resilience C — MODEL_NOT_FOUND skips retries and succeeds on fallback model
  await runTest('AA. Provider Resilience C: MODEL_NOT_FOUND skips retries and succeeds on fallback model', async () => {
    const modelNotFoundGenerate = async (prompt: string, model: string): Promise<GroundedSearchResponse> => {
      if (model === 'gemini-3.5-flash-lite') {
        throw new Error('404 Model Not Found');
      }
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
              groundingChunks: [{ web: { uri: 'https://www.tangerangkota.go.id/kaldik' } }],
            },
          },
        ],
      };
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: modelNotFoundGenerate,
      resolveGroundedUrl: async () => 'https://www.tangerangkota.go.id/kaldik',
      sleep: async () => {},
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
  });

  // TEST AB: Provider Resilience D — HTTP 403 halts search immediately
  await runTest('AB. Provider Resilience D: HTTP 403 permission error halts search immediately without retries or geography fallback', async () => {
    let attempts = 0;
    const permDeniedGenerate = async (): Promise<GroundedSearchResponse> => {
      attempts++;
      throw new Error('403 PERMISSION_DENIED: API key not valid');
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: permDeniedGenerate,
      sleep: async () => {},
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'MODEL_FAILURE');
    assert.strictEqual(attempts, 1, '403 error must not be retried repeatedly');
    assert.strictEqual(res.diagnostic.stages.length, 1, 'Must stop geography search immediately');
  });

  // TEST AC: Provider Resilience E — Valid empty [] at REGENCY falls back to PROVINCE
  await runTest('AC. Provider Resilience E: Valid empty [] at REGENCY falls back to PROVINCE', async () => {
    const queriedLevels: string[] = [];
    const validEmptyGenerate = async (prompt: string): Promise<GroundedSearchResponse> => {
      if (prompt.includes('Kabupaten/Kota')) queriedLevels.push('REGENCY');
      else if (prompt.includes('tingkat Provinsi')) queriedLevels.push('PROVINCE');
      else queriedLevels.push('NATIONAL');

      return { text: '[]' };
    };

    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: validEmptyGenerate,
      sleep: async () => {},
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.deepStrictEqual(queriedLevels, ['REGENCY', 'PROVINCE', 'NATIONAL']);
    assert.strictEqual(res.diagnostic.stages.length, 3);
  });

  // TEST AD: Provider Resilience F — All valid empty [] results yield NO_OFFICIAL_SOURCE
  await runTest('AD. Provider Resilience F: All valid empty [] results yield NO_OFFICIAL_SOURCE (not NO_GROUNDING or MODEL_FAILURE)', async () => {
    const provider = new GroundedCalendarSearchProvider({
      apiKey: 'test-key',
      generateGroundedContent: async () => ({ text: '[]' }),
      sleep: async () => {},
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'NO_OFFICIAL_SOURCE');
    assert.strictEqual(res.diagnostic.stages.length, 3);
  });

  // =========================================================================
  // TRUSTED CALENDAR SEARCH PROVIDER AUDIT (FREE-TIER PLAIN GEMINI)
  // =========================================================================

  // TEST AE: Free-tier contract — Provider codebase contains NO googleSearch tools
  await runTest('AE. Free-tier contract: TrustedCalendarSearchProvider contains NO googleSearch tool references', () => {
    const filePath = path.resolve(process.cwd(), 'server/trustedCalendarProvider.ts');
    const source = fs.readFileSync(filePath, 'utf-8');
    assert.ok(
      !source.includes('googleSearch'),
      'trustedCalendarProvider.ts must not contain googleSearch tool reference'
    );
    assert.ok(
      !source.includes('tools:'),
      'trustedCalendarProvider.ts must not configure any tools'
    );
  });

  // TEST AF: Plain Gemini discovery & extraction without tools
  await runTest('AF. Plain Gemini: Plain generator invoked without tools for discovery & extraction', async () => {
    let plainCalls = 0;
    const fakePlainGenerate = async (prompt: string, model: string) => {
      plainCalls++;
      if (prompt.includes('Sebutkan 3-6 URL resmi')) {
        return { text: JSON.stringify(['https://disdik.tangerangkota.go.id/kaldik-2026-2027']) };
      }
      return {
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Pedoman Kaldik Kota Tangerang 2026/2027',
            semester1StartDate: '2026-07-13',
            semester1EndDate: '2026-12-18',
            semester2StartDate: '2027-01-04',
            semester2EndDate: '2027-06-25',
          },
        ]),
      };
    };

    const fakeFetch = async (url: string) => {
      return {
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang Provinsi Banten resmi berlaku. Semester 1 dimulai 13 Juli 2026 sampai 18 Desember 2026. Semester 2 dimulai 4 Januari 2027 sampai 25 Juni 2027.',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      };
    };

    const provider = new TrustedCalendarSearchProvider({
      generatePlainContent: fakePlainGenerate,
      fetchSourceContent: fakeFetch,
    });

    const candidates = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(candidates.length, 1);
    assert.strictEqual(candidates[0].sourceLevel, 'REGENCY');
    assert.strictEqual(candidates[0].semester1StartDate, '2026-07-13');
    assert.ok(plainCalls >= 1, 'Plain Gemini generator must be used');
  });

  // TEST AG: Regency short-circuit
  await runTest('AG. Regency short-circuit: REGENCY valid -> PROVINCE 0, NATIONAL 0', async () => {
    let queriedStages: string[] = [];

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async (req, level) => {
        queriedStages.push(level);
        if (level === 'REGENCY') {
          return ['https://disdik.bandungkab.go.id/kaldik-2026'];
        }
        return [];
      },
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Pedoman Kalender Pendidikan Tahun Ajaran 2026/2027 Kabupaten Bandung Jawa Barat',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Jawa Barat',
            regency: 'Kabupaten Bandung',
            academicYear: '2026/2027',
            authority: 'Disdik Kab Bandung',
            documentTitle: 'Kaldik 2026/2027',
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Jawa Barat',
      regency: 'Kabupaten Bandung',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceLevel, 'REGENCY');
    assert.deepStrictEqual(queriedStages, ['REGENCY'], 'Must short-circuit immediately at REGENCY');
  });

  // TEST AH: Province fallback
  await runTest('AH. Province fallback: REGENCY empty -> PROVINCE valid -> NATIONAL 0', async () => {
    let queriedStages: string[] = [];

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async (req, level) => {
        queriedStages.push(level);
        if (level === 'PROVINCE') {
          return ['https://disdik.jabarprov.go.id/kaldik-2026'];
        }
        return [];
      },
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Keputusan Kadisdik Kalender Pendidikan 2026/2027 Provinsi Jawa Barat',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Jawa Barat',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Jawa Barat',
            documentTitle: 'Kaldik Provinsi 2026/2027',
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Jawa Barat',
      regency: 'Kabupaten Bandung Barat',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceLevel, 'PROVINCE');
    assert.deepStrictEqual(queriedStages, ['REGENCY', 'PROVINCE'], 'Must fall back to PROVINCE and stop before NATIONAL');
  });

  // TEST AI: National fallback
  await runTest('AI. National fallback: REGENCY empty, PROVINCE empty -> NATIONAL valid', async () => {
    let queriedStages: string[] = [];

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async (req, level) => {
        queriedStages.push(level);
        if (level === 'NATIONAL') {
          return ['https://kemendikdasmen.go.id/pedoman-kaldik-2026'];
        }
        return [];
      },
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Pedoman Kalender Pendidikan Tahun Pelajaran 2026/2027 Kementerian Pendidikan Dasar dan Menengah RI',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            academicYear: '2026/2027',
            authority: 'Kemendikdasmen RI',
            documentTitle: 'Pedoman Kaldik Nasional 2026/2027',
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Papua Barat Daya',
      regency: 'Kabupaten Raja Ampat',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceLevel, 'NATIONAL');
    assert.deepStrictEqual(queriedStages, ['REGENCY', 'PROVINCE', 'NATIONAL']);
  });

  // TEST AJ: Reject fake AI URL (HTTP 404 / unreachable)
  await runTest('AJ. Reject fake AI URL: Unreachable / 404 candidate is discarded', async () => {
    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => ['https://disdik.tangerangkota.go.id/fake-url-not-found-404'],
      fetchSourceContent: async () => null, // Unreachable / 404
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.candidates.length, 0);
    assert.strictEqual(res.diagnostic.reason, 'CANDIDATE_REJECTED');
  });

  // TEST AK: Reject non-government URL
  await runTest('AK. Reject non-government URL: Domains outside *.go.id are strictly discarded', async () => {
    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [
        'https://example.com/kaldik-tangerang',
        'https://blogguru.blogspot.com/kaldik-2026',
      ],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan 2026/2027 Kota Tangerang',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.candidates.length, 0);
    assert.strictEqual(res.diagnostic.reason, 'NO_OFFICIAL_SOURCE');
  });

  // TEST AL: Reject valid .go.id but unrelated page
  await runTest('AL. Reject unrelated page: Valid .go.id without calendar keywords/year is discarded', async () => {
    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => ['https://tangerangkota.go.id/berita/pelantikan-pejabat-2026'],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Wali Kota Tangerang melantik sejumlah pejabat struktural di lingkungan pemerintah kota Tangerang.',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.candidates.length, 0);
    assert.strictEqual(res.diagnostic.reason, 'CANDIDATE_REJECTED');
  });

  // TEST AM: Verified source + incomplete dates
  await runTest('AM. Incomplete dates: Official source verified but dates missing -> PARTIAL candidate with empty dates', async () => {
    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => ['https://disdik.tangerangkota.go.id/pengumuman-kaldik-2026-2027'],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Pengumuman Resmi: Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang telah diterbitkan dan dapat diunduh di sekretariat dinas.',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Pengumuman Kalender Pendidikan Kota Tangerang',
            // All dates omitted/empty
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].verificationStatus, 'PARTIAL');
    assert.strictEqual(results[0].sourceUrl, 'https://disdik.tangerangkota.go.id/pengumuman-kaldik-2026-2027');
    assert.strictEqual(results[0].semester1StartDate, undefined);
    assert.strictEqual(results[0].semester1EndDate, undefined);
  });

  // TEST AN: No fabrication — Provider enforces verified sourceUrl and academicYear
  await runTest('AN. No fabrication: AI attempt to invent alternate sourceUrl or academicYear is ignored', async () => {
    const verifiedOfficialUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026-2027';
    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedOfficialUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang resmi.',
        finalUrl: url,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2099/3000', // Fabricated future year!
            authority: 'Dinas Pendidikan',
            documentTitle: 'Kaldik',
            sourceUrl: 'https://fake-url-invented-by-ai.com', // Fabricated URL!
            semester1StartDate: 'invalid-date-string', // Malformed date!
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].sourceUrl, verifiedOfficialUrl, 'Must use verified official URL, not AI hallucination');
    assert.strictEqual(results[0].academicYear, '2026/2027', 'Must preserve requested academicYear');
    assert.strictEqual(results[0].semester1StartDate, undefined, 'Invalid date format must be sanitized to undefined');
  });

  // TEST AO: Kota Tangerang contract simulation
  await runTest('AO. Kota Tangerang contract: Kota Tangerang, Banten, 2026/2027 resolves to REGENCY candidate after HTTP verification', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kalender-pendidikan-2026-2027';
    const provider = new TrustedCalendarSearchProvider({
      fetchSourceContent: async (url) => {
        if (url === verifiedUrl) {
          return {
            ok: true,
            status: 200,
            text: 'Keputusan Kepala Dinas Pendidikan Kota Tangerang tentang Pedoman Kalender Pendidikan Tahun Ajaran 2026/2027. Semester 1 dimulai 2026-07-13 sampai 2026-12-18.',
            finalUrl: verifiedUrl,
            contentType: 'text/html',
            isPdf: false,
          };
        }
        return null;
      },
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Pedoman Kalender Pendidikan Tahun Ajaran 2026/2027',
            documentNumber: '421/01-Disdik/2026',
            semester1StartDate: '2026-07-13',
            semester1EndDate: '2026-12-18',
          },
        ]),
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].sourceLevel, 'REGENCY');
    assert.strictEqual(res.candidates[0].regency, 'Kota Tangerang');
    assert.strictEqual(res.candidates[0].sourceUrl, verifiedUrl);
    assert.strictEqual(res.candidates[0].verificationStatus, 'PARTIAL');
  });

  // TEST AP: Empty chain across all stages returns NO_OFFICIAL_SOURCE
  await runTest('AP. Empty chain: All stages empty returns NO_OFFICIAL_SOURCE without fabricated data', async () => {
    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [],
      fetchSourceContent: async () => null,
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Kalimantan Utara',
      regency: 'Kabupaten Tana Tidung',
    });

    assert.strictEqual(res.candidates.length, 0);
    assert.strictEqual(res.diagnostic.reason, 'NO_OFFICIAL_SOURCE');
    assert.strictEqual(res.diagnostic.stages.length, 3);
  });

  // TEST AQ: Real link discovery — Seed HTML with relative official link is discovered and verified
  await runTest('AQ. Real link discovery: Relative URL in official seed HTML is resolved and accepted', async () => {
    const seedUrl = 'https://disdik.tangerangkota.go.id';
    const targetDocUrl = 'https://disdik.tangerangkota.go.id/dokumen/kalender-pendidikan-2026-2027';

    const provider = new TrustedCalendarSearchProvider({
      fetchSourceContent: async (url) => {
        if (url === seedUrl) {
          return {
            ok: true,
            status: 200,
            text: 'Dinas Pendidikan Kota Tangerang Beranda',
            rawHtml: '<html><body><h1>Portal Disdik</h1><a href="/dokumen/kalender-pendidikan-2026-2027">Pedoman Kalender Pendidikan 2026/2027</a></body></html>',
            finalUrl: seedUrl,
            contentType: 'text/html',
            isPdf: false,
          };
        }
        if (url === targetDocUrl) {
          return {
            ok: true,
            status: 200,
            text: 'Pedoman Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang Provinsi Banten resmi diterbitkan. Semester 1 dimulai 13 Juli 2026.',
            finalUrl: targetDocUrl,
            contentType: 'text/html',
            isPdf: false,
          };
        }
        return null;
      },
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Pedoman Kalender Pendidikan 2026/2027',
            semester1StartDate: '2026-07-13',
          },
        ]),
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].sourceUrl, targetDocUrl);
    assert.strictEqual(res.candidates[0].semester1StartDate, '2026-07-13');
  });

  // TEST AR: Reject irrelevant links — Homepage with general links produces no false calendar candidate
  await runTest('AR. Reject irrelevant links: Seed HTML with general non-calendar links produces no false candidate', async () => {
    const seedUrl = 'https://disdik.tangerangkota.go.id';

    const provider = new TrustedCalendarSearchProvider({
      generatePlainContent: async () => ({ text: '[]' }),
      fetchSourceContent: async (url) => {
        if (url === seedUrl) {
          return {
            ok: true,
            status: 200,
            text: 'Dinas Pendidikan Berita Profil Galeri Pengumuman Umum',
            rawHtml: '<html><body><a href="/berita">Berita Terkini</a><a href="/profil">Profil Pejabat</a><a href="/galeri">Galeri Foto</a><a href="/pengumuman">Pengumuman Umum</a></body></html>',
            finalUrl: seedUrl,
            contentType: 'text/html',
            isPdf: false,
          };
        }
        return null;
      },
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.candidates.length, 0);
    assert.strictEqual(res.diagnostic.reason, 'NO_OFFICIAL_SOURCE');
  });

  // TEST AS: Date hallucination rejected — AI date not in sourceText is discarded
  await runTest('AS. Date hallucination rejected: AI date absent from sourceText is discarded (undefined)', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang resmi diterbitkan.',
        finalUrl: verifiedUrl,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            semester1StartDate: '2026-07-13', // Hallucinated date not in sourceText!
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].semester1StartDate, undefined, 'Hallucinated date must become undefined');
  });

  // TEST AT: Indonesian date evidence accepted — Indonesian textual date in sourceText is accepted
  await runTest('AT. Indonesian date evidence accepted: Textual date "13 Juli 2026" maps to 2026-07-13', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang. Semester ganjil dimulai tanggal 13 Juli 2026.',
        finalUrl: verifiedUrl,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            semester1StartDate: '2026-07-13',
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].semester1StartDate, '2026-07-13');
  });

  // TEST AU: Slash date accepted — Numeric slash date in sourceText is accepted
  await runTest('AU. Slash date accepted: Numeric date "13/07/2026" in sourceText maps to 2026-07-13', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang. Mulai semester: 13/07/2026.',
        finalUrl: verifiedUrl,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            semester1StartDate: '2026-07-13',
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].semester1StartDate, '2026-07-13');
  });

  // TEST AV: Wrong date rejected — Date in sourceText is 13 Juli 2026, AI outputs 2026-07-14 -> undefined
  await runTest('AV. Wrong date rejected: Source has 13 Juli 2026, AI outputs 2026-07-14 -> rejected (undefined)', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang. Mulai pembelajaran: 13 Juli 2026.',
        finalUrl: verifiedUrl,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang',
            semester1StartDate: '2026-07-14', // Incorrect day!
          },
        ]),
      }),
    });

    const results = await provider.search({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].semester1StartDate, undefined, 'Mismatched date must be discarded');
  });

  // TEST AW: PDF partial — Verified .go.id PDF with no extracted text yields PARTIAL with empty dates
  await runTest('AW. PDF partial: Verified .go.id PDF without extracted text returns PARTIAL with empty semester dates', async () => {
    const pdfUrl = 'https://disdik.tangerangkota.go.id/dokumen/kaldik-2026-2027.pdf';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [pdfUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: '',
        rawHtml: '',
        finalUrl: pdfUrl,
        contentType: 'application/pdf',
        isPdf: true,
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].verificationStatus, 'PARTIAL');
    assert.strictEqual(res.candidates[0].sourceUrl, pdfUrl);
    assert.strictEqual(res.candidates[0].semester1StartDate, undefined);
    assert.strictEqual(res.candidates[0].semester1EndDate, undefined);
    assert.strictEqual(res.candidates[0].semester2StartDate, undefined);
    assert.strictEqual(res.candidates[0].semester2EndDate, undefined);
  });

  // TEST AX: PDF text extraction — Fixture PDF text extracts semester boundaries
  await runTest('AX. PDF text extraction: Official PDF with extracted text successfully extracts semester boundaries', async () => {
    const pdfUrl = 'https://disdik.tangerangkota.go.id/dokumen/kaldik-2026-2027.pdf';

    // Generate in-memory PDF fixture with jsPDF
    const doc = new jsPDF();
    doc.text('Kalender Pendidikan Tahun Pelajaran 2026/2027 Kota Tangerang.', 10, 10);
    doc.text('Semester Ganjil dimulai 13 Juli 2026 dan berakhir 18 Desember 2026.', 10, 20);
    const pdfArrayBuffer = doc.output('arraybuffer');

    // Extract text deterministically using extractTextFromPdfBuffer
    const extractedText = await extractTextFromPdfBuffer(pdfArrayBuffer);
    assert.ok(extractedText.includes('13 Juli 2026'));

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [pdfUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: extractedText,
        rawHtml: '',
        finalUrl: pdfUrl,
        contentType: 'application/pdf',
        isPdf: true,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang 2026/2027',
            semester1StartDate: '2026-07-13',
            semester1EndDate: '2026-12-18',
          },
        ]),
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.diagnostic.reason, 'SUCCESS');
    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].semester1StartDate, '2026-07-13');
    assert.strictEqual(res.candidates[0].semester1EndDate, '2026-12-18');
  });

  // TEST BA: Event extraction — Verified event in sourceText is extracted into candidate.events
  await runTest('BA. Event extraction: Event explicitly present in sourceText is extracted and validated', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026-2027';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Pelajaran 2026/2027 Kota Tangerang. Libur Semester Ganjil tanggal 21 Desember 2026 sampai 3 Januari 2027.',
        rawHtml: '',
        finalUrl: verifiedUrl,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang 2026/2027',
            events: [
              {
                name: 'Libur Semester Ganjil',
                startDate: '2026-12-21',
                endDate: '2027-01-03',
                category: 'SEMESTER_BREAK',
              },
            ],
          },
        ]),
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.candidates.length, 1);
    assert.ok(Array.isArray(res.candidates[0].events));
    assert.strictEqual(res.candidates[0].events?.length, 1);
    assert.strictEqual(res.candidates[0].events?.[0].name, 'Libur Semester Ganjil');
    assert.strictEqual(res.candidates[0].events?.[0].startDate, '2026-12-21');
    assert.strictEqual(res.candidates[0].events?.[0].endDate, '2027-01-03');
    assert.strictEqual(res.candidates[0].events?.[0].category, 'SEMESTER_BREAK');
  });

  // TEST BB: Hallucinated event rejection — Event with dates not in sourceText is discarded
  await runTest('BB. Hallucinated event rejection: AI event with fabricated dates is discarded', async () => {
    const verifiedUrl = 'https://disdik.tangerangkota.go.id/kaldik-2026-2027';

    const provider = new TrustedCalendarSearchProvider({
      discoverCandidateUrls: async () => [verifiedUrl],
      fetchSourceContent: async (url) => ({
        ok: true,
        status: 200,
        text: 'Kalender Pendidikan Tahun Ajaran 2026/2027 Kota Tangerang.',
        rawHtml: '',
        finalUrl: verifiedUrl,
        contentType: 'text/html',
        isPdf: false,
      }),
      generatePlainContent: async () => ({
        text: JSON.stringify([
          {
            province: 'Banten',
            regency: 'Kota Tangerang',
            academicYear: '2026/2027',
            authority: 'Dinas Pendidikan Kota Tangerang',
            documentTitle: 'Kaldik Kota Tangerang 2026/2027',
            events: [
              {
                name: 'Libur Semester',
                startDate: '2026-12-21',
                endDate: '2027-01-03',
                category: 'SEMESTER_BREAK',
              },
            ],
          },
        ]),
      }),
    });

    const res = await provider.searchWithDiagnostics({
      academicYear: '2026/2027',
      province: 'Banten',
      regency: 'Kota Tangerang',
    });

    assert.strictEqual(res.candidates.length, 1);
    assert.strictEqual(res.candidates[0].events, undefined, 'Hallucinated events must be discarded');
  });

  console.log(`\n========================================`);
  console.log(`ALL BACKEND CALENDAR SEARCH PROVIDER TESTS PASSED (${passedTests}/${totalTests})`);
  console.log(`========================================\n`);
}

main().catch((err) => {
  console.error('Fatal error in testCalendarBackendSearchProvider:', err);
  process.exit(1);
});
