import { GoogleGenAI } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  CalendarDataProvider,
  CalendarSearchRequest,
  CalendarSourceCandidate,
  CalendarSourceLevel,
  CalendarSourceEvent,
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

const INDONESIAN_MONTHS: Record<number, string[]> = {
  1: ['januari', 'jan'],
  2: ['februari', 'feb'],
  3: ['maret', 'mar'],
  4: ['april', 'apr'],
  5: ['mei'],
  6: ['juni', 'jun'],
  7: ['juli', 'jul'],
  8: ['agustus', 'agt', 'agu'],
  9: ['september', 'sep'],
  10: ['oktober', 'okt'],
  11: ['november', 'nov'],
  12: ['desember', 'des'],
};

/**
 * Pure deterministic evidence checker.
 * Returns true only if the given ISO date (YYYY-MM-DD) is explicitly supported
 * by the supplied source text in standard Indonesian or numeric formats.
 */
export function isDateSupportedBySource(
  isoDate: string,
  sourceText: string
): boolean {
  if (!isoDate || !sourceText || typeof isoDate !== 'string' || typeof sourceText !== 'string') {
    return false;
  }

  const match = isoDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [_, yearStr, monthStr, dayStr] = match;
  const monthNum = parseInt(monthStr, 10);
  const dayNum = parseInt(dayStr, 10);
  if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) return false;

  const dayPadded = dayStr;
  const dayUnpadded = String(dayNum);
  const monthPadded = monthStr;
  const monthUnpadded = String(monthNum);

  const text = sourceText.toLowerCase();

  // 1. ISO format: 2026-07-13, 2026/07/13, 2026.07.13
  const isoPattern = new RegExp(`\\b${yearStr}[-/\\.]${monthPadded}[-/\\.]${dayPadded}\\b`, 'i');
  if (isoPattern.test(text)) return true;

  // 2. Numeric DD-MM-YYYY or D-M-YYYY: 13-07-2026, 13/07/2026, 13.07.2026, 13-7-2026, etc.
  const dmyNumericPattern = new RegExp(`\\b(?:${dayPadded}|${dayUnpadded})[-/\\.](?:${monthPadded}|${monthUnpadded})[-/\\.]${yearStr}\\b`, 'i');
  if (dmyNumericPattern.test(text)) return true;

  // 3. Indonesian textual month names: 13 Juli 2026, 13-juli-2026, 13 juli 2026, etc.
  const months = INDONESIAN_MONTHS[monthNum] || [];
  for (const mName of months) {
    const textPattern = new RegExp(`\\b(?:${dayPadded}|${dayUnpadded})[- ]+${mName}[- ]+${yearStr}\\b`, 'i');
    if (textPattern.test(text)) return true;
  }

  return false;
}

/**
 * Validates ISO date format and guarantees that deterministic evidence exists in sourceText.
 */
export function extractValidatedDate(
  rawDate: unknown,
  sourceText: string
): string | undefined {
  const sanitized = sanitizeIsoDate(rawDate);
  if (!sanitized) return undefined;
  if (!isDateSupportedBySource(sanitized, sourceText)) {
    return undefined;
  }
  return sanitized;
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

/**
 * Extracts plain text from a PDF ArrayBuffer or Uint8Array.
 * Safety: max chars bounded to maxChars (default 50,000).
 * Fail-closed: returns '' if extraction fails without crashing.
 */
export async function extractTextFromPdfBuffer(
  buffer: ArrayBuffer | Uint8Array,
  maxChars: number = 50000
): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer),
      useSystemFonts: true,
      disableFontFace: true,
    });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const textParts: string[] = [];
    let totalLength = 0;

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => (item && 'str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        textParts.push(pageText);
        totalLength += pageText.length;
        if (totalLength >= maxChars) {
          break;
        }
      }
    }

    return textParts.join('\n\n').slice(0, maxChars);
  } catch {
    return '';
  }
}

export interface FetchedSourceContent {
  ok: boolean;
  status: number;
  text: string;
  rawHtml?: string;
  finalUrl: string;
  contentType: string;
  isPdf: boolean;
}

export type SourceContentFetcher = (url: string) => Promise<FetchedSourceContent | null>;

