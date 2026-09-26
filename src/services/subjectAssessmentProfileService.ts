import {
  SubjectAssessmentProfile,
  SubjectCompetencyDomain,
  AssessmentEvidenceRecommendationRule,
  AssessmentGenerationRule,
  AssessmentEvidenceType,
  AssessmentInstrumentType,
} from '../types';
import { resolveSubjectInput } from '../data/curriculum/resolver';

const PROV_PEDAGOGICAL: AssessmentGenerationRule = {
  id: 'PROV-PEDAGOGICAL-STANDARD',
  sourceType: 'PEDAGOGICAL_RULE',
  description: 'Kaidah pedagogis perancangan bukti kompetensi dan ragam instrumen asesmen terstandar.',
};

// ==========================================
// 1. SPECIFIC PROFILE: PJOK
// ==========================================
function createPjokProfile(): SubjectAssessmentProfile {
  const competencyDomains: SubjectCompetencyDomain[] = [
    { id: 'MOTOR_SKILLS', name: 'Keterampilan Pola Gerak Dasar & Keterampilan Gerak Aktivitas Jasmani' },
    { id: 'MOVEMENT_KNOWLEDGE', name: 'Pengetahuan Prosedural, Konsep Gerak, & Aturan Permainan' },
    { id: 'TACTICS_STRATEGY', name: 'Penerapan Taktik, Strategi, & Pengambilan Keputusan dalam Aktivitas Jasmani' },
    { id: 'FITNESS_HEALTH', name: 'Aktivitas Kebugaran Jasmani, Pemeliharaan Kesehatan Diri, & Pola Hidup Sehat' },
  ];

  const supportedEvidenceTypes: AssessmentEvidenceType[] = [
    'PERFORMANCE',
    'OBSERVATION',
    'KNOWLEDGE_RESPONSE',
    'REASONING',
    'PORTFOLIO',
  ];

  const supportedInstrumentTypes: AssessmentInstrumentType[] = [
    'PERFORMANCE',
    'OBSERVATION',
    'WRITTEN_TEST',
    'ORAL_TEST',
    'PORTFOLIO',
    'SELF_ASSESSMENT',
  ];

  const recommendationRules: AssessmentEvidenceRecommendationRule[] = [
    {
      id: 'PJOK-MOTOR-SKILL',
      ruleDescription: 'Tujuan berfokus pada unjuk kerja gerak fisik/motorik (mempraktikkan, melakukan, memainkan, memeragakan gerak).',
      triggerKeywords: ['mempraktikkan', 'melakukan', 'memeragakan', 'bermain', 'senam', 'lari', 'melempar', 'menendang', 'menangkap', 'melompat', 'gerak dasar', 'lokomotor', 'nonlokomotor', 'manipulatif'],
      recommendedEvidenceTypes: ['PERFORMANCE', 'OBSERVATION'],
      recommendedInstrumentTypes: ['PERFORMANCE', 'OBSERVATION'],
      rationaleCode: 'PJOK_PSYCHOMOTOR_EVIDENCE',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'PJOK-KNOWLEDGE-RULES',
      ruleDescription: 'Tujuan berfokus pada pengetahuan aturan, konsep gerak, atau prosedur keselamatan.',
      triggerKeywords: ['menjelaskan', 'menyebutkan', 'memahami aturan', 'menganalisis peraturan', 'mengetahui konsep', 'mengidentifikasi prosedur', 'konsep gerak'],
      recommendedEvidenceTypes: ['KNOWLEDGE_RESPONSE', 'REASONING'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ORAL_TEST'],
      rationaleCode: 'PJOK_COGNITIVE_EVIDENCE',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'PJOK-STRATEGY-DECISION',
      ruleDescription: 'Tujuan berfokus pada taktik bermain, strategi regu, atau penalaran situasi permainan.',
      triggerKeywords: ['strategi', 'taktik', 'pengambilan keputusan', 'mengevaluasi strategi', 'pola penyerangan', 'pola pertahanan'],
      recommendedEvidenceTypes: ['REASONING', 'PERFORMANCE'],
      recommendedInstrumentTypes: ['PERFORMANCE', 'WRITTEN_TEST', 'ORAL_TEST'],
      rationaleCode: 'PJOK_STRATEGIC_REASONING',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'PJOK-FITNESS-HEALTH',
      ruleDescription: 'Tujuan berfokus pada kebugaran jasmani, kebersihan, gizi, dan kebiasaan pola hidup sehat.',
      triggerKeywords: ['kebugaran', 'kesehatan diri', 'pola hidup sehat', 'kebersihan diri', 'gizi', 'makanan sehat', 'daya tahan', 'kelenturan'],
      recommendedEvidenceTypes: ['PERFORMANCE', 'OBSERVATION', 'PORTFOLIO'],
      recommendedInstrumentTypes: ['PERFORMANCE', 'PORTFOLIO', 'SELF_ASSESSMENT'],
      rationaleCode: 'PJOK_HEALTH_HABIT_EVIDENCE',
      provenance: PROV_PEDAGOGICAL,
    },
  ];

  return {
    subjectKey: 'PJOK',
    subjectLabel: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    competencyDomains,
    supportedEvidenceTypes,
    supportedInstrumentTypes,
    recommendationRules,
    provenance: [PROV_PEDAGOGICAL],
    profileStatus: 'SPECIFIC',
  };
}

// ==========================================
// 2. SPECIFIC PROFILE: BAHASA INDONESIA
// ==========================================
function createBahasaIndonesiaProfile(): SubjectAssessmentProfile {
  const competencyDomains: SubjectCompetencyDomain[] = [
    { id: 'MEMBACA_MEMIRSA', name: 'Membaca dan Memirsa (Teks Sastra, Informasi, Visual)' },
    { id: 'MENULIS', name: 'Menulis (Menyusun Teks, Karangan, Puisi, Laporan, Refleksi)' },
    { id: 'BERBICARA_MEMPRESENTASIKAN', name: 'Berbicara dan Mempresentasikan (Lisan, Pidato, Diskusi)' },
    { id: 'MENYIMAK', name: 'Menyimak (Memahami Pesan Lisan, Audio, Arahan)' },
  ];

  const supportedEvidenceTypes: AssessmentEvidenceType[] = [
    'KNOWLEDGE_RESPONSE',
    'REASONING',
    'PRODUCT',
    'ORAL_RESPONSE',
    'PERFORMANCE',
  ];

  const supportedInstrumentTypes: AssessmentInstrumentType[] = [
    'WRITTEN_TEST',
    'ORAL_TEST',
    'PRODUCT',
    'PERFORMANCE',
    'ASSIGNMENT',
  ];

  const recommendationRules: AssessmentEvidenceRecommendationRule[] = [
    {
      id: 'BINDO-MEMBACA-MEMIRSA',
      ruleDescription: 'Tujuan berfokus pada pemahaman bacaan, interpretasi teks, dan informasi tersurat/tersirat.',
      triggerKeywords: ['membaca', 'memirsa', 'menemukan informasi', 'pesan tersirat', 'makna kata', 'ide pokok', 'interpretasi', 'menyimpulkan isi'],
      recommendedEvidenceTypes: ['KNOWLEDGE_RESPONSE', 'REASONING'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ASSIGNMENT'],
      rationaleCode: 'BINDO_READING_COMPREHENSION',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'BINDO-MENULIS',
      ruleDescription: 'Tujuan berfokus pada produksi karya tulis, penyusunan paragraf, atau pembuatan teks.',
      triggerKeywords: ['menulis', 'menyusun teks', 'membuat karangan', 'menulis puisi', 'menulis surat', 'membuat laporan', 'menyunting'],
      recommendedEvidenceTypes: ['PRODUCT', 'PERFORMANCE'],
      recommendedInstrumentTypes: ['PRODUCT', 'ASSIGNMENT', 'WRITTEN_TEST'],
      rationaleCode: 'BINDO_WRITING_PRODUCT',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'BINDO-BERBICARA-MEMPRESENTASIKAN',
      ruleDescription: 'Tujuan berfokus pada penyampaian gagasan secara lisan, presentasi, atau interaksi tutur.',
      triggerKeywords: ['berbicara', 'menceritakan kembali', 'mempresentasikan', 'berpidato', 'berdialog', 'menyampaikan pendapat secara lisan'],
      recommendedEvidenceTypes: ['ORAL_RESPONSE', 'PERFORMANCE'],
      recommendedInstrumentTypes: ['ORAL_TEST', 'PERFORMANCE'],
      rationaleCode: 'BINDO_ORAL_COMMUNICATION',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'BINDO-MENYIMAK',
      ruleDescription: 'Tujuan berfokus pada mendengarkan rekaman/tuturan lisan dan merespons pesan instruksi.',
      triggerKeywords: ['menyimak', 'mendengarkan instruksi', 'menangkap pesan lisan', 'mengidentifikasi tuturan'],
      recommendedEvidenceTypes: ['ORAL_RESPONSE', 'KNOWLEDGE_RESPONSE'],
      recommendedInstrumentTypes: ['ORAL_TEST', 'WRITTEN_TEST', 'OBSERVATION'],
      rationaleCode: 'BINDO_LISTENING_COMPREHENSION',
      provenance: PROV_PEDAGOGICAL,
    },
  ];

  return {
    subjectKey: 'BINDO',
    subjectLabel: 'Bahasa Indonesia',
    competencyDomains,
    supportedEvidenceTypes,
    supportedInstrumentTypes,
    recommendationRules,
    provenance: [PROV_PEDAGOGICAL],
    profileStatus: 'SPECIFIC',
  };
}

// ==========================================
// 3. SPECIFIC PROFILE: MATEMATIKA
// ==========================================
function createMatematikaProfile(): SubjectAssessmentProfile {
  const competencyDomains: SubjectCompetencyDomain[] = [
    { id: 'CONCEPTUAL_UNDERSTANDING', name: 'Pemahaman Konsep Bilangan, Aljabar, Geometri, Pengukuran' },
    { id: 'PROCEDURAL_FLUENCY', name: 'Kecakapan Prosedural & Algoritma Operasi Hitung' },
    { id: 'PROBLEM_SOLVING', name: 'Pemecahan Masalah Matematis Kontekstual & Non-Rutin' },
    { id: 'MATHEMATICAL_REASONING', name: 'Penalaran, Pembuktian, & Justifikasi Matematis' },
    { id: 'DATA_REPRESENTATION', name: 'Penyajian, Interpretasi Data, & Peluang' },
  ];

  const supportedEvidenceTypes: AssessmentEvidenceType[] = [
    'KNOWLEDGE_RESPONSE',
    'REASONING',
    'PRODUCT',
  ];

  const supportedInstrumentTypes: AssessmentInstrumentType[] = [
    'WRITTEN_TEST',
    'ORAL_TEST',
    'ASSIGNMENT',
    'PROJECT',
  ];

  const recommendationRules: AssessmentEvidenceRecommendationRule[] = [
    {
      id: 'MAT-CONCEPTUAL',
      ruleDescription: 'Tujuan berfokus pada pemahaman definisi konsep, notasi, dan sifat-sifat matematis.',
      triggerKeywords: ['memahami konsep', 'mengenal', 'mengidentifikasi sifat', 'nilai tempat', 'pecahan', 'sudut', 'bangun datar', 'bangun ruang'],
      recommendedEvidenceTypes: ['KNOWLEDGE_RESPONSE', 'REASONING'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ORAL_TEST'],
      rationaleCode: 'MAT_CONCEPTUAL_UNDERSTANDING',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'MAT-PROCEDURAL',
      ruleDescription: 'Tujuan berfokus pada kecakapan komputasi dan langkah-langkah prosedural hitung.',
      triggerKeywords: ['menghitung', 'menjumlahkan', 'mengurangkan', 'mengalikan', 'membagi', 'operasi hitung', 'mengukur', 'menyelesaikan persamaan'],
      recommendedEvidenceTypes: ['KNOWLEDGE_RESPONSE', 'PRODUCT'],
      recommendedInstrumentTypes: ['WRITTEN_TEST'],
      rationaleCode: 'MAT_PROCEDURAL_CALCULATION',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'MAT-REASONING',
      ruleDescription: 'Tujuan berfokus pada pembuktian, argumentasi matematis, dan penalaran inferensial.',
      triggerKeywords: ['menjelaskan alasan', 'membuktikan', 'menjustifikasi', 'menalar', 'menguji dugaan', 'memvalidasi kesimpulan'],
      recommendedEvidenceTypes: ['REASONING'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ORAL_TEST', 'ASSIGNMENT'],
      rationaleCode: 'MAT_REASONING_AND_PROOF',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'MAT-PROBLEM-SOLVING',
      ruleDescription: 'Tujuan berfokus pada pemodelan dan pemecahan masalah soal cerita/kontekstual.',
      triggerKeywords: ['memecahkan masalah', 'soal cerita', 'masalah kontekstual', 'memodelkan matematika', 'situasi nyata'],
      recommendedEvidenceTypes: ['REASONING', 'PRODUCT'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ASSIGNMENT', 'PROJECT'],
      rationaleCode: 'MAT_PROBLEM_SOLVING',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'MAT-DATA-REPRESENTATION',
      ruleDescription: 'Tujuan berfokus pada penyajian data, pembacaan grafik/diagram, dan statistika dasar.',
      triggerKeywords: ['menyajikan data', 'diagram batang', 'diagram lingkaran', 'tabel frekuensi', 'membaca grafik', 'mean', 'median', 'modus'],
      recommendedEvidenceTypes: ['REASONING', 'PRODUCT'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'PROJECT', 'ASSIGNMENT'],
      rationaleCode: 'MAT_DATA_ANALYSIS',
      provenance: PROV_PEDAGOGICAL,
    },
  ];

  return {
    subjectKey: 'MAT',
    subjectLabel: 'Matematika',
    competencyDomains,
    supportedEvidenceTypes,
    supportedInstrumentTypes,
    recommendationRules,
    provenance: [PROV_PEDAGOGICAL],
    profileStatus: 'SPECIFIC',
  };
}

// ==========================================
// 4. SPECIFIC PROFILE: IPA / IPAS
// ==========================================
function createIpaIpasProfile(subjectKey: 'IPAS' | 'IPA'): SubjectAssessmentProfile {
  const label = subjectKey === 'IPAS'
    ? 'Ilmu Pengetahuan Alam dan Sosial (IPAS)'
    : 'Ilmu Pengetahuan Alam (IPA)';

  const competencyDomains: SubjectCompetencyDomain[] = [
    { id: 'NATURAL_PHENOMENA', name: 'Pemahaman Konsep & Fenomena Alam/Sosial' },
    { id: 'SCIENTIFIC_INQUIRY', name: 'Keterampilan Proses, Inkuiri, & Percobaan Ilmiah' },
    { id: 'CAUSAL_PREDICTION', name: 'Analisis Sebab-Akibat, Causal Explanation, & Prediksi Ilmiah' },
    { id: 'DATA_INTERPRETATION', name: 'Interpretasi Bukti, Data Eksperimen, & Penarikan Kesimpulan' },
  ];

  const supportedEvidenceTypes: AssessmentEvidenceType[] = [
    'REASONING',
    'OBSERVATION',
    'PERFORMANCE',
    'PRODUCT',
    'KNOWLEDGE_RESPONSE',
  ];

  const supportedInstrumentTypes: AssessmentInstrumentType[] = [
    'WRITTEN_TEST',
    'PERFORMANCE',
    'OBSERVATION',
    'PROJECT',
    'ASSIGNMENT',
  ];

  const recommendationRules: AssessmentEvidenceRecommendationRule[] = [
    {
      id: 'SCIENCE-INQUIRY',
      ruleDescription: 'Tujuan berfokus pada investigasi, percobaan langsung, atau perancangan eksperimen.',
      triggerKeywords: ['menginvestigasi', 'melakukan percobaan', 'bereksperimen', 'menyelidiki', 'menguji hipotesis', 'merancang percobaan'],
      recommendedEvidenceTypes: ['PERFORMANCE', 'OBSERVATION', 'PRODUCT'],
      recommendedInstrumentTypes: ['PERFORMANCE', 'OBSERVATION', 'PROJECT'],
      rationaleCode: 'SCIENCE_INQUIRY_PRACTICE',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'SCIENCE-CAUSAL-PREDICTION',
      ruleDescription: 'Tujuan berfokus pada penjelasan hubungan sebab-akibat atau memprediksi fenomena sains.',
      triggerKeywords: ['menjelaskan hubungan', 'sebab akibat', 'mengapa terjadi', 'siklus air', 'fotosintesis', 'memprediksi dampak', 'perubahan wujud'],
      recommendedEvidenceTypes: ['REASONING', 'KNOWLEDGE_RESPONSE'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ORAL_TEST'],
      rationaleCode: 'SCIENCE_CAUSAL_REASONING',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'SCIENCE-DATA-INTERPRETATION',
      ruleDescription: 'Tujuan berfokus pada interpretasi hasil pengukuran, grafik pertumbuhan, atau bukti pengamatan.',
      triggerKeywords: ['menginterpretasi data', 'menganalisis hasil pengamatan', 'menyimpulkan data percobaan', 'grafik pertumbuhan'],
      recommendedEvidenceTypes: ['REASONING', 'PRODUCT'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ASSIGNMENT'],
      rationaleCode: 'SCIENCE_DATA_INTERPRETATION',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'SCIENCE-PHENOMENON-OBSERVATION',
      ruleDescription: 'Tujuan berfokus pada observasi bagian tubuh makhluk hidup atau ekosistem sekitar.',
      triggerKeywords: ['mengamati', 'mengidentifikasi bagian tubuh', 'ekosistem', 'lingkungan sekitar', 'keanekaragaman hayati'],
      recommendedEvidenceTypes: ['OBSERVATION', 'REASONING'],
      recommendedInstrumentTypes: ['OBSERVATION', 'PERFORMANCE', 'WRITTEN_TEST'],
      rationaleCode: 'SCIENCE_OBSERVATIONAL_EVIDENCE',
      provenance: PROV_PEDAGOGICAL,
    },
  ];

  return {
    subjectKey,
    subjectLabel: label,
    competencyDomains,
    supportedEvidenceTypes,
    supportedInstrumentTypes,
    recommendationRules,
    provenance: [PROV_PEDAGOGICAL],
    profileStatus: 'SPECIFIC',
  };
}

// ==========================================
// 5. SPECIFIC PROFILE: PENDIDIKAN PANCASILA
// ==========================================
function createPendidikanPancasilaProfile(): SubjectAssessmentProfile {
  const competencyDomains: SubjectCompetencyDomain[] = [
    { id: 'PANCASILA_VALUES', name: 'Pemahaman Nilai Sila Pancasila, Sejarah, & Simbol Negara' },
    { id: 'CONSTITUTION_NORMS', name: 'Aturan, Norma, Hak, & Kewajiban Warga Negara' },
    { id: 'CIVIC_REFLECTION', name: 'Refleksi Diri, Sikap Etis, & Komitmen Berbangsa' },
    { id: 'COLLABORATIVE_APPLICATION', name: 'Penerapan Gotong Royong, Musyawarah, & Keberagaman' },
  ];

  const supportedEvidenceTypes: AssessmentEvidenceType[] = [
    'KNOWLEDGE_RESPONSE',
    'REASONING',
    'PERFORMANCE',
    'OBSERVATION',
    'PORTFOLIO',
  ];

  const supportedInstrumentTypes: AssessmentInstrumentType[] = [
    'WRITTEN_TEST',
    'ORAL_TEST',
    'OBSERVATION',
    'SELF_ASSESSMENT',
    'PEER_ASSESSMENT',
    'PERFORMANCE',
    'ASSIGNMENT',
  ];

  const recommendationRules: AssessmentEvidenceRecommendationRule[] = [
    {
      id: 'PANCASILA-CONCEPTUAL',
      ruleDescription: 'Tujuan berfokus pada pemahaman makna simbol, sila, hak, dan kewajiban.',
      triggerKeywords: ['makna sila', 'simbol negara', 'mengenal lambang', 'hak dan kewajiban', 'norma yang berlaku', 'aturan hukum'],
      recommendedEvidenceTypes: ['KNOWLEDGE_RESPONSE', 'REASONING'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ORAL_TEST'],
      rationaleCode: 'PANCASILA_CIVIC_KNOWLEDGE',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'PANCASILA-REAL-LIFE-CASE',
      ruleDescription: 'Tujuan berfokus pada penalaran kasus kehidupan sehari-hari, dilema etika, atau pemecahan konflik.',
      triggerKeywords: ['studi kasus', 'dilema', 'analisis kasus', 'menyelesaikan masalah bersama', 'sikap toleransi', 'menghargai perbedaan'],
      recommendedEvidenceTypes: ['REASONING'],
      recommendedInstrumentTypes: ['WRITTEN_TEST', 'ASSIGNMENT'],
      rationaleCode: 'PANCASILA_CASE_REASONING',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'PANCASILA-REFLECTION',
      ruleDescription: 'Tujuan berfokus pada refleksi sikap moral diri sendiri (bukan skor moral otomatis).',
      triggerKeywords: ['merefleksikan', 'menilai diri', 'komitmen pribadi', 'kebiasaan bersikap adil', 'kejujuran'],
      recommendedEvidenceTypes: ['REASONING', 'PORTFOLIO'],
      recommendedInstrumentTypes: ['SELF_ASSESSMENT', 'PORTFOLIO', 'ASSIGNMENT'],
      rationaleCode: 'PANCASILA_SELF_REFLECTION',
      provenance: PROV_PEDAGOGICAL,
    },
    {
      id: 'PANCASILA-COLLABORATION',
      ruleDescription: 'Tujuan berfokus pada praktik gotong royong, kerja kelompok, atau musyawarah di kelas.',
      triggerKeywords: ['gotong royong', 'musyawarah', 'bekerja sama', 'mufakat', 'menghargai pendapat teman', 'praktik musyawarah'],
      recommendedEvidenceTypes: ['PERFORMANCE', 'OBSERVATION'],
      recommendedInstrumentTypes: ['OBSERVATION', 'PEER_ASSESSMENT', 'PERFORMANCE'],
      rationaleCode: 'PANCASILA_COLLABORATIVE_ACTION',
      provenance: PROV_PEDAGOGICAL,
    },
  ];

  return {
    subjectKey: 'PANCASILA',
    subjectLabel: 'Pendidikan Pancasila',
    competencyDomains,
    supportedEvidenceTypes,
    supportedInstrumentTypes,
    recommendationRules,
    provenance: [PROV_PEDAGOGICAL],
    profileStatus: 'SPECIFIC',
  };
}

// ==========================================
// 6. GENERIC SUBJECT PROFILE (FALLBACK)
// ==========================================
function createGenericProfile(subjectKey: string, subjectLabel?: string): SubjectAssessmentProfile {
  return {
    subjectKey,
    subjectLabel: subjectLabel || subjectKey,
    competencyDomains: [
      { id: 'GENERAL_KNOWLEDGE', name: 'Pengetahuan & Pemahaman Konseptual Umum' },
      { id: 'GENERAL_SKILLS', name: 'Keterampilan Aplikasi & Praktik' },
    ],
    supportedEvidenceTypes: [
      'KNOWLEDGE_RESPONSE',
      'REASONING',
      'PRODUCT',
      'PERFORMANCE',
      'OBSERVATION',
    ],
    supportedInstrumentTypes: [
      'WRITTEN_TEST',
      'PERFORMANCE',
      'OBSERVATION',
      'PRODUCT',
      'ASSIGNMENT',
      'ORAL_TEST',
    ],
    recommendationRules: [
      {
        id: 'GENERIC-KNOWLEDGE',
        ruleDescription: 'Aturan umum kompetensi kognitif (menjelaskan, menyebutkan, memahami).',
        triggerKeywords: ['menjelaskan', 'memahami', 'mengidentifikasi', 'menyebutkan'],
        recommendedEvidenceTypes: ['KNOWLEDGE_RESPONSE', 'REASONING'],
        recommendedInstrumentTypes: ['WRITTEN_TEST', 'ORAL_TEST'],
        rationaleCode: 'GENERIC_KNOWLEDGE_EVIDENCE',
        provenance: PROV_PEDAGOGICAL,
      },
      {
        id: 'GENERIC-PRACTICE',
        ruleDescription: 'Aturan umum kompetensi kinerja/keterampilan (mempraktikkan, membuat, mendemonstrasikan).',
        triggerKeywords: ['mempraktikkan', 'membuat', 'mendemonstrasikan', 'melakukan', 'menyajikan'],
        recommendedEvidenceTypes: ['PERFORMANCE', 'PRODUCT', 'OBSERVATION'],
        recommendedInstrumentTypes: ['PERFORMANCE', 'PRODUCT', 'OBSERVATION', 'ASSIGNMENT'],
        rationaleCode: 'GENERIC_PRACTICE_EVIDENCE',
        provenance: PROV_PEDAGOGICAL,
      },
    ],
    provenance: [PROV_PEDAGOGICAL],
    profileStatus: 'GENERIC',
  };
}

/**
 * Resolusi SubjectAssessmentProfile secara deterministik.
 * Memetakan ke 5 Specific Profiles: PJOK, Bahasa Indonesia, Matematika, IPA/IPAS, Pendidikan Pancasila.
 * Untuk mata pelajaran resmi lainnya menghasilkan GENERIC.
 * Jika input kosong atau tidak valid menghasilkan UNRESOLVED (Fail-Closed).
 */
export function resolveSubjectAssessmentProfile(subjectInput?: string): SubjectAssessmentProfile {
  if (!subjectInput || typeof subjectInput !== 'string' || subjectInput.trim() === '') {
    return {
      subjectKey: '',
      subjectLabel: '',
      competencyDomains: [],
      supportedEvidenceTypes: [],
      supportedInstrumentTypes: [],
      recommendationRules: [],
      provenance: [],
      profileStatus: 'UNRESOLVED',
    };
  }

  const trimmed = subjectInput.trim();
  const canonicalRes = resolveSubjectInput(trimmed);

  const subjectCode = canonicalRes.status === 'RESOLVED' && canonicalRes.subjectCode
    ? canonicalRes.subjectCode
    : trimmed.toUpperCase();

  const label = canonicalRes.subject ? canonicalRes.subject.name : trimmed;

  // 1. PJOK
  if (subjectCode === 'PJOK' || trimmed.toUpperCase().includes('PJOK') || trimmed.toUpperCase().includes('PENJAS')) {
    return createPjokProfile();
  }

  // 2. Bahasa Indonesia
  if (subjectCode === 'BINDO' || trimmed.toUpperCase().includes('BAHASA INDONESIA')) {
    return createBahasaIndonesiaProfile();
  }

  // 3. Matematika
  if (subjectCode === 'MAT' || trimmed.toUpperCase().includes('MATEMATIKA')) {
    return createMatematikaProfile();
  }

  // 4. IPA / IPAS
  if (subjectCode === 'IPAS' || trimmed.toUpperCase().includes('IPAS')) {
    return createIpaIpasProfile('IPAS');
  }
  if (subjectCode === 'IPA' || trimmed.toUpperCase().includes('IPA TERPADU') || trimmed.toUpperCase() === 'IPA') {
    return createIpaIpasProfile('IPA');
  }

  // 5. Pendidikan Pancasila
  if (
    subjectCode === 'PANCASILA' ||
    trimmed.toUpperCase().includes('PANCASILA') ||
    trimmed.toUpperCase().includes('PPKN') ||
    trimmed.toUpperCase().includes('PKN')
  ) {
    return createPendidikanPancasilaProfile();
  }

  // Jika teridentifikasi di katalog atau string valid namun bukan salah satu dari 5 MVP:
  if (canonicalRes.status === 'RESOLVED' || trimmed.length >= 2) {
    return createGenericProfile(subjectCode, label);
  }

  return {
    subjectKey: trimmed,
    subjectLabel: trimmed,
    competencyDomains: [],
    supportedEvidenceTypes: [],
    supportedInstrumentTypes: [],
    recommendationRules: [],
    provenance: [],
    profileStatus: 'UNRESOLVED',
  };
}
