import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  ActiveContext,
  CPData,
  TPData,
  ATPData,
  CPSource,
} from '../types';

export const CURRICULA = [
  'Kurikulum Merdeka',
  'Kurikulum Nasional (K-13 Penyesuaian)',
  'Kurikulum Satuan Pendidikan Khusus / Inklusif',
];

export const ACADEMIC_YEARS = [
  '2024/2025',
  '2025/2026',
  '2026/2027',
  '2027/2028',
];

export const SEMESTERS = ['1 (Ganjil)', '2 (Genap)'] as const;

export const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'SMK'] as const;

export const GRADE_PHASE_MAP: Record<string, { grade: string; phase: string; level: 'SD' | 'SMP' | 'SMA' | 'SMK' }[]> = {
  SD: [
    { grade: 'Kelas 1', phase: 'Fase A', level: 'SD' },
    { grade: 'Kelas 2', phase: 'Fase A', level: 'SD' },
    { grade: 'Kelas 3', phase: 'Fase B', level: 'SD' },
    { grade: 'Kelas 4', phase: 'Fase B', level: 'SD' },
    { grade: 'Kelas 5', phase: 'Fase C', level: 'SD' },
    { grade: 'Kelas 6', phase: 'Fase C', level: 'SD' },
  ],
  SMP: [
    { grade: 'Kelas 7', phase: 'Fase D', level: 'SMP' },
    { grade: 'Kelas 8', phase: 'Fase D', level: 'SMP' },
    { grade: 'Kelas 9', phase: 'Fase D', level: 'SMP' },
  ],
  SMA: [
    { grade: 'Kelas 10', phase: 'Fase E', level: 'SMA' },
    { grade: 'Kelas 11', phase: 'Fase F', level: 'SMA' },
    { grade: 'Kelas 12', phase: 'Fase F', level: 'SMA' },
  ],
  SMK: [
    { grade: 'Kelas 10', phase: 'Fase E', level: 'SMK' },
    { grade: 'Kelas 11', phase: 'Fase F', level: 'SMK' },
    { grade: 'Kelas 12', phase: 'Fase F', level: 'SMK' },
  ],
};

/**
 * Centrally derived Phase from Education Level and Grade.
 * Phase cannot be freely edited.
 */
export function getPhaseFromGrade(level: string = 'SD', grade: string = 'Kelas 1'): string {
  const normLevel = (level.toUpperCase() in GRADE_PHASE_MAP ? level.toUpperCase() : 'SD') as keyof typeof GRADE_PHASE_MAP;
  const grades = GRADE_PHASE_MAP[normLevel] || GRADE_PHASE_MAP.SD;
  
  // Direct match
  const matched = grades.find((g) => g.grade.toLowerCase() === grade.toLowerCase());
  if (matched) return matched.phase;

  // Partial or numeric matching
  const num = parseInt(grade.replace(/[^0-9]/g, ''), 10);
  if (normLevel === 'SD') {
    if (num <= 2) return 'Fase A';
    if (num <= 4) return 'Fase B';
    return 'Fase C';
  }
  if (normLevel === 'SMP') {
    return 'Fase D';
  }
  if (normLevel === 'SMA' || normLevel === 'SMK') {
    if (num === 10) return 'Fase E';
    return 'Fase F';
  }
  return 'Fase A';
}

/**
 * Builds the single source of truth ActiveContext from profile, school, and academicSetting.
 */
export function buildActiveContext(
  profile: TeacherProfile,
  school: SchoolData,
  setting: AcademicSetting
): ActiveContext {
  const derivedPhase = getPhaseFromGrade(setting.level || profile.defaultLevel || 'SD', setting.grade || 'Kelas 4');
  const curType = setting.curriculumType || (setting.curriculum === 'Kurikulum 2013' ? 'K13' : 'KURIKULUM_MERDEKA');
  return {
    profileId: profile.id,
    schoolId: school.id || profile.schoolId,
    curriculum: setting.curriculum || 'Kurikulum Merdeka',
    curriculumType: curType,
    academicYear: setting.academicYear || '2025/2026',
    semester: setting.semester || '1 (Ganjil)',
    level: setting.level || profile.defaultLevel || 'SD',
    grade: setting.grade || 'Kelas 4',
    phase: derivedPhase,
    subject: setting.subject || profile.defaultSubject || 'Bahasa Indonesia',
    totalHoursPerWeek: setting.totalHoursPerWeek || 5,
  };
}