/**
 * Default HTTP fetcher with timeout, size bound, redirect follow, HTTPS .go.id enforcement, and PDF text extraction.
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
      try {
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength > 10 * 1024 * 1024) {
          // Hard size limit: 10 MB, fail closed to metadata-only partial source
          return {
            ok: true,
            status: res.status,
            text: '',
            rawHtml: '',
            finalUrl,
            contentType: 'application/pdf',
            isPdf: true,
          };
        }

        const extractedText = await extractTextFromPdfBuffer(arrayBuffer, 50000);
        return {
          ok: true,
          status: res.status,
          text: extractedText,
          rawHtml: '',
          finalUrl,
          contentType: 'application/pdf',
          isPdf: true,
        };
      } catch {
        return {
          ok: true,
          status: res.status,
          text: '',
          rawHtml: '',
          finalUrl,
          contentType: 'application/pdf',
          isPdf: true,
        };
      }
    }

    const rawText = await res.text();
    const boundedText = rawText.slice(0, 524288);
    const cleanText = extractCleanTextFromHtml(boundedText);

    return {
      ok: true,
      status: res.status,
      text: cleanText,
      rawHtml: boundedText,
      finalUrl,
      contentType,
      isPdf: false,
    };
  } catch {
    return null;
  }
};

/**
 * Extracts and ranks official .go.id links from real HTML of an official seed page.
 * Bounded to crawl depth 1.
 */
export function extractOfficialLinksFromHtml(
  html: string,
  baseUrl: string,
  academicYear: string
): string[] {
  if (!html || !baseUrl || typeof html !== 'string') return [];

  const linkRegex = /<a\s+[^>]*href\s*=\s*(?:["']([^"']+)["']|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi;
  const scoredLinks: { url: string; score: number }[] = [];
  const seenUrls = new Set<string>();

  const yearClean = academicYear.trim();
  const yearVariants = [
    yearClean,
    yearClean.replace('/', '-'),
    yearClean.replace('/', '_'),
    yearClean.split('/')[0],
  ].filter(Boolean);

  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const rawHref = (match[1] || match[2] || '').trim();
    const anchorText = (match[3] || '').replace(/<[^>]+>/g, ' ').toLowerCase();

    if (
      !rawHref ||
      rawHref.startsWith('#') ||
      rawHref.startsWith('javascript:') ||
      rawHref.startsWith('mailto:') ||
      rawHref.startsWith('tel:')
    ) {
      continue;
    }

    let resolvedUrl: string;
    try {
      const parsed = new URL(rawHref, baseUrl);
      parsed.hash = '';
      resolvedUrl = parsed.toString();
    } catch {
      continue;
    }

    if (!isOfficialCalendarSourceUrl(resolvedUrl)) {
      continue;
    }

    if (seenUrls.has(resolvedUrl)) {
      continue;
    }
    seenUrls.add(resolvedUrl);

    // Scoring
    const combined = `${resolvedUrl} ${anchorText}`.toLowerCase();
    let score = 0;

    // Calendar keywords
    const calendarKeywords = [
      'kalender pendidikan',
      'kaldik',
      'kalender akademik',
      'pedoman kalender',
      'keputusan kalender',
      'tahun pelajaran',
      'tahun ajaran',
    ];

    for (const kw of calendarKeywords) {
      if (combined.includes(kw)) {
        score += 10;
      }
    }

    // Year boost
    for (const yv of yearVariants) {
      if (combined.includes(yv.toLowerCase())) {
        score += 5;
      }
    }

    if (score > 0) {
      scoredLinks.push({ url: resolvedUrl, score });
    }
  }

  scoredLinks.sort((a, b) => b.score - a.score);
  return scoredLinks.map((item) => item.url);
}

/**
 * Generates official seed root URLs for a given scope (max 6 seed roots).
 */
