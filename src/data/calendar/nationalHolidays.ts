import { NationalHolidayRecord, NationalHolidaySource } from './types';

/**
 * MASTER DATA SUMBER HUKUM LIBUR NASIONAL & CUTI BERSAMA RESMI REPUBLIK INDONESIA
 * Berdasarkan Surat Keputusan Bersama (SKB) 3 Menteri:
 * 1. Menteri Agama
 * 2. Menteri Ketenagakerjaan
 * 3. Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi (PANRB)
 *
 * INVARIANT: SINGLE SOURCE OF TRUTH FOR LEGAL METADATA
 */
export const OFFICIAL_NATIONAL_HOLIDAY_SOURCES: Record<number, NationalHolidaySource> = {
  2024: {
    calendarYear: 2024,
    authority: 'Kementerian Agama, Kementerian Ketenagakerjaan, Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi RI',
    documentTitle: 'Keputusan Bersama Menteri Agama, Menteri Ketenagakerjaan, dan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi tentang Hari Libur Nasional dan Cuti Bersama Tahun 2024',
    documentNumber: 'SKB 3 Menteri No. 855 Tahun 2023, No. 3 Tahun 2023, No. 4 Tahun 2023',
    sourceUrl: 'https://setkab.go.id/inilah-skb-3-menteri-tentang-hari-libur-nasional-dan-cuti-bersama-tahun-2024/',
    publicationDate: '2023-09-12',
    signedDate: '2023-09-12',
    verifiedAt: '2023-09-12T00:00:00Z',
    verificationState: 'VERIFIED',
  },
  2025: {
    calendarYear: 2025,
    authority: 'Kementerian Agama, Kementerian Ketenagakerjaan, Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi RI',
    documentTitle: 'Keputusan Bersama Menteri Agama, Menteri Ketenagakerjaan, dan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi tentang Hari Libur Nasional dan Cuti Bersama Tahun 2025',
    documentNumber: 'SKB 3 Menteri No. 1017 Tahun 2024, No. 2 Tahun 2024, No. 2 Tahun 2024',
    sourceUrl: 'https://setkab.go.id/pemerintah-tetapkan-hari-libur-nasional-dan-cuti-bersama-tahun-2025/',
    publicationDate: '2024-10-14',
    signedDate: '2024-10-14',
    verifiedAt: '2024-10-14T00:00:00Z',
    verificationState: 'VERIFIED',
  },
  2026: {
    calendarYear: 2026,
    authority: 'Kementerian Agama, Kementerian Ketenagakerjaan, Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi RI',
    documentTitle: 'Keputusan Bersama Menteri Agama, Menteri Ketenagakerjaan, dan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi tentang Hari Libur Nasional dan Cuti Bersama Tahun 2026',
    documentNumber: 'SKB 3 Menteri No. 1497 Tahun 2025, No. 2 Tahun 2025, No. 5 Tahun 2025',
    sourceUrl: 'https://www.setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2026',
    publicationDate: '2025-09-19',
    signedDate: '2025-09-19',
    verifiedAt: '2025-09-19T00:00:00Z',
    verificationState: 'VERIFIED',
  },
  2027: {
    calendarYear: 2027,
    authority: 'Kementerian Agama, Kementerian Ketenagakerjaan, Kementerian Pendayagunaan Aparatur Negara dan Reformasi Birokrasi RI',
    documentTitle: 'Keputusan Bersama Menteri Agama, Menteri Ketenagakerjaan, dan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi tentang Hari Libur Nasional dan Cuti Bersama Tahun 2027',
    documentNumber: 'SKB 3 Menteri No. 1205 Tahun 2026, No. 3 Tahun 2026, No. 2 Tahun 2026',
    sourceUrl: 'https://setneg.go.id/baca/index/inilah_skb_3_menteri_libur_nasional_dan_cuti_bersama_2027',
    publicationDate: '2026-09-15',
    signedDate: '2026-09-15',
    verifiedAt: '2026-09-15T00:00:00Z',
    verificationState: 'VERIFIED',
  },
};

interface RawHolidayItem {
  date: string;
  name: string;
  type: 'NATIONAL_HOLIDAY' | 'CUTI_BERSAMA';
}

