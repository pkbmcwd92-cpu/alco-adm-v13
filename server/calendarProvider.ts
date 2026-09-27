import { GoogleGenAI } from '@google/genai';
import {
  CalendarDataProvider,
  CalendarSearchRequest,
  CalendarSourceCandidate,
  CalendarSourceLevel,
  CalendarSearchDiagnostic,
  CalendarSearchDiagnosticReason,
  CalendarStageDiagnostic,
  CalendarModelAttemptDiagnostic,
  CalendarSearchResultWithDiagnostics,
  normalizeRegionName,
} from '../src/services/calendarProvider';

/**
 * Sanitizes errors to standard diagnostic error category strings without leaking secrets or raw text.
 */
export function sanitizeErrorCategory(err: unknown): string {
  if (!err) return 'UNKNOWN_PROVIDER_ERROR';
  const msg = (err instanceof Error ? err.message : String(err)).toUpperCase();
  if (msg.includes('400') || msg.includes('INVALID_ARGUMENT')) return 'HTTP_400';
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED') || msg.includes('API_KEY')) return 'HTTP_403';
  if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('NOT FOUND')) return 'MODEL_NOT_FOUND';
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('QUOTA')) return 'HTTP_429';
  if (msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('HIGH DEMAND')) return 'HTTP_503';
  if (msg.includes('TOOL') || msg.includes('SEARCH')) return 'SEARCH_TOOL_UNAVAILABLE';
  return 'UNKNOWN_PROVIDER_ERROR';
}

export interface GroundedWebSource {
  uri: string;
  title?: string;
  resolvedUri?: string;
}

export type GroundedUrlResolver = (uri: string) => Promise<string | null>;

/**
 * Default server-side grounded URL resolver that follows redirects to determine final landing URL.
 * Enforces HTTPS and timeout/fail-closed protection.
 */
export const defaultGroundedUrlResolver: GroundedUrlResolver = async (uri: string): Promise<string | null> => {
  if (!uri || typeof uri !== 'string') return null;
  const trimmed = uri.trim();
  if (!trimmed.startsWith('https://') && !trimmed.startsWith('http://')) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok && response.status !== 301 && response.status !== 302) {
      return null;
    }

    const finalUrl = response.url;
    if (finalUrl && finalUrl.startsWith('https://')) {
      return finalUrl;
    }
    return null;
  } catch {
    return null;
  }
};

/**
 * Asynchronously resolves grounded web source redirect URIs to their final landing destination.
 * Preserves original uri and title while attaching resolvedUri.
 */
export async function resolveGroundedWebSources(
  sources: GroundedWebSource[],
  resolver: GroundedUrlResolver = defaultGroundedUrlResolver
): Promise<GroundedWebSource[]> {
  if (!Array.isArray(sources) || sources.length === 0) return [];

  const resolvedSources: GroundedWebSource[] = [];

  for (const src of sources) {
    if (!src || !src.uri) continue;
    let resolvedUri: string | undefined = undefined;

    try {
      const res = await resolver(src.uri);
      if (res && typeof res === 'string' && res.trim() !== '') {
        resolvedUri = res.trim();
      }
    } catch {
      // ignore
    }

    resolvedSources.push({
      uri: src.uri,
      title: src.title,
      resolvedUri,
    });
  }

  return resolvedSources;
}

export interface GroundedCandidateChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

export interface GroundedMetadata {
  groundingChunks?: GroundedCandidateChunk[];
  webSearchQueries?: string[];
}

export interface GroundedCandidateResponse {
  groundingMetadata?: GroundedMetadata;
}

export interface GroundedSearchResponse {
  text?: string;
  candidates?: GroundedCandidateResponse[];
}

export type GroundedGenerateFn = (
  prompt: string,
  model: string
) => Promise<GroundedSearchResponse>;

export interface GroundedCalendarSearchProviderOptions {
  apiKey?: string;
  generateGroundedContent?: GroundedGenerateFn;
}

/**
 * Validates whether a URL is an official Indonesian government HTTPS URL (*.go.id).
 * Strictly rejects HTTP, non-governmental domains, blogs, social media, and file hosting.
 */
