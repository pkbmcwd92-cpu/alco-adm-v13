import { MasterCPEntry } from './types';

/**
 * MASTER CAPAIAN PEMBELAJARAN RESMI JENJANG SMA (FASE E & FASE F)
 * Sumber Resmi: Keputusan Kepala BSKAP No. 032/H/KR/2024 & Permendikdasmen No. 13 Tahun 2025
 */
export const SMA_CP_ENTRIES: MasterCPEntry[] = [
  // --- FASE E (KELAS 10 SMA) ---
  {
    id: 'cp25-sma-fase-e-pai',
    subjectCode: 'PAI',
    phase: 'E',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    effectiveFrom: '2025-07-01',
    effectiveUntil: '2026-06-30',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP PAI dan Budi Pekerti SMA Fase E TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    generalDescription:
      'Pada akhir Fase E, peserta didik menganalisis ayat Al-Qur’an dan hadis tentang berpikir kritis dan toleransi, cabang-cabang iman (syu’abul iman), bahaya pergaulan bebas dan minuman keras, fikih muamalah kontemporer, serta peran tokoh Islam di Indonesia.',
    elements: [
      {
        name: 'Al-Qur’an dan Hadis',
        content:
          'Peserta didik menganalisis ayat Al-Qur’an dan hadis tentang perintah berpikir kritis, toleransi beragama, dan memelihara kehidupan manusia.',
      },
      {
        name: 'Akidah',
        content:
          'Peserta didik menganalisis cabang-cabang iman (syu’abul iman), keterkaitan antara iman, Islam, dan ihsan dalam kehidupan bermasyarakat.',
      },
      {
        name: 'Akhlak',
        content:
          'Peserta didik menghindari akhlak mazmumah (pergaulan bebas, narkoba, judi online) dan membiasakan akhlak mahmudah.',
      },
      {
        name: 'Fikih',
        content:
          'Peserta didik menganalisis ketentuan fikih muamalah: asuransi syariah, perbankan syariah, dan koperasi syariah.',
      },
      {
        name: 'Sejarah Peradaban Islam',
        content:
          'Peserta didik menganalisis sejarah dan peran ulama penyebar Islam (Wali Songo) serta kontribusi kerajaan Islam di Nusantara.',
      },
    ],
  },
  {
    id: 'cp26-sma-fase-e-pai',
    subjectCode: 'PAI',
    phase: 'E',
    level: 'SMA',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    effectiveFrom: '2026-07-01',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'Capaian Pembelajaran PAI dan Budi Pekerti SMA Fase E berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026.',
    generalDescription:
      'Pada akhir Fase E, peserta didik mampu menganalisis pesan Al-Qur’an dan hadis tentang integritas, berpikir kritis, moderasi beragama, cabang-cabang iman, fikih kontemporer, serta keteladanan tokoh peradaban Islam di Indonesia.',
    elements: [
      {
        name: 'Al-Qur’an dan Hadis',
        content:
          'Peserta didik menganalisis ayat Al-Qur’an dan hadis tentang etika berpikir ilmiah, integritas, dan penguatan kerukunan umat beragama.',
      },
      {
        name: 'Akidah',
        content:
          'Peserta didik mendalami implementasi syu’abul iman dalam menjaga kehormatan diri dan harmoni sosial.',
      },
      {
        name: 'Akhlak',
        content:
          'Peserta didik mengaktualisasikan akhlak mulia dalam pencegahan kekerasan, penyalahgunaan teknologi, dan menjaga kelestarian lingkungan.',
      },
      {
        name: 'Fikih',
        content:
          'Peserta didik memahami dan menganalisis prinsip-prinsip transaksi ekonomi syariah dan muamalah modern yang etis.',
      },
      {
        name: 'Sejarah Peradaban Islam',
        content:
          'Peserta didik meneladani perjuangan para ulama dan tokoh Islam dalam membangun peradaban dan kebangsaan Indonesia.',
      },
    ],
  },
  {
    id: 'cp-sma-fase-e-bindo',
    subjectCode: 'BINDO',
    phase: 'E',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase E, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar sesuai dengan tujuan, konteks sosial, akademis, dan dunia kerja. Peserta didik mampu mengevaluasi informasi, ide pokok, dan pesan implisit dari berbagai tipe teks fiksi dan nonfiksi.',
    elements: [
      {
        name: 'Menyimak',
        content:
          'Peserta didik mampu mengevaluasi dan mengkreasi informasi berupa gagasan, pikiran, perasaan, pandangan, arahan atau pesan yang akurat dari menyimak berbagai jenis teks (nonfiksi dan fiksi).',
      },
      {
        name: 'Membaca dan Memirsa',
        content:
          'Peserta didik mampu mengevaluasi informasi berupa gagasan,pikiran, pandangan, arahan atau pesan dari berbagai jenis teks, mengapresiasi teks fiksi dan nonfiksi.',
      },
      {
        name: 'Berbicara dan Mempresentasikan',
        content:
          'Peserta didik mampu mengolah dan menyajikan gagasan, pikiran, pandangan, arahan atau pesan untuk tujuan pengajuan usul, perumusan masalah, dan solusi dalam bentuk monolog, dialog, dan gelar wicara.',
      },
      {
        name: 'Menulis',
        content:
          'Peserta didik mampu menulis gagasan,pikiran, pandangan, arahan atau pesan tertulis untuk berbagai tujuan secara logis, kritis, dan kreatif dalam bentuk teks fiksi dan nonfiksi.',
      },
    ],
  },
  {
    id: 'cp-sma-fase-e-mat',
    subjectCode: 'MAT',
    phase: 'E',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase E, peserta didik dapat menggeneralisasi sifat-sifat bilangan berpangkat (eksponen) dan logaritma, barisan dan deret, sistem persamaan linear tiga variabel, perbandingan trigonometri siku-siku, serta statistika dan peluang.',
    elements: [
      {
        name: 'Bilangan & Aljabar',
        content:
          'Peserta didik dapat menggeneralisasi sifat-sifat operasi bilangan berpangkat (eksponen) dan logaritma, menyelesaikan sistem persamaan linear tiga variabel dan sistem pertidaksamaan linear dua variabel.',
      },
      {
        name: 'Geometri dan Trigonometri',
        content:
          'Peserta didik dapat menyelesaikan permasalahan segitiga siku-siku yang melibatkan perbandingan trigonometri dan aplikasinya.',
      },
      {
        name: 'Analisis Data dan Peluang',
        content:
          'Peserta didik dapat menampilkan dan menginterpretasikan data menggunakan diagram pencar (scatter plot) dan menghitung peluang kejadian majemuk.',
      },
    ],
  },
  {
    id: 'cp-sma-fase-e-fisika',
    subjectCode: 'FISIKA',
    phase: 'E',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase E, peserta didik mengidentifikasi besaran dan satuan pengukuran, energi terbarukan dan dampaknya terhadap lingkungan, serta prinsip pemanasan global.',
    elements: [
      {
        name: 'Pemahaman Fisika',
        content:
          'Peserta didik memahami konsep pengukuran besaran fisis, aturan angka penting, efisiensi energi, sumber energi alternatif terbarukan, serta mitigasi perubahan iklim global.',
      },
      {
        name: 'Keterampilan Proses',
        content:
          'Mengamati fenomena energi, merancang penyelidikan ilmiah menggunakan instrumen presisi, menganalisis data empiris, dan menyajikan solusi energi ramah lingkungan.',
      },
    ],
  },

  // --- FASE F (KELAS 11 & 12 SMA) ---
  {
    id: 'cp-sma-fase-f-bindo',
    subjectCode: 'BINDO',
    phase: 'F',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase F, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar sesuai dengan tujuan, konteks sosial, akademis, dan dunia kerja secara mandiri, kritis, dan beretika. Peserta didik mampu menulis karya ilmiah dan teks sastra bermutu.',
    elements: [
      {
        name: 'Menyimak',
        content:
          'Peserta didik mampu mengevaluasi berbagai gagasan dan pandangan berdasarkan kaidah logika berpikir dari menyimak berbagai jenis teks di ranah akademis dan profesional.',
      },
      {
        name: 'Membaca dan Memirsa',
        content:
          'Peserta didik mampu mengevaluasi gagasan dan pandangan berdasarkan kaidah logika berpikir dari membaca berbagai jenis teks karya ilmiah, esai, dan novel sastra.',
      },
      {
        name: 'Menulis',
        content:
          'Peserta didik mampu menulis gagasan, pikiran, pandangan, pengetahuan metakognisi untuk berbagai tujuan secara logis, kritis, dan kreatif dalam bentuk karya ilmiah dan karya kreatif.',
      },
    ],
  },
  {
    id: 'cp-sma-fase-f-mat',
    subjectCode: 'MAT',
    phase: 'F',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase F, peserta didik dapat memodelkan pinjaman dan investasi dengan bunga majemuk dan anuitas, menerapkan konsep matriks, transformasi geometri, serta fungsi invers dan komposisi.',
    elements: [
      {
        name: 'Aljabar dan Fungsi',
        content:
          'Peserta didik dapat menentukan fungsi invers, komposisi fungsi, dan transformasi fungsi untuk memodelkan situasi dunia nyata.',
      },
      {
        name: 'Matematika Finansial',
        content:
          'Peserta didik dapat memodelkan situasi keuangan menggunakan bunga majemuk, diskonto, dan anuitas.',
      },
      {
        name: 'Geometri dan Matriks',
        content:
          'Peserta didik dapat melakukan operasi aljabar pada matriks dan menerapkannya dalam transformasi geometri dan sistem persamaan.',
      },
    ],
  },
  {
    id: 'cp-sma-fase-f-fisika',
    subjectCode: 'FISIKA',
    phase: 'F',
    level: 'SMA',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase F (Mapel Pilihan), peserta didik memahami konsep mekanika fluida, termodinamika, gelombang mekanik dan elektromagnetik, rangkaian arus searah dan bolak-balik, serta dasar fisika modern.',
    elements: [
      {
        name: 'Pemahaman Fisika Tingkat Lanjut',
        content:
          'Menerapkan hukum-hukum termodinamika, kinematika gerak melingkar dan harmonik, fluida statis dan dinamis, induksi elektromagnetik, dan teori relativitas khusus.',
      },
      {
        name: 'Keterampilan Proses & Eksperimen',
        content:
          'Merancang dan melakukan eksperimen laboratorium fisika, mengolah data menggunakan alat analisis digital, dan mempresentasikan laporan ilmiah.',
      },
    ],
  },
];