export const SUBJECT_OPTIONS: Record<'SD' | 'SMP' | 'SMA' | 'SMK', string[]> = {
  SD: [
    'Bahasa Indonesia',
    'Matematika',
    'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
    'Pendidikan Pancasila',
    'Pendidikan Agama Islam dan Budi Pekerti',
    'Pendidikan Agama Kristen dan Budi Pekerti',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    'Seni Rupa',
    'Seni Musik',
    'Seni Tari',
    'Seni Teater',
    'Bahasa Inggris',
    'Muatan Lokal (Bahasa Daerah)',
  ],
  SMP: [
    'Bahasa Indonesia',
    'Matematika',
    'Ilmu Pengetahuan Alam (IPA)',
    'Ilmu Pengetahuan Sosial (IPS)',
    'Pendidikan Pancasila',
    'Pendidikan Agama dan Budi Pekerti',
    'Bahasa Inggris',
    'Informatika',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    'Seni dan Prakarya',
  ],
  SMA: [
    'Bahasa Indonesia',
    'Matematika (Wajib/Pilihan)',
    'Bahasa Inggris',
    'Pendidikan Pancasila',
    'Fisika',
    'Kimia',
    'Biologi',
    'Ekonomi',
    'Sosiologi',
    'Geografi',
    'Sejarah',
    'Informatika',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  ],
  SMK: [
    'Bahasa Indonesia',
    'Matematika',
    'Bahasa Inggris',
    'Pendidikan Pancasila',
    'Dasar-dasar Kejuruan',
    'Konsentrasi Keahlian',
    'Projek Kreatif dan Kewirausahaan',
    'Informatika',
    'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
  ],
};

export const P3_DIMENSIONS = [
  'Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia',
  'Berkebinekaan Global',
  'Gotong Royong',
  'Mandiri',
  'Bernalar Kritis',
  'Kreatif',
];

export interface CPSamplePreset {
  subject: string;
  grade: string;
  phase: string;
  level: 'SD' | 'SMP' | 'SMA' | 'SMK';
  sourceInfo: CPSource;
  generalDescription: string;
  elements: { name: string; content: string }[];
}

/**
 * Local reference registry.
 * Clearly designated as local_reference or verified when citing official government publications.
 */
