import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { OfficialEducationDataProvider } from './server/schoolProvider';
import {
  fallbackAnalyzeCP,
  fallbackGenerateTP,
  fallbackGenerateATP,
  fallbackRefineText,
} from './server/curriculumFallback';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini client to prevent crashes if key is missing on load
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Resilient generator helper with model fallbacks and exponential backoff retry for 503/429/temporary spikes
async function generateContentWithRetry(params: {
  contents: string;
  config?: any;
}): Promise<{ text?: string }> {
  // Standard non-paid models ordered by capability and availability
  const modelsToTry = [
    'gemini-3.8-flash',
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
  ];
  const ai = getAIClient();
  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });
        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || String(err)).toLowerCase();

        // If 404, model not found so don't retry same model, move to next model immediately
        if (errMsg.includes('404') || errMsg.includes('not found') || errMsg.includes('no longer available')) {
          break;
        }

        // For temporary 503 high demand or 429 rate limits, wait with brief backoff and try next attempt or fallback model
        if (errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('429') || errMsg.includes('unavailable')) {
          console.info(`[AI Service] Model ${model} returned temporary status (${attempt + 1}/2). Backing off...`);
          await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 400));
        } else {
          // For other errors, move to next fallback model
          break;
        }
      }
    }
  }

  const finalErrMsg = (lastError?.message || String(lastError)).toLowerCase();
  if (finalErrMsg.includes('503') || finalErrMsg.includes('high demand') || finalErrMsg.includes('unavailable')) {
    throw new Error('Layanan AI sedang mengalami lonjakan antrean trafik tinggi. Silakan klik tombol generate kembali dalam beberapa saat.');
  }
  throw lastError || new Error('Gagal memproses permintaan AI');
}

function cleanAndParseJSON(rawText?: string, fallback: any = {}): any {
  if (!rawText) return fallback;
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('Failed to parse JSON output from AI:', cleaned);
    return fallback;
  }
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// Official Education Reference School Search Endpoint
app.get('/api/schools/search', async (req, res) => {
  try {
    const query = typeof req.query.q === 'string' ? req.query.q : '';
    const result = await OfficialEducationDataProvider.search(query);
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Error searching schools:', error);
    const message = error instanceof Error ? error.message : 'Gagal menghubungi data referensi sekolah';
    res.status(500).json({
      success: false,
      found: false,
      candidates: [],
      message: 'Tidak dapat menghubungi sumber data sekolah saat ini.',
      error: message,
    });
  }
});

// Automatic Principal Resolution & Verification Endpoint
app.post('/api/schools/resolve-principal', async (req, res) => {
  try {
    const { name, npsn, district, regency, province } = req.body || {};
    const result = await OfficialEducationDataProvider.resolvePrincipal({
      name: name || '',
      npsn: npsn || '',
      district: district || '',
      regency: regency || '',
      province: province || '',
    });
    res.json({ success: true, ...result });
  } catch (error: unknown) {
    console.error('Error resolving principal:', error);
    const message = error instanceof Error ? error.message : 'Gagal memverifikasi kepala sekolah';
    res.status(500).json({
      success: false,
      found: false,
      verificationStatus: 'unverified',
      message: 'Gagal menghubungi layanan verifikasi kepala sekolah saat ini.',
      error: message,
    });
  }
});

