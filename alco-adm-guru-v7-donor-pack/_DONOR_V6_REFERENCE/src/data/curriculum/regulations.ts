import { RegulationSource } from './types';

/**
 * MASTER REGISTRY SUMBER REGULASI RESMI KURIKULUM NASIONAL
 *
 * Prinsip Hierarchy Regulasi:
 * 1. REGULATION (Undang-Undang / Peraturan Menteri)
 * 2. OFFICIAL_DECISION (Keputusan BSKAP / Dirjen)
 * 3. OFFICIAL_GUIDE (Panduan Resmi Kemendikdasmen / BSKAP)
 * 4. OFFICIAL_EXAMPLE (Contoh KSP Resmi - sebagai referensi, bukan regulasi nasional)
 */
export const OFFICIAL_REGULATION_SOURCES: RegulationSource[] = [
  {
    id: 'DEC-BKPDM-020-2026',
    title:
      'Keputusan Kepala Badan Standar, Kurikulum, dan Penjaminan Mutu Pendidikan Nomor 020 Tahun 2026 tentang Capaian Pembelajaran Pendidikan Agama dan Budi Pekerti pada Pendidikan Anak Usia Dini, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah',
    number: '020 Tahun 2026',
    year: 2026,
    type: 'OFFICIAL_DECISION',
    authority:
      'Badan Standar, Kurikulum, dan Penjaminan Mutu Pendidikan (BKPDM) Kementerian Pendidikan Dasar dan Menengah RI',
    legalEffectiveDate: null,
    implementationFromAcademicYear: '2026/2027',
    effectiveFrom: '2026-07-01',
    sourceUrl:
      'https://kurikulum.kemdikbud.go.id/unduhan/keputusan-kepala-bkpdm-nomor-020-tahun-2026',
    notes:
      'Pembaruan Capaian Pembelajaran khusus mata pelajaran kelompok Pendidikan Agama dan Budi Pekerti (PAI, Kristen, Katolik, Hindu, Buddha, Khonghucu) mulai Tahun Ajaran 2026/2027. Tidak mengubah CP mata pelajaran umum/non-agama.',
  },
  {
    id: 'REG-PERMENDIKBUDRISTEK-12-2024',
    title:
      'Permendikbudristek Nomor 12 Tahun 2024 tentang Kurikulum pada Pendidikan Anak Usia Dini, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah',
    number: '12',
    year: 2024,
    type: 'REGULATION',
    authority: 'Kementerian Pendidikan, Kebudayaan, Riset, dan Teknologi RI',
    legalEffectiveDate: '2024-03-26',
    implementationFromAcademicYear: '2024/2025',
    effectiveFrom: '2024-03-26',
    sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=3299',
    notes:
      'Regulasi induk struktur Kurikulum Merdeka nasional untuk SD, SMP, SMA/SMK termasuk alokasi intrakurikuler dan kokurikuler.',
  },
  {
    id: 'REG-PERMENDIKDASMEN-13-2025',
    title:
      'Permendikdasmen Nomor 13 Tahun 2025 tentang Perubahan atas Permendikbudristek Nomor 12 Tahun 2024 tentang Kurikulum pada PAUD, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah',
    number: '13',
    year: 2025,
    type: 'REGULATION',
    authority: 'Kementerian Pendidikan Dasar dan Menengah RI',
    legalEffectiveDate: '2025-07-11',
    implementationFromAcademicYear: '2025/2026',
    effectiveFrom: '2025-07-01',
    sourceUrl: 'https://jdih.kemdikdasmen.go.id/detail_peraturan?main=13-2025',
    notes:
      'Mengatur pembaruan implementasi Kurikulum Merdeka mulai Tahun Ajaran 2025/2026 dan penambahan Mata Pelajaran Pilihan Koding dan Kecerdasan Artifisial (Coding dan AI) untuk jenjang SD, SMP, dan SMA.',
  },
  {
    id: 'DEC-BSKAP-046-2025',
    title:
      'Keputusan Kepala BSKAP No. 046/H/KR/2025 tentang Capaian Pembelajaran pada Pendidikan Anak Usia Dini, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah pada Kurikulum Merdeka',
    number: '046/H/KR/2025',
    year: 2025,
    type: 'OFFICIAL_DECISION',
    authority: 'Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP) Kemendikdasmen RI',
    legalEffectiveDate: '2025-07-16',
    implementationFromAcademicYear: '2025/2026',
    effectiveFrom: '2025-07-01',
    sourceUrl: 'https://kurikulum.kemdikbud.go.id/unduhan/keputusan-kepala-bskap-nomor-046-h-kr-2025',
    notes:
      'Pembaruan Capaian Pembelajaran (CP) 2025 memuat muatan koding dan kecerdasan artifisial serta penyesuaian elemen kompetensi pada jenjang PAUD, Dikdas, dan Dikmen.',
  },
  {
    id: 'GUIDE-BSKAP-PPA-2025',
    title: 'Panduan Pembelajaran dan Asesmen Kurikulum Merdeka (Edisi Revisi 2025)',
    year: 2025,
    type: 'OFFICIAL_GUIDE',
    authority: 'BSKAP Kemendikdasmen RI',
    legalEffectiveDate: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    effectiveFrom: '2025-07-01',
    sourceUrl: 'https://kurikulum.kemdikbud.go.id/unduhan/panduan-pembelajaran-dan-asesmen-2025',
    notes:
      'Panduan resmi perencanaan pembelajaran, alokasi JP efektif, asesmen autentik, dan kriteria ketercapaian tujuan pembelajaran (KKTP) edisi revisi 2025.',
  },
  {
    id: 'DEC-BSKAP-032-2024',
    title:
      'Keputusan Kepala BSKAP No. 032/H/KR/2024 tentang Capaian Pembelajaran pada Pendidikan Anak Usia Dini, Jenjang Pendidikan Dasar, dan Jenjang Pendidikan Menengah pada Kurikulum Merdeka',
    number: '032/H/KR/2024',
    year: 2024,
    type: 'OFFICIAL_DECISION',
    authority: 'Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP) Kemendikbudristek',
    legalEffectiveDate: '2024-06-11',
    implementationFromAcademicYear: '2024/2025',
    effectiveFrom: '2024-06-11',
    effectiveUntil: '2025-06-30',
    sourceUrl: 'https://kurikulum.kemdikbud.go.id/unduhan/keputusan-kepala-bskap-nomor-032-h-kr-2024',
    notes:
      'Regulasi historis penetapan rumusan Capaian Pembelajaran (CP) 2024 untuk Fase Fondasi sampai Fase F. Dimutakhirkan oleh Keputusan Kepala BSKAP No. 046/H/KR/2025.',
  },
  {
    id: 'DEC-BSKAP-031-2024',
    title:
      'Keputusan Kepala BSKAP No. 031/H/KR/2024 tentang Penetapan Satuan Pendidikan Pelaksana Kurikulum Merdeka',
    number: '031/H/KR/2024',
    year: 2024,
    type: 'OFFICIAL_DECISION',
    authority: 'Badan Standar, Kurikulum, dan Asesmen Pendidikan (BSKAP)',
    legalEffectiveDate: '2024-06-01',
    implementationFromAcademicYear: '2024/2025',
    effectiveFrom: '2024-06-01',
    sourceUrl: 'https://kurikulum.kemdikbud.go.id/unduhan/keputusan-kepala-bskap-nomor-031-h-kr-2024',
    notes: 'Penetapan sekolah pelaksana Kurikulum Merdeka secara bertahap.',
  },
  {
    id: 'GUIDE-BSKAP-PPA-2024',
    title: 'Panduan Pembelajaran dan Asesmen Kurikulum Merdeka (Edisi Revisi 2024)',
    year: 2024,
    type: 'OFFICIAL_GUIDE',
    authority: 'BSKAP Kemendikbudristek RI',
    legalEffectiveDate: '2024-06-01',
    implementationFromAcademicYear: '2024/2025',
    effectiveFrom: '2024-06-01',
    effectiveUntil: '2025-06-30',
    sourceUrl: 'https://kurikulum.kemdikbud.go.id/unduhan/panduan-pembelajaran-dan-asesmen-2024',
    notes:
      'Petunjuk teknis perencanaan pembelajaran, penyusunan TP/ATP, alokasi waktu, kriteria ketercapaian tujuan pembelajaran (KKTP), dan asesmen formatif/sumatif 2024.',
  },
  {
    id: 'REG-PERMENDIKBUD-37-2018',
    title:
      'Permendikbud Nomor 37 Tahun 2018 tentang Perubahan atas Permendikbud Nomor 24 Tahun 2016 tentang Kompetensi Inti dan Kompetensi Dasar Pelajaran pada Kurikulum 2013 pada Pendidikan Dasar dan Pendidikan Menengah',
    number: '37',
    year: 2018,
    type: 'REGULATION',
    authority: 'Kementerian Pendidikan dan Kebudayaan RI',
    legalEffectiveDate: '2018-12-21',
    implementationFromAcademicYear: '2018/2019',
    effectiveFrom: '2018-12-21',
    sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=2178',
    notes:
      'Memuat struktur KI dan KD resmi untuk Kurikulum 2013 (K13) tingkat SD, SMP, dan SMA.',
  },
  {
    id: 'REG-PERMENDIKBUD-35-2018',
    title:
      'Permendikbud Nomor 35 Tahun 2018 tentang Perubahan atas Permendikbud Nomor 58 Tahun 2014 tentang Kurikulum 2013 Sekolah Menengah Pertama / Madrasah Tsanawiyah',
    number: '35',
    year: 2018,
    type: 'REGULATION',
    authority: 'Kementerian Pendidikan dan Kebudayaan RI',
    legalEffectiveDate: '2018-12-01',
    implementationFromAcademicYear: '2018/2019',
    effectiveFrom: '2018-12-01',
    sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=2180',
    notes: 'Struktur kurikulum dan beban belajar Kurikulum 2013 SMP/MTs.',
  },
  {
    id: 'REG-PERMENDIKBUD-36-2018',
    title:
      'Permendikbud Nomor 36 Tahun 2018 tentang Perubahan atas Permendikbud Nomor 59 Tahun 2014 tentang Kurikulum 2013 Sekolah Menengah Atas / Madrasah Aliyah',
    number: '36',
    year: 2018,
    type: 'REGULATION',
    authority: 'Kementerian Pendidikan dan Kebudayaan RI',
    legalEffectiveDate: '2018-12-01',
    implementationFromAcademicYear: '2018/2019',
    effectiveFrom: '2018-12-01',
    sourceUrl: 'https://jdih.kemdikbud.go.id/detail_peraturan?main=2181',
    notes: 'Struktur kurikulum dan beban belajar Kurikulum 2013 SMA/MA.',
  },
];

/**
 * Helper to fetch a regulation by ID
 */
export function getRegulationSource(id: string): RegulationSource | undefined {
  return OFFICIAL_REGULATION_SOURCES.find((reg) => reg.id === id);
}

/**
 * Helper to fetch multiple regulations by ID array
 */
export function getRegulationSources(ids: string[]): RegulationSource[] {
  return OFFICIAL_REGULATION_SOURCES.filter((reg) => ids.includes(reg.id));
}

export const CURRICULUM_REGULATIONS = OFFICIAL_REGULATION_SOURCES;