export const CP_PRESETS: CPSamplePreset[] = [
  {
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    grade: 'Kelas 1',
    phase: 'Fase A',
    level: 'SD',
    sourceInfo: {
      title: 'Panduan Pembelajaran dan Asesmen Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
      institution: 'Kemendikdasmen / BSKAP Kemendikbudristek',
      documentYear: '2025',
      url: 'https://kurikulum.kemdikbud.go.id/',
      page: 'Fase A (Kelas 1-2 SD)',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
    },
    generalDescription:
      'Pada akhir Fase A, peserta didik dapat menunjukkan berbagai aktivitas pola gerak dasar lokomotor, non-lokomotor, dan manipulatif sebagai hasil peniruan dari berbagai sumber. Peserta didik mengetahui prosedur pola gerak dasar, menjaga kebersihan dan kesehatan diri, serta menunjukkan perilaku bertanggung jawab, mandiri, dan menghargai orang lain.',
    elements: [
      {
        name: 'Keterampilan Gerak',
        content:
          'Peserta didik mempraktikkan keterampilan pola gerak dasar lokomotor (jalan, lari, lompat), non-lokomotor (menekuk, memutar, mengayun), dan manipulatif (melempar, menangkap, menendang) dalam berbagai bentuk permainan sederhana dan/atau tradisional.',
      },
      {
        name: 'Pengetahuan Gerak',
        content:
          'Peserta didik memahami prosedur berbagai keterampilan pola gerak dasar lokomotor, non-lokomotor, dan manipulatif dalam berbagai permainan sederhana dan/atau tradisional.',
      },
      {
        name: 'Pemanfaatan Gerak',
        content:
          'Peserta didik menjaga kebersihan tubuh, mengenali bagian-bagian tubuh yang boleh dan tidak boleh disentuh orang lain, serta menerapkan pola hidup sehat dalam kehidupan sehari-hari.',
      },
      {
        name: 'Pengembangan Karakter dan Internalisasi Nilai-nilai Gerak',
        content:
          'Peserta didik menunjukkan perilaku bertanggung jawab, mengikuti aturan permainan, berbagi ruang dan alat, serta menghargai perbedaan teman saat beraktivitas jasmani.',
      },
    ],
  },
  {
    subject: 'Bahasa Indonesia',
    grade: 'Kelas 4',
    phase: 'Fase B',
    level: 'SD',
    sourceInfo: {
      title: 'Keputusan Kepala BSKAP No. 032/H/KR/2024 tentang Capaian Pembelajaran pada Kurikulum Merdeka',
      institution: 'BSKAP Kemendikbudristek',
      documentYear: '2024',
      url: 'https://kurikulum.kemdikbud.go.id/',
      page: 'Bahasa Indonesia Fase B',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
    },
    generalDescription:
      'Pada akhir Fase B, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar, sesuai dengan tujuan, konteks sosial, akademis, dan dunia kerja. Peserta didik mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi sederhana dalam bentuk cetak atau elektronik.',
    elements: [
      {
        name: 'Menyimak',
        content:
          'Peserta didik mampu memahami ide pokok (gagasan) suatu pesan lisan, informasi dari media audio, teks aural (teks yang dibacakan dan/atau didengar), dan instruksi lisan yang berkaitan dengan tujuan berkomunikasi.',
      },
      {
        name: 'Membaca dan Memirsa',
        content:
          'Peserta didik mampu memahami pesan dan informasi tentang kehidupan sehari-hari, teks narasi, dan puisi anak dalam bentuk cetak atau elektronik. Peserta didik mampu membaca kata-kata baru berdasarkan pola kombinasi huruf yang telah dikenali dengan fasih.',
      },
      {
        name: 'Berbicara dan Mempresentasikan',
        content:
          'Peserta didik mampu berbicara dengan pilihan kata dan sikap tubuh/gestur yang santun, menggunakan volume dan intonasi yang tepat sesuai konteks. Peserta didik mengajukan dan menanggapi pertanyaan secara santun dalam suatu percakapan.',
      },
      {
        name: 'Menulis',
        content:
          'Peserta didik mampu menulis teks narasi, teks deskripsi, teks rekon, teks prosedur, dan teks eksposisi dengan rangkaian kalimat yang beragam, informasi yang rinci dan akurat dengan topik yang beragam.',
      },
    ],
  },
  {
    subject: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
    grade: 'Kelas 4',
    phase: 'Fase B',
    level: 'SD',
    sourceInfo: {
      title: 'Keputusan Kepala BSKAP No. 032/H/KR/2024 tentang Capaian Pembelajaran',
      institution: 'BSKAP Kemendikbudristek',
      documentYear: '2024',
      url: 'https://kurikulum.kemdikbud.go.id/',
      page: 'IPAS Fase B',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
    },
    generalDescription:
      'Pada akhir Fase B, peserta didik mengidentifikasi keterkaitan antara bentuk serta fungsi bagian tubuh pada manusia dan tumbuhan. Peserta didik dapat membuat simulasi menggunakan bagan/alat bantu sederhana tentang siklus hidup makhluk hidup, wujud zat dan perubahannya, serta bentuk energi dan perubahannya.',
    elements: [
      {
        name: 'Pemahaman IPAS (Sains dan Sosial)',
        content:
          'Peserta didik menganalisis hubungan antara bentuk dan fungsi bagian tubuh pada tumbuhan dan hewan; mendeskripsikan proses fotosintesis dan kaitannya dengan makhluk hidup lain; mendemonstrasikan bagaimana wujud zat berubah; mengidentifikasi sumber dan bentuk energi serta perubahannya dalam kehidupan sehari-hari; dan mengenali kearifan lokal di daerah tempat tinggalnya.',
      },
      {
        name: 'Keterampilan Proses',
        content:
          'Mengamati, mempertanyakan dan memprediksi, merencanakan dan melakukan penyelidikan, memproses, menganalisis data dan informasi, mengevaluasi dan refleksi, serta mengomunikasikan hasil penyelidikan secara lisan dan tertulis.',
      },
    ],
  },
  {
    subject: 'Matematika',
    grade: 'Kelas 4',
    phase: 'Fase B',
    level: 'SD',
    sourceInfo: {
      title: 'Keputusan Kepala BSKAP No. 032/H/KR/2024 tentang Capaian Pembelajaran',
      institution: 'BSKAP Kemendikbudristek',
      documentYear: '2024',
      url: 'https://kurikulum.kemdikbud.go.id/',
      page: 'Matematika Fase B',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
    },
    generalDescription:
      'Pada akhir Fase B, peserta didik dapat menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 10.000. Mereka dapat melakukan operasi penjumlahan, pengurangan, perkalian, dan pembagian bilangan cacah sampai 100.',
    elements: [
      {
        name: 'Bilangan',
        content:
          'Peserta didik menunjukkan pemahaman dan intuisi bilangan pada bilangan cacah sampai 10.000, membaca, menulis, membandingkan, mengurutkan nilai tempat, serta melakukan operasi penjumlahan dan pengurangan sampai 1.000, perkalian dan pembagian sampai 100.',
      },
      {
        name: 'Pengukuran',
        content:
          'Peserta didik dapat mengukur panjang dan berat benda menggunakan satuan baku, serta mengukur luas dan volume menggunakan satuan tidak baku dan satuan baku berupa bilangan cacah.',
      },
      {
        name: 'Geometri',
        content:
          'Peserta didik dapat mendeskripsikan ciri berbagai bentuk bangun datar (segiempat, segitiga, segibanyak) dan menyusun/mengurai gabungan bangun datar.',
      },
    ],
  },
  {
    subject: 'Pendidikan Pancasila',
    grade: 'Kelas 4',
    phase: 'Fase B',
    level: 'SD',
    sourceInfo: {
      title: 'Keputusan Kepala BSKAP No. 032/H/KR/2024 tentang Capaian Pembelajaran',
      institution: 'BSKAP Kemendikbudristek',
      documentYear: '2024',
      url: 'https://kurikulum.kemdikbud.go.id/',
      page: 'Pendidikan Pancasila Fase B',
      retrievedAt: new Date().toISOString(),
      verificationStatus: 'verified',
    },
    generalDescription:
      'Pada akhir Fase B, peserta didik mampu memahami dan menyajikan pesan moral berdasarkan sila-sila Pancasila, mengenal identitas diri dan lingkungan, serta mempraktikkan gotong royong dan mematuhi norma/aturan yang berlaku.',
    elements: [
      {
        name: 'Pancasila',
        content:
          'Peserta didik mampu memahami dan menjelaskan makna sila-sila Pancasila serta menceritakan contoh penerapan sila Pancasila dalam kehidupan sehari-hari.',
      },
      {
        name: 'Undang-Undang Dasar Negara Republik Indonesia 1945',
        content:
          'Peserta didik mampu mengidentifikasi aturan di keluarga, sekolah, dan lingkungan sekitar tempat tinggal serta melaksanakannya dengan bimbingan orang tua dan guru.',
      },
      {
        name: 'Bhinneka Tunggal Ika',
        content:
          'Peserta didik mampu mengidentifikasi dan menghargai keragaman suku bangsa, budaya, bahasa, dan agama di lingkungan sekitar.',
      },
      {
        name: 'Negara Kesatuan Republik Indonesia',
        content:
          'Peserta didik mampu mengenal susunan wilayah NKRI mulai dari lingkungan RT, RW, desa/kelurahan, hingga kecamatan sebagai bagian tak terpisahkan.',
      },
    ],
  },
];

