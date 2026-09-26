import { runPreviewRouteProbe, formatPreviewRouteProbeReport } from '../src/services/previewRouteProbe';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passed++;
  } else {
    console.error(`[FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('=== Running Comprehensive Preview Route Probe Regression Tests ===\n');

  const baseContextWithQuery = {
    href: 'https://preview.example.com/project/session/?user=admin#section1',
    origin: 'https://preview.example.com',
    pathname: '/project/session/',
    baseURI: 'https://preview.example.com/project/session/?user=admin#section1'
  };

  // Test Suite 1: Full Candidate Set, Resolutions, Structurally Accurate Requests/Payloads & Format Checks
  {
    const mockResponses: Record<string, Record<string, { status: number; contentType: string; body: string; redirected?: boolean }>> = {
      'https://preview.example.com/api/health': {
        'GET': {
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: '{"status":"ok","timestamp":"2026-09-26T00:00:00.000Z"}'
        }
      },
      'https://preview.example.com/project/session/api/health': {
        'GET': {
          status: 200,
          contentType: 'application/json',
          body: '{"status":"ok","relative":true}'
        }
      },
      'https://preview.example.com/api/e4-1a-4-route-does-not-exist': {
        'POST': {
          status: 404,
          contentType: 'application/json',
          body: '{"error":"Unknown API route"}'
        }
      },
      'https://preview.example.com/api/ai/analyze-cp': {
        'POST': {
          status: 400,
          contentType: 'application/json',
          body: '{"error":"Data CP tidak boleh kosong"}'
        }
      },
      'https://preview.example.com/api/ai/generate-tp': {
        'POST': {
          status: 503,
          contentType: 'application/json',
          body: '{"error":"Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang)."}'
        }
      }
    };

    let postBodiesCaptured: Record<string, string[]> = {};

    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = url.toString();
      const method = init?.method || 'GET';
      const cleanUrlStr = urlStr.split('?')[0].split('#')[0];

      if (method === 'POST' && init?.body) {
        if (!postBodiesCaptured[cleanUrlStr]) {
          postBodiesCaptured[cleanUrlStr] = [];
        }
        postBodiesCaptured[cleanUrlStr].push(init.body.toString());
      }

      let status = 200;
      let body = '{"status":"ok"}';
      let contentType = 'application/json';

      if (cleanUrlStr.includes('/api/ai/generate-tp') && method === 'POST') {
        const payload = JSON.parse(init?.body as string);
        if (payload.cpGeneral === '') {
          status = 400;
          body = '{"error":"Capaian Pembelajaran (CP) harus diisi terlebih dahulu"}';
        } else {
          status = 503;
          body = '{"error":"Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang)."}';
        }
      } else {
        const resData = mockResponses[cleanUrlStr]?.[method] || {
          status: 404,
          contentType: 'text/plain',
          body: 'Not found'
        };
        status = resData.status;
        body = resData.body;
        contentType = resData.contentType;
      }

      return {
        status,
        url: urlStr,
        redirected: false,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? contentType : null
        },
        text: async () => body
      } as any;
    };

    const result = await runPreviewRouteProbe({
      context: baseContextWithQuery,
      fetchFn: mockFetch
    });

    // A. Probe count and structure
    assert(result.results.length === 7, 'Exactly 7 probes run');
    assert(result.results[0].method === 'GET', 'Probe 1 is GET');
    assert(result.results[1].method === 'GET', 'Probe 2 is GET');
    assert(result.results[2].method === 'GET', 'Probe 3 is GET');
    assert(result.results[3].method === 'POST', 'Probe 4 is POST');
    assert(result.results[4].method === 'POST', 'Probe 5 is POST');
    assert(result.results[5].method === 'POST', 'Probe 6 is POST');
    assert(result.results[6].method === 'POST', 'Probe 7 is POST');

    // B. GET route resolution
    const p1 = result.results[0];
    assert(p1.requestPath === '/api/health', 'Probe 1 request path is /api/health');
    assert(p1.resolvedUrl === 'https://preview.example.com/api/health', 'Probe 1 resolves to absolute domain root: ' + p1.resolvedUrl);
    assert(p1.classification === 'JSON', 'Probe 1 GET classified as JSON');

    const p2 = result.results[1];
    assert(p2.requestPath === 'api/health', 'Probe 2 request path is api/health');
    assert(p2.resolvedUrl === 'https://preview.example.com/project/session/api/health', 'Probe 2 resolves relative under current path: ' + p2.resolvedUrl);
    assert(p2.classification === 'JSON', 'Probe 2 GET classified as JSON');

    const p3 = result.results[2];
    assert(p3.requestPath === './api/health', 'Probe 3 request path is ./api/health');
    assert(p3.resolvedUrl === 'https://preview.example.com/project/session/api/health', 'Probe 3 resolves ./ correctly: ' + p3.resolvedUrl);
    assert(p3.classification === 'JSON', 'Probe 3 GET classified as JSON');

    // C. Generic POST fallback
    const p4 = result.results[3];
    assert(p4.requestPath === '/api/e4-1a-4-route-does-not-exist', 'Probe 4 request path is correct');
    assert(p4.resolvedUrl === 'https://preview.example.com/api/e4-1a-4-route-does-not-exist', 'Probe 4 resolved path is correct');
    assert(p4.status === 404, 'Probe 4 returns HTTP 404');
    assert(p4.classification === 'JSON', 'Probe 4 classified as JSON');
    const p4Bodies = postBodiesCaptured['https://preview.example.com/api/e4-1a-4-route-does-not-exist'] || [];
    assert(p4Bodies.length === 1 && p4Bodies[0] === '{}', 'Probe 4 sent body exactly `{}`');

    // D. Analyze CP invalid branch
    const p5 = result.results[4];
    assert(p5.requestPath === '/api/ai/analyze-cp', 'Probe 5 request path is correct');
    assert(p5.status === 400, 'Probe 5 returns HTTP 400');
    assert(p5.classification === 'JSON', 'Probe 5 classified as JSON');
    const p5Bodies = postBodiesCaptured['https://preview.example.com/api/ai/analyze-cp'] || [];
    assert(p5Bodies.length === 1 && p5Bodies[0] === '{}', 'Probe 5 sent body exactly `{}`');

    // E. Generate TP invalid branch
    const p6 = result.results[5];
    assert(p6.requestPath === '/api/ai/generate-tp', 'Probe 6 request path is correct');
    assert(p6.status === 400, 'Probe 6 returns HTTP 400 (CP empty)');
    assert(p6.classification === 'JSON', 'Probe 6 classified as JSON');
    const tpPOSTs = postBodiesCaptured['https://preview.example.com/api/ai/generate-tp'] || [];
    assert(tpPOSTs.length === 2, 'Two POST requests were dispatched to /api/ai/generate-tp');
    
    const p6BodyObj = JSON.parse(tpPOSTs[0]);
    assert(p6BodyObj.cpGeneral === '' && p6BodyObj.cpElements.length === 0 && p6BodyObj.cpAnalysisItems.length === 0, 'Probe 6 body matches invalid spec exactly');

    // F. Generate TP minimal valid branch
    const p7 = result.results[6];
    assert(p7.status === 503, 'Probe 7 returns HTTP 503 (unconfigured Gemini)');
    assert(p7.classification === 'JSON', 'Probe 7 classified as JSON');
    const p7BodyObj = JSON.parse(tpPOSTs[1]);
    assert(p7BodyObj.cpGeneral === 'Diagnostic probe CP', 'Probe 7 cpGeneral matches valid diagnostic value');
    assert(p7BodyObj.subject === 'Diagnostic', 'Probe 7 specifies synthetic diagnostic subject');
    assert(p7BodyObj.grade === 'Kelas 1', 'Probe 7 specifies Kelas 1');
    assert(p7BodyObj.phase === 'Fase A', 'Probe 7 specifies Fase A');
    assert(p7BodyObj.curriculum === 'KURIKULUM_MERDEKA', 'Probe 7 specifies KURIKULUM_MERDEKA');
    assert(p7BodyObj.count === 1, 'Probe 7 specifies count: 1');

    // G. URL privacy regression & cleanUrl tests
    assert(result.context.href === 'https://preview.example.com/project/session/', 'Strips query string and fragments from context location.href');
    assert(result.context.baseURI === 'https://preview.example.com/project/session/', 'Strips query string and fragments from context document.baseURI');
    assert(p1.resolvedUrl === 'https://preview.example.com/api/health', 'Strips query and fragments from probe resolvedUrl');
    assert(p1.finalResponseUrl === 'https://preview.example.com/api/health', 'Strips query and fragments from probe finalResponseUrl');

    // H. Formatter regression
    const reportText = formatPreviewRouteProbeReport(result);
    assert(reportText.includes('=== GAS Preview Route Probe ==='), 'Formatted report contains valid heading banner');
    assert(reportText.includes('location.href: https://preview.example.com/project/session/'), 'Report renders clean href context');
    assert(reportText.includes('location.origin: https://preview.example.com'), 'Report renders clean origin context');
    assert(reportText.includes('location.pathname: /project/session/'), 'Report renders clean pathname context');
    assert(reportText.includes('document.baseURI: https://preview.example.com/project/session/'), 'Report renders clean baseURI context');
    
    assert(reportText.includes('method: GET'), 'Report renders `method: GET` values');
    assert(reportText.includes('method: POST'), 'Report renders `method: POST` values');
    assert(reportText.includes('requestPath: /api/health'), 'Report renders requestPath');
    assert(reportText.includes('resolvedUrl: https://preview.example.com/api/health'), 'Report renders resolvedUrl');
    assert(reportText.includes('finalResponseUrl: https://preview.example.com/api/health'), 'Report renders finalResponseUrl');
    assert(reportText.includes('status: 200'), 'Report renders status codes');
    assert(reportText.includes('contentType: application/json'), 'Report renders contentTypes');
    assert(reportText.includes('classification: JSON'), 'Report renders JSON classification');
    assert(reportText.includes('redirected: false'), 'Report renders redirected field');
    
    // I. Snippet bounds check for JSON responses
    assert(p1.responseSnippet !== undefined && p1.responseSnippet.length <= 200, 'JSON response snippet <= 200 chars');
  }

  // Test Suite 2: Alternate Mock Scenario (HTML 200 POST Redirect classification + Snippet checks)
  {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const largeHtml = '<!doctype html><html><body>InterceptionFallback' + 'X'.repeat(500) + '</body></html>';
      return {
        status: 200,
        url: url.toString() + '?redirected=true#hash',
        redirected: true,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'text/html; charset=utf-8' : null
        },
        text: async () => largeHtml
      } as any;
    };

    const result = await runPreviewRouteProbe({
      context: baseContextWithQuery,
      fetchFn: mockFetch
    });

    // Check Probe 7
    const p7 = result.results[6];
    assert(p7.classification === 'HTML', 'Probe 7 classified as HTML under proxy redirect mock');
    assert(p7.status === 200, 'Probe 7 has status 200');
    assert(p7.redirected === true, 'Probe 7 redirected field is recorded as true');
    assert(p7.responseSnippet !== undefined && p7.responseSnippet.length <= 200, 'HTML response snippet length <= 200 chars');
    assert(p7.responseSnippet.toLowerCase().startsWith('<!doctype'), 'HTML response snippet matches beginning sequence');
    assert(p7.finalResponseUrl === 'https://preview.example.com/api/ai/generate-tp', 'Stripped query and fragment from HTML finalResponseUrl');
  }

  // Test Suite 3: Network Isolation & Error Resilience
  {
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = url.toString();
      // Throw network error specifically for analyze-cp (Probe 5)
      if (urlStr.includes('/api/ai/analyze-cp')) {
        throw new Error('Connection refused');
      }
      return {
        status: 200,
        url: urlStr,
        headers: {
          get: (name: string) => name.toLowerCase() === 'content-type' ? 'application/json' : null
        },
        text: async () => '{"status":"ok"}'
      } as any;
    };

    const result = await runPreviewRouteProbe({
      context: baseContextWithQuery,
      fetchFn: mockFetch
    });

    // J. Network isolation checks
    assert(result.results.length === 7, 'All 7 probes ran successfully despite network failure in one probe');
    
    const p5Error = result.results[4];
    assert(p5Error.classification === 'NETWORK_ERROR', 'Probe 5 successfully classified as NETWORK_ERROR');
    assert(p5Error.error === 'Connection refused', 'Probe 5 successfully captured connection refused message');

    const p6JSON = result.results[5];
    assert(p6JSON.classification === 'JSON', 'Unrelated Probe 6 successfully finished and classified as JSON');
    assert(p6JSON.status === 200, 'Unrelated Probe 6 status is 200');

    const p7JSON = result.results[6];
    assert(p7JSON.classification === 'JSON', 'Unrelated Probe 7 successfully finished and classified as JSON');
  }

  console.log(`\n=== Preview Route Probe Regression Summary: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