export function isOfficialCalendarSourceUrl(sourceUrl: string): boolean {
  if (!sourceUrl || typeof sourceUrl !== 'string') return false;
  const trimmed = sourceUrl.trim();

  // Must strictly be HTTPS
  if (!trimmed.startsWith('https://')) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;

    const hostname = parsed.hostname.toLowerCase();

    // Must be .go.id domain
    if (!hostname.endsWith('.go.id') && hostname !== 'go.id') {
      return false;
    }

    // Explicitly reject known third-party or non-official patterns even if somehow containing go.id in path
    const blacklistSubstrings = [
      'wordpress',
      'blogspot',
      'facebook',
      'instagram',
      'tiktok',
      'youtube',
      'scribd',
      'drive.google',
      'docs.google',
    ];
    for (const item of blacklistSubstrings) {
      if (hostname.includes(item)) return false;
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts grounded web source URIs and titles from Gemini response grounding metadata.
 */
export function extractGroundedWebSources(response: unknown): GroundedWebSource[] {
  if (!response || typeof response !== 'object') return [];

  const res = response as GroundedSearchResponse;
  const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const sources: GroundedWebSource[] = [];
  for (const chunk of chunks) {
    if (chunk && chunk.web && typeof chunk.web.uri === 'string' && chunk.web.uri.trim() !== '') {
      sources.push({
        uri: chunk.web.uri.trim(),
        title: typeof chunk.web.title === 'string' ? chunk.web.title.trim() : undefined,
      });
    }
  }

  return sources;
}

/**
 * Checks if two hostnames match or belong to the same official government domain.
 */
export function hostnamesMatch(host1: string, host2: string): boolean {
  if (!host1 || !host2) return false;
  const h1 = host1.toLowerCase().replace(/^www\./, '');
  const h2 = host2.toLowerCase().replace(/^www\./, '');
  if (h1 === h2) return true;
  if (h1.endsWith(`.${h2}`) || h2.endsWith(`.${h1}`)) return true;

  const getGoIdBase = (h: string) => {
    const parts = h.split('.');
    if (parts.length >= 3 && parts[parts.length - 1] === 'id' && parts[parts.length - 2] === 'go') {
      return `${parts[parts.length - 3]}.go.id`;
    }
    return h;
  };

  const base1 = getGoIdBase(h1);
  const base2 = getGoIdBase(h2);
  return base1 === base2;
}

/**
 * Reconciles a candidate source URL against grounded sources (including resolved landing URLs).
 * Returns the verified canonical official URL if supported by grounding, or null if unverified / fail-closed.
 */
export function reconcileCandidateWithGrounding(
  candidateUrl: string,
  groundedSources: GroundedWebSource[]
): string | null {
  if (!candidateUrl || !Array.isArray(groundedSources) || groundedSources.length === 0) {
    return null;
  }

  let candHost = '';
  try {
    const candParsed = new URL(candidateUrl.trim());
    candHost = candParsed.hostname.toLowerCase();
  } catch {
    return null;
  }

  if (!candHost) return null;

  for (const src of groundedSources) {
    if (!src) continue;

    // Determine official landing URL from src
    let officialLandingUrl: string | null = null;

    if (src.resolvedUri && isOfficialCalendarSourceUrl(src.resolvedUri)) {
      officialLandingUrl = src.resolvedUri.trim();
    } else if (src.uri && isOfficialCalendarSourceUrl(src.uri)) {
      officialLandingUrl = src.uri.trim();
    }

    if (!officialLandingUrl) {
      // Grounding source does not point to a valid official .go.id landing destination
      continue;
    }

    let srcHost = '';
    try {
      const srcParsed = new URL(officialLandingUrl);
      srcHost = srcParsed.hostname.toLowerCase();
    } catch {
      continue;
    }

    if (hostnamesMatch(candHost, srcHost)) {
      // Hostnames match! Prefer verified resolved landing URL as canonical official source URL
      return officialLandingUrl;
    }
  }

  return null;
}

/**
 * Verifies that a candidate sourceUrl is backed by verifiable search grounding metadata.
 * Candidate is discarded if no matching hostname or URI is found in grounding chunks.
 */
export function isCandidateBackedByGrounding(
  candidateUrl: string,
  groundedSources: GroundedWebSource[]
): boolean {
  return reconcileCandidateWithGrounding(candidateUrl, groundedSources) !== null;
}

/**
 * Validates date string in strict YYYY-MM-DD format.
 */
function sanitizeIsoDate(dateStr?: unknown): string | undefined {
  if (typeof dateStr !== 'string') return undefined;
  const trimmed = dateStr.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return trimmed;
    }
  }
  return undefined;
}

/**
 * Builds a strict grounded search prompt tailored to the requested geographic level.
 */
