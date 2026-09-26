/**
 * Pedagogical Rule-Based Engine & Fallback Generator for Kurikulum Merdeka
 * Used when GEMINI_API_KEY is not configured or when AI services are temporarily unreachable.
 */

export interface FallbackAnalyzeCPParams {
  cpText?: string;
  elements?: { name: string; content: string }[];
  subject?: string;
  grade?: string;
  phase?: string;
  curriculum?: string;
}

export function fallbackAnalyzeCP(params: FallbackAnalyzeCPParams) {
  const subject = params.subject || 'Mata Pelajaran';
  const grade = params.grade || 'Kelas 4';
  const phase = params.phase || 'Fase B';
  const rawText = (params.cpText || '') + ' ' + (params.elements?.map((e) => `${e.name}: ${e.content}`).join(' ') || '');

  // Extract action verbs and competencies
  const commonKKO = [
    'Memahami',
    'Mengidentifikasi',
    'Menganalisis',
    'Menerapkan',
    'Mengevaluasi',
    'Merancang',
    'Mempraktikkan',
    'Menyajikan',
    'Mengomunikasikan',
    'Menciptakan',
    'Menjelaskan',
    'Membandingkan',
  ];

  const matchedCompetencies = commonKKO.filter((kko) =>
    new RegExp(`\\b${kko}\\b`, 'i').test(rawText)
  );

  const finalCompetencies =
    matchedCompetencies.length >= 2
      ? matchedCompetencies.slice(0, 5)
      : ['Memahami konsep dasar', 'Menganalisis dan mengeksplorasi', 'Menerapkan dalam pemecahan masalah', 'Mengomunikasikan hasil pemikiran'];

  // Extract content topics
  const contentTokens = rawText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4 && !['peserta', 'didik', 'mampu', 'dapat', 'pada', 'fase', 'akhir', 'dalam', 'dengan', 'untuk'].includes(w.toLowerCase()));

  const uniqueTokens = Array.from(new Set(contentTokens)).slice(0, 6);
  const keyContents =
    uniqueTokens.length >= 2
      ? uniqueTokens.map((t) => `Konsep dan penerapan ${t}`)
      : [`Konsep esensial ${subject}`, `Keterampilan proses dan penalaran pada ${phase}`, `Aplikasi kontekstual dalam kehidupan sehari-hari`];

  return {
    summary: `Capaian Pembelajaran (CP) untuk ${subject} pada ${grade} (${phase}) menitikberatkan pada penguasaan kompetensi mendasar dan pemahaman konseptual yang bermakna. Peserta didik dibimbing untuk mengintegrasikan pemahaman teori dengan keterampilan praktis serta penalaran kritis sesuai karakteristik perkembangan peserta didik pada fase ini.`,
    keyCompetencies: finalCompetencies,
    keyContents: keyContents,
    p3Focus: ['Bernalar Kritis', 'Mandiri', 'Kreatif', 'Gotong Royong'],
    pedagogicalTips: [
      `Gunakan pendekatan pembelajaran kontekstual berbasis masalah (Problem-Based Learning) yang dekat dengan lingkungan peserta didik ${grade}.`,
      `Lakukan asesmen diagnostik di awal pembelajaran untuk memetakan kesiapan dan minat belajar peserta didik.`,
      `Integrasikan aktivitas kolaboratif berpasangan atau kelompok kecil untuk mengasah dimensi Gotong Royong dan Komunikasi.`,
    ],
  };
}

export interface FallbackGenerateTPParams {
  cpGeneral?: string;
  cpElements?: { name: string; content: string }[];
  subject?: string;
  grade?: string;
  phase?: string;
  curriculum?: string;
  count?: number;
}

