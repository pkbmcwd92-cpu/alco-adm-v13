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
import {
  isOfficialCalendarSourceUrl,
  sanitizeErrorCategory,
  classifyProviderError,
} from './calendarProvider';

/**
 * Validates date string in strict YYYY-MM-DD format.
 */
export function sanitizeIsoDate(dateStr?: unknown): string | undefined {
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

export interface SourceContentVerificationResult {
  isValid: boolean;
  hasCalendarKeyword: boolean;
  hasAcademicYear: boolean;
  hasGeographicSignal: boolean;
  rejectionReason?: string;
}

/**
 * Verifies whether fetched text or page content contains genuine proof
 * of Indonesian academic calendar regulations for the requested region and academic year.
 */
export function verifySourceContentRelevance(
  textOrHtml: string,
  url: string,
  request: CalendarSearchRequest,
  level: CalendarSourceLevel
): SourceContentVerificationResult {
  if (!textOrHtml && !url) {
    return {
      isValid: false,
      hasCalendarKeyword: false,
      hasAcademicYear: false,
      hasGeographicSignal: false,
      rejectionReason: 'EMPTY_CONTENT',
    };
  }

  const combined = `${url} ${textOrHtml}`.toLowerCase();

  // 1. Calendar keywords
  const calendarKeywords = [
    'kalender pendidikan',
    'kaldik',
    'kalender akademik',
    'hari pertama masuk sekolah',
    'semester genap',
    'semester ganjil',
    'tahun pelajaran',
    'tahun ajaran',
  ];
  const hasCalendarKeyword = calendarKeywords.some((kw) => combined.includes(kw));

  // 2. Academic year matching (flexible formats: 2026/2027, 2026-2027, 2026 / 2027, 2026_2027)
  const reqYear = request.academicYear.trim();
  const yearVariants: string[] = [reqYear];
  if (reqYear.includes('/')) {
    yearVariants.push(reqYear.replace('/', '-'));
    yearVariants.push(reqYear.replace('/', ' / '));
    yearVariants.push(reqYear.replace('/', '_'));
    yearVariants.push(reqYear.replace('/', ' '));
  }
  const hasAcademicYear = yearVariants.some((v) => combined.includes(v.toLowerCase()));

  // 3. Geographic signal matching
  let hasGeographicSignal = true;
  if (level === 'REGENCY' && request.regency) {
    const regCore = request.regency
      .toLowerCase()
      .replace(/^kabupaten\s+/i, '')
      .replace(/^kab\.\s*/i, '')
      .replace(/^kota\s+/i, '')
      .trim();
    if (regCore.length >= 3) {
      hasGeographicSignal = combined.includes(regCore);
    }
  } else if (level === 'PROVINCE' && request.province) {
    const provCore = request.province
      .toLowerCase()
      .replace(/^provinsi\s+/i, '')
      .replace(/^prov\.\s*/i, '')
      .trim();
    if (provCore.length >= 3) {
      hasGeographicSignal = combined.includes(provCore);
    }
  }

  const isValid = hasCalendarKeyword && hasAcademicYear && hasGeographicSignal;
  let rejectionReason: string | undefined = undefined;
  if (!hasCalendarKeyword) rejectionReason = 'MISSING_CALENDAR_KEYWORD';
  else if (!hasAcademicYear) rejectionReason = 'MISSING_ACADEMIC_YEAR';
  else if (!hasGeographicSignal) rejectionReason = 'GEOGRAPHIC_MISMATCH';

  return {
    isValid,
    hasCalendarKeyword,
    hasAcademicYear,
    hasGeographicSignal,
    rejectionReason,
  };
}

/**
 * Strips HTML tags and script/style content to extract clean plain text for AI processing.
 */
export function extractCleanTextFromHtml(html: string): string {
  if (!html) return '';
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<(?:br|p|div|h[1-6]|li|tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");

  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim()
    .slice(0, 10000);
}

export interface FetchedSourceContent {
  ok: boolean;
  status: number;
  text: string;
  finalUrl: string;
  contentType: string;
  isPdf: boolean;
}

export type SourceContentFetcher = (url: string) => Promise<FetchedSourceContent | null>;

/**
 * Default HTTP fetcher with timeout, size bound, redirect follow, and HTTPS .go.id enforcement.
 */
export const defaultSourceContentFetcher: SourceContentFetcher = async (url: string): Promise<FetchedSourceContent | null> => {
  if (!isOfficialCalendarSourceUrl(url)) return null;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url.trim(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/pdf,*/*',
      },
    });
    clearTimeout(timeoutId);

    const finalUrl = res.url || url;
    if (!isOfficialCalendarSourceUrl(finalUrl)) {
      return null;
    }

    if (!res.ok) {
      return null;
    }

    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isPdf = contentType.includes('application/pdf') || finalUrl.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return {
        ok: true,
        status: res.status,
        text: '',
        finalUrl,
        contentType: 'application/pdf',
        isPdf: true,
      };
    }

    const rawText = await res.text();
    const boundedText = rawText.slice(0, 524288);
    const cleanText = extractCleanTextFromHtml(boundedText);

    return {
      ok: true,
      status: res.status,
      text: cleanText,
      finalUrl,
      contentType,
      isPdf: false,
    };
  } catch {
    return null;
  }
};

/**
 * Generates official deterministic candidate URLs based on administrative region names and .go.id conventions.
 */
export function generateDeterministicOfficialUrls(
  request: CalendarSearchRequest,
  level: CalendarSourceLevel
): string[] {
  const urls: string[] = [];
  const reqYearSlug = request.academicYear.trim().replace('/', '-');

  if (level === 'REGENCY' && request.regency) {
    const raw = request.regency.toLowerCase().trim();
    const isKota = raw.startsWith('kota');
    const core = raw
      .replace(/^kabupaten\s+/i, '')
      .replace(/^kab\.\s*/i, '')
      .replace(/^kota\s+/i, '')
      .replace(/[^a-z0-9]/g, '');

    const domainSuffix = isKota ? `${core}kota.go.id` : `${core}kab.go.id`;
    urls.push(
      `https://disdik.${domainSuffix}/kalender-pendidikan-${reqYearSlug}`,
      `https://disdik.${domainSuffix}/kaldik-${reqYearSlug}`,
      `https://disdik.${domainSuffix}/kalender-pendidikan`,
      `https://disdik.${domainSuffix}`,
      `https://${domainSuffix}/kalender-pendidikan-${reqYearSlug}`,
      `https://jdih.${domainSuffix}`
    );
  } else if (level === 'PROVINCE' && request.province) {
    const rawProv = request.province.toLowerCase().trim();
    const coreProv = rawProv
      .replace(/^provinsi\s+/i, '')
      .replace(/^prov\.\s*/i, '')
      .replace(/[^a-z0-9]/g, '');

    const provDomain = `${coreProv}prov.go.id`;
    urls.push(
      `https://disdik.${provDomain}/kalender-pendidikan-${reqYearSlug}`,
      `https://dindikbud.${provDomain}/kalender-pendidikan-${reqYearSlug}`,
      `https://disdik.${provDomain}/kaldik-${reqYearSlug}`,
      `https://disdik.${provDomain}`,
      `https://${provDomain}`,
      `https://jdih.${provDomain}`
    );
  } else if (level === 'NATIONAL') {
    urls.push(
      `https://kemendikdasmen.go.id/pedoman-kalender-pendidikan-${reqYearSlug}`,
      `https://kemendikdasmen.go.id`,
      `https://kemdikbud.go.id`,
      `https://jdih.kemdikbud.go.id`
    );
  }

  return urls.filter(isOfficialCalendarSourceUrl);
}

export type PlainGeminiGenerateFn = (
  prompt: string,
  model: string
) => Promise<{ text?: string }>;

export interface TrustedCalendarSearchProviderOptions {
  apiKey?: string;
  discoverCandidateUrls?: (request: CalendarSearchRequest, level: CalendarSourceLevel) => Promise<string[]>;
  generatePlainContent?: PlainGeminiGenerateFn;
  fetchSourceContent?: SourceContentFetcher;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Builds Plain Gemini prompt for date extraction from verified source content.
 * Strictly forbids web search tools and forbids date fabrication.
 */
export function buildPlainExtractionPrompt(
  request: CalendarSearchRequest,
  level: CalendarSourceLevel,
  verifiedUrl: string,
  sourceText: string
): string {
  return `Anda adalah sistem ekstraksi fakta resmi Kalender Pendidikan Indonesia.
Tugas: Ekstrak ketentuan tanggal Kalender Pendidikan Tahun Ajaran ${request.academicYear} HANYA dari teks dokumen resmi yang disediakan di bawah ini.

URL Sumber Terverifikasi: ${verifiedUrl}
Wilayah: ${level === 'REGENCY' ? request.regency + ', ' + request.province : level === 'PROVINCE' ? request.province : 'Nasional'}
Tahun Ajaran: ${request.academicYear}

TEKS DOKUMEN:
"""
${sourceText.slice(0, 8000)}
"""

ATURAN KETAT:
1. EKSTRAK HANYA tanggal yang secara eksplisit tertulis dalam teks dokumen di atas.
2. JANGAN MENGARANG tanggal, nomor SK, atau tautan.
3. Jika tanggal semester tidak tertulis di teks dokumen, isi dengan string kosong ("") atau null.
4. Format tanggal harus YYYY-MM-DD.

Kembalikan HANYA JSON array dengan satu objek:
[
  {
    "province": "${request.province || ''}",
    "regency": "${request.regency || ''}",
    "academicYear": "${request.academicYear}",
    "authority": "Nama Dinas Pendidikan / Instansi Penerbit",
    "documentTitle": "Judul Dokumen Kalender Pendidikan",
    "documentNumber": "",
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
 * Trusted Calendar Search Provider.
 * Architecture:
 * 1. Web / Domain Discovery (Official .go.id patterns + Plain Gemini helper, NO Google Search Grounding tool)
 * 2. Strict Official HTTP Source & Content Verification
 * 3. Plain Gemini Extraction (Free-tier safe, zero date hallucination)
 * 4. Short-circuiting canonical hierarchy: REGENCY -> PROVINCE -> NATIONAL
 */
export class TrustedCalendarSearchProvider implements CalendarDataProvider {
  private customDiscoverUrls?: (request: CalendarSearchRequest, level: CalendarSourceLevel) => Promise<string[]>;
  private customGeneratePlain?: PlainGeminiGenerateFn;
  private fetchSource: SourceContentFetcher;
  private sleepFn: (ms: number) => Promise<void>;
  private apiKey?: string;

  constructor(options?: TrustedCalendarSearchProviderOptions) {
    this.customDiscoverUrls = options?.discoverCandidateUrls;
    this.customGeneratePlain = options?.generatePlainContent;
    this.fetchSource = options?.fetchSourceContent || defaultSourceContentFetcher;
    this.sleepFn = options?.sleep || ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
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

  /**
   * Plain Gemini helper for candidate URL discovery (WITHOUT Google Search tools).
   */
  private async discoverCandidateUrlsWithAI(
    request: CalendarSearchRequest,
    level: CalendarSourceLevel,
    modelAttempts: CalendarModelAttemptDiagnostic[]
  ): Promise<string[]> {
    const targetRegion = level === 'REGENCY'
      ? `${request.regency}, ${request.province}`
      : level === 'PROVINCE'
      ? request.province
      : 'Nasional';

    const prompt = `Sebutkan 3-6 URL resmi pemerintah Republik Indonesia (domain .go.id) dari Dinas Pendidikan, Pemerintah Daerah, atau JDIH yang berpotensi memuat Kalender Pendidikan Tahun Ajaran ${request.academicYear} untuk:
Wilayah: ${targetRegion}
Tingkat: ${level}

Ketentuan:
1. Hanya sertakan URL dengan protokol HTTPS dan domain berakhiran .go.id.
2. JANGAN menggunakan domain non-pemerintah.
3. Kembalikan HANYA JSON array string URL:
["https://..."]`;

    if (this.customGeneratePlain) {
      try {
        const res = await this.customGeneratePlain(prompt, 'gemini-3.5-flash-lite');
        modelAttempts.push({ model: 'gemini-3.5-flash-lite', status: 'SUCCESS' });
        return this.parseUrlsFromJson(res.text || '');
      } catch (err) {
        modelAttempts.push({
          model: 'gemini-3.5-flash-lite',
          status: 'ERROR',
          errorCategory: sanitizeErrorCategory(err),
        });
        return [];
      }
    }

    const ai = this.getAIClient();
    if (!ai) return [];

    const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];

    for (const model of modelsToTry) {
      try {
        // Plain generation WITHOUT tools
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
        });

        modelAttempts.push({ model, status: 'SUCCESS' });
        const urls = this.parseUrlsFromJson(response.text || '');
        if (urls.length > 0) {
          return urls;
        }
      } catch (err) {
        modelAttempts.push({
          model,
          status: 'ERROR',
          errorCategory: sanitizeErrorCategory(err),
        });
        continue;
      }
    }

    return [];
  }

  private parseUrlsFromJson(rawText: string): string[] {
    if (!rawText) return [];
    let text = rawText.trim();
    if (text.includes('```json')) {
      text = text.slice(text.indexOf('```json') + 7);
      if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
    } else if (text.includes('```')) {
      text = text.slice(text.indexOf('```') + 3);
      if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
    }
    text = text.trim();

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === 'string' && isOfficialCalendarSourceUrl(item))
          .map((s) => s.trim());
      }
    } catch {
      // Extract urls by regex if JSON parsing fails
      const matches = [...text.matchAll(/https:\/\/[a-zA-Z0-9\.\-_]+\.go\.id[^\s\"'<>]+/g)].map((m) => m[0]);
      return matches.filter(isOfficialCalendarSourceUrl);
    }
    return [];
  }

  /**
   * Plain Gemini extractor to extract dates from verified official content.
   */
  private async extractCandidateFromVerifiedSource(
    request: CalendarSearchRequest,
    level: CalendarSourceLevel,
    verifiedUrl: string,
    sourceText: string,
    modelAttempts: CalendarModelAttemptDiagnostic[]
  ): Promise<CalendarSourceCandidate> {
    const fallbackCandidate: CalendarSourceCandidate = {
      sourceLevel: level,
      province: level === 'NATIONAL' ? undefined : request.province,
      regency: level === 'REGENCY' ? request.regency : undefined,
      academicYear: request.academicYear.trim(),
      authority:
        level === 'REGENCY'
          ? `Dinas Pendidikan ${request.regency || ''}`
          : level === 'PROVINCE'
          ? `Dinas Pendidikan ${request.province || ''}`
          : 'Kementerian Pendidikan Dasar dan Menengah RI',
      documentTitle: `Kalender Pendidikan Tahun Ajaran ${request.academicYear}`,
      sourceUrl: verifiedUrl,
      verificationStatus: 'PARTIAL',
      retrievedAt: new Date().toISOString(),
    };

    if (!sourceText || sourceText.trim().length === 0) {
      return fallbackCandidate;
    }

    const prompt = buildPlainExtractionPrompt(request, level, verifiedUrl, sourceText);

    let rawOutput = '';
    if (this.customGeneratePlain) {
      try {
        const res = await this.customGeneratePlain(prompt, 'gemini-3.5-flash-lite');
        modelAttempts.push({ model: 'gemini-3.5-flash-lite', status: 'SUCCESS' });
        rawOutput = res.text || '';
      } catch (err) {
        modelAttempts.push({
          model: 'gemini-3.5-flash-lite',
          status: 'ERROR',
          errorCategory: sanitizeErrorCategory(err),
        });
        return fallbackCandidate;
      }
    } else {
      const ai = this.getAIClient();
      if (!ai) return fallbackCandidate;

      const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: prompt,
          });
          modelAttempts.push({ model, status: 'SUCCESS' });
          rawOutput = response.text || '';
          break;
        } catch (err) {
          modelAttempts.push({
            model,
            status: 'ERROR',
            errorCategory: sanitizeErrorCategory(err),
          });
          continue;
        }
      }
    }

    if (!rawOutput) return fallbackCandidate;

    let text = rawOutput.trim();
    if (text.includes('```json')) {
      text = text.slice(text.indexOf('```json') + 7);
      if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
    } else if (text.includes('```')) {
      text = text.slice(text.indexOf('```') + 3);
      if (text.includes('```')) text = text.slice(0, text.indexOf('```'));
    }
    text = text.trim();

    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object') {
        const item = parsed[0];
        return {
          sourceLevel: level,
          province: level === 'NATIONAL' ? undefined : (typeof item.province === 'string' && item.province.trim() ? item.province.trim() : request.province),
          regency: level === 'REGENCY' ? (typeof item.regency === 'string' && item.regency.trim() ? item.regency.trim() : request.regency) : undefined,
          academicYear: request.academicYear.trim(),
          authority: typeof item.authority === 'string' && item.authority.trim() ? item.authority.trim() : fallbackCandidate.authority,
          documentTitle: typeof item.documentTitle === 'string' && item.documentTitle.trim() ? item.documentTitle.trim() : fallbackCandidate.documentTitle,
          documentNumber: typeof item.documentNumber === 'string' && item.documentNumber.trim() ? item.documentNumber.trim() : undefined,
          sourceUrl: verifiedUrl, // Source of truth: verified HTTP URL, cannot be hallucinated
          publicationDate: sanitizeIsoDate(item.publicationDate),
          effectiveDate: sanitizeIsoDate(item.effectiveDate),
          semester1StartDate: sanitizeIsoDate(item.semester1StartDate),
          semester1EndDate: sanitizeIsoDate(item.semester1EndDate),
          semester2StartDate: sanitizeIsoDate(item.semester2StartDate),
          semester2EndDate: sanitizeIsoDate(item.semester2EndDate),
          semesterStartDate: sanitizeIsoDate(item.semesterStartDate || item.semester1StartDate),
          semesterEndDate: sanitizeIsoDate(item.semesterEndDate || item.semester2EndDate),
          verificationStatus: 'PARTIAL',
          retrievedAt: new Date().toISOString(),
        };
      }
    } catch {
      // Fall through to fallback candidate
    }

    return fallbackCandidate;
  }

  /**
   * Searches for calendar source candidates while recording granular runtime diagnostic metadata across resolution stages.
   */
  async searchWithDiagnostics(request: CalendarSearchRequest): Promise<CalendarSearchResultWithDiagnostics> {
    const isAiConfigured = Boolean(this.apiKey || this.customGeneratePlain || process.env.GEMINI_API_KEY);

    if (!request || !request.academicYear || request.academicYear.trim() === '') {
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

    const runStage = async (level: CalendarSourceLevel): Promise<boolean> => {
      const modelAttempts: CalendarModelAttemptDiagnostic[] = [];

      // 1. Collect candidate URLs from injected discoverer, deterministic patterns, and plain Gemini helper
      let candidateUrls: string[] = [];

      if (this.customDiscoverUrls) {
        try {
          const customUrls = await this.customDiscoverUrls(request, level);
          if (Array.isArray(customUrls)) {
            candidateUrls.push(...customUrls);
          }
        } catch {
          // ignore custom discovery errors
        }
      } else {
        // Pattern-based discovery
        candidateUrls.push(...generateDeterministicOfficialUrls(request, level));

        // Plain Gemini discovery helper (if configured)
        if (isAiConfigured) {
          const aiUrls = await this.discoverCandidateUrlsWithAI(request, level, modelAttempts);
          candidateUrls.push(...aiUrls);
        }
      }

      // Deduplicate and filter strict official .go.id
      const uniqueUrls = Array.from(new Set(candidateUrls.map((u) => u.trim()))).filter(isOfficialCalendarSourceUrl);
      const boundedUrls = uniqueUrls.slice(0, 8); // Max 8 candidate URLs per stage

      const rawCandidateCount = boundedUrls.length;
      let verifiedOfficialCount = 0;
      const stageCandidates: CalendarSourceCandidate[] = [];

      // 2. HTTP Fetch and verify each candidate
      for (const url of boundedUrls) {
        const fetched = await this.fetchSource(url);
        if (!fetched || !fetched.ok) {
          continue;
        }

        const relevance = verifySourceContentRelevance(fetched.text, fetched.finalUrl, request, level);
        if (!relevance.isValid) {
          continue;
        }

        verifiedOfficialCount++;

        // 3. Plain Gemini extraction (or metadata fallback for PDF)
        const candidate = await this.extractCandidateFromVerifiedSource(
          request,
          level,
          fetched.finalUrl,
          fetched.text,
          modelAttempts
        );

        stageCandidates.push(candidate);
        break; // Found verified and relevant official source for this geographic level!
      }

      const responseReceived = verifiedOfficialCount > 0 || modelAttempts.some((m) => m.status === 'SUCCESS');
      const textPresent = stageCandidates.length > 0;
      const acceptedCandidateCount = stageCandidates.length;

      const stageDiag: CalendarStageDiagnostic = {
        level,
        modelAttempts,
        responseReceived,
        textPresent,
        rawCandidateCount,
        groundingSourceCount: rawCandidateCount, // compatible alias for discovered sources
        resolvedGroundingCount: verifiedOfficialCount, // compatible alias for verified sources
        acceptedCandidateCount,
      };

      stages.push(stageDiag);

      if (stageCandidates.length > 0) {
        acceptedCandidates = stageCandidates;
        return true; // Short-circuit!
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
      stages.some((s) => s.modelAttempts.length > 0) &&
      stages.every((s) => s.modelAttempts.length > 0 && s.modelAttempts.every((m) => m.status === 'ERROR'));

    const totalRawCandidates = stages.reduce((acc, s) => acc + s.rawCandidateCount, 0);

    if (allModelAttemptsFailed && totalRawCandidates === 0) {
      reason = 'MODEL_FAILURE';
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

  async search(request: CalendarSearchRequest): Promise<CalendarSourceCandidate[]> {
    const result = await this.searchWithDiagnostics(request);
    return result.candidates;
  }
}