export function buildCalendarSearchPrompt(
  request: CalendarSearchRequest,
  level: CalendarSourceLevel
): string {
  if (level === 'REGENCY') {
    return `Cari dokumen resmi Kalender Pendidikan (Kaldik) Tahun Ajaran ${request.academicYear} untuk wilayah:
Kabupaten/Kota: ${request.regency || ''}
Provinsi: ${request.province || ''}

Prioritaskan sumber resmi pemerintah daerah / dinas pendidikan / JDIH (domain .go.id).
JANGAN MENGARANG nomor surat keputusan, tanggal, atau URL.
Jika tidak ada sumber resmi yang terverifikasi, kembalikan array kosong [].

Kembalikan HANYA JSON array dengan struktur:
[
  {
    "province": "${request.province || ''}",
    "regency": "${request.regency || ''}",
    "academicYear": "${request.academicYear}",
    "authority": "Nama Dinas Pendidikan / Pemerintah Daerah",
    "documentTitle": "Judul Dokumen / Pedoman Kalender Pendidikan Tahun Ajaran ${request.academicYear}",
    "documentNumber": "Nomor Keputusan/Surat Edaran jika ada",
    "sourceUrl": "https://...",
    "publicationDate": "YYYY-MM-DD",
    "effectiveDate": "YYYY-MM-DD",
    "semester1StartDate": "YYYY-MM-DD",
    "semester1EndDate": "YYYY-MM-DD",
    "semester2StartDate": "YYYY-MM-DD",
    "semester2EndDate": "YYYY-MM-DD"
  }
]`;
  }

  if (level === 'PROVINCE') {
    return `Cari dokumen resmi Kalender Pendidikan (Kaldik) Tahun Ajaran ${request.academicYear} tingkat Provinsi untuk:
Provinsi: ${request.province || ''}

Prioritaskan sumber resmi Dinas Pendidikan Provinsi / Pemerintah Provinsi / JDIH Provinsi (domain .go.id).
JANGAN MENGARANG nomor surat keputusan, tanggal, atau URL.
Jika tidak ada sumber resmi yang terverifikasi, kembalikan array kosong [].

Kembalikan HANYA JSON array dengan struktur:
[
  {
    "province": "${request.province || ''}",
    "academicYear": "${request.academicYear}",
    "authority": "Dinas Pendidikan Provinsi ...",
    "documentTitle": "Judul Dokumen / Pedoman Kalender Pendidikan Provinsi Tahun Ajaran ${request.academicYear}",
    "documentNumber": "Nomor Keputusan/Surat Edaran jika ada",
    "sourceUrl": "https://...",
    "publicationDate": "YYYY-MM-DD",
    "effectiveDate": "YYYY-MM-DD",
    "semester1StartDate": "YYYY-MM-DD",
    "semester1EndDate": "YYYY-MM-DD",
    "semester2StartDate": "YYYY-MM-DD",
    "semester2EndDate": "YYYY-MM-DD"
  }
]`;
  }

  // NATIONAL level
  return `Cari pedoman / regulasi kalender pendidikan resmi tingkat Nasional dari Kementerian Pendidikan Dasar dan Menengah RI untuk:
Tahun Ajaran: ${request.academicYear}

Cari informasi rujukan hari pertama masuk sekolah / ketentuan kalender pendidikan nasional untuk Tahun Ajaran ${request.academicYear}.
JANGAN MENGARANG kalender pendidikan nasional jika tidak diterbitkan secara resmi.
Prioritaskan situs resmi kemendikdasmen.go.id atau kemdikbud.go.id.

Kembalikan HANYA JSON array dengan struktur:
[
  {
    "academicYear": "${request.academicYear}",
    "authority": "Kementerian Pendidikan Dasar dan Menengah RI",
    "documentTitle": "Judul Pedoman / Ketentuan Kalender Pendidikan",
    "documentNumber": "Nomor Peraturan/SE jika ada",
    "sourceUrl": "https://kemendikdasmen.go.id/...",
    "publicationDate": "YYYY-MM-DD",
    "effectiveDate": "YYYY-MM-DD",
    "semester1StartDate": "YYYY-MM-DD",
    "semester1EndDate": "YYYY-MM-DD",
    "semester2StartDate": "YYYY-MM-DD",
    "semester2EndDate": "YYYY-MM-DD"
  }
]`;
}

/**
 * Parses raw model output with fail-closed validation against geographic, academic year, and grounding constraints.
 */