export function fallbackGenerateTP(params: FallbackGenerateTPParams) {
  const subject = params.subject || 'Mata Pelajaran';
  const grade = params.grade || 'Kelas 4';
  const phase = params.phase || 'Fase B';
  const count = params.count || 4;

  const elements = params.cpElements && params.cpElements.length > 0
    ? params.cpElements
    : [{ name: 'Umum', content: params.cpGeneral || `Pemahaman dan Keterampilan Proses ${subject}` }];

  const tpItems: Array<{
    code: string;
    elementName: string;
    statement: string;
    competence: string;
    contentScope: string;
    p3Dimensions: string[];
  }> = [];

  const gradeNumber = grade.replace(/\D/g, '') || '4';
  let counter = 1;

  for (let i = 0; i < elements.length && tpItems.length < count; i++) {
    const elem = elements[i];
    const elemName = elem.name || `Elemen ${i + 1}`;
    const cleanContent = elem.content ? elem.content.slice(0, 80).trim() : `materi ${subject}`;

    // TP 1 for this element
    tpItems.push({
      code: `TP ${gradeNumber}.${counter++}`,
      elementName: elemName,
      statement: `Peserta didik mampu memahami dan menjelaskan konsep ${elemName.toLowerCase()} terkait ${cleanContent} secara tepat dan mandiri.`,
      competence: 'Memahami & Menjelaskan',
      contentScope: `Konsep Dasar ${elemName}`,
      p3Dimensions: ['Bernalar Kritis', 'Mandiri'],
    });

    if (tpItems.length < count) {
      // TP 2 for this element
      tpItems.push({
        code: `TP ${gradeNumber}.${counter++}`,
        elementName: elemName,
        statement: `Peserta didik mampu mengidentifikasi, menganalisis, dan menerapkan pengetahuan ${elemName.toLowerCase()} dalam pemecahan masalah kontekstual.`,
        competence: 'Menganalisis & Menerapkan',
        contentScope: `Aplikasi & Penerapan ${elemName}`,
        p3Dimensions: ['Bernalar Kritis', 'Kreatif'],
      });
    }

    if (tpItems.length < count) {
      // TP 3 for this element
      tpItems.push({
        code: `TP ${gradeNumber}.${counter++}`,
        elementName: elemName,
        statement: `Peserta didik mampu menyajikan hasil eksplorasi dan karya kolaboratif terkait ${cleanContent} dengan komunikatif dan bertanggung jawab.`,
        competence: 'Menyajikan & Mengomunikasikan',
        contentScope: `Eksplorasi & Presentasi Hasil Belajar`,
        p3Dimensions: ['Gotong Royong', 'Kreatif'],
      });
    }
  }

  // Ensure minimum count reached
  while (tpItems.length < count) {
    tpItems.push({
      code: `TP ${gradeNumber}.${counter++}`,
      elementName: 'Keterampilan Proses',
      statement: `Peserta didik mampu mengevaluasi dan merefleksikan proses pembelajaran ${subject} untuk perbaikan berkelanjutan.`,
      competence: 'Mengevaluasi & Merefleksi',
      contentScope: `Refleksi dan Evaluasi Hasil Belajar ${subject}`,
      p3Dimensions: ['Mandiri', 'Bernalar Kritis'],
    });
  }

  return tpItems.slice(0, count);
}

export interface FallbackGenerateATPParams {
  tps: Array<{
    id?: string;
    code: string;
    statement: string;
    elementName?: string;
    competence?: string;
    contentScope?: string;
    p3Dimensions?: string[];
  }>;
  cpGeneral?: string;
  subject?: string;
  grade?: string;
  phase?: string;
  semester?: string;
  academicYear?: string;
  totalHoursPerWeek?: number;
}

export function fallbackGenerateATP(params: FallbackGenerateATPParams) {
  const subject = params.subject || '';
  const grade = params.grade || '';
  const phase = params.phase || '';
  const tps = params.tps || [];

  const items = tps.map((tp, idx) => {
    const stepNum = idx + 1;
    const material = tp.contentScope || '';
    return {
      stepNumber: stepNum,
      tpId: tp.id || '',
      tpCode: tp.code || '',
      tpStatement: tp.statement || '',
      materialScope: material,
      allocatedJP: null,
      jp: null as any,
      p3Dimensions: tp.p3Dimensions && tp.p3Dimensions.length > 0 ? tp.p3Dimensions : [],
      assessmentPlan: '',
      glossary: '',
      resources: '',
    };
  });

  return {
    rationale: subject && grade
      ? `Alur Tujuan Pembelajaran (ATP) untuk ${subject} ${grade} (${phase}).`
      : 'Alur Tujuan Pembelajaran (ATP).',
    items,
  };
}

export function fallbackRefineText(text: string, instruction?: string, context?: string) {
  if (!text) return '';
  const trimmed = text.trim();
  // Capitalize sentence start and trim multiple spaces
  const clean = trimmed
    .replace(/\s+/g, ' ')
    .replace(/(^\w|\.\s+\w)/gm, (match) => match.toUpperCase());
  return clean;
}
