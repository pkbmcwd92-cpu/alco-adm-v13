import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import { OfficialEducationDataProvider } from './server/schoolProvider';
import { GroundedCalendarSearchProvider } from './server/calendarProvider';
import {
  selectBestCalendarSource,
  evaluateCalendarCandidate,
  CalendarSearchRequest,
} from './src/services/calendarProvider';
import {
  fallbackAnalyzeCP,
  fallbackRefineText,
} from './server/curriculumFallback';
import { validateGraduateProfileDimensions } from './src/constants/graduateProfileDimensions';

dotenv.config();

const app = express();
const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : NaN;
const PORT = (!isNaN(envPort) && envPort > 0) ? envPort : 3000;

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

const assessmentAICommonProperties = {
  coverageUnitId: {
    type: Type.STRING,
    description: 'ID coverage unit. Wajib sama persis dengan GenerationContract.',
  },
  assessmentIndicator: {
    type: Type.STRING,
  },
  materialOrContext: {
    type: Type.STRING,
  },
  rubricDraft: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      criteria: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            indicator: { type: Type.STRING },
            weight: { type: Type.NUMBER },
          },
          required: ['label'],
        },
      },
      scale: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            label: { type: Type.STRING },
            score: { type: Type.NUMBER },
            descriptor: { type: Type.STRING },
            order: { type: Type.NUMBER },
          },
          required: ['label'],
        },
      },
    },
  },
  scoringGuideDraft: {
    type: Type.OBJECT,
    properties: {
      instructions: { type: Type.STRING },
      maxScore: { type: Type.NUMBER },
    },
  },
};

const assessmentAIResponseSchema = {
  type: Type.ARRAY,
  items: {
    anyOf: [
      {
        type: Type.OBJECT,
        properties: {
          ...assessmentAICommonProperties,
          itemType: {
            type: Type.STRING,
            enum: [
              'MULTIPLE_CHOICE',
              'MULTIPLE_SELECT',
              'TRUE_FALSE',
              'SHORT_ANSWER',
              'ESSAY',
              'MATCHING',
              'CATEGORY_RESPONSE',
            ],
          },
          prompt: {
            type: Type.STRING,
          },
          stimulus: {
            type: Type.STRING,
          },
          stimulusSource: {
            type: Type.STRING,
          },
          options: {
            type: Type.ARRAY,
            minItems: 2,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                text: { type: Type.STRING },
                isCorrect: { type: Type.BOOLEAN },
              },
              required: ['text'],
            },
          },
          proposedAnswer: {
            type: Type.OBJECT,
            properties: {
              answerType: {
                type: Type.STRING,
                enum: [
                  'EXACT',
                  'OPTION',
                  'MULTIPLE_OPTION',
                  'EXPECTED_RESPONSE',
                  'MATCHING',
                  'CATEGORY_RESPONSE',
                ],
              },
              value: { type: Type.STRING },
              optionIndices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
              explanation: { type: Type.STRING },
            },
          },
        },
        required: ['coverageUnitId', 'itemType', 'prompt'],
      },

      {
        type: Type.OBJECT,
        properties: {
          ...assessmentAICommonProperties,
          taskTitle: {
            type: Type.STRING,
          },
          taskPrompt: {
            type: Type.STRING,
          },
          instructions: {
            type: Type.STRING,
          },
          expectedDeliverable: {
            type: Type.STRING,
          },
          aspects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                description: { type: Type.STRING },
                weight: { type: Type.NUMBER },
              },
              required: ['label'],
            },
          },
        },
        required: ['coverageUnitId', 'taskPrompt'],
      },

      {
        type: Type.OBJECT,
        properties: {
          ...assessmentAICommonProperties,
          instructions: {
            type: Type.STRING,
          },
          evidenceRequirements: {
            type: Type.ARRAY,
            minItems: 1,
            items: {
              type: Type.STRING,
            },
          },
        },
        required: [
          'coverageUnitId',
          'evidenceRequirements',
        ],
      },

      {
        type: Type.OBJECT,
        properties: {
          ...assessmentAICommonProperties,
          instructions: {
            type: Type.STRING,
          },
          recordingScheme: {
            type: Type.STRING,
          },
          aspects: {
            type: Type.ARRAY,
            minItems: 1,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                indicator: { type: Type.STRING },
              },
              required: ['label'],
            },
          },
        },
        required: [
          'coverageUnitId',
          'aspects',
        ],
      },
    ],
  },
};

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