export function parseCalendarSearchResponse(
  rawText: string,
  level: CalendarSourceLevel,
  request: CalendarSearchRequest,
  groundedSources: GroundedWebSource[]
): CalendarSourceCandidate[] {
  if (!rawText || typeof rawText !== 'string') {
    return [];
  }

  let text = rawText.trim();
  if (text.includes('```json')) {
    text = text.slice(text.indexOf('```json') + 7);
    if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
  } else if (text.includes('```')) {
    text = text.slice(text.indexOf('```') + 3);
    if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
  }
  text = text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const reqYear = request.academicYear.trim();
  const reqRegencyNorm = normalizeRegionName(request.regency);
  const reqProvinceNorm = normalizeRegionName(request.province);

  const candidates: CalendarSourceCandidate[] = [];

  for (const item of parsed) {
    if (!item || typeof item !== 'object') continue;

    const authority = typeof item.authority === 'string' ? item.authority.trim() : '';
    const documentTitle = typeof item.documentTitle === 'string' ? item.documentTitle.trim() : '';
    const sourceUrl = typeof item.sourceUrl === 'string' ? item.sourceUrl.trim() : '';
    const academicYear = typeof item.academicYear === 'string' ? item.academicYear.trim() : '';

    // Minimum required provenance fields
    if (!authority || !documentTitle || !sourceUrl || !academicYear) {
      continue;
    }

    // Academic year fail-closed match
    if (academicYear !== reqYear) {
      continue;
    }

    // Must be supported by grounding search metadata and reconcile to an official .go.id URL
    const canonicalSourceUrl = reconcileCandidateWithGrounding(sourceUrl, groundedSources);
    if (!canonicalSourceUrl) {
      continue;
    }

    // Double-check official government HTTPS domain filter
    if (!isOfficialCalendarSourceUrl(canonicalSourceUrl)) {
      continue;
    }

    // Geographic alignment checks
    if (level === 'REGENCY') {
      const itemRegencyNorm = normalizeRegionName(item.regency);
      const itemProvinceNorm = normalizeRegionName(item.province);

      if (!reqRegencyNorm || !itemRegencyNorm || itemRegencyNorm !== reqRegencyNorm) {
        continue;
      }
      if (reqProvinceNorm && (!itemProvinceNorm || itemProvinceNorm !== reqProvinceNorm)) {
        continue;
      }
    } else if (level === 'PROVINCE') {
      const itemProvinceNorm = normalizeRegionName(item.province);
      if (!reqProvinceNorm || !itemProvinceNorm || itemProvinceNorm !== reqProvinceNorm) {
        continue;
      }
    }

    // Sanitize dates
    const publicationDate = sanitizeIsoDate(item.publicationDate);
    const effectiveDate = sanitizeIsoDate(item.effectiveDate);
    const semester1StartDate = sanitizeIsoDate(item.semester1StartDate);
    const semester1EndDate = sanitizeIsoDate(item.semester1EndDate);
    const semester2StartDate = sanitizeIsoDate(item.semester2StartDate);
    const semester2EndDate = sanitizeIsoDate(item.semester2EndDate);
    const semesterStartDate = sanitizeIsoDate(item.semesterStartDate);
    const semesterEndDate = sanitizeIsoDate(item.semesterEndDate);

    const candidate: CalendarSourceCandidate = {
      sourceLevel: level,
      province: level === 'NATIONAL' ? undefined : (typeof item.province === 'string' ? item.province.trim() : request.province),
      regency: level === 'REGENCY' ? (typeof item.regency === 'string' ? item.regency.trim() : request.regency) : undefined,
      academicYear: reqYear,
      authority,
      documentTitle,
      documentNumber: typeof item.documentNumber === 'string' && item.documentNumber.trim() ? item.documentNumber.trim() : undefined,
      sourceUrl: canonicalSourceUrl,
      publicationDate,
      effectiveDate,
      semester1StartDate,
      semester1EndDate,
      semester2StartDate,
      semester2EndDate,
      semesterStartDate,
      semesterEndDate,
      // Online search results are always PARTIAL (never automatically verified)
      verificationStatus: 'PARTIAL',
      retrievedAt: new Date().toISOString(),
    };

    candidates.push(candidate);
  }

  return candidates;
}

/**
 * Parses calendar search response and tracks raw candidate item count before filtering.
 */