// 1. Endpoint: AI Understanding & Breakdown of CP
app.post('/api/ai/analyze-cp', async (req, res) => {
  const { cpText, elements, subject, grade, phase, curriculum } = req.body || {};

  if (!cpText && (!elements || elements.length === 0)) {
    return res.status(400).json({ error: 'Data CP tidak boleh kosong' });
  }

  // If GEMINI_API_KEY is configured, try Gemini AI first
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Anda adalah pakar kurikulum dan konsultan pendidikan profesional di Indonesia.
Bantu seorang guru memahami, membedah, dan menganalisis Capaian Pembelajaran (CP) berikut:

- Mata Pelajaran: ${subject || 'Mata Pelajaran'}
- Jenjang & Kelas: ${grade || 'Kelas 4'} (${phase || 'Fase B'})
- Kurikulum: ${curriculum || 'Kurikulum Merdeka'}
- CP Umum: ${cpText || '-'}
- Elemen CP: ${
        elements && elements.length > 0
          ? elements.map((e: { name: string; content: string }) => `[${e.name}]: ${e.content}`).join('\n')
          : 'Tidak ada rincian elemen terpisah'
      }

Berikan output dalam format JSON dengan struktur:
1. "summary": Ringkasan fokus utama CP dalam 1-2 paragraf bahasa Indonesia yang jelas, bernas, dan aplikatif bagi guru.
2. "keyCompetencies": Array string berisi daftar kompetensi utama/kata kerja operasional (KKO) yang ditargetkan pada fase ini.
3. "keyContents": Array string materi/konten inti esensial.
4. "p3Focus": Array string dimensi Profil Pelajar Pancasila yang paling relevan.
5. "pedagogicalTips": Array string berisi 2-3 tips strategi pembelajaran kontekstual di kelas.`;

      const response = await generateContentWithRetry({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              keyCompetencies: { type: Type.ARRAY, items: { type: Type.STRING } },
              keyContents: { type: Type.ARRAY, items: { type: Type.STRING } },
              p3Focus: { type: Type.ARRAY, items: { type: Type.STRING } },
              pedagogicalTips: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['summary', 'keyCompetencies', 'keyContents', 'p3Focus', 'pedagogicalTips'],
          },
        },
      });

      const parsed = cleanAndParseJSON(response.text, null);
      if (parsed && parsed.summary) {
        return res.json({ success: true, data: parsed, engine: 'gemini' });
      }
    } catch (error: unknown) {
      console.warn('Gemini analysis failed or unconfigured, using pedagogical fallback engine:', error);
    }
  }

  // Pedagogical Rule Engine fallback
  const fallback = fallbackAnalyzeCP({ cpText, elements, subject, grade, phase, curriculum });
  res.json({ success: true, data: fallback, engine: 'pedagogical_engine' });
});

// 2. Endpoint: AI Generate TP from CP
app.post('/api/ai/generate-tp', async (req, res) => {
  const { cpGeneral, cpElements, cpAnalysis, subject, grade, phase, curriculum, count = 4 } = req.body || {};

  if (!cpGeneral && (!cpElements || cpElements.length === 0)) {
    return res.status(400).json({ error: 'Capaian Pembelajaran (CP) harus diisi terlebih dahulu' });
  }

  // If GEMINI_API_KEY is configured, try Gemini AI first
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Anda adalah ahli perancangan kurikulum pendidikan nasional Indonesia.
Tugas Anda adalah merumuskan Tujuan Pembelajaran (TP) yang diturunkan SECARA KETAT dan EKSPLISIT dari Capaian Pembelajaran (CP) dan Hasil Analisis CP yang diberikan di bawah ini.

PERINGATAN PENTING:
- TP HARUS mencakup Kompetensi (kemampuan/keterampilan) dan Lingkup Materi (konten esensial).
- Formula TP yang baik: "Peserta didik mampu [Kompetensi/KKO] [Lingkup Materi] melalui [Konteks/Aktivitas/Kondisi] dengan [Kriteria/Tepat]."
- TP harus dapat diobservasi dan diukur (mengacu pada Taksonomi Bloom / Anderson atau Marzano).
- Jangan membuat TP yang menyimpang dari CP yang tersimpan.

DATA PEMBELAJARAN:
- Mata Pelajaran: ${subject || 'Bahasa Indonesia'}
- Tingkat: ${grade || 'Kelas 4'} (${phase || 'Fase B'})
- Kurikulum: ${curriculum || 'Kurikulum Merdeka'}
- Deskripsi CP Umum: ${cpGeneral || '-'}
- Elemen-Elemen CP:
${
  cpElements && cpElements.length > 0
    ? cpElements.map((e: { name: string; content: string }, idx: number) => `${idx + 1}. [Elemen: ${e.name}]: ${e.content}`).join('\n')
    : 'Tidak ada rincian elemen.'
}
${
  cpAnalysis && Array.isArray(cpAnalysis) && cpAnalysis.length > 0
    ? `\nANALISIS CP (Rujukan Kompetensi & Materi):
${cpAnalysis.map((a: any, idx: number) => `${idx + 1}. [Elemen: ${a.elementName || '-'}] Kompetensi: ${a.cpCompetence || '-'} | Materi: ${a.materialScope || '-'} | Rekomendasi TP: ${a.suggestedTp || '-'}`).join('\n')}`
    : ''
}

Buatlah sekitar ${count} hingga 6 butir Tujuan Pembelajaran (TP) yang sistematis.
Kembalikan respon dalam format JSON sesuai schema:`;

      const response = await generateContentWithRetry({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                code: { type: Type.STRING, description: 'Kode TP misal TP 4.1, TP 4.2' },
                elementName: { type: Type.STRING, description: 'Nama Elemen CP yang menjadi rujukan' },
                statement: { type: Type.STRING, description: 'Rumusan kalimat Tujuan Pembelajaran lengkap' },
                competence: { type: Type.STRING, description: 'Kata Kerja Operasional / Kompetensi utama' },
                contentScope: { type: Type.STRING, description: 'Lingkup Materi / Topik Pembelajaran' },
                p3Dimensions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: 'Dimensi Profil Pelajar Pancasila yang diasah (1-3 dimensi)',
                },
              },
              required: ['code', 'elementName', 'statement', 'competence', 'contentScope', 'p3Dimensions'],
            },
          },
        },
      });

      const parsed = cleanAndParseJSON(response.text, null);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, items: parsed, engine: 'gemini' });
      }
    } catch (error: unknown) {
      console.warn('Gemini TP generation failed or unconfigured, using pedagogical fallback engine:', error);
    }
  }

  // Pedagogical Rule Engine fallback
  const fallbackItems = fallbackGenerateTP({ cpGeneral, cpElements, subject, grade, phase, curriculum, count });
  res.json({ success: true, items: fallbackItems, engine: 'pedagogical_engine' });
});