// Initial starter seed profiles and school
export const INITIAL_SCHOOL: SchoolData = {
  id: 'sch-default-1',
  name: 'SDN Karang Tengah 1',
  npsn: '20234567',
  address: 'Jl. Merdeka Pendidikan No. 45',
  village: 'Karang Tengah',
  district: 'Kecamatan Cerdas',
  regency: 'Kabupaten Gemilang',
  province: 'Jawa Barat',
  principalName: 'Dra. Hj. Siti Rahmawati, M.Pd.',
  principalNip: '19680512 199303 2 004',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export const INITIAL_PROFILES: TeacherProfile[] = [
  {
    id: 'prof-1',
    name: 'Adzani Kusumawardani, S.Pd.',
    nip: '19890720 201401 2 015',
    nuptk: '4538761234900021',
    status: 'PNS',
    defaultSubject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    defaultLevel: 'SD',
    schoolId: 'sch-default-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prof-2',
    name: 'Ratna Dewi, S.Pd.SD',
    nip: '19920315 201902 2 008',
    nuptk: '8923765412900043',
    status: 'PPPK',
    defaultSubject: 'Bahasa Indonesia',
    defaultLevel: 'SD',
    schoolId: 'sch-default-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'prof-3',
    name: 'Ahmad Fauzi, S.Pd.',
    nip: '19951110 202203 1 005',
    nuptk: '1245890345900012',
    status: 'Guru Tetap Yayasan (GTY)',
    defaultSubject: 'Matematika',
    defaultLevel: 'SD',
    schoolId: 'sch-default-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_ACADEMIC_SETTINGS: AcademicSetting[] = [
  {
    id: 'acad-prof-1',
    profileId: 'prof-1',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2026/2027',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 1',
    phase: 'Fase A',
    subject: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    totalHoursPerWeek: 4,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'acad-prof-2',
    profileId: 'prof-2',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'Bahasa Indonesia',
    totalHoursPerWeek: 6,
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'acad-prof-3',
    profileId: 'prof-3',
    curriculum: 'Kurikulum Merdeka',
    curriculumType: 'KURIKULUM_MERDEKA',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    phase: 'Fase B',
    subject: 'Matematika',
    totalHoursPerWeek: 5,
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_CP_DATA: CPData[] = [
  {
    id: 'cp-prof-1',
    academicSettingId: 'acad-prof-1',
    source: CP_PRESETS[0].sourceInfo,
    generalDescription: CP_PRESETS[0].generalDescription,
    elements: CP_PRESETS[0].elements.map((el, i) => ({
      id: `elem-${i + 1}`,
      name: el.name,
      content: el.content,
    })),
    aiNotes: 'Capaian Pembelajaran PJOK Fase A (Kelas 1-2 SD) berfokus pada penguasaan pola gerak dasar (lokomotor, non-lokomotor, manipulatif) melalui peniruan gerak dan permainan menyenangkan, serta pengenalan kebersihan diri.',
    lastEditedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_TP_DATA: TPData[] = [
  {
    id: 'tp-prof-1',
    academicSettingId: 'acad-prof-1',
    basedOnCpUpdatedAt: INITIAL_CP_DATA[0].updatedAt,
    items: [
      {
        id: 'tp-1',
        code: 'TP 1.1',
        elementName: 'Keterampilan Gerak',
        statement: 'Peserta didik mampu mempraktikkan keterampilan pola gerak dasar lokomotor (jalan, lari, lompat) melalui permainan sederhana yang menyenangkan.',
        competence: 'Mempraktikkan',
        contentScope: 'Pola gerak dasar lokomotor (jalan, lari, lompat)',
        p3Dimensions: ['Mandiri', 'Gotong Royong'],
        order: 1,
      },
      {
        id: 'tp-2',
        code: 'TP 1.2',
        elementName: 'Keterampilan Gerak',
        statement: 'Peserta didik mampu mempraktikkan keterampilan pola gerak dasar non-lokomotor (menekuk, memutar, mengayun) secara seimbang dan teratur.',
        competence: 'Mempraktikkan',
        contentScope: 'Pola gerak non-lokomotor (menekuk, memutar, mengayun)',
        p3Dimensions: ['Mandiri', 'Bernalar Kritis'],
        order: 2,
      },
      {
        id: 'tp-3',
        code: 'TP 1.3',
        elementName: 'Keterampilan Gerak',
        statement: 'Peserta didik mampu mempraktikkan keterampilan pola gerak dasar manipulatif (melempar dan menangkap bola kecil) dengan bimbingan guru.',
        competence: 'Mempraktikkan',
        contentScope: 'Pola gerak manipulatif (melempar dan menangkap bola)',
        p3Dimensions: ['Mandiri', 'Kreatif'],
        order: 3,
      },
      {
        id: 'tp-4',
        code: 'TP 1.4',
        elementName: 'Pemanfaatan Gerak',
        statement: 'Peserta didik mampu mengenali dan mempraktikkan cara menjaga kebersihan diri serta berpakaian rapi saat dan setelah beraktivitas jasmani.',
        competence: 'Mengenali dan Mempraktikkan',
        contentScope: 'Kebersihan tubuh dan pakaian olahraga',
        p3Dimensions: ['Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia', 'Mandiri'],
        order: 4,
      },
    ],
    updatedAt: new Date().toISOString(),
  },
];

export const INITIAL_ATP_DATA: ATPData[] = [
  {
    id: 'atp-prof-1',
    academicSettingId: 'acad-prof-1',
    rationale: 'Alur Tujuan Pembelajaran PJOK Kelas 1 Fase A disusun bertahap mulai dari pengenalan gerak tubuh sendiri (lokomotor & non-lokomotor) menuju interaksi dengan objek/alat (manipulatif), lalu ditutup dengan pembiasaan kebersihan diri untuk menanamkan kebiasaan hidup sehat sedini mungkin.',
    totalJP: 16,
    basedOnTpUpdatedAt: INITIAL_TP_DATA[0].updatedAt,
    items: [
      {
        id: 'atp-row-1',
        stepNumber: 1,
        tpId: 'tp-1',
        tpCode: 'TP 1.1',
        tpStatement: 'Peserta didik mampu mempraktikkan keterampilan pola gerak dasar lokomotor (jalan, lari, lompat) melalui permainan sederhana yang menyenangkan.',
        materialScope: 'Pola Gerak Dasar Lokomotor (Jalan, Lari, Lompat)',
        jp: 4,
        p3Dimensions: ['Mandiri', 'Gotong Royong'],
        assessmentPlan: 'Asesmen Awal: Observasi gerak bebas; Formatif: Unjuk kerja permainan pos rintangan lari & lompat',
        glossary: 'Lokomotor, Berjalan, Berlari, Melompat, Rintangan',
        resources: 'Cone / pembatas warna, Buku Guru PJOK Kelas 1 Kemendikdasmen',
      },
      {
        id: 'atp-row-2',
        stepNumber: 2,
        tpId: 'tp-2',
        tpCode: 'TP 1.2',
        tpStatement: 'Peserta didik mampu mempraktikkan keterampilan pola gerak dasar non-lokomotor (menekuk, memutar, mengayun) secara seimbang dan teratur.',
        materialScope: 'Pola Gerak Non-Lokomotor (Senam Gerak Berirama Sederhana)',
        jp: 4,
        p3Dimensions: ['Mandiri', 'Bernalar Kritis'],
        assessmentPlan: 'Formatif: Lembar ceklis gerak meniru pohon tertiup angin dan putaran lengan',
        glossary: 'Non-Lokomotor, Mengayun, Menekuk, Keseimbangan, Memutar',
        resources: 'Musik senam anak ceria, Audio visual contoh gerak tubuh',
      },
      {
        id: 'atp-row-3',
        stepNumber: 3,
        tpId: 'tp-3',
        tpCode: 'TP 1.3',
        tpStatement: 'Peserta didik mampu mempraktikkan keterampilan pola gerak dasar manipulatif (melempar dan menangkap bola kecil) dengan bimbingan guru.',
        materialScope: 'Pola Gerak Manipulatif (Permainan Lempar Tangkap Bola Spon)',
        jp: 4,
        p3Dimensions: ['Mandiri', 'Kreatif'],
        assessmentPlan: 'Formatif: Unjuk kerja lempar tangkap bola berpasangan jarak 2 meter',
        glossary: 'Manipulatif, Bola Spon, Melempar, Menangkap, Sasaran',
        resources: 'Bola spon lembut, Keranjang sasaran warna-warni',
      },
      {
        id: 'atp-row-4',
        stepNumber: 4,
        tpId: 'tp-4',
        tpCode: 'TP 1.4',
        tpStatement: 'Peserta didik mampu mengenali dan mempraktikkan cara menjaga kebersihan diri serta berpakaian rapi saat dan setelah beraktivitas jasmani.',
        materialScope: 'Kebiasaan Hidup Bersih dan Sehat (Cuci Tangan, Ganti Pakaian)',
        jp: 4,
        p3Dimensions: ['Beriman, Bertakwa kepada Tuhan YME, dan Berakhlak Mulia', 'Mandiri'],
        assessmentPlan: 'Sumatif Lingkup Materi: Praktik 7 langkah cuci tangan dengan sabun & portofolio kebersihan',
        glossary: 'Kebersihan Diri, Cuci Tangan, Keringat, Pakaian Bersih',
        resources: 'Poster panduan cuci tangan, Air mengalir dan sabun',
      },
    ],
    updatedAt: new Date().toISOString(),
  },
];