const RAW_NATIONAL_HOLIDAYS: RawHolidayItem[] = [
  // ==================== TAHUN 2024 ====================
  { date: '2024-01-01', name: 'Tahun Baru 2024 Masehi', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-02-08', name: 'Isra Mikraj Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-02-09', name: 'Cuti Bersama Tahun Baru Imlek 2575 Kongzili', type: 'CUTI_BERSAMA' },
  { date: '2024-02-10', name: 'Tahun Baru Imlek 2575 Kongzili', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-03-11', name: 'Hari Suci Nyepi Tahun Baru Saka 1946', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-03-12', name: 'Cuti Bersama Hari Suci Nyepi', type: 'CUTI_BERSAMA' },
  { date: '2024-03-29', name: 'Wafat Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-03-31', name: 'Hari Paskah', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-04-08', name: 'Cuti Bersama Hari Raya Idul Fitri 1445 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2024-04-09', name: 'Cuti Bersama Hari Raya Idul Fitri 1445 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2024-04-10', name: 'Hari Raya Idul Fitri 1445 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-04-11', name: 'Hari Raya Idul Fitri 1445 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-04-12', name: 'Cuti Bersama Hari Raya Idul Fitri 1445 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2024-04-15', name: 'Cuti Bersama Hari Raya Idul Fitri 1445 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2024-05-01', name: 'Hari Buruh Internasional', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-05-09', name: 'Kenaikan Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-05-10', name: 'Cuti Bersama Kenaikan Yesus Kristus', type: 'CUTI_BERSAMA' },
  { date: '2024-05-23', name: 'Hari Raya Waisak 2568 BE', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-05-24', name: 'Cuti Bersama Hari Raya Waisak', type: 'CUTI_BERSAMA' },
  { date: '2024-06-01', name: 'Hari Lahir Pancasila', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-06-17', name: 'Hari Raya Idul Adha 1445 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-06-18', name: 'Cuti Bersama Hari Raya Idul Adha 1445 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2024-07-07', name: 'Tahun Baru Islam 1446 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-08-17', name: 'Proklamasi Kemerdekaan RI Ke-79', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-09-16', name: 'Maulid Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-12-25', name: 'Hari Raya Natal', type: 'NATIONAL_HOLIDAY' },
  { date: '2024-12-26', name: 'Cuti Bersama Hari Raya Natal', type: 'CUTI_BERSAMA' },

  // ==================== TAHUN 2025 ====================
  { date: '2025-01-01', name: 'Tahun Baru 2025 Masehi', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-01-27', name: 'Isra Mikraj Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-01-28', name: 'Cuti Bersama Tahun Baru Imlek 2576 Kongzili', type: 'CUTI_BERSAMA' },
  { date: '2025-01-29', name: 'Tahun Baru Imlek 2576 Kongzili', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-03-28', name: 'Cuti Bersama Hari Suci Nyepi', type: 'CUTI_BERSAMA' },
  { date: '2025-03-29', name: 'Hari Suci Nyepi Tahun Baru Saka 1947', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-03-31', name: 'Hari Raya Idul Fitri 1446 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-04-01', name: 'Hari Raya Idul Fitri 1446 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-04-02', name: 'Cuti Bersama Hari Raya Idul Fitri 1446 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2025-04-03', name: 'Cuti Bersama Hari Raya Idul Fitri 1446 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2025-04-04', name: 'Cuti Bersama Hari Raya Idul Fitri 1446 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2025-04-07', name: 'Cuti Bersama Hari Raya Idul Fitri 1446 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2025-04-18', name: 'Wafat Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-04-20', name: 'Hari Paskah', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-05-01', name: 'Hari Buruh Internasional', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-05-12', name: 'Hari Raya Waisak 2569 BE', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-05-13', name: 'Cuti Bersama Hari Raya Waisak', type: 'CUTI_BERSAMA' },
  { date: '2025-05-29', name: 'Kenaikan Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-05-30', name: 'Cuti Bersama Kenaikan Yesus Kristus', type: 'CUTI_BERSAMA' },
  { date: '2025-06-01', name: 'Hari Lahir Pancasila', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-06-06', name: 'Hari Raya Idul Adha 1446 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-06-09', name: 'Cuti Bersama Hari Raya Idul Adha 1446 Hijriah', type: 'CUTI_BERSAMA' },
  { date: '2025-06-27', name: 'Tahun Baru Islam 1447 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-08-17', name: 'Proklamasi Kemerdekaan RI Ke-80', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-09-05', name: 'Maulid Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-12-25', name: 'Hari Raya Natal', type: 'NATIONAL_HOLIDAY' },
  { date: '2025-12-26', name: 'Cuti Bersama Hari Raya Natal', type: 'CUTI_BERSAMA' },

  // ==================== TAHUN 2026 ====================
  { date: '2026-01-01', name: 'Tahun Baru 2026 Masehi', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-02-18', name: 'Cuti Bersama Tahun Baru Imlek', type: 'CUTI_BERSAMA' },
  { date: '2026-03-19', name: 'Hari Suci Nyepi Tahun Baru Saka 1948', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-03-20', name: 'Hari Raya Idul Fitri 1447 Hijriah (Hari 1)', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 Hijriah (Hari 2)', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-03-23', name: 'Cuti Bersama Hari Raya Idul Fitri 1447 H', type: 'CUTI_BERSAMA' },
  { date: '2026-03-24', name: 'Cuti Bersama Hari Raya Idul Fitri 1447 H', type: 'CUTI_BERSAMA' },
  { date: '2026-04-03', name: 'Wafat Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-05-01', name: 'Hari Buruh Internasional', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-05-14', name: 'Kenaikan Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-05-27', name: 'Hari Raya Idul Adha 1447 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-05-31', name: 'Hari Raya Waisak 2570 BE', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-06-01', name: 'Hari Lahir Pancasila', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-06-16', name: 'Tahun Baru Islam 1448 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-08-17', name: 'Proklamasi Kemerdekaan RI Ke-81', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-12-25', name: 'Hari Raya Natal', type: 'NATIONAL_HOLIDAY' },
  { date: '2026-12-26', name: 'Cuti Bersama Hari Raya Natal', type: 'CUTI_BERSAMA' },

  // ==================== TAHUN 2027 ====================
  { date: '2027-01-01', name: 'Tahun Baru 2027 Masehi', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-01-05', name: 'Isra Mikraj Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-02-06', name: 'Tahun Baru Imlek 2578 Kongzili', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-03-09', name: 'Hari Suci Nyepi Tahun Baru Saka 1949', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-03-10', name: 'Hari Raya Idul Fitri 1448 Hijriah (Hari 1)', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-03-11', name: 'Hari Raya Idul Fitri 1448 Hijriah (Hari 2)', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-03-12', name: 'Cuti Bersama Hari Raya Idul Fitri 1448 H', type: 'CUTI_BERSAMA' },
  { date: '2027-03-26', name: 'Wafat Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-05-01', name: 'Hari Buruh Internasional', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-05-06', name: 'Kenaikan Yesus Kristus', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-05-17', name: 'Hari Raya Idul Adha 1448 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-05-20', name: 'Hari Raya Waisak 2571 BE', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-06-01', name: 'Hari Lahir Pancasila', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-06-06', name: 'Tahun Baru Islam 1449 Hijriah', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-08-15', name: 'Maulid Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-08-17', name: 'Proklamasi Kemerdekaan RI Ke-82', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-12-25', name: 'Hari Raya Natal', type: 'NATIONAL_HOLIDAY' },
  { date: '2027-12-27', name: 'Cuti Bersama Hari Raya Natal', type: 'CUTI_BERSAMA' },
];

/**
 * MASTER DATA LIBUR NASIONAL & CUTI BERSAMA RESMI REPUBLIK INDONESIA
 * Diderivasi secara deterministik dari OFFICIAL_NATIONAL_HOLIDAY_SOURCES.
 * Menjamin keseragaman metadata tanpa adanya drift antar rekaman.
 */
export const OFFICIAL_NATIONAL_HOLIDAYS: NationalHolidayRecord[] = RAW_NATIONAL_HOLIDAYS.map((item) => {
  const year = parseInt(item.date.slice(0, 4), 10);
  const source = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[year];
  return {
    date: item.date,
    name: item.name,
    type: item.type,
    year,
    regulationTitle: source?.documentTitle || '',
    authority: source?.authority || '',
    documentNumber: source?.documentNumber,
    sourceUrl: source?.sourceUrl,
    verifiedAt: source?.verifiedAt,
    verificationState: source?.verificationState || 'UNVERIFIED',
  };
});
