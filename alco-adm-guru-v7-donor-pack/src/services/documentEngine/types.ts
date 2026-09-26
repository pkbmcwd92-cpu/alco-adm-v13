import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AdministrationWorkspace,
  CPData,
  TPData,
  ATPData,
  AppDocumentRecord,
  DocumentType,
  Student,
  AcademicCalendar,
  CalendarDay,
  TimeAllocation,
  AttendanceSession,
  AttendanceRecord,
  AssessmentCriterion,
  Assessment,
  AssessmentResult,
  RemedialRecord,
  EnrichmentRecord,
  K13Analysis,
  K13KKM,
  DocumentMode,
  DocumentSnapshot,
} from '../../types';

export type { DocumentType, DocumentMode, DocumentSnapshot, AppDocumentRecord };

export interface DocumentGenerationContext {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  workspace?: AdministrationWorkspace;
  documentMode?: DocumentMode; // 'data' | 'blank'
  snapshot?: DocumentSnapshot; // Preserved frozen snapshot for historical documents
  skipDownload?: boolean; // When true, generates document and returns blob without triggering browser saveAs
  effectiveWeeksCount?: number; // for PROMES (default 18 weeks/semester)
  cp?: CPData;
  tp?: TPData;
  atp?: ATPData;
  students?: Student[];
  calendar?: AcademicCalendar;
  calendarDays?: CalendarDay[];
  timeAllocations?: TimeAllocation[];
  attendanceSessions?: AttendanceSession[];
  attendanceRecords?: AttendanceRecord[];
  assessmentCriteria?: AssessmentCriterion[];
  assessments?: Assessment[];
  assessmentResults?: AssessmentResult[];
  remedials?: RemedialRecord[];
  enrichments?: EnrichmentRecord[];
  k13Analysis?: K13Analysis;
  k13KKM?: K13KKM;
}

export type ZipExportFormat = 'pdf' | 'docx' | 'both';

export interface ZipExportOptions {
  format?: ZipExportFormat;
  documentMode?: DocumentMode;
  types?: DocumentType[];
  folderStructure?: 'standard' | 'flat';
  onProgress?: (current: number, total: number, docTitle: string) => void;
  existingRecords?: AppDocumentRecord[];
}

export interface ZipExportResult {
  success: boolean;
  zipFileName: string;
  exportedCount: number;
  pdfCount: number;
  docxCount: number;
  foldersCreated: string[];
  snapshots: DocumentSnapshot[];
}

export interface DocumentValidationResult {
  isValid: boolean;
  missingFields: string[];
  message?: string;
  targetStep?: 'profile' | 'academic' | 'cp' | 'tp' | 'atp';
}

export interface GeneratedDocumentResult {
  success: boolean;
  type: DocumentType;
  title: string;
  fileName: string;
  record: AppDocumentRecord;
  blob?: Blob;
}

export interface DocumentCatalogItem {
  id: string;
  type: DocumentType;
  category: 'Perencanaan Utama' | 'Perangkat Pembelajaran' | 'Pelaksanaan & Asesmen' | 'Tindak Lanjut' | 'Kurikulum 2013';
  title: string;
  description: string;
  requiredSources: string[];
}
