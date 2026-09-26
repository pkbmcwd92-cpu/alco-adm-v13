import { GoogleGenAI } from '@google/genai';
import {
  CalendarDataProvider,
  CalendarSearchRequest,
  CalendarSourceCandidate,
  CalendarSourceLevel,
  normalizeRegionName,
} from '../src/services/calendarProvider';

export interface GroundedWebSource {
  uri: string;
  title?: string;
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
 * Verifies that a candidate sourceUrl is backed by verifiable search grounding metadata.
 * Candidate is discarded if no matching hostname or URI is found in grounding chunks.
 */
export function isCandidateBackedByGrounding(
  candidateUrl: string,
  groundedSources: GroundedWebSource[]
): boolean {
  if (!candidateUrl || !Array.isArray(groundedSources) || groundedSources.length === 0) {
    return false;
  }

  let candHost = '';
  try {
    const candParsed = new URL(candidateUrl.trim());
    candHost = candParsed.hostname.toLowerCase();
  } catch {
    return false;
  }

  if (!candHost) return false;

  const candCleanUrl = candidateUrl.trim().toLowerCase().split('#')[0].replace(/\/+$/, '');

  for (const src of groundedSources) {
    if (!src || !src.uri) continue;
    const srcCleanUrl = src.uri.trim().toLowerCase().split('#')[0].replace(/\/+$/, '');

    // 1. Exact or prefix URI match
    if (candCleanUrl === srcCleanUrl || srcCleanUrl.startsWith(candCleanUrl) || candCleanUrl.startsWith(srcCleanUrl)) {
      return true;
    }

    // 2. Hostname match against grounded source URI
    try {
      const srcParsed = new URL(src.uri);
      const srcHost = srcParsed.hostname.toLowerCase();
      if (candHost === srcHost || candHost.endsWith(`.${srcHost}`) || srcHost.endsWith(`.${candHost}`)) {
        return true;
      }
    } catch {
      // ignore
    }

    // 3. Hostname appears in grounded URI or title
    if (src.uri.toLowerCase().includes(candHost)) {
      return true;
    }
    if (src.title && src.title.toLowerCase().includes(candHost)) {
      return true;
    }
  }

  return false;
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
    return `Cari dokumen resmi Kalender Pendidikan (Kaldik) untuk wilayah:
Kabupaten/Kota: ${request.regency || ''}
Provinsi: ${request.province || ''}
Tahun Ajaran: ${request.academicYear}

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
    "documentTitle": "Judul Dokumen / Pedoman Kalender Pendidikan",
    "documentNumber": "Nomor Keputusan/Surat Edaran jika ada",
    "sourceUrl": "https://...",
    "publicationDate": "YYYY-MM-DD",
    "effectiveDate": "YYYY-MM-DD",
    "semesterStartDate": "YYYY-MM-DD",
    "semesterEndDate": "YYYY-MM-DD"
  }
]`;
  }

  if (level === 'PROVINCE') {
    return `Cari dokumen resmi Kalender Pendidikan (Kaldik) tingkat Provinsi untuk:
Provinsi: ${request.province || ''}
Tahun Ajaran: ${request.academicYear}

Prioritaskan sumber resmi Dinas Pendidikan Provinsi / Pemerintah Provinsi / JDIH Provinsi (domain .go.id).
JANGAN MENGARANG nomor surat keputusan, tanggal, atau URL.
Jika tidak ada sumber resmi yang terverifikasi, kembalikan array kosong [].

Kembalikan HANYA JSON array dengan struktur:
[
  {
    "province": "${request.province || ''}",
    "academicYear": "${request.academicYear}",
    "authority": "Dinas Pendidikan Provinsi ...",
    "documentTitle": "Judul Dokumen / Pedoman Kalender Pendidikan Provinsi",
    "documentNumber": "Nomor Keputusan/Surat Edaran jika ada",
    "sourceUrl": "https://...",
    "publicationDate": "YYYY-MM-DD",
    "effectiveDate": "YYYY-MM-DD",
    "semesterStartDate": "YYYY-MM-DD",
    "semesterEndDate": "YYYY-MM-DD"
  }
]`;
  }

