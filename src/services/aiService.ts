import { CPElem, TPItem, ATPItem, AcademicSetting, LearningPlan } from '../types';
import {
  normalizeLearningExperiencePhase,
  normalizeAIAssessmentPlan,
  normalizeAIReflection,
  normalizeDeepLearningContext,
  normalizeAIResources,
} from './learningPlanService';

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
  cpAnalysisItems?: any[];
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

    const contentType = res.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      const mime = contentType.split(';')[0]?.trim() || contentType || 'unknown';
      throw new Error(`Endpoint AI TP tidak mengembalikan JSON (received ${mime}). Pastikan aplikasi dijalankan melalui backend Express/API, bukan static/Vite preview. (Status ${res.status})`);
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menghasilkan TP dengan AI (Status ${res.status})`);
    }

    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error('Respons AI TP tidak valid: format data harus berupa objek.');
    }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Respons AI TP tidak valid: "items" harus berupa array dan tidak boleh kosong.');
    }
    for (let i = 0; i < data.items.length; i++) {
      const item = data.items[i];
      if (!item || typeof item !== 'object') {
        throw new Error(`Respons AI TP tidak valid: butir ke-${i + 1} bukan objek.`);
      }
      const stmt = item.statement || item.description;
      if (!stmt || typeof stmt !== 'string' || stmt.trim() === '') {
        throw new Error(`Respons AI TP tidak valid: butir ke-${i + 1} tidak memiliki statement/description yang sah.`);
      }
    }

    const rawItems = data.items;
    return rawItems.map((item: any, idx: number) => {
      const stmt = item.statement || item.description || '';
      return {
        id: `tp-item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        code: item.code || '',
        elementName: item.elementName || '',
        statement: stmt,
        description: stmt,
        competence: item.competence || '',
        contentScope: item.contentScope || '',
        p3Dimensions: Array.isArray(item.p3Dimensions) ? item.p3Dimensions : [],
        order: idx + 1,
        cpAnalysisItemIds: Array.isArray(item.cpAnalysisItemIds) ? item.cpAnalysisItemIds : [],
      };
    });
  } catch (err) {
    throw new Error(formatAIErrorMessage(err, 'merumuskan Tujuan Pembelajaran'));
  }
}

export interface GenerateLearningPlanParams {
  academicSetting: AcademicSetting;
  tps: TPItem[];
  atpItems?: ATPItem[];
  topic?: string;
}

export async function generateLearningPlanWithAI(params: GenerateLearningPlanParams): Promise<Partial<LearningPlan>> {
  try {
    const res = await fetch('/api/ai/generate-learning-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menyusun draf Modul Ajar AI (Status ${res.status})`);
    }

    const data = await res.json();
    if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
      throw new Error('Hasil respon AI Modul Ajar tidak berbentuk objek valid.');
    }

    // Runtime validation and normalization for critical structure
    if (typeof data.data.initialCompetency !== 'string' || data.data.initialCompetency.trim() === '') {
      throw new Error('Hasil respon AI Modul Ajar tidak memuat Kompetensi Awal (initialCompetency) yang valid.');
    }
    data.data.initialCompetency = data.data.initialCompetency.trim();

    const rawDimensions = Array.isArray(data.data.graduateProfileDimensions) ? data.data.graduateProfileDimensions : [];
    const validDimensions = rawDimensions.filter((d: any) => typeof d === 'string' && d.trim().length > 0).map((d: any) => d.trim());
    if (validDimensions.length === 0) {
      throw new Error('Hasil respon AI Modul Ajar tidak memuat Dimensi Profil Lulusan yang valid.');
    }
    data.data.graduateProfileDimensions = validDimensions;

    const normalizedResources = normalizeAIResources(data.data.resources);
    if (normalizedResources.length === 0) {
      throw new Error('Hasil respon AI Modul Ajar tidak memuat Sarana dan Prasarana / Sumber Belajar (resources) yang valid.');
    }
    data.data.resources = normalizedResources;

    if (typeof data.data.learningModel !== 'string' || data.data.learningModel.trim() === '') {
      throw new Error('Hasil respon AI Modul Ajar tidak memuat Model/Praktik Pembelajaran (learningModel) yang valid.');
    }
    data.data.learningModel = data.data.learningModel.trim();

    if (!Array.isArray(data.data.learningExperiences) || data.data.learningExperiences.length === 0) {
      throw new Error('Hasil respon AI Modul Ajar tidak memuat Pengalaman Belajar (learningExperiences).');
    }

    const phaseSet = new Set<string>();
    for (let i = 0; i < data.data.learningExperiences.length; i++) {
      const exp = data.data.learningExperiences[i];
      if (!exp || typeof exp !== 'object') {
        throw new Error(`Butir pengalaman belajar ke-${i + 1} tidak valid.`);
      }
      const normPhase = normalizeLearningExperiencePhase(exp.phase);
      if (!normPhase) {
        throw new Error(`Fase pengalaman belajar ke-${i + 1} ('${exp.phase}') tidak sah. Pilihan sah: UNDERSTAND, APPLY, REFLECT`);
      }
      exp.phase = normPhase;
      phaseSet.add(normPhase);
      if (!exp.description || typeof exp.description !== 'string' || exp.description.trim() === '') {
        throw new Error(`Deskripsi pengalaman belajar ke-${i + 1} kosong.`);
      }
      exp.id = `exp-ai-${i + 1}`;
    }
    for (const phase of ['UNDERSTAND', 'APPLY', 'REFLECT']) {
      if (!phaseSet.has(phase)) {
        throw new Error(`Hasil respon AI Modul Ajar belum memuat fase ${phase}.`);
      }
    }
    const normalizedAssessmentPlan = normalizeAIAssessmentPlan(data.data.assessmentPlan, params.tps.map((t) => t.id));
    const assessmentCount =
      normalizedAssessmentPlan.initial.length +
      normalizedAssessmentPlan.formative.length +
      normalizedAssessmentPlan.summative.length;
    if (assessmentCount === 0) {
      throw new Error('Hasil respon AI Modul Ajar tidak memuat Rencana Asesmen valid.');
    }
    data.data.assessmentPlan = normalizedAssessmentPlan;
    data.data.reflection = normalizeAIReflection(data.data.reflection);
    data.data.deepLearningContext = normalizeDeepLearningContext(data.data.deepLearningContext);
    delete data.data.allocatedJP;

    return data.data;
  } catch (err) {
    throw new Error(formatAIErrorMessage(err, 'menyusun Modul Ajar / RPP'));
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
    if (!data.data || !Array.isArray(data.data.items) || data.data.items.length === 0) {
      throw new Error('Hasil respon AI ATP tidak memuat butir alur yang valid.');
    }
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