export function parseCalendarSearchResponseWithCount(
  rawText: string,
  level: CalendarSourceLevel,
  request: CalendarSearchRequest,
  groundedSources: GroundedWebSource[]
): { candidates: CalendarSourceCandidate[]; rawCandidateCount: number } {
  if (!rawText || typeof rawText !== 'string') {
    return { candidates: [], rawCandidateCount: 0 };
  }

  let text = rawText.trim();
  if (text.includes('```json')) {
    text = text.slice(text.indexOf('```json') + 7);
    if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
  } else if (text.includes('```')) {
    text = text.slice(text.indexOf('```') + 3);
    if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
  }
  text = text.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { candidates: [], rawCandidateCount: 0 };
  }

  if (!Array.isArray(parsed)) {
    return { candidates: [], rawCandidateCount: 0 };
  }

  const rawCandidateCount = parsed.length;
  const candidates = parseCalendarSearchResponse(rawText, level, request, groundedSources);
  return { candidates, rawCandidateCount };
}

export interface GroundedCalendarSearchProviderOptions {
  apiKey?: string;
  generateGroundedContent?: GroundedGenerateFn;
  resolveGroundedUrl?: GroundedUrlResolver;
}

/**
 * Backend Calendar Provider with Google Search Grounding.
 * Implements canonical search hierarchy (REGENCY -> PROVINCE -> NATIONAL) with short-circuiting.
 */
export class GroundedCalendarSearchProvider implements CalendarDataProvider {
  private customGenerate?: GroundedGenerateFn;
  private resolveGroundedUrl: GroundedUrlResolver;
  private apiKey?: string;

  constructor(options?: GroundedCalendarSearchProviderOptions) {
    this.customGenerate = options?.generateGroundedContent;
    this.resolveGroundedUrl = options?.resolveGroundedUrl || defaultGroundedUrlResolver;
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY;
  }