  // NATIONAL level
  return `Cari pedoman / regulasi kalender pendidikan resmi tingkat Nasional dari Kementerian Pendidikan Dasar dan Menengah (Kemendikdasmen / Kemdikbud) untuk:
Tahun Ajaran: ${request.academicYear}

Cari informasi rujukan hari pertama masuk sekolah / batas semester nasional jika ada.
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
    "semesterStartDate": "YYYY-MM-DD",
    "semesterEndDate": "YYYY-MM-DD"
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

    // Official government HTTPS domain filter
    if (!isOfficialCalendarSourceUrl(sourceUrl)) {
      continue;
    }

    // Must be supported by grounding search metadata
    if (!isCandidateBackedByGrounding(sourceUrl, groundedSources)) {
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
      sourceUrl,
      publicationDate,
      effectiveDate,
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
 * Backend Calendar Provider with Google Search Grounding.
 * Implements canonical search hierarchy (REGENCY -> PROVINCE -> NATIONAL) with short-circuiting.
 */
export class GroundedCalendarSearchProvider implements CalendarDataProvider {
  private customGenerate?: GroundedGenerateFn;
  private apiKey?: string;

  constructor(options?: GroundedCalendarSearchProviderOptions) {
    this.customGenerate = options?.generateGroundedContent;
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

  private async executeGroundedSearch(prompt: string): Promise<GroundedSearchResponse | null> {
    if (this.customGenerate) {
      try {
        return await this.customGenerate(prompt, 'gemini-2.5-flash');
      } catch {
        return null;
      }
    }

    const ai = this.getAIClient();
    if (!ai) return null;

    const modelsToTry = [
      'gemini-2.5-flash',
      'gemini-3.8-flash',
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

        return {
          text: response.text,
          candidates: response.candidates as GroundedCandidateResponse[],
        };
      } catch (err: any) {
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
        // If googleSearch is unsupported on a specific model, try next
        continue;
      }
    }

    return null;
  }

  /**
   * Searches for calendar source candidates following hierarchical resolution:
   * 1. REGENCY (if regency & province specified)
   * 2. PROVINCE (if province specified and regency yielded no candidates)
   * 3. NATIONAL (if regional search yielded no candidates)
   */
  async search(request: CalendarSearchRequest): Promise<CalendarSourceCandidate[]> {
    if (!request || !request.academicYear) {
      return [];
    }

    // 1. Stage: REGENCY search
    if (request.regency && request.province) {
      const regencyPrompt = buildCalendarSearchPrompt(request, 'REGENCY');
      const regencyResponse = await this.executeGroundedSearch(regencyPrompt);

      if (regencyResponse && regencyResponse.text) {
        const groundedSources = extractGroundedWebSources(regencyResponse);
        const regencyCandidates = parseCalendarSearchResponse(
          regencyResponse.text,
          'REGENCY',
          request,
          groundedSources
        );

        if (regencyCandidates.length > 0) {
          // Short-circuit: return regency candidate without performing further searches
          return regencyCandidates;
        }
      }
    }

    // 2. Stage: PROVINCE search
    if (request.province) {
      const provincePrompt = buildCalendarSearchPrompt(request, 'PROVINCE');
      const provinceResponse = await this.executeGroundedSearch(provincePrompt);

      if (provinceResponse && provinceResponse.text) {
        const groundedSources = extractGroundedWebSources(provinceResponse);
        const provinceCandidates = parseCalendarSearchResponse(
          provinceResponse.text,
          'PROVINCE',
          request,
          groundedSources
        );

        if (provinceCandidates.length > 0) {
          // Short-circuit: return province candidate
          return provinceCandidates;
        }
      }
    }

    // 3. Stage: NATIONAL search
    const nationalPrompt = buildCalendarSearchPrompt(request, 'NATIONAL');
    const nationalResponse = await this.executeGroundedSearch(nationalPrompt);

    if (nationalResponse && nationalResponse.text) {
      const groundedSources = extractGroundedWebSources(nationalResponse);
      return parseCalendarSearchResponse(
        nationalResponse.text,
        'NATIONAL',
        request,
        groundedSources
      );
    }

    return [];
  }
}