// Grounded Calendar Online Resolution Endpoint
app.post('/api/calendar/resolve', async (req, res) => {
  const { academicYear, semester, province, regency } = req.body || {};

  // 1. Validation error -> HTTP 400
  if (!academicYear || typeof academicYear !== 'string' || academicYear.trim() === '') {
    return res.status(400).json({
      success: false,
      error: 'Tahun ajaran (academicYear) wajib diisi.',
    });
  }

  const semNum = Number(semester);
  if (semNum !== 1 && semNum !== 2) {
    return res.status(400).json({
      success: false,
      error: 'Semester wajib bernilai 1 atau 2.',
    });
  }

  const searchRequest: CalendarSearchRequest = {
    academicYear: academicYear.trim(),
    semester: semNum as 1 | 2,
    province: typeof province === 'string' && province.trim() ? province.trim() : undefined,
    regency: typeof regency === 'string' && regency.trim() ? regency.trim() : undefined,
  };

  try {
    const provider = new GroundedCalendarSearchProvider();
    const candidates = await provider.search(searchRequest);

    const selectedSource = selectBestCalendarSource(candidates, searchRequest);

    if (!selectedSource) {
      return res.json({
        success: true,
        resolution: {
          status: 'UNRESOLVED',
          selectedSource: undefined,
          candidates,
          resolvedLevel: undefined,
        },
      });
    }

    const status = evaluateCalendarCandidate(selectedSource);

    return res.json({
      success: true,
      resolution: {
        status,
        selectedSource,
        candidates,
        resolvedLevel: selectedSource.sourceLevel,
      },
    });
  } catch (error: unknown) {
    console.error('Error in /api/calendar/resolve:', error);
    const message = error instanceof Error ? error.message : 'Gagal memproses resolusi kalender pendidikan';
    return res.status(500).json({
      success: false,
      error: message,
      resolution: {
        status: 'UNRESOLVED',
        candidates: [],
      },
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

- Mata Pelajaran: ${subject || '-'}
- Jenjang & Kelas: ${grade || '-'} (${phase || '-'})
- Kurikulum: ${curriculum || '-'}
- CP Umum: ${cpText || '-'}
- Elemen CP: ${
        elements && elements.length > 0
          ? elements.map((e: { name: string; content: string }) => `[${e.name}]: ${e.content}`).join('\n')
          : 'Tidak ada rincian elemen terpisah'
      }

Berikan output dalam format JSON dengan struktur:
1. "summary": Ringkasan fokus utama CP dalam 1-2 paragraf bahasa Indonesia yang jelas, bernas, dan aplikatif bagi guru. Gunakan terminologi "Murid" (bukan peserta didik).
2. "keyCompetencies": Array string berisi daftar kompetensi utama/kata kerja operasional (KKO) yang ditargetkan pada fase ini.
3. "keyContents": Array string materi/konten inti esensial.
4. "p3Focus": Array string Dimensi Profil Lulusan yang paling relevan.
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

// Runtime validator for AI TP response
function validateAITPPayload(data: any): { isValid: boolean; reason?: string } {
  if (!Array.isArray(data)) {
    return { isValid: false, reason: 'Payload AI bukan berupa array' };
  }
  if (data.length === 0) {
    return { isValid: false, reason: 'Hasil perumusan AI TP kosong' };
  }
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    if (!item || typeof item !== 'object') {
      return { isValid: false, reason: `Butir TP ke-${i + 1} bukan berupa objek valid` };
    }
    const statement = item.statement || item.description;
    if (!statement || typeof statement !== 'string' || statement.trim() === '') {
      return { isValid: false, reason: `Rumusan TP ke-${i + 1} kosong atau tidak valid` };
    }
  }
  return { isValid: true };
}

// 2. Endpoint: AI Generate TP from CP
app.post('/api/ai/generate-tp', async (req, res) => {
  const { cpGeneral, cpElements, cpAnalysisItems, subject, grade, phase, curriculum, count = 4 } = req.body || {};

  if (!cpGeneral && (!cpElements || cpElements.length === 0)) {
    return res.status(400).json({ error: 'Capaian Pembelajaran (CP) harus diisi terlebih dahulu' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang).' });
  }

  try {
    const prompt = `Anda adalah ahli perancangan kurikulum pendidikan nasional Indonesia.
Tugas Anda adalah merumuskan Tujuan Pembelajaran (TP) yang diturunkan SECARA KETAT dan EKSPLISIT dari Capaian Pembelajaran (CP) dan Hasil Analisis CP yang diberikan di bawah ini.

PERINGATAN PENTING:
- TP HARUS mencakup Kompetensi (kemampuan/keterampilan) dan Lingkup Materi (konten esensial).
- Formula TP yang baik: "Murid mampu [Kompetensi/KKO] [Lingkup Materi] melalui [Konteks/Aktivitas/Kondisi] dengan [Kriteria/Tepat]."
- TP harus dapat diobservasi dan diukur (mengacu pada Taksonomi Bloom / Anderson atau Marzano).
- Jangan membuat TP yang menyimpang dari CP yang tersimpan.

DATA PEMBELAJARAN:
- Mata Pelajaran: ${subject || '-'}
- Tingkat: ${grade || '-'} (${phase || '-'})
- Kurikulum: ${curriculum || '-'}
- Deskripsi CP Umum: ${cpGeneral || '-'}
- Elemen-Elemen CP:
${
  cpElements && cpElements.length > 0
    ? cpElements.map((e: { name: string; content: string }, idx: number) => `${idx + 1}. [Elemen: ${e.name}]: ${e.content}`).join('\n')
    : 'Tidak ada rincian elemen.'
}
${
  cpAnalysisItems && Array.isArray(cpAnalysisItems) && cpAnalysisItems.length > 0
    ? `\nANALISIS CP (Rujukan Kompetensi & Materi):
${cpAnalysisItems.map((a: any, idx: number) => `${idx + 1}. [Elemen: ${a.elementName || '-'}] Kompetensi: ${a.cpCompetence || '-'} | Materi: ${a.materialScope || '-'} | Rekomendasi TP: ${a.suggestedTp || '-'}`).join('\n')}`
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
                description: 'Dimensi Profil Lulusan yang diasah (1-3 dimensi)',
              },
            },
            required: ['code', 'elementName', 'statement', 'competence', 'contentScope', 'p3Dimensions'],
          },
        },
      },
    });

    const parsed = cleanAndParseJSON(response.text, null);
    const validation = validateAITPPayload(parsed);

    if (!validation.isValid) {
      console.warn('Gemini generate TP output invalid:', validation.reason);
      return res.status(500).json({ error: `Respons AI tidak memenuhi kualifikasi struktur TP: ${validation.reason}` });
    }

    return res.json({ success: true, items: parsed, engine: 'gemini' });
  } catch (error: any) {
    console.error('Gemini generate TP failed:', error);
    return res.status(500).json({ error: `Gagal merumuskan AI TP: ${error.message || 'Respons provider AI tidak dapat diproses'}` });
  }
});

// 3. Endpoint: AI Generate ATP from TP
app.post('/api/ai/generate-atp', async (req, res) => {
  const { tps, cpGeneral, subject, grade, phase, semester, academicYear, curriculum, totalHoursPerWeek } = req.body || {};

  // 1. Validate TP array prerequisite
  if (!tps || !Array.isArray(tps) || tps.length === 0) {
    return res.status(400).json({ error: 'Daftar Tujuan Pembelajaran (TP) harus diisi dan tidak boleh kosong sebelum menyusun ATP.' });
  }

  // 2. Validate Academic Context Prerequisites
  if (!subject || typeof subject !== 'string' || subject.trim() === '') {
    return res.status(400).json({ error: 'Mata pelajaran harus diisi sebelum menyusun ATP.' });
  }

  if (!grade || typeof grade !== 'string' || grade.trim() === '') {
    return res.status(400).json({ error: 'Kelas/tingkat harus diisi sebelum menyusun ATP.' });
  }

  const isK13 = (curriculum && String(curriculum).toUpperCase().includes('K13')) || (curriculum && String(curriculum).toUpperCase().includes('2013'));
  if (!isK13) {
    if (!phase || typeof phase !== 'string' || phase.trim() === '') {
      return res.status(400).json({ error: 'Fase harus diisi untuk Kurikulum Merdeka sebelum menyusun ATP.' });
    }
  }

  if (!academicYear || typeof academicYear !== 'string' || academicYear.trim() === '') {
    return res.status(400).json({ error: 'Tahun ajaran/akademik harus diisi sebelum menyusun ATP.' });
  }

  if (!semester || typeof semester !== 'string' || semester.trim() === '') {
    return res.status(400).json({ error: 'Semester harus diisi sebelum menyusun ATP.' });
  }

  // 3. Validate totalHoursPerWeek if provided (No silent default, no fake JP assumption)
  let validatedWeeklyJP: number | undefined = undefined;
  if (totalHoursPerWeek !== undefined && totalHoursPerWeek !== null) {
    const isNumType = typeof totalHoursPerWeek === 'number';
    const isStringType = typeof totalHoursPerWeek === 'string';
    const parsed = isNumType
      ? totalHoursPerWeek
      : isStringType && totalHoursPerWeek.trim() !== ''
        ? Number(totalHoursPerWeek)
        : NaN;

    if (
      !Number.isFinite(parsed) ||
      isNaN(parsed) ||
      parsed <= 0 ||
      !Number.isInteger(parsed)
    ) {
      return res.status(400).json({
        error: 'Alokasi jam per minggu (totalHoursPerWeek) jika diisi harus berupa bilangan bulat positif yang valid (misal: 1, 2, 4, 5).',
      });
    }
    validatedWeeklyJP = parsed;
  }

  // 4. Check AI configuration (GEMINI_API_KEY)
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang).' });
  }

  try {
    const prompt = `Anda adalah spesialis penyusun Alur Tujuan Pembelajaran (ATP) dan perangkat pembelajaran Kurikulum Merdeka.
Susunlah Matriks Alur Tujuan Pembelajaran (ATP) yang berurutan secara logis, pedagogis, dan terstruktur dari daftar Tujuan Pembelajaran (TP) berikut:

DATA PEMBELAJARAN:
- Mata Pelajaran: ${subject || '-'}
- Kelas / Fase: ${grade || '-'} / ${phase || '-'}
- Tahun Ajaran / Semester: ${academicYear || '-'} / ${semester || '-'}
- Alokasi Jam per Minggu: ${validatedWeeklyJP !== undefined ? `${validatedWeeklyJP} JP` : 'Belum ditentukan'}
- Rujukan CP: ${cpGeneral || '-'}

DAFTAR TP YANG SUDAH DIBUAT:
${tps
  .map(
    (tp: { code: string; statement: string; competence?: string; contentScope?: string; p3Dimensions?: string[] }, idx: number) =>
      `${idx + 1}. [Kode: ${tp.code || '-'}] ${tp.statement} (Materi: ${tp.contentScope || '-'}, Kompetensi: ${
        tp.competence || '-'
      }, Dimensi Profil Lulusan: ${tp.p3Dimensions?.join(', ') || '-'})`
  )
  .join('\n')}

INSTRUKSI PENYUSUNAN ATP:
1. Urutkan TP secara logis (misal dari konkret ke abstrak, mudah ke sukar, atau hierarki keterampilan bahasa/sains/matematika).
${
  validatedWeeklyJP !== undefined
    ? `2. Tentukan Alokasi Waktu (JP) yang realistis dan proporsional untuk tiap langkah pembelajaran (total mingguan: ${validatedWeeklyJP} JP).`
    : `2. Alokasi Waktu (JP) per minggu BELUM DITENTUKAN. JANGAN mengarang alokasi JP atau menyimpulkan angka JP sendiri. Kosongkan alokasi JP untuk tiap langkah pembelajaran.`
}
3. Rincikan Rencana Asesmen (Asesmen Awal, Formatif, dan Sumatif Lingkup Materi).
4. Rincikan Glosarium / Kata Kunci penting.
5. Gunakan terminologi "Murid" (bukan peserta didik) dan "Dimensi Profil Lulusan".
6. Buat rasionalisasi alur pembelajaran secara komprehensif.

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
                  jp: {
                    type: Type.INTEGER,
                    description: validatedWeeklyJP !== undefined
                      ? 'Jumlah Alokasi Jam Pelajaran (JP), misal 4, 6, 8'
                      : 'Jangan diisi jika alokasi JP per minggu belum ditentukan',
                  },
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
                  ...(validatedWeeklyJP !== undefined ? ['jp'] : []),
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
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return res.status(500).json({ error: 'Respons AI tidak memenuhi kualifikasi struktur ATP: Respons bukan berupa objek valid' });
    }

    if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
      return res.status(500).json({ error: 'Respons AI tidak memenuhi kualifikasi struktur ATP: Hasil perumusan alur TP kosong atau bukan array' });
    }

    for (let i = 0; i < parsed.items.length; i++) {
      const item = parsed.items[i];
      if (!item || typeof item !== 'object') {
        return res.status(500).json({ error: `Respons AI tidak memenuhi kualifikasi struktur ATP: Butir langkah ATP ke-${i + 1} bukan berupa objek valid` });
      }
      const stmt = item.tpStatement || item.statement;
      if (!stmt || typeof stmt !== 'string' || stmt.trim() === '') {
        return res.status(500).json({ error: `Respons AI tidak memenuhi kualifikasi struktur ATP: Rumusan TP pada butir langkah ke-${i + 1} kosong atau tidak valid` });
      }

      if (validatedWeeklyJP === undefined) {
        // Enforce unresolved JP: do not leak synthetic or guessed numbers
        delete item.jp;
        delete item.allocatedJP;
      } else {
        // If JP was provided by caller, retain positive finite JP from AI
        if (typeof item.jp === 'number' && Number.isFinite(item.jp) && item.jp > 0) {
          item.allocatedJP = item.jp;
        } else {
          delete item.jp;
          delete item.allocatedJP;
        }
      }
    }

    return res.json({ success: true, data: parsed, engine: 'gemini' });
  } catch (error: any) {
    console.error('Gemini ATP generation failed:', error);
    return res.status(500).json({ error: `Gagal menyusun ATP dengan AI: ${error.message || 'Respons provider AI tidak dapat diproses'}` });
  }
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

// Safe phase normalization helper for learning plan
function normalizeExperiencePhase(phase: any): 'UNDERSTAND' | 'APPLY' | 'REFLECT' | null {
  if (typeof phase !== 'string') return null;
  const s = phase.trim().toUpperCase();
  if (s === 'UNDERSTAND' || s === 'MEMAHAMI') {
    return 'UNDERSTAND';
  }
  if (s === 'APPLY' || s === 'MENGAPLIKASI' || s === 'MENGAPLIKASIKAN') {
    return 'APPLY';
  }
  if (s === 'REFLECT' || s === 'MEREFLEKSI' || s === 'MEREFLEKSIKAN') {
    return 'REFLECT';
  }
  return null;
}

// Runtime validator for AI Learning Plan response
function validateAILearningPlanPayload(data: any): { isValid: boolean; reason?: string } {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { isValid: false, reason: 'Payload AI bukan berupa objek valid' };
  }

  // Print-readiness mandatory pedagogical fields for Kurikulum Merdeka
  if (typeof data.initialCompetency !== 'string' || data.initialCompetency.trim() === '') {
    return { isValid: false, reason: 'Kompetensi Awal (initialCompetency) kosong atau tidak valid' };
  }

  const dimVal = validateGraduateProfileDimensions(data.graduateProfileDimensions);
  if (!dimVal.isValid) {
    return { isValid: false, reason: dimVal.error || 'Dimensi Profil Lulusan (graduateProfileDimensions) kosong atau tidak valid' };
  }

  if (!Array.isArray(data.resources) || data.resources.filter((r: any) => r && typeof r === 'object' && ((typeof r.title === 'string' && r.title.trim().length > 0) || (typeof r.source === 'string' && r.source.trim().length > 0))).length === 0) {
    return { isValid: false, reason: 'Sarana dan prasarana / sumber belajar (resources) kosong atau tidak valid' };
  }

  if (typeof data.learningModel !== 'string' || data.learningModel.trim() === '') {
    return { isValid: false, reason: 'Model/praktik pembelajaran (learningModel) kosong atau tidak valid' };
  }

  if (!Array.isArray(data.learningExperiences) || data.learningExperiences.length === 0) {
    return { isValid: false, reason: 'Daftar Pengalaman Belajar (learningExperiences) kosong atau bukan array' };
  }

  const phaseSet = new Set<string>();
  for (let i = 0; i < data.learningExperiences.length; i++) {
    const exp = data.learningExperiences[i];
    if (!exp || typeof exp !== 'object') {
      return { isValid: false, reason: `Butir pengalaman belajar ke-${i + 1} bukan berupa objek` };
    }
    const normalizedPhase = normalizeExperiencePhase(exp.phase);
    if (!normalizedPhase) {
      return { isValid: false, reason: `Fase pengalaman belajar ke-${i + 1} ('${exp.phase}') tidak valid. Pilihan sah: UNDERSTAND, APPLY, REFLECT` };
    }
    exp.phase = normalizedPhase;
    phaseSet.add(normalizedPhase);

    if (!exp.description || typeof exp.description !== 'string' || exp.description.trim() === '') {
      return { isValid: false, reason: `Deskripsi pengalaman belajar ke-${i + 1} kosong` };
    }

    exp.id = `exp-ai-${i + 1}`;
  }

  for (const phase of ['UNDERSTAND', 'APPLY', 'REFLECT']) {
    if (!phaseSet.has(phase)) {
      return { isValid: false, reason: `Pengalaman Belajar wajib memuat fase ${phase}` };
    }
  }

  if (!data.assessmentPlan || typeof data.assessmentPlan !== 'object' || Array.isArray(data.assessmentPlan)) {
    return { isValid: false, reason: 'Rencana Asesmen (assessmentPlan) wajib berupa objek' };
  }

  const assessmentCount = ['initial', 'formative', 'summative'].reduce((sum, key) => {
    const items = Array.isArray(data.assessmentPlan[key]) ? data.assessmentPlan[key] : [];
    return sum + items.filter((item: any) => item && typeof item === 'object' && (
      typeof item.description === 'string' ||
      typeof item.technique === 'string' ||
      typeof item.method === 'string' ||
      typeof item.instrument === 'string'
    )).length;
  }, 0);
  if (assessmentCount === 0) {
    return { isValid: false, reason: 'Rencana Asesmen tidak memuat item pedagogis valid' };
  }

  if (data.triggerQuestions !== undefined && !Array.isArray(data.triggerQuestions)) {
    return { isValid: false, reason: 'Pertanyaan pemantik (triggerQuestions) harus berupa array' };
  }

  // Normalize arrays
  data.triggerQuestions = Array.isArray(data.triggerQuestions) ? data.triggerQuestions : [];
  data.resources = Array.isArray(data.resources) ? data.resources : [];
  data.graduateProfileDimensions = Array.isArray(data.graduateProfileDimensions) ? data.graduateProfileDimensions : [];
  if (data.reflection && typeof data.reflection === 'object') {
    data.reflection = {
      teacherReflection: typeof data.reflection.teacherReflection === 'string'
        ? data.reflection.teacherReflection
        : (typeof data.reflection.teacher === 'string' ? data.reflection.teacher : undefined),
      studentReflection: typeof data.reflection.studentReflection === 'string'
        ? data.reflection.studentReflection
        : (typeof data.reflection.student === 'string' ? data.reflection.student : undefined),
    };
  }
  delete data.allocatedJP;

  return { isValid: true };
}

// Endpoint: AI Generate Learning Plan (Modul Ajar DRAFT)
app.post('/api/ai/generate-learning-plan', async (req, res) => {
  const requestId = `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const { academicSetting, tps, atpItems, topic } = req.body || {};

  if (!tps || !Array.isArray(tps) || tps.length === 0) {
    return res.status(400).json({ error: 'Minimal satu Tujuan Pembelajaran (TP) diperlukan untuk menyusun Modul Ajar' });
  }

  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'Layanan AI belum dikonfigurasi (GEMINI_API_KEY tidak terpasang).' });
  }

  try {
    const subject = academicSetting?.subject || '';
    const grade = academicSetting?.grade || '';
    const phase = academicSetting?.phase || '';

    const atpContextStr = atpItems && atpItems.length > 0
      ? atpItems.map((a: any, i: number) => {
          const actualJp = typeof a.allocatedJP === 'number' && a.allocatedJP > 0
            ? a.allocatedJP
            : (typeof a.jp === 'number' && a.jp > 0 ? a.jp : null);
          const jpStr = actualJp ? `${actualJp} JP` : 'Belum ditentukan';
          return `${i + 1}. Langkah ${a.stepNumber || i + 1}: Lingkup ${a.materialScope || '-'} (${jpStr})`;
        }).join('\n')
      : 'ATP: Belum tersedia';

    const prompt = `Anda adalah spesialis penyusun Modul Ajar / RPP Berdiferensiasi Kurikulum Merdeka 2026 (Deep Learning & Kemendikdasmen).
Susun draf Modul Ajar pedagogis yang komprehensif berdasarkan data rujukan berikut:

MATA PELAJARAN: ${subject}
KELAS / FASE: ${grade} / ${phase}
TOPIK: ${topic || tps[0]?.contentScope || tps[0]?.statement || 'Topik Pembelajaran'}

TUJUAN PEMBELAJARAN (TP) RUJUKAN:
${tps.map((t: any, i: number) => `${i + 1}. [Kode: ${t.code || '-'}] ${t.statement} (Materi: ${t.contentScope || '-'}, Kompetensi: ${t.competence || '-'})`).join('\n')}

ATP / ALOKASI JP RUJUKAN:
${atpContextStr}

INSTRUKSI INFORMASI UMUM & PEDAGOGIS:
1. "initialCompetency" (Kompetensi Awal): Tuliskan kalimat prasyarat kompetensi awal yang diharapkan (misal: "Murid diharapkan telah mengenal..." atau "Prasyarat pembelajaran meliputi..."). Jangan mengklaim penguasaan murid tanpa asesmen nyata.
2. "graduateProfileDimensions": Pilih 2–4 dimensi profil lulusan yang paling relevan dari 8 dimensi kanonikal: "Keimanan dan Ketakwaan terhadap Tuhan Yang Maha Esa", "Kewargaan", "Penalaran Kritis", "Kreativitas", "Kolaborasi", "Kemandirian", "Kesehatan", "Komunikasi".
3. "resources": Susun daftar sarana, prasarana, atau sumber belajar yang diperlukan atau direncanakan sesuai mata pelajaran dan aktivitas nyata.
4. "learningModel": Tentukan model atau praktik pembelajaran kontekstual yang operasional (misal: "Pembelajaran kontekstual melalui demonstrasi, praktik terbimbing, kolaborasi, dan refleksi").

INSTRUKSI KEGIATAN & ASESMEN:
5. Susun Pengalaman Belajar (learningExperiences) dengan struktur 3 fase utama (UNDERSTAND, APPLY, REFLECT) sesuai panduan 2026. Nilai properti "phase" HARUS salah satu dari: "UNDERSTAND", "APPLY", atau "REFLECT".
6. Setiap Pengalaman Belajar memuat "description" yang jelas dan operasional, serta "durationMinutes" (dalam menit, opsional).
7. Gunakan terminologi "Murid" (bukan peserta didik) dan "Dimensi Profil Lulusan".
8. Sediakan Rencana Asesmen (Asesmen Diagnostik Awal, Formatif, dan Sumatif).
9. Sediakan Rencana Diferensiasi (Konten, Proses, Produk).
10. Buat kalimat pemahaman bermakna dan pertanyaan pemantik yang relevan.
11. JANGAN mengarang atau memalsukan Alokasi JP jika belum ditentukan.

Kembalikan output JSON sesuai schema.`;

    const response = await generateContentWithRetry({
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: [
            'learningExperiences',
            'initialCompetency',
            'graduateProfileDimensions',
            'resources',
            'learningModel',
          ],
          properties: {
            title: { type: Type.STRING },
            topic: { type: Type.STRING },
            initialCompetency: { type: Type.STRING, description: 'Kompetensi awal atau prasyarat pembelajaran' },
            graduateProfileDimensions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '2-4 Dimensi Profil Lulusan kanonikal yang relevan',
            },
            learningModel: { type: Type.STRING, description: 'Model atau praktik pembelajaran kontekstual' },
            resources: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                },
                required: ['title'],
              },
              description: 'Daftar sarana dan prasarana / sumber belajar',
            },
            meaningfulUnderstanding: { type: Type.STRING },
            triggerQuestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            learningExperiences: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  phase: { type: Type.STRING, description: 'MUST be UNDERSTAND, APPLY, or REFLECT' },
                  description: { type: Type.STRING },
                  durationMinutes: { type: Type.NUMBER },
                },
                required: ['phase', 'description'],
              },
            },
            deepLearningContext: {
              type: Type.OBJECT,
              properties: {
                principles: { type: Type.ARRAY, items: { type: Type.STRING } },
                graduateProfileDimensions: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
            learningSteps: {
              type: Type.OBJECT,
              properties: {
                opening: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepName: { type: Type.STRING },
                      description: { type: Type.STRING },
                      durationMinutes: { type: Type.NUMBER },
                    },
                  },
                },
                core: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepName: { type: Type.STRING },
                      description: { type: Type.STRING },
                      durationMinutes: { type: Type.NUMBER },
                    },
                  },
                },
                closing: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      stepName: { type: Type.STRING },
                      description: { type: Type.STRING },
                      durationMinutes: { type: Type.NUMBER },
                    },
                  },
                },
              },
            },
            assessmentPlan: {
              type: Type.OBJECT,
              properties: {
                initial: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      technique: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                  },
                },
                formative: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      technique: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                  },
                },
                summative: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      technique: { type: Type.STRING },
                      description: { type: Type.STRING },
                    },
                  },
                },
              },
            },
            differentiation: {
              type: Type.OBJECT,
              properties: {
                content: { type: Type.STRING },
                process: { type: Type.STRING },
                product: { type: Type.STRING },
              },
            },
            reflection: {
              type: Type.OBJECT,
              properties: {
                teacherReflection: { type: Type.STRING },
                studentReflection: { type: Type.STRING },
              },
            },
            enrichmentPlan: { type: Type.STRING },
            remedialPlan: { type: Type.STRING },
          },
        },
      },
    });

    const parsed = cleanAndParseJSON(response.text, null);
    const validation = validateAILearningPlanPayload(parsed);

    if (!validation.isValid) {
      console.warn(`[AI Service][learning-plan][${requestId}] Gemini output invalid:`, validation.reason);
      return res.status(500).json({ error: `Respons AI tidak memenuhi kualifikasi struktur Modul Ajar: ${validation.reason}` });
    }

    return res.json({ success: true, data: parsed, engine: 'gemini' });
  } catch (error: any) {
    console.error(`[AI Service][learning-plan][${requestId}] Gemini generate learning plan failed:`, error?.message || error);
    return res.status(500).json({ error: `Gagal menyusun Draf AI Modul Ajar: ${error.message || 'Respons provider AI tidak dapat diproses'}` });
  }
});

// 2. Endpoint: AI Assessment Package Generation (9C.4 / 9C.7)
app.post('/api/ai/generate-assessment-package', async (req, res) => {
  const { systemPrompt, userPrompt } = req.body || {};
  if (!userPrompt) {
    return res.status(400).json({ error: 'User prompt is required' });
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const response = await generateContentWithRetry({
        contents: userPrompt,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: 'application/json',
          responseSchema: assessmentAIResponseSchema,
        },
      });

      if (response.text) {
        return res.json({ success: true, rawText: response.text });
      }
    } catch (error: any) {
      console.error('Gemini generate assessment package failed:', error);
      return res.status(500).json({ error: error.message || 'Gagal generate perangkat asesmen via Gemini' });
    }
  }

  return res.status(501).json({ error: 'Kunci API Gemini belum dikonfigurasi di lingkungan server.' });
});

// 3. Endpoint: AI Assessment Target Granular Regeneration (9C.6 / 9C.7)
app.post('/api/ai/regenerate-assessment-target', async (req, res) => {
  const { contract } = req.body || {};
  if (!contract) {
    return res.status(400).json({ error: 'Contract is required' });
  }

  if (process.env.GEMINI_API_KEY) {
    try {
      const systemInstruction = `Anda adalah asisten AI kurikulum dan pembuat soal profesional di Indonesia.
Bantu guru melakukan regenerasi granular (pembaruan bertahap) secara aman untuk target: ${contract.target}.
Target ID: ${contract.targetId}.

Aturan utama:
- Tanggapi HANYA dengan objek JSON valid berisi rincian bidang yang diminta di editableContent.
- Kembalikan bidang yang berubah atau yang baru saja, pertahankan tipe data bidang aslinya.
- Jangan menambahkan penjelasan, markdown block (seperti \`\`\`json), atau teks pengantar lainnya. Tanggapi dengan format mentah JSON objek saja.`;

      const userPrompt = `Lakukan regenerasi target ${contract.target} untuk Target ID: ${contract.targetId}.

Konteks tidak berubah (Immutable Context):
${JSON.stringify(contract.immutableContext, null, 2)}

Materi & Kriteria:
- Kalibrasi Kelas: ${JSON.stringify(contract.gradeCalibration, null, 2)}
- Profil Subjek: ${JSON.stringify(contract.subjectProfile, null, 2)}

Temuan Validasi yang Perlu Diperbaiki (Validation Findings):
${JSON.stringify(contract.validationFindings, null, 2)}

Konten yang Dipertahankan (Preserved Content):
${JSON.stringify(contract.preservedContent, null, 2)}

Konten yang Boleh Diedit & Diminta Regenerasi (Editable/Requested Content):
${JSON.stringify(contract.editableContent, null, 2)}

Hasilkan pembaruan untuk editableContent tersebut dalam format JSON.`;

      const response = await generateContentWithRetry({
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
        },
      });

      if (response.text) {
        const cleanedText = response.text.trim();
        const parsed = cleanAndParseJSON(cleanedText, null);
        if (parsed) {
          return res.json({ success: true, data: parsed });
        } else {
          return res.status(500).json({ error: 'Gagal parse JSON hasil regenerasi AI' });
        }
      }
    } catch (error: any) {
      console.error('Gemini regenerate assessment target failed:', error);
      return res.status(500).json({ error: error.message || 'Gagal regenerasi granular via Gemini' });
    }
  }

  return res.status(501).json({ error: 'Kunci API Gemini belum dikonfigurasi di lingkungan server.' });
});

// Final /api 404 handler - must return JSON and never fall through to Vite static HTML fallback
app.all('/api/*', (req, res) => {
  res.status(404).json({
    error: 'Unknown API route',
    path: req.path
  });
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