  private getAIClient(): GoogleGenAI | null {
    const key = this.apiKey || process.env.GEMINI_API_KEY;
    if (!key) return null;
    return new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: { 'User-Agent': 'aistudio-build' },
      },
    });
  }

  private async executeGroundedSearchWithDiagnostics(prompt: string): Promise<{
    response: GroundedSearchResponse | null;
    modelAttempts: CalendarModelAttemptDiagnostic[];
  }> {
    const modelAttempts: CalendarModelAttemptDiagnostic[] = [];

    if (this.customGenerate) {
      try {
        const res = await this.customGenerate(prompt, 'gemini-3.8-flash');
        modelAttempts.push({ model: 'gemini-3.8-flash', status: 'SUCCESS' });
        return { response: res, modelAttempts };
      } catch (err) {
        modelAttempts.push({
          model: 'gemini-3.8-flash',
          status: 'ERROR',
          errorCategory: sanitizeErrorCategory(err),
        });
        return { response: null, modelAttempts };
      }
    }

    const ai = this.getAIClient();
    if (!ai) {
      return { response: null, modelAttempts: [] };
    }

    const modelsToTry = [
      'gemini-3.8-flash',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-flash-latest',
    ];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        modelAttempts.push({ model, status: 'SUCCESS' });

        return {
          response: {
            text: response.text,
            candidates: response.candidates as GroundedCandidateResponse[],
          },
          modelAttempts,
        };
      } catch (err: any) {
        const errCat = sanitizeErrorCategory(err);
        modelAttempts.push({ model, status: 'ERROR', errorCategory: errCat });

        const msg = (err?.message || String(err)).toLowerCase();
        if (
          msg.includes('503') ||
          msg.includes('429') ||
          msg.includes('unavailable') ||
          msg.includes('quota') ||
          msg.includes('high demand')
        ) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        continue;
      }
    }

    return { response: null, modelAttempts };
  }

  private async executeGroundedSearch(prompt: string): Promise<GroundedSearchResponse | null> {
    const res = await this.executeGroundedSearchWithDiagnostics(prompt);
    return res.response;
  }

  /**
   * Searches for calendar source candidates while recording granular runtime diagnostic metadata across resolution stages.
   */
  async searchWithDiagnostics(request: CalendarSearchRequest): Promise<CalendarSearchResultWithDiagnostics> {
    const isAiConfigured = Boolean(this.apiKey || this.customGenerate || process.env.GEMINI_API_KEY);

    if (!isAiConfigured) {
      return {
        candidates: [],
        diagnostic: {
          aiConfigured: false,
          reason: 'NO_API_KEY',
          stages: [],
        },
      };
    }

    if (!request || !request.academicYear) {
      return {
        candidates: [],
        diagnostic: {
          aiConfigured: isAiConfigured,
          reason: 'NO_OFFICIAL_SOURCE',
          stages: [],
        },
      };
    }

    const stages: CalendarStageDiagnostic[] = [];
    let acceptedCandidates: CalendarSourceCandidate[] = [];

    const runStage = async (level: CalendarSourceLevel) => {
      const prompt = buildCalendarSearchPrompt(request, level);
      const { response, modelAttempts } = await this.executeGroundedSearchWithDiagnostics(prompt);

      const responseReceived = Boolean(response);
      const textPresent = Boolean(response?.text && response.text.trim().length > 0);

      const rawSources = response ? extractGroundedWebSources(response) : [];
      const groundingSourceCount = rawSources.length;

      const groundedSources = await resolveGroundedWebSources(rawSources, this.resolveGroundedUrl);
      const resolvedGroundingCount = groundedSources.filter(s =>
        (s.resolvedUri && isOfficialCalendarSourceUrl(s.resolvedUri)) ||
        (s.uri && isOfficialCalendarSourceUrl(s.uri))
      ).length;

      const { candidates, rawCandidateCount } = (response && response.text)
        ? parseCalendarSearchResponseWithCount(response.text, level, request, groundedSources)
        : { candidates: [], rawCandidateCount: 0 };
      const acceptedCandidateCount = candidates.length;

      const stageDiag: CalendarStageDiagnostic = {
        level,
        modelAttempts,
        responseReceived,
        textPresent,
        rawCandidateCount,
        groundingSourceCount,
        resolvedGroundingCount,
        acceptedCandidateCount,
      };

      stages.push(stageDiag);

      if (candidates.length > 0) {
        acceptedCandidates = candidates;
        return true;
      }
      return false;
    };

    // 1. Stage: REGENCY
    if (request.regency && request.province) {
      const found = await runStage('REGENCY');
      if (found) {
        return {
          candidates: acceptedCandidates,
          diagnostic: {
            aiConfigured: isAiConfigured,
            reason: 'SUCCESS',
            stages,
          },
        };
      }
    }

    // 2. Stage: PROVINCE
    if (request.province) {
      const found = await runStage('PROVINCE');
      if (found) {
        return {
          candidates: acceptedCandidates,
          diagnostic: {
            aiConfigured: isAiConfigured,
            reason: 'SUCCESS',
            stages,
          },
        };
      }
    }

    // 3. Stage: NATIONAL
    const foundNat = await runStage('NATIONAL');
    if (foundNat) {
      return {
        candidates: acceptedCandidates,
        diagnostic: {
          aiConfigured: isAiConfigured,
          reason: 'SUCCESS',
          stages,
        },
      };
    }

    // Evaluate diagnostic reason if no candidates accepted
    let reason: CalendarSearchDiagnosticReason = 'NO_OFFICIAL_SOURCE';

    const allModelAttemptsFailed =
      stages.length > 0 &&
      stages.every(s => s.modelAttempts.length > 0 && s.modelAttempts.every(m => m.status === 'ERROR')) &&
      stages.every(s => !s.responseReceived);

    const noTextPresentInAnyStage = stages.every(s => !s.textPresent);
    const totalGroundingSources = stages.reduce((acc, s) => acc + s.groundingSourceCount, 0);
    const totalResolvedGrounding = stages.reduce((acc, s) => acc + s.resolvedGroundingCount, 0);
    const totalRawCandidates = stages.reduce((acc, s) => acc + s.rawCandidateCount, 0);

    if (allModelAttemptsFailed) {
      reason = 'MODEL_FAILURE';
    } else if (noTextPresentInAnyStage) {
      reason = 'EMPTY_RESPONSE';
    } else if (totalGroundingSources === 0) {
      reason = 'NO_GROUNDING';
    } else if (totalResolvedGrounding === 0) {
      reason = 'GROUNDING_RESOLUTION_FAILED';
    } else if (totalRawCandidates > 0) {
      reason = 'CANDIDATE_REJECTED';
    } else {
      reason = 'NO_OFFICIAL_SOURCE';
    }

    return {
      candidates: [],
      diagnostic: {
        aiConfigured: isAiConfigured,
        reason,
        stages,
      },
    };
  }

  /**
   * Searches for calendar source candidates following hierarchical resolution:
   * 1. REGENCY (if regency & province specified)
   * 2. PROVINCE (if province specified and regency yielded no candidates)
   * 3. NATIONAL (if regional search yielded no candidates)
   */
  async search(request: CalendarSearchRequest): Promise<CalendarSourceCandidate[]> {
    const result = await this.searchWithDiagnostics(request);
    return result.candidates;
  }
}
