import { CalendarDayStatus, CalendarProvenance, CalendarSourceType } from '../../types';

export interface NationalHolidaySource {
  calendarYear: number;
  authority: string;
  documentTitle: string;
  documentNumber: string;
  sourceUrl: string;
  publicationDate?: string;
  signedDate?: string;
  verifiedAt: string;
  verificationState: 'VERIFIED' | 'UNVERIFIED';
}

export interface NationalHolidayRecord {
  date: string; // YYYY-MM-DD
  name: string;
  type: 'NATIONAL_HOLIDAY' | 'CUTI_BERSAMA';
  year: number;
  regulationTitle: string;
  authority: string;
  documentNumber?: string;
  sourceUrl?: string;
  verifiedAt?: string;
  verificationState?: 'VERIFIED' | 'UNVERIFIED';
}

export interface RegionalCalendarEvent {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  name: string;
  status: CalendarDayStatus;
  category:
    | 'SEMESTER_BREAK'
    | 'MID_SEMESTER_BREAK'
    | 'SCHOOL_EVENT'
    | 'ASSESSMENT'
    | 'REGIONAL_HOLIDAY'
    | 'RELIGIOUS_HOLIDAY'
    | 'OTHER';
  notes?: string;
}

export interface RegionalSemesterConfig {
  semester: '1' | '2';
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  events: RegionalCalendarEvent[];
  defaultSchoolDaysPerWeek?: 5 | 6;
}

export interface RegionalEducationCalendar {
  id: string;
  scope?: 'REGENCY' | 'PROVINCE' | 'NATIONAL';
  province: string;
  regency?: string; // Optional if specific to regency/city
  academicYear: string; // e.g. "2024/2025", "2025/2026", "2026/2027"
  authority: string; // e.g. "Dinas Pendidikan Provinsi Jawa Barat"
  documentTitle: string; // e.g. "Pedoman Penyusunan Kalender Pendidikan TP 2025/2026"
  documentNumber: string; // e.g. "SK Kadisdik No. 421.2/11250-Set.Disdik/2025"
  sourceUrl?: string;
  effectiveFrom: string;
  verifiedAt: string;
  verificationState?: 'VERIFIED' | 'UNVERIFIED';
  semesters: {
    semester1: RegionalSemesterConfig;
    semester2: RegionalSemesterConfig;
  };
  notes?: string;
}

