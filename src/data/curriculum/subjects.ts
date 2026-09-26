import { CurriculumSubject } from './types';

/**
 * MASTER MATA PELAJARAN KURIKULUM RESMI (STABLE CODE)
 *
 * Jangan gunakan nama mata pelajaran bebas sebagai ID utama.
 * Gunakan stable code yang konsisten lintas jenjang SD, SMP, SMA.
 */
export const CURRICULUM_SUBJECTS: CurriculumSubject[] = [
  // --- KELOMPOK AGAMA DAN BUDI PEKERTI ---
  {
    code: 'PAI',
    name: 'Pendidikan Agama Islam dan Budi Pekerti',
    aliases: [
      'Pendidikan Agama Islam',
      'PAI dan BP',
      'Pendidikan Agama Islam & Budi Pekerti',
      'PAI & Budi Pekerti',
      'PAI',
    ],
  },
  {
    code: 'PAK',
    name: 'Pendidikan Agama Kristen dan Budi Pekerti',
    aliases: [
      'Pendidikan Agama Kristen',
      'PAK dan BP',
      'Pendidikan Agama Kristen & Budi Pekerti',
      'PAK',
    ],
  },
  {
    code: 'PKAT',
    name: 'Pendidikan Agama Katolik dan Budi Pekerti',
    aliases: [
      'Pendidikan Agama Katolik',
      'Katolik dan Budi Pekerti',
      'PKAT',
    ],
  },
  {
    code: 'PHINDU',
    name: 'Pendidikan Agama Hindu dan Budi Pekerti',
    aliases: [
      'Pendidikan Agama Hindu',
      'Hindu dan Budi Pekerti',
      'PHINDU',
    ],
  },
  {
    code: 'PBUDDHA',
    name: 'Pendidikan Agama Buddha dan Budi Pekerti',
    aliases: [
      'Pendidikan Agama Buddha',
      'Buddha dan Budi Pekerti',
      'PBUDDHA',
    ],
  },
  {
    code: 'PKHONGHUCU',
    name: 'Pendidikan Agama Khonghucu dan Budi Pekerti',
    aliases: [
      'Pendidikan Agama Khonghucu',
      'Khonghucu dan Budi Pekerti',
      'PKHONGHUCU',
    ],
  },

  // --- KELOMPOK MATA PELAJARAN UMUM & INTI ---
  {
    code: 'PANCASILA',
    name: 'Pendidikan Pancasila',
    aliases: [
      'Pendidikan Pancasila dan Kewarganegaraan',
      'Pendidikan Pancasila dan Kewarganegaraan (PPKn)',
      'PPKn',
      'PKn',
      'Pancasila',
    ],
  },
  {
    code: 'BINDO',
    name: 'Bahasa Indonesia',
    aliases: ['B. Indonesia', 'B.Indo', 'B Indo', 'Bahasa Indonesia'],
  },
  {
    code: 'MAT',
    name: 'Matematika',
    aliases: ['MTK', 'Mtk', 'Matematika Umum'],
  },
  {
    code: 'IPAS',
    name: 'Ilmu Pengetahuan Alam dan Sosial (IPAS)',
    aliases: [
      'Ilmu Pengetahuan Alam dan Sosial',
      'IPAS',
      'IPA dan IPS Terpadu SD',
    ],
    defaultLevel: 'SD',
  },
  {
    code: 'IPA',
    name: 'Ilmu Pengetahuan Alam (IPA)',
    aliases: ['Ilmu Pengetahuan Alam', 'IPA Terpadu', 'IPA'],
    defaultLevel: 'SMP',
  },
  {
    code: 'IPS',
    name: 'Ilmu Pengetahuan Sosial (IPS)',
    aliases: ['Ilmu Pengetahuan Sosial', 'IPS Terpadu', 'IPS'],
    defaultLevel: 'SMP',
  },
  {
    code: 'BING',
    name: 'Bahasa Inggris',
    aliases: ['B. Inggris', 'B.Inggris', 'English', 'Bahasa Inggris'],
  },
  {
    code: 'PJOK',
    name: 'Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)',
    aliases: [
      'Pendidikan Jasmani, Olahraga, dan Kesehatan',
      'PJOK',
      'Penjasorkes',
      'Pendidikan Jasmani',
      'Jasmani Olahraga dan Kesehatan',
    ],
  },
  {
    code: 'INFORMATIKA',
    name: 'Informatika',
    aliases: ['TIK', 'Teknologi Informasi dan Komunikasi', 'Informatika'],
  },

  // --- KELOMPOK SENI DAN PRAKARYA ---
  {
    code: 'SENI_RUPA',
    name: 'Seni Rupa',
    aliases: ['Seni dan Budaya (Seni Rupa)', 'Seni Rupa'],
  },
  {
    code: 'SENI_MUSIK',
    name: 'Seni Musik',
    aliases: ['Seni dan Budaya (Seni Musik)', 'Seni Musik'],
  },
  {
    code: 'SENI_TARI',
    name: 'Seni Tari',
    aliases: ['Seni dan Budaya (Seni Tari)', 'Seni Tari'],
  },
  {
    code: 'SENI_TEATER',
    name: 'Seni Teater',
    aliases: ['Seni dan Budaya (Seni Teater)', 'Seni Teater'],
  },
  {
    code: 'PRAKARYA',
    name: 'Prakarya dan Kewirausahaan (PKWU)',
    aliases: [
      'Prakarya',
      'Prakarya dan Kewirausahaan',
      'PKWU',
      'Kerajinan/Rekayasa/Budidaya/Pengolahan',
    ],
  },

  // --- MATA PELAJARAN PILIHAN & MUATAN KHUSUS ---
  {
    code: 'CODING_AI',
    name: 'Koding dan Kecerdasan Artifisial (Coding dan AI)',
    aliases: [
      'Koding dan Kecerdasan Artifisial',
      'Coding dan AI',
      'Koding & AI',
      'Coding & AI',
      'Coding & Artificial Intelligence',
      'Kecerdasan Buatan',
      'Kecerdasan Artifisial',
      'Koding',
      'Coding',
      'CODING_AI',
    ],
    notes:
      'Mapel pilihan sesuai Permendikdasmen No. 13 Tahun 2025. Tidak wajib untuk seluruh sekolah/guru.',
  },
  {
    code: 'LOCAL_CONTENT',
    name: 'Muatan Lokal',
    aliases: [
      'Mulok',
      'Muatan Lokal Bahasa Daerah',
      'Bahasa Daerah',
      'Bahasa Jawa',
      'Bahasa Sunda',
      'Bahasa Madura',
      'Bahasa Bali',
    ],
  },

  // --- KELOMPOK MATA PELAJARAN PILIHAN SMA (FASE F / FASE E) ---
  {
    code: 'FISIKA',
    name: 'Fisika',
    aliases: ['Fisika'],
    defaultLevel: 'SMA',
  },
  {
    code: 'KIMIA',
    name: 'Kimia',
    aliases: ['Kimia'],
    defaultLevel: 'SMA',
  },
  {
    code: 'BIOLOGI',
    name: 'Biologi',
    aliases: ['Biologi'],
    defaultLevel: 'SMA',
  },
  {
    code: 'SOSIOLOGI',
    name: 'Sosiologi',
    aliases: ['Sosiologi'],
    defaultLevel: 'SMA',
  },
  {
    code: 'EKONOMI',
    name: 'Ekonomi',
    aliases: ['Ekonomi'],
    defaultLevel: 'SMA',
  },
  {
    code: 'GEOGRAFI',
    name: 'Geografi',
    aliases: ['Geografi'],
    defaultLevel: 'SMA',
  },
  {
    code: 'SEJARAH',
    name: 'Sejarah',
    aliases: ['Sejarah Umum', 'Sejarah Pilihan', 'Sejarah'],
    defaultLevel: 'SMA',
  },
  {
    code: 'ANTROPOLOGI',
    name: 'Antropologi',
    aliases: ['Antropologi'],
    defaultLevel: 'SMA',
  },
  {
    code: 'MAT_LANJUT',
    name: 'Matematika Tingkat Lanjut',
    aliases: ['Matematika Tingkat Lanjut', 'Matematika Peminatan', 'Matematika Lanjut'],
    defaultLevel: 'SMA',
  },
  {
    code: 'BINDO_LANJUT',
    name: 'Bahasa Indonesia Tingkat Lanjut',
    aliases: ['Bahasa Indonesia Tingkat Lanjut', 'Bahasa dan Sastra Indonesia'],
    defaultLevel: 'SMA',
  },
  {
    code: 'BING_LANJUT',
    name: 'Bahasa Inggris Tingkat Lanjut',
    aliases: ['Bahasa Inggris Tingkat Lanjut', 'Bahasa dan Sastra Inggris'],
    defaultLevel: 'SMA',
  },
  {
    code: 'BAHASA_ASING_LAIN',
    name: 'Bahasa Asing Lainnya',
    aliases: ['Bahasa Arab', 'Bahasa Jepang', 'Bahasa Jerman', 'Bahasa Perancis', 'Bahasa Mandarin', 'Bahasa Korea'],
    defaultLevel: 'SMA',
  },
];