export function generateOfficialSeedRoots(
  request: CalendarSearchRequest,
  level: CalendarSourceLevel
): string[] {
  const seeds: string[] = [];

  if (level === 'REGENCY' && request.regency) {
    const raw = request.regency.toLowerCase().trim();
    const isKota = raw.startsWith('kota');
    const core = raw
      .replace(/^kabupaten\s+/i, '')
      .replace(/^kab\.\s*/i, '')
      .replace(/^kota\s+/i, '')
      .replace(/[^a-z0-9]/g, '');

    const domainSuffix = isKota ? `${core}kota.go.id` : `${core}kab.go.id`;
    seeds.push(
      `https://disdik.${domainSuffix}`,
      `https://dindik.${domainSuffix}`,
      `https://${domainSuffix}`,
      `https://jdih.${domainSuffix}`
    );
  } else if (level === 'PROVINCE' && request.province) {
    const rawProv = request.province.toLowerCase().trim();
    const coreProv = rawProv
      .replace(/^provinsi\s+/i, '')
      .replace(/^prov\.\s*/i, '')
      .replace(/[^a-z0-9]/g, '');

    const provDomain = `${coreProv}prov.go.id`;
    seeds.push(
      `https://disdik.${provDomain}`,
      `https://dindikbud.${provDomain}`,
      `https://${provDomain}`,
      `https://jdih.${provDomain}`
    );
  } else if (level === 'NATIONAL') {
    seeds.push(
      `https://kemendikdasmen.go.id`,
      `https://kemdikbud.go.id`,
      `https://jdih.kemdikbud.go.id`
    );
  }

  return seeds.filter(isOfficialCalendarSourceUrl).slice(0, 6);
}

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
      `https://${domainSuffix}/kalender-pendidikan-${reqYearSlug}`
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
      `https://disdik.${provDomain}/kaldik-${reqYearSlug}`
    );
  } else if (level === 'NATIONAL') {
    urls.push(
      `https://kemendikdasmen.go.id/pedoman-kalender-pendidikan-${reqYearSlug}`,
      `https://kemdikbud.go.id/kalender-pendidikan-${reqYearSlug}`
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
${sourceText.slice(0, 15000)}
"""

ATURAN KETAT:
1. EKSTRAK HANYA tanggal dan informasi yang secara eksplisit tertulis dalam teks dokumen di atas.
2. JANGAN MENGARANG atau menginferensi tanggal, batas semester, nomor SK, atau agenda/libur yang tidak tertulis.
3. Jika tanggal semester tidak tertulis di teks dokumen, isi dengan string kosong ("") atau null.
4. Format tanggal harus YYYY-MM-DD.
5. Untuk events (agenda/libur/asesmen/jeda semester), ekstrak hanya jika nama dan tanggal mulai ada secara eksplisit di teks dokumen.
   Kategori yang diizinkan: HOLIDAY, SEMESTER_BREAK, MID_SEMESTER_BREAK, ASSESSMENT, SCHOOL_EVENT, OTHER.

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
    "semester2EndDate": "YYYY-MM-DD",
    "events": [
      {
        "name": "Libur Semester Ganjil",
        "startDate": "YYYY-MM-DD",
        "endDate": "YYYY-MM-DD",
        "category": "SEMESTER_BREAK"
      }
    ]
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

        // Parse and validate structured events from AI against source text
        const rawEvents = Array.isArray(item.events) ? item.events : [];
        const validatedEvents: CalendarSourceEvent[] = [];

        const allowedCategories: CalendarSourceEvent['category'][] = [
          'HOLIDAY',
          'SEMESTER_BREAK',
          'MID_SEMESTER_BREAK',
          'ASSESSMENT',
          'SCHOOL_EVENT',
          'OTHER',
        ];

        for (const ev of rawEvents) {
          if (!ev || typeof ev !== 'object') continue;
          const name = typeof ev.name === 'string' ? ev.name.trim() : '';
          if (!name) continue;

          // Validate startDate against sourceText
          const validStart = extractValidatedDate(ev.startDate, sourceText);
          if (!validStart) {
            // If startDate is not supported by source text, discard the entire event
            continue;
          }

          // Validate endDate against sourceText if provided
          let validEnd: string | undefined = undefined;
          if (ev.endDate) {
            validEnd = extractValidatedDate(ev.endDate, sourceText);
          }

          let category: CalendarSourceEvent['category'] = 'OTHER';
          if (ev.category && typeof ev.category === 'string') {
            const upperCat = ev.category.toUpperCase().trim();
            if (allowedCategories.includes(upperCat as any)) {
              category = upperCat as CalendarSourceEvent['category'];
            }
          }

          validatedEvents.push({
            name,
            startDate: validStart,
            endDate: validEnd,
            category,
          });
        }

        return {
          sourceLevel: level,
          province: level === 'NATIONAL' ? undefined : (typeof item.province === 'string' && item.province.trim() ? item.province.trim() : request.province),
          regency: level === 'REGENCY' ? (typeof item.regency === 'string' && item.regency.trim() ? item.regency.trim() : request.regency) : undefined,
          academicYear: request.academicYear.trim(),
          authority: typeof item.authority === 'string' && item.authority.trim() ? item.authority.trim() : fallbackCandidate.authority,
          documentTitle: typeof item.documentTitle === 'string' && item.documentTitle.trim() ? item.documentTitle.trim() : fallbackCandidate.documentTitle,
          documentNumber: typeof item.documentNumber === 'string' && item.documentNumber.trim() ? item.documentNumber.trim() : undefined,
          sourceUrl: verifiedUrl, // Source of truth: verified HTTP URL, cannot be hallucinated
          publicationDate: extractValidatedDate(item.publicationDate, sourceText),
          effectiveDate: extractValidatedDate(item.effectiveDate, sourceText),
          semester1StartDate: extractValidatedDate(item.semester1StartDate, sourceText),
          semester1EndDate: extractValidatedDate(item.semester1EndDate, sourceText),
          semester2StartDate: extractValidatedDate(item.semester2StartDate, sourceText),
          semester2EndDate: extractValidatedDate(item.semester2EndDate, sourceText),
          semesterStartDate: extractValidatedDate(item.semesterStartDate || item.semester1StartDate, sourceText),
          semesterEndDate: extractValidatedDate(item.semesterEndDate || item.semester2EndDate, sourceText),
          events: validatedEvents.length > 0 ? validatedEvents : undefined,
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

      // 1. Collect candidate URLs from injected discoverer, seed HTML link discovery, deterministic patterns, and plain Gemini helper
      const discoveredCandidateUrls: string[] = [];
      const fallbackProbes: string[] = [];

      if (this.customDiscoverUrls) {
        try {
          const customUrls = await this.customDiscoverUrls(request, level);
          if (Array.isArray(customUrls)) {
            discoveredCandidateUrls.push(...customUrls);
          }
        } catch {
          // ignore custom discovery errors
        }
      } else {
        // A. Official seed roots (max 6)
        const seedRoots = generateOfficialSeedRoots(request, level);

        // B. Extract links from reachable real HTML seed pages (crawl depth 1)
        for (const seedUrl of seedRoots) {
          try {
            const fetchedSeed = await this.fetchSource(seedUrl);
            if (fetchedSeed && fetchedSeed.ok) {
              // If the seed page itself directly passes calendar relevance verification, it can be a candidate
              const seedRelevance = verifySourceContentRelevance(fetchedSeed.text, fetchedSeed.finalUrl, request, level);
              if (seedRelevance.isValid) {
                discoveredCandidateUrls.push(fetchedSeed.finalUrl);
              }

              // Extract and rank links from HTML
              const htmlContent = fetchedSeed.rawHtml || fetchedSeed.text;
              const extractedLinks = extractOfficialLinksFromHtml(htmlContent, fetchedSeed.finalUrl, request.academicYear);
              discoveredCandidateUrls.push(...extractedLinks);
            }
          } catch {
            // ignore seed fetch error
          }
        }

        // C. Deterministic candidate URLs as compatibility fallback
        if (discoveredCandidateUrls.length === 0) {
          fallbackProbes.push(...generateDeterministicOfficialUrls(request, level));
        }

        // D. Plain Gemini URL suggestions as final fallback (if needed)
        if (isAiConfigured && discoveredCandidateUrls.length === 0) {
          const aiUrls = await this.discoverCandidateUrlsWithAI(request, level, modelAttempts);
          discoveredCandidateUrls.push(...aiUrls);
        }
      }

      // Deduplicate and filter strict official .go.id
      const allUrlsToTest = Array.from(
        new Set([...discoveredCandidateUrls, ...fallbackProbes].map((u) => u.trim()))
      ).filter(isOfficialCalendarSourceUrl).slice(0, 8); // Max 8 candidate URLs per stage

      let rawCandidateCount = discoveredCandidateUrls.filter(isOfficialCalendarSourceUrl).length;
      let verifiedOfficialCount = 0;
      const stageCandidates: CalendarSourceCandidate[] = [];

      // 2. HTTP Fetch and verify each candidate
      for (const url of allUrlsToTest) {
        const fetched = await this.fetchSource(url);
        if (!fetched || !fetched.ok) {
          continue;
        }

        if (discoveredCandidateUrls.length === 0) {
          rawCandidateCount++;
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
