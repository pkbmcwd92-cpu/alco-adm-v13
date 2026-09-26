import {
  AcademicCalendar,
  CalendarDay,
  CalendarDayStatus,
  CalendarProvenance,
  CalendarResolutionStatus,
  CalendarSourceType,
  CalendarWorkflowStatus,
  SchoolData,
  AcademicSetting,
} from '../types';
import {
  OFFICIAL_NATIONAL_HOLIDAYS,
  OFFICIAL_NATIONAL_HOLIDAY_SOURCES,
  OFFICIAL_REGIONAL_CALENDARS,
  NationalHolidayRecord,
  RegionalEducationCalendar,
} from '../data/calendar';
import { resolveSemester } from './jpEngine';

export interface CalendarResolutionResult {
  isResolved: boolean;
  workflowStatus: CalendarWorkflowStatus;
  resolutionStatus: CalendarResolutionStatus;
  calendar: AcademicCalendar | null;
  days: CalendarDay[];
  matchedRegionalSource?: RegionalEducationCalendar;
  nationalHolidaysApplied: NationalHolidayRecord[];
  diagnostic: string;
  actionableMessage?: string;
}

/**
 * Normalisasi nama provinsi untuk pencocokan toleran tapi aman
 */
export function normalizeProvinceName(province?: string): string {
  if (!province) return '';
  const clean = province
    .toLowerCase()
    .replace(/^prov(\.|insi)?\s+/i, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (clean === 'jabar' || clean.includes('jawa barat')) return 'Jawa Barat';
  if (clean === 'dki' || clean.includes('jakarta')) return 'DKI Jakarta';
  if (clean === 'jateng' || clean.includes('jawa tengah')) return 'Jawa Tengah';
  if (clean === 'jatim' || clean.includes('jawa timur')) return 'Jawa Timur';
  if (clean === 'diy' || clean.includes('yogyakarta') || clean.includes('jogja')) return 'DI Yogyakarta';
  if (clean.includes('banten')) return 'Banten';
  if (clean.includes('bali')) return 'Bali';
  if (clean === 'sumut' || clean.includes('sumatera utara')) return 'Sumatera Utara';
  if (clean === 'sumbar' || clean.includes('sumatera barat')) return 'Sumatera Barat';
  if (clean.includes('riau')) return 'Riau';
  if (clean === 'sulsel' || clean.includes('sulawesi selatan')) return 'Sulawesi Selatan';
  if (clean === 'kaltim' || clean.includes('kalimantan timur')) return 'Kalimantan Timur';

  return province.trim();
}

/**
 * Normalisasi format tahun ajaran, misal "2026/2027", "2026-2027" -> "2026/2027"
 */
export function normalizeAcademicYear(year?: string): string {
  if (!year) return '';
  const match = year.match(/(\d{4})\s*[\/\-]\s*(\d{4})/);
  if (match) {
    return `${match[1]}/${match[2]}`;
  }
  return year.trim();
}

/**
 * Normalisasi semester secara eksplisit tanpa fallback diam-diam ke Semester 1
 */
export function validateAndResolveSemester(rawSemester?: string): '1' | '2' | null {
  if (!rawSemester) return null;
  const str = String(rawSemester).trim().toLowerCase();
  if (str === '1' || str === 'ganjil' || str.startsWith('1') || str.includes('ganjil')) {
    return '1';
  }
  if (str === '2' || str === 'genap' || str.startsWith('2') || str.includes('genap')) {
    return '2';
  }
  return null;
}

/**
 * Menghasilkan daftar tanggal dalam rentang YYYY-MM-DD
 */
function getDateRangeArray(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    return dates;
  }
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Helper untuk memastikan tidak ada duplikasi provenance pada CalendarDay atau AcademicCalendar
 */
export function dedupProvenances(provenances: CalendarProvenance[]): CalendarProvenance[] {
  const seen = new Set<string>();
  const result: CalendarProvenance[] = [];
  for (const p of provenances) {
    const key = `${p.sourceType}|${p.documentNumber || p.sourceName || ''}|${p.sourceUrl || ''}|${p.region || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  }
  return result;
}

/**
 * RESOLUSI OTOMATIS KALENDER PENDIDIKAN
 * Alur: Wilayah Sekolah + Tahun Ajaran + Semester -> Kaldik Provinsi Terverifikasi -> Overlay Libur Nasional SKB 3 Menteri
 * Menjamin prinsip "NO DATA > FAKE DATA" (fail-closed jika tidak ada sumber resmi terverifikasi).
 */
export function resolveOfficialCalendar(params: {
  province?: string;
  regency?: string;
  academicYear?: string;
  semester?: '1' | '2' | string;
  academicSettingId?: string;
  calendarId?: string;
  schoolDaysPerWeek?: number | null;
  subjectWeeklyJP?: number | null;
}): CalendarResolutionResult {
  const normProvince = normalizeProvinceName(params.province);
  const normYear = normalizeAcademicYear(params.academicYear);
  const canonicalSem = validateAndResolveSemester(params.semester);

  if (!normProvince) {
    return {
      isResolved: false,
      workflowStatus: 'UNRESOLVED',
      resolutionStatus: 'REGION_REQUIRED',
      calendar: null,
      days: [],
      nationalHolidaysApplied: [],
      diagnostic: 'Wilayah provinsi sekolah belum ditentukan pada profil sekolah.',
      actionableMessage: 'Lengkapi wilayah provinsi sekolah pada data profil sekolah untuk mengaktifkan resolusi kalender pendidikan resmi.',
    };
  }

  if (!normYear) {
    return {
      isResolved: false,
      workflowStatus: 'UNRESOLVED',
      resolutionStatus: 'ACADEMIC_YEAR_REQUIRED',
      calendar: null,
      days: [],
      nationalHolidaysApplied: [],
      diagnostic: 'Tahun ajaran belum ditentukan pada pengaturan akademik.',
      actionableMessage: 'Pilih tahun ajaran aktif pada pengaturan akademik untuk mengidentifikasi kalender pendidikan yang sesuai.',
    };
  }

  if (!canonicalSem) {
    return {
      isResolved: false,
      workflowStatus: 'UNRESOLVED',
      resolutionStatus: 'SEMESTER_REQUIRED',
      calendar: null,
      days: [],
      nationalHolidaysApplied: [],
      diagnostic: 'Semester belum dipilih atau nilai semester tidak valid pada pengaturan akademik.',
      actionableMessage: 'Pilih Semester 1 (Ganjil) atau Semester 2 (Genap) secara eksplisit untuk melanjutkan.',
    };
  }

  // 1. Cari Kalender Pendidikan Provinsi yang cocok & terverifikasi
  const matchedRegional = OFFICIAL_REGIONAL_CALENDARS.find(
    (rc) =>
      normalizeProvinceName(rc.province).toLowerCase() === normProvince.toLowerCase() &&
      normalizeAcademicYear(rc.academicYear) === normYear
  );

  const isVerified =
    matchedRegional &&
    matchedRegional.verificationState !== 'UNVERIFIED' &&
    Boolean(matchedRegional.documentNumber) &&
    Boolean(matchedRegional.documentTitle) &&
    Boolean(matchedRegional.sourceUrl) &&
    Boolean(matchedRegional.verifiedAt);

  if (!matchedRegional || !isVerified) {
    return {
      isResolved: false,
      workflowStatus: 'UNRESOLVED',
      resolutionStatus: 'UNVERIFIED_SOURCE',
      calendar: null,
      days: [],
      nationalHolidaysApplied: [],
      diagnostic: `Kalender pendidikan resmi untuk Provinsi "${normProvince}" Tahun Ajaran "${normYear}" belum terdaftar pada basis data resmi terverifikasi.`,
      actionableMessage: `Sesuai prinsip "NO DATA > FAKE DATA", sistem tidak mengarang tanggal. Silakan gunakan tombol "Input Manual" untuk memasukkan rentang waktu dan agenda kalender sekolah Anda secara mandiri.`,
    };
  }

  const semConfig =
    canonicalSem === '2' ? matchedRegional.semesters.semester2 : matchedRegional.semesters.semester1;

  if (!semConfig || !semConfig.startDate || !semConfig.endDate) {
    return {
      isResolved: false,
      workflowStatus: 'UNRESOLVED',
      resolutionStatus: 'UNRESOLVED',
      calendar: null,
      days: [],
      matchedRegionalSource: matchedRegional,
      nationalHolidaysApplied: [],
      diagnostic: `Konfigurasi Semester ${canonicalSem} tidak ditemukan pada kalender resmi ${matchedRegional.documentNumber}.`,
      actionableMessage: `Data semester ${canonicalSem} belum tersedia pada dokumen ${matchedRegional.documentNumber}. Anda dapat mengatur rentang waktu secara manual.`,
    };
  }

  const startDate = semConfig.startDate;
  const endDate = semConfig.endDate;
  const calId = params.calendarId || `cal-${params.academicSettingId || 'default'}`;
  const nowIso = new Date().toISOString();

  // Provenance rujukan daerah
  const regionalProvenance: CalendarProvenance = {
    sourceType: 'REGIONAL_EDUCATION_CALENDAR',
    sourceName: matchedRegional.documentTitle,
    sourceAuthority: matchedRegional.authority,
    sourceUrl: matchedRegional.sourceUrl,
    region: matchedRegional.province,
    academicYear: matchedRegional.academicYear,
    documentNumber: matchedRegional.documentNumber,
    documentTitle: matchedRegional.documentTitle,
    publicationDate: matchedRegional.effectiveFrom,
    effectiveDate: matchedRegional.effectiveFrom,
    retrievedAt: nowIso,
    checksumOrDate: matchedRegional.verifiedAt,
  };

  // 2. Kumpulkan agenda regional
  const daysMap = new Map<string, CalendarDay>();
  let regionalEventCount = 0;

  for (const ev of semConfig.events || []) {
    const rangeDates = getDateRangeArray(ev.startDate, ev.endDate);
    for (const d of rangeDates) {
      if (d >= startDate && d <= endDate) {
        regionalEventCount++;
        daysMap.set(d, {
          id: `day-reg-${d}`,
          academicCalendarId: calId,
          date: d,
          status: ev.status,
          notes: ev.name + (ev.notes ? ` (${ev.notes})` : ''),
          sourceType: 'REGIONAL_EDUCATION_CALENDAR',
          sourceName: matchedRegional.documentNumber,
          sourceAuthority: matchedRegional.authority,
          sourceDocumentNumber: matchedRegional.documentNumber,
          sourceUrl: matchedRegional.sourceUrl,
          sourceLayer: 'REGIONAL_BASE',
          sourceProvenances: [regionalProvenance],
          category: ev.category,
        });
      }
    }
  }

  // 3. Overlay Libur Nasional & Cuti Bersama SKB 3 Menteri (Mendukung rentang melintasi dua tahun kalender)
  const nationalHolidaysApplied: NationalHolidayRecord[] = [];
  const yearsInvolved = new Set<number>();
  let nationalHolidayCount = 0;
  let hasUnverifiedNationalHolidayInDateRange = false;

  for (const holiday of OFFICIAL_NATIONAL_HOLIDAYS) {
    if (holiday.date >= startDate && holiday.date <= endDate) {
      const eventYear = holiday.year || parseInt(holiday.date.slice(0, 4), 10);
      const natSource = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[eventYear];

      // Fail-closed: Verifikasi exact legal source
      const isNatSourceVerified =
        natSource &&
        natSource.verificationState === 'VERIFIED' &&
        Boolean(natSource.documentNumber) &&
        Boolean(natSource.documentTitle) &&
        Boolean(natSource.sourceUrl) &&
        Boolean(natSource.verifiedAt);

      if (!isNatSourceVerified) {
        hasUnverifiedNationalHolidayInDateRange = true;
        // Tidak membuat provenance sintetik jika sumber tidak tersedia atau tidak terverifikasi
        continue;
      }

      nationalHolidaysApplied.push(holiday);
      nationalHolidayCount++;
      yearsInvolved.add(eventYear);

      const holidayDocNumber = natSource.documentNumber;
      const holidayDocTitle = natSource.documentTitle;
      const holidayAuthority = natSource.authority;
      const holidayUrl = natSource.sourceUrl;

      const holidayProvenance: CalendarProvenance = {
        sourceType: 'NATIONAL_HOLIDAY_OVERLAY',
        sourceName: holidayDocTitle,
        sourceAuthority: holidayAuthority,
        sourceUrl: holidayUrl,
        region: 'Nasional',
        academicYear: normYear,
        documentNumber: holidayDocNumber,
        documentTitle: holidayDocTitle,
        publicationDate: natSource.publicationDate,
        effectiveDate: natSource.signedDate || natSource.publicationDate,
        retrievedAt: nowIso,
        checksumOrDate: natSource.verifiedAt,
      };

      const existing = daysMap.get(holiday.date);

      // Overlay menggabungkan catatan dan menjaga riwayat provenance regional & nasional tanpa duplikasi
      const combinedNotes = existing
        ? `${holiday.name} [${holidayDocNumber}] • Agenda Daerah: ${existing.notes}`
        : `${holiday.name} (${holiday.type === 'CUTI_BERSAMA' ? 'Cuti Bersama' : 'Libur Nasional'})`;

      const existingProvenances = existing?.sourceProvenances || [];
      const mergedProvenances = dedupProvenances([...existingProvenances, holidayProvenance]);

      daysMap.set(holiday.date, {
        id: `day-nat-${holiday.date}`,
        academicCalendarId: calId,
        date: holiday.date,
        status: 'HOLIDAY' as CalendarDayStatus,
        notes: combinedNotes,
        sourceType: 'NATIONAL_HOLIDAY_OVERLAY',
        sourceName: holidayDocNumber,
        sourceAuthority: holidayAuthority,
        sourceDocumentNumber: holidayDocNumber,
        sourceUrl: holidayUrl,
        sourceLayer: 'NATIONAL_OVERLAY',
        sourceProvenances: mergedProvenances,
        category: holiday.type === 'CUTI_BERSAMA' ? 'CUTI_BERSAMA' : 'NATIONAL_HOLIDAY',
      });
    }
  }

  // Buat daftar provenance nasional untuk seluruh tahun yang terlibat (HANYA tahun yang terverifikasi dan diterapkan)
  const nationalProvenancesList: CalendarProvenance[] = Array.from(yearsInvolved)
    .sort((a, b) => a - b)
    .map((yr) => {
      const src = OFFICIAL_NATIONAL_HOLIDAY_SOURCES[yr];
      return {
        sourceType: 'NATIONAL_HOLIDAY_OVERLAY',
        sourceName: src.documentTitle,
        sourceAuthority: src.authority,
        sourceUrl: src.sourceUrl,
        region: 'Nasional',
        academicYear: normYear,
        documentNumber: src.documentNumber,
        documentTitle: src.documentTitle,
        publicationDate: src.publicationDate,
        effectiveDate: src.signedDate || src.publicationDate,
        retrievedAt: nowIso,
        checksumOrDate: src.verifiedAt,
      };
    });

  const primaryNatProvenance =
    nationalProvenancesList.length > 0 ? nationalProvenancesList[0] : undefined;

  const days: CalendarDay[] = Array.from(daysMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const resolvedSchoolDays =
    params.schoolDaysPerWeek === 5 || params.schoolDaysPerWeek === 6
      ? params.schoolDaysPerWeek
      : semConfig.defaultSchoolDaysPerWeek || 5;

  const resolutionStatus: CalendarResolutionStatus = hasUnverifiedNationalHolidayInDateRange
    ? 'PARTIALLY_RESOLVED'
    : 'RESOLVED';

  const calendar: AcademicCalendar = {
    id: calId,
    academicSettingId: params.academicSettingId || '',
    academicYear: normYear,
    semester: canonicalSem === '1' ? '1 (Ganjil)' : '2 (Genap)',
    startDate,
    endDate,
    schoolDaysPerWeek: resolvedSchoolDays,
    sourceType: 'REGIONAL_EDUCATION_CALENDAR',
    sourceName: matchedRegional.documentTitle,
    sourceAuthority: matchedRegional.authority,
    sourceDocumentNumber: matchedRegional.documentNumber,
    sourceUrl: matchedRegional.sourceUrl,
    sourceRegion: matchedRegional.province,
    workflowStatus: 'AUTO_RESOLVED',
    resolutionStatus,
    reviewStatus: 'UNREVIEWED',
    retrievedAt: nowIso,
    verifiedAt: matchedRegional.verifiedAt,
    isOverridden: false,
    provenance: regionalProvenance,
    nationalProvenance: primaryNatProvenance,
    nationalProvenances: nationalProvenancesList.length > 0 ? nationalProvenancesList : undefined,
    nationalHolidayOverlayName:
      nationalProvenancesList.length > 0
        ? nationalProvenancesList.map((p) => p.documentNumber).join(' & ')
        : undefined,
    nationalHolidayOverlayUrl: primaryNatProvenance?.sourceUrl,
    nationalHolidayCount,
    regionalEventCount,
    schoolEventCount: 0,
    jpPerWeek: params.subjectWeeklyJP ?? null,
    updatedAt: nowIso,
  };

  const diagnosticMsg = hasUnverifiedNationalHolidayInDateRange
    ? `Kalender pendidikan daerah terverifikasi (${matchedRegional.documentNumber}), namun beberapa hari libur nasional pada rentang waktu ini dilewati karena sumber hukum belum terverifikasi.`
    : nationalHolidayCount > 0
    ? `Berhasil menyelesaikan Kalender Pendidikan dari ${matchedRegional.authority} (${matchedRegional.documentNumber}) dengan ${nationalHolidayCount} Libur Nasional SKB 3 Menteri.`
    : `Berhasil menyelesaikan Kalender Pendidikan dari ${matchedRegional.authority} (${matchedRegional.documentNumber}).`;

  return {
    isResolved: true,
    workflowStatus: 'AUTO_RESOLVED',
    resolutionStatus,
    calendar,
    days,
    matchedRegionalSource: matchedRegional,
    nationalHolidaysApplied,
    diagnostic: diagnosticMsg,
  };
}

/**
 * Resolusi kalender berdasarkan SchoolData dan AcademicSetting langsung
 */
export function resolveCalendarBySchoolAndSetting(
  school: SchoolData,
  setting: AcademicSetting,
  existingCalendar?: AcademicCalendar,
  existingDays?: CalendarDay[]
): CalendarResolutionResult {
  // Jika kalender sudah dikonfirmasi atau dioverride, pertahankan integritasnya
  if (
    existingCalendar &&
    (existingCalendar.workflowStatus === 'CONFIRMED' || existingCalendar.workflowStatus === 'MANUAL_OVERRIDE') &&
    existingCalendar.startDate &&
    existingCalendar.endDate
  ) {
    return {
      isResolved: true,
      workflowStatus: existingCalendar.workflowStatus,
      resolutionStatus: existingCalendar.workflowStatus === 'MANUAL_OVERRIDE' ? 'MANUALLY_OVERRIDDEN' : 'RESOLVED',
      calendar: existingCalendar,
      days: existingDays || [],
      nationalHolidaysApplied: [],
      diagnostic: `Kalender saat ini menggunakan status [${existingCalendar.workflowStatus}] yang tersimpan.`,
    };
  }

  return resolveOfficialCalendar({
    province: school.province,
    regency: school.regency,
    academicYear: setting.academicYear,
    semester: setting.semester,
    academicSettingId: setting.id,
    calendarId: existingCalendar?.id,
    schoolDaysPerWeek: existingCalendar?.schoolDaysPerWeek ?? null,
    subjectWeeklyJP: setting.subjectWeeklyJP ? Number(setting.subjectWeeklyJP) : null,
  });
}

/**
 * Terapkan Penyesuaian Manual (MANUAL OVERRIDE) oleh Satuan Pendidikan
 */
export function applyManualCalendarOverride(
  currentCalendar: AcademicCalendar,
  currentDays: CalendarDay[],
  updates: {
    startDate?: string;
    endDate?: string;
    schoolDaysPerWeek?: number | null;
    jpPerWeek?: number | null;
    notes?: string;
    overrideReason?: string;
  },
  newOrModifiedDays?: CalendarDay[]
): { calendar: AcademicCalendar; days: CalendarDay[] } {
  const updatedDays = newOrModifiedDays ?? currentDays;

  const calendar: AcademicCalendar = {
    ...currentCalendar,
    ...updates,
    startDate: updates.startDate ?? currentCalendar.startDate,
    endDate: updates.endDate ?? currentCalendar.endDate,
    schoolDaysPerWeek: updates.schoolDaysPerWeek !== undefined ? updates.schoolDaysPerWeek : currentCalendar.schoolDaysPerWeek,
    jpPerWeek: updates.jpPerWeek !== undefined ? updates.jpPerWeek : currentCalendar.jpPerWeek,
    sourceType: 'SCHOOL_OVERRIDE',
    workflowStatus: 'MANUAL_OVERRIDE',
    resolutionStatus: 'MANUALLY_OVERRIDDEN',
    isOverridden: true,
    overrideReason: updates.overrideReason || updates.notes || 'Penyesuaian tanggal / agenda oleh satuan pendidikan',
    updatedAt: new Date().toISOString(),
  };

  return { calendar, days: updatedDays };
}

/**
 * Konfirmasi Alur Kerja Kalender (CONFIRM)
 */
export function confirmCalendarWorkflow(
  currentCalendar: AcademicCalendar,
  currentDays: CalendarDay[]
): { calendar: AcademicCalendar; days: CalendarDay[] } {
  const confirmedAt = new Date().toISOString();
  const calendar: AcademicCalendar = {
    ...currentCalendar,
    workflowStatus: 'CONFIRMED',
    resolutionStatus: 'RESOLVED',
    reviewStatus: 'CONFIRMED',
    confirmedAt,
    verifiedAt: confirmedAt,
    updatedAt: confirmedAt,
  };

  return { calendar, days: currentDays };
}

/**
 * Reset kalender kembali ke standar resmi daerah & nasional
 */
export function resetCalendarToOfficial(
  schoolOrProvince: SchoolData | string,
  settingOrYear: AcademicSetting | string,
  semesterOrId?: '1' | '2' | string,
  academicSettingId?: string,
  calendarId?: string
): CalendarResolutionResult {
  if (typeof schoolOrProvince === 'string') {
    return resolveOfficialCalendar({
      province: schoolOrProvince,
      academicYear: String(settingOrYear),
      semester: semesterOrId,
      academicSettingId: academicSettingId,
      calendarId: calendarId,
    });
  }

  const school = schoolOrProvince;
  const setting = settingOrYear as AcademicSetting;
  const calId = typeof semesterOrId === 'string' ? semesterOrId : calendarId;

  return resolveOfficialCalendar({
    province: school.province,
    regency: school.regency,
    academicYear: setting.academicYear,
    semester: setting.semester,
    academicSettingId: setting.id,
    calendarId: calId,
    subjectWeeklyJP: setting.subjectWeeklyJP ? Number(setting.subjectWeeklyJP) : null,
  });
}

/**
 * Daftar Provinsi resmi yang terverifikasi dalam repositori
 */
export function getAvailableProvinces(): string[] {
  const provinces = new Set<string>();
  OFFICIAL_REGIONAL_CALENDARS.filter((c) => c.verificationState !== 'UNVERIFIED').forEach((c) =>
    provinces.add(c.province)
  );
  return Array.from(provinces).sort();
}

/**
 * Daftar Tahun Ajaran resmi yang terverifikasi dalam repositori
 */
export function getAvailableAcademicYears(): string[] {
  const years = new Set<string>();
  OFFICIAL_REGIONAL_CALENDARS.filter((c) => c.verificationState !== 'UNVERIFIED').forEach((c) =>
    years.add(c.academicYear)
  );
  return Array.from(years).sort();
}
