export interface ProbeResult {
  method: 'GET' | 'POST';
  requestPath: string;
  resolvedUrl: string;
  finalResponseUrl?: string;
  status?: number;
  contentType?: string;
  classification: 'JSON' | 'HTML' | 'OTHER' | 'NETWORK_ERROR';
  responseSnippet?: string;
  redirected?: boolean;
  error?: string;
}

export interface ProbeContext {
  href: string;
  origin: string;
  pathname: string;
  baseURI: string;
}

function cleanUrl(urlStr?: string): string {
  if (!urlStr) return '';
  try {
    const parsed = new URL(urlStr);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch (e) {
    const idx = urlStr.indexOf('?');
    let res = idx !== -1 ? urlStr.slice(0, idx) : urlStr;
    const hashIdx = res.indexOf('#');
    if (hashIdx !== -1) {
      res = res.slice(0, hashIdx);
    }
    return res;
  }
}

export async function runPreviewRouteProbe(options?: {
  context?: Partial<ProbeContext>;
  fetchFn?: typeof fetch;
}): Promise<{ context: ProbeContext; results: ProbeResult[] }> {
  // Capture browser context safely
  const rawHref = options?.context?.href ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost:3000/');
  const rawOrigin = options?.context?.origin ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const rawPathname = options?.context?.pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
  const rawBaseURI = options?.context?.baseURI ?? (typeof document !== 'undefined' ? document.baseURI : rawHref);

  const context: ProbeContext = {
    href: cleanUrl(rawHref),
    origin: cleanUrl(rawOrigin),
    pathname: rawPathname, // pathname doesn't have query or fragment usually
    baseURI: cleanUrl(rawBaseURI)
  };

  const fetchToUse = options?.fetchFn ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  interface ProbeCandidate {
    method: 'GET' | 'POST';
    path: string;
    body?: string;
  }

  const candidates: ProbeCandidate[] = [
    { method: 'GET', path: '/api/health' },
    { method: 'GET', path: 'api/health' },
    { method: 'GET', path: './api/health' },
    { method: 'POST', path: '/api/e4-1a-4-route-does-not-exist', body: '{}' },
    { method: 'POST', path: '/api/ai/analyze-cp', body: '{}' },
    {
      method: 'POST',
      path: '/api/ai/generate-tp',
      body: JSON.stringify({
        cpGeneral: '',
        cpElements: [],
        cpAnalysisItems: []
      })
    },
    {
      method: 'POST',
      path: '/api/ai/generate-tp',
      body: JSON.stringify({
        cpGeneral: 'Diagnostic probe CP',
        cpElements: [],
        cpAnalysisItems: [],
        subject: 'Diagnostic',
        grade: 'Kelas 1',
        phase: 'Fase A',
        curriculum: 'KURIKULUM_MERDEKA',
        count: 1
      })
    }
  ];

  const probeCandidate = async (cand: ProbeCandidate): Promise<ProbeResult> => {
    let rawResolvedUrl = '';
    try {
      rawResolvedUrl = new URL(cand.path, rawBaseURI).toString();
    } catch (e: any) {
      return {
        method: cand.method,
        requestPath: cand.path,
        resolvedUrl: cleanUrl(rawResolvedUrl || cand.path),
        classification: 'NETWORK_ERROR',
        error: `URL resolution failed: ${e.message}`
      };
    }

    const resolvedUrl = cleanUrl(rawResolvedUrl);

    if (!fetchToUse) {
      return {
        method: cand.method,
        requestPath: cand.path,
        resolvedUrl,
        classification: 'NETWORK_ERROR',
        error: 'Fetch implementation is not available'
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout limit

    try {
      const headers: Record<string, string> = {
        'cache-control': 'no-cache'
      };
      if (cand.method === 'POST') {
        headers['Content-Type'] = 'application/json';
      }

      const response = await fetchToUse(rawResolvedUrl, {
        method: cand.method,
        cache: 'no-store',
        headers,
        body: cand.body,
        signal: controller.signal
      });

      const contentType = response.headers.get('content-type') || '';
      const responseText = await response.text();
      const textSnippet = responseText.substring(0, 200).trim();

      let classification: 'JSON' | 'HTML' | 'OTHER' | 'NETWORK_ERROR' = 'OTHER';
      if (contentType.toLowerCase().includes('application/json')) {
        classification = 'JSON';
      } else if (
        contentType.toLowerCase().includes('text/html') ||
        textSnippet.toLowerCase().includes('<!doctype') ||
        textSnippet.toLowerCase().includes('<html')
      ) {
        classification = 'HTML';
      }

      return {
        method: cand.method,
        requestPath: cand.path,
        resolvedUrl,
        finalResponseUrl: cleanUrl(response.url || rawResolvedUrl),
        status: response.status,
        contentType,
        classification,
        responseSnippet: textSnippet,
        redirected: response.redirected
      };
    } catch (err: any) {
      return {
        method: cand.method,
        requestPath: cand.path,
        resolvedUrl,
        classification: 'NETWORK_ERROR',
        error: err.name === 'AbortError' ? 'Request timed out' : err.message || String(err)
      };
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const results = await Promise.all(candidates.map(probeCandidate));
  return { context, results };
}

export function formatPreviewRouteProbeReport(data: { context: ProbeContext; results: ProbeResult[] }): string {
  const { context, results } = data;
  let report = '\n=== GAS Preview Route Probe ===\n';
  report += `location.href: ${context.href}\n`;
  report += `location.origin: ${context.origin}\n`;
  report += `location.pathname: ${context.pathname}\n`;
  report += `document.baseURI: ${context.baseURI}\n\n`;

  results.forEach((r, idx) => {
    report += `Probe ${idx + 1}:\n`;
    report += `  method: ${r.method}\n`;
    report += `  requestPath: ${r.requestPath}\n`;
    report += `  resolvedUrl: ${r.resolvedUrl}\n`;
    report += `  finalResponseUrl: ${r.finalResponseUrl ?? 'N/A'}\n`;
    report += `  status: ${r.status !== undefined ? r.status : 'N/A'}\n`;
    report += `  contentType: ${r.contentType ?? 'N/A'}\n`;
    report += `  classification: ${r.classification}\n`;
    report += `  redirected: ${r.redirected !== undefined ? r.redirected : 'false'}\n`;
    if (r.responseSnippet) {
      report += `  responseSnippet: ${r.responseSnippet}\n`;
    }
    if (r.error) {
      report += `  error: ${r.error}\n`;
    }
    report += '\n';
  });

  return report;
}
