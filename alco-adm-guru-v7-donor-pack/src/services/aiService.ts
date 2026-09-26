import { CPElem, TPItem, ATPItem } from '../types';

export interface CPAnalysisResult {
  summary: string;
  keyCompetencies: string[];
  keyContents: string[];
  p3Focus: string[];
  pedagogicalTips: string[];
}

export interface GenerateTPParams {
  cpGeneral: string;
  cpElements: CPElem[];
  cpAnalysis?: any[];
  subject: string;
  grade: string;
  phase: string;
  curriculum: string;
  count?: number;
}

export interface GenerateATPParams {
  tps: TPItem[];
  cpGeneral: string;
  subject: string;
  grade: string;
  phase: string;
  semester: string;
  academicYear: string;
  totalHoursPerWeek?: number;
}

export interface GenerateATPResult {
  rationale: string;
  items: Omit<ATPItem, 'id' | 'tpId'>[];
}

/**
 * Maps raw backend or fetch errors into a clear, user-friendly Indonesian explanation.
 */
export function formatAIErrorMessage(error: any, actionName: string = 'memproses permintaan'): string {
  if (!error) return `Terjadi kendala saat ${actionName}. Silakan coba lagi.`;
  const raw = (error.message || String(error)).toLowerCase();

  if (raw.includes('503') || raw.includes('high demand') || raw.includes('unavailable') || raw.includes('spikes in demand')) {
    return 'Layanan AI sedang mengalami lonjakan antrean trafik tinggi. Silakan klik tombol "Coba Lagi" dalam beberapa detik.';
  }
  if (raw.includes('429') || raw.includes('quota') || raw.includes('rate limit')) {
    return 'Batas kuota AI sementara tercapai. Mohon tunggu sebentar lalu coba kembali.';
  }
  if (raw.includes('failed to fetch') || raw.includes('network') || raw.includes('econnrefused')) {
    return 'Gagal terhubung ke server backend AI. Pastikan koneksi internet Anda aktif dan server berjalan.';
  }
  if (raw.includes('api key') || raw.includes('unauthorized') || raw.includes('401')) {
    return 'Kunci API Gemini belum dikonfigurasi di lingkungan server.';
  }
  if (raw.includes('timeout') || raw.includes('timed out')) {
    return 'Permintaan AI membutuhkan waktu terlalu lama. Silakan coba kembali dengan cakupan data yang lebih spesifik.';
  }

  return error.message || `Terjadi kesalahan saat ${actionName}. Silakan periksa kembali data Anda.`;
}

export async function analyzeCPWithAI(params: {
  cpText: string;
  elements: CPElem[];
  subject: string;
  grade: string;
  phase: string;
  curriculum: string;
}): Promise<CPAnalysisResult> {
  try {
    const res = await fetch('/api/ai/analyze-cp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menganalisis CP (Status ${res.status})`);
    }

    const data = await res.json();
    return data.data;
  } catch (err) {
    throw new Error(formatAIErrorMessage(err, 'menganalisis Capaian Pembelajaran'));
  }
}

export async function generateTPWithAI(params: GenerateTPParams): Promise<TPItem[]> {
  try {
    const res = await fetch('/api/ai/generate-tp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menghasilkan TP dengan AI (Status ${res.status})`);
    }

    const data = await res.json();
    const rawItems = data.items || [];
    return rawItems.map((item: any, idx: number) => ({
      id: `tp-ai-${Date.now()}-${idx}`,
      code: item.code || `TP ${idx + 1}`,
      elementName: item.elementName || 'Umum',
      statement: item.statement,
      competence: item.competence || 'Memahami',
      contentScope: item.contentScope || 'Materi Pokok',
      p3Dimensions: item.p3Dimensions || ['Bernalar Kritis'],
      order: idx + 1,
    }));
  } catch (err) {
    throw new Error(formatAIErrorMessage(err, 'merumuskan Tujuan Pembelajaran'));
  }
}

export async function generateATPWithAI(params: GenerateATPParams): Promise<GenerateATPResult> {
  try {
    const res = await fetch('/api/ai/generate-atp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menyusun ATP dengan AI (Status ${res.status})`);
    }

    const data = await res.json();
    return data.data;
  } catch (err) {
    throw new Error(formatAIErrorMessage(err, 'menyusun Alur Tujuan Pembelajaran'));
  }
}

export async function refineTextWithAI(params: {
  text: string;
  instruction?: string;
  context?: string;
}): Promise<string> {
  try {
    const res = await fetch('/api/ai/refine-text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Gagal menyempurnakan teks');
    }

    const data = await res.json();
    return data.refinedText;
  } catch (err) {
    throw new Error(formatAIErrorMessage(err, 'menyempurnakan kalimat'));
  }
}