// 3. Endpoint: AI Generate ATP from TP
app.post('/api/ai/generate-atp', async (req, res) => {
  const { tps, cpGeneral, subject, grade, phase, semester, academicYear, totalHoursPerWeek = 5 } = req.body || {};

  if (!tps || !Array.isArray(tps) || tps.length === 0) {
    return res.status(400).json({ error: 'Daftar Tujuan Pembelajaran (TP) harus ada sebelum menyusun ATP' });
  }

  // If GEMINI_API_KEY is configured, try Gemini AI first
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Anda adalah spesialis penyusun Alur Tujuan Pembelajaran (ATP) dan perangkat pembelajaran Kurikulum Merdeka.
Susunlah Matriks Alur Tujuan Pembelajaran (ATP) yang berurutan secara logis, pedagogis, dan terstruktur dari daftar Tujuan Pembelajaran (TP) berikut:

DATA PEMBELAJARAN:
- Mata Pelajaran: ${subject || 'Bahasa Indonesia'}
- Kelas / Fase: ${grade || 'Kelas 4'} / ${phase || 'Fase B'}
- Tahun Ajaran / Semester: ${academicYear || '2025/2026'} / ${semester || '1 (Ganjil)'}
- Alokasi Jam per Minggu: ${totalHoursPerWeek} JP
- Rujukan CP: ${cpGeneral || 'Sesuai kurikulum nasional'}

DAFTAR TP YANG SUDAH DIBUAT:
${tps
  .map(
    (tp: { code: string; statement: string; competence?: string; contentScope?: string; p3Dimensions?: string[] }, idx: number) =>
      `${idx + 1}. [Kode: ${tp.code}] ${tp.statement} (Materi: ${tp.contentScope || '-'}, Kompetensi: ${
        tp.competence || '-'
      }, P3: ${tp.p3Dimensions?.join(', ') || '-'})`
  )
  .join('\n')}

INSTRUKSI PENYUSUNAN ATP:
1. Urutkan TP secara logis (misal dari konkret ke abstrak, mudah ke sukar, atau hierarki keterampilan bahasa/sains/matematika).
2. Tentukan Alokasi Waktu (JP) yang realistis untuk tiap langkah pembelajaran (total berkisar 20-36 JP per semester untuk mapel ini).
3. Rincikan Rencana Asesmen (Asesmen Awal, Formatif, dan Sumatif Lingkup Materi).
4. Rincikan Glosarium / Kata Kunci penting.
5. Buat rasionalisasi alur pembelajaran secara komprehensif.

Kembalikan output JSON sesuai schema:`;

      const response = await generateContentWithRetry({
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              rationale: {
                type: Type.STRING,
                description: 'Penjelasan rasional mengapa alur TP disusun dalam urutan ini.',
              },
              items: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER, description: 'Urutan alur pembelajaran (1, 2, 3...)' },
                    tpCode: { type: Type.STRING, description: 'Kode TP yang diurutkan' },
                    tpStatement: { type: Type.STRING, description: 'Rumusan TP' },
                    materialScope: { type: Type.STRING, description: 'Lingkup Materi / Topik Pembelajaran Spesifik' },
                    jp: { type: Type.INTEGER, description: 'Jumlah Alokasi Jam Pelajaran (JP), misal 4, 6, 8' },
                    p3Dimensions: { type: Type.ARRAY, items: { type: Type.STRING } },
                    assessmentPlan: { type: Type.STRING, description: 'Bentuk Asesmen Awal, Formatif, dan Sumatif' },
                    glossary: { type: Type.STRING, description: 'Kata kunci / Glosarium istilah penting' },
                    resources: { type: Type.STRING, description: 'Sumber belajar / Media yang disarankan' },
                  },
                  required: [
                    'stepNumber',
                    'tpCode',
                    'tpStatement',
                    'materialScope',
                    'jp',
                    'p3Dimensions',
                    'assessmentPlan',
                    'glossary',
                  ],
                },
              },
            },
            required: ['rationale', 'items'],
          },
        },
      });

      const parsed = cleanAndParseJSON(response.text, null);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return res.json({ success: true, data: parsed, engine: 'gemini' });
      }
    } catch (error: unknown) {
      console.warn('Gemini ATP generation failed or unconfigured, using pedagogical fallback engine:', error);
    }
  }

  // Pedagogical Rule Engine fallback
  const fallbackMatrix = fallbackGenerateATP({ tps, cpGeneral, subject, grade, phase, semester, academicYear, totalHoursPerWeek });
  res.json({ success: true, data: fallbackMatrix, engine: 'pedagogical_engine' });
});

// 4. Endpoint: AI Refine / Polish any custom text
app.post('/api/ai/refine-text', async (req, res) => {
  const { text, instruction, context } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'Teks tidak boleh kosong' });
  }

  // If GEMINI_API_KEY is configured, try Gemini AI first
  if (process.env.GEMINI_API_KEY) {
    try {
      const prompt = `Anda adalah asisten ahli administrasi guru Indonesia.
Teks asli: "${text}"
Konteks: ${context || 'Administrasi Kurikulum Merdeka'}
Instruksi perbaikan: ${instruction || 'Sempurnakan tata bahasa, ketepatan pedagogis, dan istilah Kurikulum Merdeka agar lebih formal, jelas, dan operasional.'}

Berikan versi teks hasil penyempurnaan dalam bahasa Indonesia yang baku dan elegan. Langsung berikan teks hasil tanpa pembuka/penutup.`;

      const response = await generateContentWithRetry({
        contents: prompt,
      });

      if (response.text && response.text.trim().length > 0) {
        return res.json({ success: true, refinedText: response.text.trim(), engine: 'gemini' });
      }
    } catch (error: unknown) {
      console.warn('Gemini refine text failed or unconfigured, using fallback:', error);
    }
  }

  const refined = fallbackRefineText(text, instruction, context);
  res.json({ success: true, refinedText: refined, engine: 'pedagogical_engine' });
});

// Vite middleware in dev or static files in prod
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Administrasi Guru AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