/**
 * Normalisasi string teks untuk perbandingan nama/alias
 */
export function normalizeSubjectString(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[(),.\-_/&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cari mata pelajaran berdasarkan code
 */
export function findSubjectByCode(code?: string): CurriculumSubject | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const norm = code.trim().toUpperCase();
  return CURRICULUM_SUBJECTS.find((s) => s.code === norm);
}

/**
 * Cari mata pelajaran berdasarkan nama atau alias
 */
export function findSubjectByNameOrAlias(nameOrAlias: string): CurriculumSubject | undefined {
  if (!nameOrAlias) return undefined;
  const normQuery = normalizeSubjectString(nameOrAlias);

  // Exact code match
  const byCode = CURRICULUM_SUBJECTS.find((s) => s.code.toLowerCase() === normQuery);
  if (byCode) return byCode;

  // Exact name match
  const byName = CURRICULUM_SUBJECTS.find(
    (s) => normalizeSubjectString(s.name) === normQuery
  );
  if (byName) return byName;

  // Alias match
  const byAlias = CURRICULUM_SUBJECTS.find((s) =>
    s.aliases?.some((a) => normalizeSubjectString(a) === normQuery)
  );
  if (byAlias) return byAlias;

  // Fuzzy match with word boundary safety
  return CURRICULUM_SUBJECTS.find((s) => {
    const sNorm = normalizeSubjectString(s.name);
    if (normQuery.includes(sNorm) || sNorm.includes(normQuery)) return true;
    return s.aliases?.some((a) => {
      const aNorm = normalizeSubjectString(a);
      return normQuery.includes(aNorm) || aNorm.includes(normQuery);
    });
  });
}

/**
 * Daftar kode baku mata pelajaran kelompok Pendidikan Agama dan Budi Pekerti
 */
export const RELIGION_SUBJECT_CODES = [
  'PAI',
  'PAK',
  'PKAT',
  'PHINDU',
  'PBUDDHA',
  'PKHONGHUCU',
] as const;

export type ReligionSubjectCode = (typeof RELIGION_SUBJECT_CODES)[number];

/**
 * Memeriksa apakah suatu kode mata pelajaran termasuk kelompok Pendidikan Agama dan Budi Pekerti.
 * Menggunakan kode kanonikal resmi, bukan pencarian substring nama sembarangan.
 */
export function isReligionSubject(subjectCode?: string): boolean {
  if (!subjectCode || typeof subjectCode !== 'string') return false;
  const norm = subjectCode.trim().toUpperCase();
  return (RELIGION_SUBJECT_CODES as readonly string[]).includes(norm);
}

