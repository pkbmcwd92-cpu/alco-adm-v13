import {
  TeachingAssignment,
  AdditionalDuty,
  TeacherLoadValidationResult,
} from '../types/jpEngine';

/**
 * Daftar Tugas Tambahan Terstandar Berdasarkan Regulasi Resmi
 * Acuan: Permendikdasmen Nomor 11 Tahun 2025
 */
export const PREDEFINED_ADDITIONAL_DUTIES: Array<{
  role: string;
  defaultJP: number;
  category: string;
  regulationReference: string;
  description: string;
}> = [
  {
    role: 'Wakil Kepala Sekolah',
    defaultJP: 12,
    category: 'Manajerial Satuan Pendidikan',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 12 JP/minggu untuk tugas wakil kepala sekolah.',
  },
  {
    role: 'Ketua Program Keahlian (SMK)',
    defaultJP: 12,
    category: 'Manajerial Kejuruan',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 12 JP/minggu untuk ketua kompetensi keahlian/jurusan.',
  },
  {
    role: 'Kepala Perpustakaan Sekolah',
    defaultJP: 12,
    category: 'Pengelolaan Unit Sumber Belajar',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 12 JP/minggu bagi guru pengelola perpustakaan tersertifikasi.',
  },
  {
    role: 'Kepala Laboratorium / Bengkel / Studio',
    defaultJP: 12,
    category: 'Pengelolaan Laboratorium & Praktik',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 12 JP/minggu untuk kepala lab/bengkel/studio.',
  },
  {
    role: 'Koordinator Projek Penguatan Profil Pelajar Pancasila (P5) / Kokurikuler',
    defaultJP: 2,
    category: 'Kokurikuler & Karakter',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025 & Permendikbudristek No. 12/2024',
    description: 'Ekuivalensi 2 JP/minggu per rombel yang dikoordinasikan (maksimal 3 rombel/6 JP).',
  },
  {
    role: 'Wali Kelas',
    defaultJP: 2,
    category: 'Pembimbingan Kelas',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 2 JP/minggu untuk pendampingan akademik dan karakter satu rombel.',
  },
  {
    role: 'Pembina OSIS',
    defaultJP: 2,
    category: 'Kesiswaan',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 2 JP/minggu untuk pembinaan organisasi siswa intra sekolah.',
  },
  {
    role: 'Pembina Ekstrakurikuler (Pramuka/PMR/Paskibra/Seni/Olahraga)',
    defaultJP: 2,
    category: 'Kesiswaan & Pengembangan Diri',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 2 JP/minggu untuk pembinaan kegiatan ekstrakurikuler resmi.',
  },
  {
    role: 'Guru Pembimbing Khusus (Pendidikan Inklusif)',
    defaultJP: 6,
    category: 'Layanan Khusus & Inklusi',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 6 JP/minggu untuk pendampingan peserta didik berkebutuhan khusus.',
  },
  {
    role: 'Guru Piket',
    defaultJP: 1,
    category: 'Ketertiban & Kedisiplinan',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 1 JP/minggu untuk pelaksanaan tugas piket sekolah terjadwal.',
  },
  {
    role: 'Tim Pengembang Kurikulum / Komite Pembelajaran',
    defaultJP: 2,
    category: 'Pengembangan Akademik',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 2 JP/minggu untuk penyusunan KSP/KTSP dan perangkat kurikulum.',
  },
  {
    role: 'Penilai Kinerja Guru (PKG)',
    defaultJP: 2,
    category: 'Penjaminan Mutu Pendidik',
    regulationReference: 'Permendikdasmen No. 11 Tahun 2025',
    description: 'Ekuivalensi 2 JP/minggu untuk pelaksanaan evaluasi dan penilaian kinerja pendidik.',
  },
];

/**
 * Menghitung dan memvalidasi beban kerja guru
 * Acuan: Permendikdasmen Nomor 11 Tahun 2025 (Standar 24 - 40 JP per minggu)
 */
export function calculateTeacherWorkload(
  assignments: TeachingAssignment[] = [],
  additionalDuties: AdditionalDuty[] = [],
  teacherName?: string
): TeacherLoadValidationResult {
  const MIN_JP = 24;
  const MAX_JP = 40;

  const assignmentBreakdown = assignments.map((a) => {
    const weeklyJP = Number(a.weeklyJP) || 0;
    const classCount = Number(a.classCount) > 0 ? Number(a.classCount) : 1;
    const subtotalJP = weeklyJP * classCount;
    return {
      subject: a.subject || 'Mata Pelajaran',
      grade: a.grade || '-',
      weeklyJP,
      classCount,
      subtotalJP,
    };
  });

  const totalDirectTeachingJP = assignmentBreakdown.reduce((sum, item) => sum + item.subtotalJP, 0);

  const dutiesBreakdown = additionalDuties.map((d) => ({
    role: d.role,
    equivalentWeeklyJP: Number(d.equivalentWeeklyJP) || 0,
    decreeNumber: d.decreeNumber,
  }));

  const totalAdditionalDutiesJP = dutiesBreakdown.reduce((sum, item) => sum + item.equivalentWeeklyJP, 0);

  const totalWorkloadJP = totalDirectTeachingJP + totalAdditionalDutiesJP;
  const isMinimumFulfilled = totalWorkloadJP >= MIN_JP;
  const isWithinMaximum = totalWorkloadJP <= MAX_JP;

  let status: 'BELUM_MEMENUHI' | 'MEMENUHI' | 'MELEBIHI_BATAS_MAKSIMAL' = 'BELUM_MEMENUHI';
  let statusLabel = 'Belum Memenuhi Beban Minimal (Kurang dari 24 JP)';
  let statusDescription = `Beban mengajar saat ini ${totalWorkloadJP} JP/minggu. Membutuhkan tambahan ${MIN_JP - totalWorkloadJP} JP tatap muka atau ekuivalensi tugas tambahan agar memenuhi syarat sertifikasi (min. 24 JP).`;

  if (totalWorkloadJP >= MIN_JP && totalWorkloadJP <= MAX_JP) {
    status = 'MEMENUHI';
    statusLabel = 'Memenuhi Standar Regulasi (24 - 40 JP)';
    statusDescription = `Beban mengajar ${totalWorkloadJP} JP/minggu (Tatap Muka: ${totalDirectTeachingJP} JP, Tugas Tambahan: ${totalAdditionalDutiesJP} JP) telah memenuhi ketentuan Permendikdasmen No. 11 Tahun 2025.`;
  } else if (totalWorkloadJP > MAX_JP) {
    status = 'MELEBIHI_BATAS_MAKSIMAL';
    statusLabel = 'Melebihi Batas Maksimal (Lebih dari 40 JP)';
    statusDescription = `Beban mengajar mencapai ${totalWorkloadJP} JP/minggu, melampaui batas maksimal regulasi (40 JP/minggu) sebesar ${totalWorkloadJP - MAX_JP} JP. Disarankan redistribusi tugas mengajar.`;
  }

  return {
    teacherName,
    totalDirectTeachingJP,
    totalAdditionalDutiesJP,
    totalWorkloadJP,
    minimumRequirementJP: MIN_JP,
    maximumRequirementJP: MAX_JP,
    isMinimumFulfilled,
    isWithinMaximum,
    status,
    statusLabel,
    statusDescription,
    breakdown: {
      assignments: assignmentBreakdown,
      additionalDuties: dutiesBreakdown,
    },
    regulatoryBasis: 'Permendikdasmen Nomor 11 Tahun 2025 tentang Pemenuhan Beban Kerja Guru',
  };
}
