import { MasterCPEntry } from './types';

/**
 * MASTER CAPAIAN PEMBELAJARAN RESMI JENJANG SD (FASE A, B, C)
 * Sumber Resmi: Keputusan Kepala BSKAP No. 032/H/KR/2024 & Permendikdasmen No. 13 Tahun 2025
 */
export const SD_CP_ENTRIES: MasterCPEntry[] = [
  // --- FASE A (KELAS 1 & 2 SD) ---
  {
    id: 'cp25-sd-fase-a-pjok',
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    effectiveFrom: '2025-07-01',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'VERIFIED',
    notes: 'CP PJOK Fase A diverifikasi langsung terhadap Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    evidence: [
      {
        regulationId: 'DEC-BSKAP-046-2025',
        sourceUrl: 'https://kurikulum.kemdikbud.go.id/unduhan/keputusan-kepala-bskap-nomor-046-h-kr-2025',
        locator: {
          attachment: 'Lampiran Capaian Pembelajaran PJOK',
          section: 'Fase A (Kelas I dan II SD/MI)',
          table: 'Elemen dan Deskripsi Capaian Pembelajaran PJOK Fase A',
        },
      },
    ],
    generalDescription:
      'Pada akhir Fase A, peserta didik menguasai keterampilan gerak fundamental (lokomotor, non-lokomotor, dan manipulatif) melalui eksplorasi berbagai aktivitas jasmani dan permainan sederhana, menerapkan konsep gerak secara sadar dan aman, berpartisipasi aktif dalam kegiatan fisik, serta membiasakan pola hidup sehat.',
    elements: [
      {
        name: 'Terampil Bergerak',
        content:
          'Peserta didik mempraktikkan keterampilan gerak fundamental (lokomotor, non-lokomotor, dan manipulatif) dalam berbagai situasi gerak dan permainan sederhana yang menyenangkan.',
      },
      {
        name: 'Belajar melalui Gerak',
        content:
          'Peserta didik menerapkan konsep dan strategi gerak serta menunjukkan perilaku fair play, kerja sama, dan menghormati aturan saat beraktivitas jasmani.',
      },
      {
        name: 'Bergaya Hidup Aktif',
        content:
          'Peserta didik berpartisipasi secara aktif dalam kegiatan jasmani harian dan mengenali pentingnya aktivitas fisik untuk kebugaran tubuh.',
      },
      {
        name: 'Memilih Hidup yang Menyehatkan',
        content:
          'Peserta didik mengenali dan menerapkan kebiasaan hidup sehat, menjaga kebersihan diri, serta mengenali bagian tubuh pribadi yang harus dijaga.',
      },
    ],
  },
  {
    id: 'cp24-sd-fase-a-pjok',
    subjectCode: 'PJOK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    effectiveFrom: '2024-06-11',
    effectiveUntil: '2025-06-30',
    implementationFromAcademicYear: '2024/2025',
    implementationUntilAcademicYear: '2024/2025',
    verificationStatus: 'SUPERSEDED',
    notes:
      'CP PJOK Fase A TA 2024/2025 rujukan Keputusan Kepala BSKAP No. 032/H/KR/2024 (telah digantikan oleh Keputusan Kepala BSKAP No. 046/H/KR/2025 untuk TA 2025/2026).',
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
    id: 'cp25-sd-fase-a-pai',
    subjectCode: 'PAI',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP PAI dan Budi Pekerti SD Fase A TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025 (berlaku hingga digantikan oleh Keputusan BKPDM No. 020 Tahun 2026).',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal huruf hijaiyah berharakat, rukun Islam, rukun iman, kalimat thoyyibah, kisah nabi, serta membiasakan akhlak mulia dan tata cara bersuci serta salat fardhu.',
    elements: [
      {
        name: 'Al-Qur’an dan Hadis',
        content:
          'Peserta didik mengenal huruf hijaiyah dan harakatnya, huruf hijaiyah bersambung, dan beberapa surah pendek Al-Qur’an.',
      },
      {
        name: 'Akidah',
        content:
          'Peserta didik mengenal rukun iman kepada Allah, malaikat-malaikat Allah, dan asmaulhusna (ar-Rahman, ar-Rahim, al-Malik, al-Quddus).',
      },
      {
        name: 'Akhlak',
        content:
          'Peserta didik membiasakan bersikap jujur, santun, disiplin, berbakti kepada orang tua, dan menyayangi sesama.',
      },
      {
        name: 'Fikih',
        content:
          'Peserta didik mengenal rukun Islam, melafalkan dua kalimat syahadat, serta tata cara bersuci (wudu) dan salat fardhu.',
      },
      {
        name: 'Sejarah Peradaban Islam',
        content:
          'Peserta didik mengenal kisah keteladanan Nabi Muhammad SAW dan beberapa nabi lainnya.',
      },
    ],
  },
  {
    id: 'cp26-sd-fase-a-pai',
    subjectCode: 'PAI',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'Capaian Pembelajaran Pendidikan Agama Islam dan Budi Pekerti Fase A berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026 (status UNVERIFIED hingga audit dokumen naskah utuh selesai).',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal huruf hijaiyah dan harakatnya, rukun Islam dan rukun iman, membiasakan akhlak mulia dalam keluarga dan sekolah, serta mengenal tata cara bersuci dan salat secara sederhana.',
    elements: [
      {
        name: 'Al-Qur’an dan Hadis',
        content:
          'Peserta didik mengenal huruf hijaiyah berharakat, surah-surah pendek pilihan, dan pesan pokok Al-Qur’an.',
      },
      {
        name: 'Akidah',
        content:
          'Peserta didik memahami rukun iman dasar dan asmaulhusna dalam kehidupan sehari-hari.',
      },
      {
        name: 'Akhlak',
        content:
          'Peserta didik mempraktikkan adab kepada orang tua, guru, teman, dan lingkungan sekitar.',
      },
      {
        name: 'Fikih',
        content:
          'Peserta didik mempraktikkan tata cara bersuci dan gerakan salat fardhu dengan benar.',
      },
      {
        name: 'Sejarah Peradaban Islam',
        content:
          'Peserta didik meneladani kisah masa kecil Nabi Muhammad SAW.',
      },
    ],
  },
  {
    id: 'cp25-sd-fase-a-pak',
    subjectCode: 'PAK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Kristen Fase A TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal kasih Allah melalui ciptaan, keluarga, dan lingkungan, serta mempraktikkan hidup rukun dan bersyukur.',
    elements: [
      {
        name: 'Allah Berkarya',
        content:
          'Peserta didik memahami bahwa Allah menciptakan dirinya dan memelihara kehidupannya.',
      },
      {
        name: 'Manusia dan Nilai-nilai Kristiani',
        content:
          'Peserta didik mempraktikkan sikap saling mengasihi dan menghormati sesama.',
      },
    ],
  },
  {
    id: 'cp26-sd-fase-a-pak',
    subjectCode: 'PAK',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Kristen Fase A berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026.',
    generalDescription:
      'Pada akhir Fase A, peserta didik memahami pemeliharaan Allah dalam keluarga dan sesama serta menerapkan nilai-nilai kasih dalam keseharian.',
    elements: [
      {
        name: 'Allah Berkarya',
        content:
          'Peserta didik meyakini Allah memelihara dirinya, keluarga, dan alam sekitar.',
      },
      {
        name: 'Manusia dan Nilai-nilai Kristiani',
        content:
          'Peserta didik mempraktikkan hidup jujur, santun, dan peduli sesama.',
      },
    ],
  },
  {
    id: 'cp25-sd-fase-a-pkat',
    subjectCode: 'PKAT',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Katolik Fase A TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal diri sebagai anugerah Allah, mengenal pribadi Yesus Kristus, dan membiasakan doa harian.',
    elements: [
      {
        name: 'Pribadi Peserta Didik',
        content:
          'Peserta didik mengenal dirinya unik sebagai ciptaan Allah.',
      },
      {
        name: 'Yesus Kristus',
        content:
          'Peserta didik mengenal kisah kelahiran dan karya kasih Yesus Kristus.',
      },
    ],
  },
  {
    id: 'cp26-sd-fase-a-pkat',
    subjectCode: 'PKAT',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Katolik Fase A berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026.',
    generalDescription:
      'Pada akhir Fase A, peserta didik menyadari kehadiran Allah dalam hidup sehari-hari, meneladani Yesus Kristus, dan hidup bersaudara dengan sesama.',
    elements: [
      {
        name: 'Pribadi Peserta Didik',
        content:
          'Peserta didik menerima diri dan bersyukur atas anugerah kehidupan dari Allah.',
      },
      {
        name: 'Yesus Kristus',
        content:
          'Peserta didik meneladani cinta kasih Yesus dalam perbuatan sehari-hari.',
      },
    ],
  },
  {
    id: 'cp25-sd-fase-a-phindu',
    subjectCode: 'PHINDU',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Hindu Fase A TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal Hyang Widhi Wasa, Tri Kaya Parisudha, serta doa-doa harian sederhana.',
    elements: [
      {
        name: 'Sraddha dan Bhakti',
        content:
          'Peserta didik mengenal Hyang Widhi Wasa sebagai pencipta alam semesta beserta isinya.',
      },
      {
        name: 'Susila',
        content:
          'Peserta didik menerapkan ajaran Tri Kaya Parisudha dalam ucapan dan perbuatan baik.',
      },
    ],
  },
  {
    id: 'cp26-sd-fase-a-phindu',
    subjectCode: 'PHINDU',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Hindu Fase A berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal keagungan Hyang Widhi Wasa, mempraktikkan etika susila Hindu, dan menjaga keharmonisan.',
    elements: [
      {
        name: 'Sraddha dan Bhakti',
        content:
          'Peserta didik memahami kebesaran Hyang Widhi Wasa melalui ciptaan-Nya.',
      },
      {
        name: 'Susila',
        content:
          'Peserta didik membiasakan budi pekerti luhur dan perilaku kasih.',
      },
    ],
  },
  {
    id: 'cp25-sd-fase-a-pbuddha',
    subjectCode: 'PBUDDHA',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Buddha Fase A TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal Triratna, kisah Pangeran Siddharta, serta nilai-nilai moralitas dasar (Pancasila Buddhis).',
    elements: [
      {
        name: 'Sejarah dan Tokoh',
        content:
          'Peserta didik mengenal riwayat kelahiran Pangeran Siddharta.',
      },
      {
        name: 'Moralitas dan Meditasi',
        content:
          'Peserta didik mempraktikkan kasih sayang kepada semua makhluk dan ketenangan pikiran sederhana.',
      },
    ],
  },
  {
    id: 'cp26-sd-fase-a-pbuddha',
    subjectCode: 'PBUDDHA',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Buddha Fase A berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal Triratna, keteladanan Buddha, dan melatih sikap penuh cinta kasih.',
    elements: [
      {
        name: 'Sejarah dan Tokoh',
        content:
          'Peserta didik meneladani sifat luhur Pangeran Siddharta sejak masa kecil.',
      },
      {
        name: 'Moralitas dan Meditasi',
        content:
          'Peserta didik membiasakan perilaku santun, tidak menyakiti makhluk hidup, dan melatih konsentrasi.',
      },
    ],
  },
  {
    id: 'cp25-sd-fase-a-pkhonghucu',
    subjectCode: 'PKHONGHUCU',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-046-2025',
    implementationFromAcademicYear: '2025/2026',
    implementationUntilAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Khonghucu Fase A TA 2025/2026 berbasis Keputusan Kepala BSKAP No. 046/H/KR/2025.',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal Tian, Nabi Kongzi, dan kebajikan dasar (Ren dan Li) dalam keluarga.',
    elements: [
      {
        name: 'Keimanan dan Karakter',
        content:
          'Peserta didik mengenal kebesaran Tian dan menunjukkan bakti kepada orang tua (Xiao).',
      },
      {
        name: 'Tata Krama dan Ibadah',
        content:
          'Peserta didik mempraktikkan sikap hormat, salam, dan doa sederhana Khonghucu.',
      },
    ],
  },
  {
    id: 'cp26-sd-fase-a-pkhonghucu',
    subjectCode: 'PKHONGHUCU',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BKPDM-020-2026',
    implementationFromAcademicYear: '2026/2027',
    verificationStatus: 'UNVERIFIED',
    notes:
      'CP Pendidikan Agama Khonghucu Fase A berdasarkan Keputusan Kepala BKPDM Nomor 020 Tahun 2026.',
    generalDescription:
      'Pada akhir Fase A, peserta didik memahami bakti kepada orang tua, mengenal riwayat Nabi Kongzi, dan mempraktikkan tata krama mulia.',
    elements: [
      {
        name: 'Keimanan dan Karakter',
        content:
          'Peserta didik menerapkan prinsip kebajikan Ren dan bakti dalam keluarga.',
      },
      {
        name: 'Tata Krama dan Ibadah',
        content:
          'Peserta didik mempraktikkan kesantunan Li dalam kehidupan sekolah dan rumah.',
      },
    ],
  },
  {
    id: 'cp-sd-fase-a-bindo',
    subjectCode: 'BINDO',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase A, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar, sesuai dengan tujuan, konteks sosial, dan akademis. Peserta didik mampu memahami pesan lisan dan informasi dari media audio, teks aural, teks visual dan/atau audiovisual.',
    elements: [
      {
        name: 'Menyimak',
        content:
          'Peserta didik mampu bersikap menjadi penyimak yang baik. Peserta didik mampu memahami pesan lisan dan informasi dari media audio, teks aural (teks yang dibacakan dan/atau didengar), dan instruksi lisan sederhana yang berkaitan dengan tujuan berkomunikasi.',
      },
      {
        name: 'Membaca dan Memirsa',
        content:
          'Peserta didik mampu bersikap menjadi pembaca dan pemirsa yang menunjukkan minat terhadap teks yang dibaca atau dipirsa. Peserta didik mampu membaca kata-kata yang dikenalinya sehari-hari dengan fasih.',
      },
      {
        name: 'Berbicara dan Mempresentasikan',
        content:
          'Peserta didik mampu berbicara dengan santun tentang beragam topik yang dikenali menggunakan volume dan intonasi yang tepat sesuai konteks.',
      },
      {
        name: 'Menulis',
        content:
          'Peserta didik mampu menunjukkan keterampilan menulis permulaan dengan benar (cara memegang alat tulis, menggerakkan jari, postur tubuh) di atas kertas dan/atau melalui media digital.',
      },
    ],
  },
  {
    id: 'cp-sd-fase-a-mat',
    subjectCode: 'MAT',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase A, peserta didik dapat memahami bilangan cacah sampai 100, melakukan operasi penjumlahan dan pengurangan bilangan cacah sampai 20, mengidentifikasi dan membandingkan bentuk bangun datar dan bangun ruang sederhana.',
    elements: [
      {
        name: 'Bilangan',
        content:
          'Peserta didik menunjukkan pemahaman dan memiliki intuisi bilangan (number sense) pada bilangan cacah sampai 100, membaca, menulis, membandingkan, serta mengurutkan bilangan cacah sampai 100.',
      },
      {
        name: 'Aljabar',
        content:
          'Peserta didik dapat menunjukan pemahaman makna simbol matematika "=" dalam suatu kalimat matematika yang terkait dengan penjumlahan dan pengurangan bilangan cacah sampai 20.',
      },
      {
        name: 'Pengukuran',
        content:
          'Peserta didik dapat membandingkan panjang dan berat benda secara langsung, dan mengukur serta mengestimasi panjang benda menggunakan satuan tidak baku.',
      },
      {
        name: 'Geometri',
        content:
          'Peserta didik dapat mengenal berbagai bentuk bangun datar (segitiga, segiempat, segi banyak, lingkaran) dan bangun ruang (balok, kubus, kerucut, bola).',
      },
    ],
  },
  {
    id: 'cp-sd-fase-a-pancasila',
    subjectCode: 'PANCASILA',
    phase: 'A',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase A, peserta didik mengenal simbol-simbol Pancasila dan lambang negara Garuda Pancasila, menerapkan nilai-nilai Pancasila di lingkungan keluarga dan sekolah, serta mengenal aturan di rumah dan di sekolah.',
    elements: [
      {
        name: 'Pancasila',
        content:
          'Peserta didik mengenal bendera negara, lagu kebangsaan, simbol dan sila-sila Pancasila dalam lambang negara Garuda Pancasila.',
      },
      {
        name: 'Undang-Undang Dasar Negara Republik Indonesia 1945',
        content:
          'Peserta didik mengenal aturan di lingkungan keluarga dan sekolah, menceritakan contoh sikap mematuhi dan tidak mematuhi aturan.',
      },
      {
        name: 'Bhinneka Tunggal Ika',
        content:
          'Peserta didik mampu menyebutkan identitas dirinya sesuai dengan jenis kelamin, minat, dan perilakunya, membedakan identitas dirinya dengan teman-temannya di lingkungan rumah dan di sekolah.',
      },
      {
        name: 'Negara Kesatuan Republik Indonesia',
        content:
          'Peserta didik mampu mengenal karakteristik dan ciri-ciri fisik lingkungan rumah dan sekolah sebagai bagian tidak terpisahkan dari wilayah NKRI.',
      },
    ],
  },

  // --- FASE B (KELAS 3 & 4 SD) ---
  {
    id: 'cp-sd-fase-b-bindo',
    subjectCode: 'BINDO',
    phase: 'B',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
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
    id: 'cp-sd-fase-b-mat',
    subjectCode: 'MAT',
    phase: 'B',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase B, peserta didik dapat menunjukkan pemahaman dan intuisi bilangan (number sense) pada bilangan cacah sampai 10.000. Mereka dapat melakukan operasi penjumlahan, pengurangan, perkalian, dan pembagian bilangan cacah sampai 100.',
    elements: [
      {
        name: 'Bilangan',
        content:
          'Peserta didik menunjukkan pemahaman dan intuisi bilangan pada bilangan cacah sampai 10.000, membaca, menulis, membandingkan, mengurutkan nilai tempat, serta melakukan operasi penjumlahan dan pengurangan sampai 1.000, perkalian dan pembagian sampai 100.',
      },
      {
        name: 'Aljabar',
        content:
          'Peserta didik dapat mengidentifikasi, menduplikasi, dan mengembangkan pola gambar atau obyek sederhana dan pola bilangan membesar dan mengecil yang melibatkan penjumlahan dan pengurangan pada bilangan cacah sampai 100.',
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
    id: 'cp-sd-fase-b-ipas',
    subjectCode: 'IPAS',
    phase: 'B',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
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
    id: 'cp-sd-fase-b-pancasila',
    subjectCode: 'PANCASILA',
    phase: 'B',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
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
  {
    id: 'cp-sd-fase-b-coding-ai',
    subjectCode: 'CODING_AI',
    phase: 'B',
    level: 'SD',
    regulationSourceId: 'REG-PERMENDIKDASMEN-13-2025',
    implementationFromAcademicYear: '2025/2026',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase B, peserta didik memahami konsep dasar berpikir komputasional sederhana, logika urutan instruksi (algoritma visual), serta pengenalan awal interaksi dengan kecerdasan buatan dalam kehidupan sehari-hari secara aman dan etis.',
    elements: [
      {
        name: 'Berpikir Komputasional dan Logika Algoritma',
        content:
          'Peserta didik mampu memecahkan masalah sederhana melalui dekomposisi langkah-langkah terstruktur dan menyusun blok visual perintah/algoritma instruksional.',
      },
      {
        name: 'Pengenalan Kecerdasan Artifisial & Literasi Digital',
        content:
          'Peserta didik mengenal contoh teknologi kecerdasan artifisial di sekitar (pengenal suara, rekomendasi gambar) dan mempraktikkan etika keamanan digital serta perlindungan data pribadi.',
      },
    ],
  },

  // --- FASE C (KELAS 5 & 6 SD) ---
  {
    id: 'cp-sd-fase-c-bindo',
    subjectCode: 'BINDO',
    phase: 'C',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase C, peserta didik memiliki kemampuan berbahasa untuk berkomunikasi dan bernalar sesuai dengan tujuan dan konteks sosial. Peserta didik mampu memahami, mengolah, dan menginterpretasi informasi serta pesan dari berbagai tipe teks secara kritis dan kreatif.',
    elements: [
      {
        name: 'Menyimak',
        content:
          'Peserta didik mampu menganalisis informasi berupa fakta, prosedur dengan mengidentifikasikan ciri objek dan urutan proses kejadian dan nilai-nilai dari berbagai jenis teks lisan dan aural yang disajikan dalam bentuk lisan, teks aural, dan audio.',
      },
      {
        name: 'Membaca dan Memirsa',
        content:
          'Peserta didik mampu membaca kata-kata dengan berbagai pola kombinasi huruf secara fasih dan indah serta memahami informasi dan kosakata baru yang memiliki makna denotatif, konotatif, dan kiasan untuk mengidentifikasi objek, fenomena, dan karakter.',
      },
      {
        name: 'Berbicara dan Mempresentasikan',
        content:
          'Peserta didik mampu menyampaikan informasi secara lisan untuk tujuan menghibur dan meyakinkan mitra tutur sesuai kaidah dan konteks.',
      },
      {
        name: 'Menulis',
        content:
          'Peserta didik mampu menulis teks eksplanasi, laporan hasil pengamatan, dan teks eksposisi persuasif dengan kaidah tata bahasa dan ejaan yang tepat.',
      },
    ],
  },
  {
    id: 'cp-sd-fase-c-mat',
    subjectCode: 'MAT',
    phase: 'C',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase C, peserta didik dapat menunjukkan pemahaman bilangan pecahan, desimal, persen, melakukan operasi hitung campuran, mengukur volume bangun ruang kubus dan balok, serta menyajikan dan menganalisis data dalam bentuk tabel dan diagram.',
    elements: [
      {
        name: 'Bilangan',
        content:
          'Peserta didik dapat membaca, menulis, membandingkan, dan mengurutkan pecahan, mengubah pecahan ke bentuk desimal dan persen, serta menyelesaikan masalah operasi hitung bilangan pecahan dan desimal.',
      },
      {
        name: 'Geometri dan Pengukuran',
        content:
          'Peserta didik dapat menghitung keliling dan luas berbagai bentuk bangun datar gabungan, serta menghitung volume bangun ruang balok dan kubus menggunakan satuan baku.',
      },
      {
        name: 'Analisis Data dan Peluang',
        content:
          'Peserta didik dapat mengurutkan, membandingkan, menyajikan, dan menganalisis data banyak benda dan data hasil pengukuran dalam bentuk gambar, diagram batang, dan tabel frekuensi.',
      },
    ],
  },
  {
    id: 'cp-sd-fase-c-ipas',
    subjectCode: 'IPAS',
    phase: 'C',
    level: 'SD',
    regulationSourceId: 'DEC-BSKAP-032-2024',
    implementationFromAcademicYear: '2024/2025',
    verificationStatus: 'UNVERIFIED',
    generalDescription:
      'Pada akhir Fase C, peserta didik melakukan simulasi dengan menggunakan gambar/bagan/alat bantu sederhana tentang sistem organ tubuh manusia, sistem tata surya, interaksi antar komponen ekosistem, serta pengaruh aktivitas manusia terhadap lingkungan dan keanekaragaman hayati.',
    elements: [
      {
        name: 'Pemahaman IPAS',
        content:
          'Peserta didik menganalisis sistem pernapasan, pencernaan, dan peredaran darah manusia; memahami rantai makanan dan jaring-jaring makanan dalam ekosistem; mengenal struktur bumi, atmosfer, dan sistem tata surya; serta mengkaji kearifan lokal dan pelestarian sumber daya alam.',
      },
      {
        name: 'Keterampilan Proses',
        content:
          'Merumuskan pertanyaan saintifik, merencanakan prosedur percobaan, mencatat data akurat, menginterpretasikan data, dan menyajikan kesimpulan ilmiah secara kolaboratif.',
      },
    ],
  },
];
