import React, { useState } from 'react';
import { saveAs } from 'file-saver';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  Check,
  Calendar,
  Layers,
  BookOpen,
  ClipboardList,
  Sparkles,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Files,
  Printer,
  FileCheck,
  FolderArchive,
  Archive,
} from 'lucide-react';
import {
  AssessmentPlan,
  AssessmentPackage,
  TeacherProfile,
  SchoolData,
  AcademicSetting,
  CPData,
  TPData,
  ATPData,
  AdministrationWorkspace,
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
  LearningPlan,
  DocumentSnapshot,
  DocumentMode,
  WorkflowStepId,
} from '../types';
import {
  DOCUMENT_CATALOG,
  generateDocument,
  generatePdfDocument,
  generateZipBundle,
  validateDocumentRequirements,
  DocumentGenerationContext,
  INDONESIAN_MONTHS,
  createDocumentSnapshot,
  resolveEffectiveContext,
  formatOfficialSnapshotDate,
  isContextDriftedFromSnapshot,
  ZipExportFormat,
  ZipExportResult,
} from '../services/documentEngine';
import { getCurriculumType } from '../services/curriculumRules';
import { isK13 as isK13Check, getCurriculumDocumentTypes } from '../services/curriculumRouter';
import { SnapshotValidationModal } from './SnapshotValidationModal';
import { ZipExportModal } from './ZipExportModal';

interface AdminDocsExportProps {
  profile: TeacherProfile;
  school: SchoolData;
  workspace?: AdministrationWorkspace;
  academicSetting: AcademicSetting;
  cp?: CPData;
  tp?: TPData;
  atp?: ATPData;
  documents?: AppDocumentRecord[];
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
  learningPlans?: LearningPlan[];
  assessmentPlans?: AssessmentPlan[];
  assessmentPackages?: AssessmentPackage[];
  onBackToStep: (stepId: WorkflowStepId) => void;
  onUpdateDocuments?: (updatedDocs: AppDocumentRecord[]) => void;
}

export const AdminDocsExport: React.FC<AdminDocsExportProps> = ({
  profile,
  school,
  workspace,
  academicSetting,
  cp,
  tp,
  atp,
  documents = [],
  students,
  calendar,
  calendarDays,
  timeAllocations,
  attendanceSessions,
  attendanceRecords,
  assessmentCriteria,
  assessments,
  assessmentResults,
  remedials,
  enrichments,
  k13Analysis,
  k13KKM,
  learningPlans = [],
  assessmentPlans = [],
  assessmentPackages = [],
  onBackToStep,
  onUpdateDocuments,
}) => {
  const isK13Curriculum = isK13Check(academicSetting);
  const [activePreviewType, setActivePreviewType] = useState<DocumentType>(() =>
    isK13Curriculum ? 'ANALISIS_SKL_KI_KD' : 'ANALISIS_CP_TP'
  );
  const [generatingDocType, setGeneratingDocType] = useState<string | null>(null);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isZipModalOpen, setIsZipModalOpen] = useState(false);
  const [zipProgressText, setZipProgressText] = useState<string | null>(null);
  const [documentMode, setDocumentMode] = useState<DocumentMode>('data');
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [exportErrorMessage, setExportErrorMessage] = useState<string | null>(null);
  const [localDocs, setLocalDocs] = useState<AppDocumentRecord[]>(documents);

  const readyAssessmentPackages = (assessmentPackages || []).filter((p) => p.workflowStatus === 'SIAP' && p.needsReview !== true);
  const [selectedAssessmentPackageId, setSelectedAssessmentPackageId] = useState<string>(() => {
    if (readyAssessmentPackages.length === 1) return readyAssessmentPackages[0].id;
    return '';
  });

  // Validation status
  const isProfileValid = !!(profile?.name && profile.name.trim().length > 0);
  const isSchoolValid = !!(school?.name && school.name.trim().length > 0);
  const isAcademicValid = !!(academicSetting?.subject && academicSetting?.grade);
  const isCPValid = !!((cp?.generalDescription && cp.generalDescription.trim().length > 0) || (cp?.elements && cp.elements.length > 0));
  const isTPValid = !!(tp?.items && tp.items.length > 0);
  const isATPValid = !!(atp?.items && atp.items.length > 0);
  const isK13KDValid = !!(k13Analysis?.items && k13Analysis.items.length > 0);
  const isK13IndikatorValid = !!(k13Analysis?.items && k13Analysis.items.some((i) => (i.materi && i.materi.trim().length > 0) || (i.kegiatan && i.kegiatan.trim().length > 0)));
  const isK13TujuanValid = !!(
    k13Analysis?.items &&
    k13Analysis.items.some(
      (i) => (i.indikator && i.indikator.trim().length > 0) || (i.tujuanPembelajaran && i.tujuanPembelajaran.trim().length > 0)
    )
  );
  const isK13KKMValid = !!(k13KKM?.items && k13KKM.items.length > 0);
  const isBulkExportEligible = documentMode === 'blank' || (isK13Curriculum ? isK13KDValid : isCPValid);

  const totalJP = (atp?.items || []).reduce((acc, curr) => acc + (Number(curr.jp) || 0), 0);

  const context: DocumentGenerationContext = {
    school,
    profile,
    academicSetting,
    workspace,
    documentMode,
    cp: cp || { id: '', academicSettingId: '', generalDescription: '', elements: [], updatedAt: '' },
    tp: tp || { id: '', academicSettingId: '', items: [], updatedAt: '' },
    atp: atp || { id: '', academicSettingId: '', rationale: '', items: [], totalJP: 0, updatedAt: '' },
    students,
    calendar,
    calendarDays,
    timeAllocations,
    attendanceSessions,
    attendanceRecords,
    assessmentCriteria,
    assessments,
    assessmentResults,
    remedials,
    enrichments,
    k13Analysis,
    k13KKM,
    learningPlans,
    assessmentPlans,
    assessmentPackages,
    activeAssessmentPackageId: selectedAssessmentPackageId || (readyAssessmentPackages.length === 1 ? readyAssessmentPackages[0].id : undefined),
  };

  const getDocRecord = (type: DocumentType): AppDocumentRecord | undefined => {
    return localDocs.find((d) => d.type === type && (!d.workspaceId || d.workspaceId === workspace?.id));
  };

  /**
   * Precise Document Dependency Tracking:
   * Checks if source data (CP, TP, ATP) has been updated since this document was generated.
   */
  const isDocOutdated = (type: DocumentType, doc?: AppDocumentRecord): boolean => {
    if (!doc) return false;
    const docTime = new Date(doc.lastGenerated || doc.generatedAt || 0).getTime();
    if (docTime === 0) return false;

    const cpTime = cp?.updatedAt ? new Date(cp.updatedAt).getTime() : 0;
    const tpTime = tp?.updatedAt ? new Date(tp.updatedAt).getTime() : 0;
    const atpTime = atp?.updatedAt ? new Date(atp.updatedAt).getTime() : 0;

    switch (type) {
      case 'ANALISIS_CP_TP':
        return cpTime > docTime;
      case 'ATP':
        return cpTime > docTime || tpTime > docTime || atpTime > docTime;
      case 'PROTA':
      case 'PROMES':
      case 'MODUL_AJAR':
      case 'ASESMEN':
      case 'JURNAL':
        return atpTime > docTime || tpTime > docTime || cpTime > docTime;
      default:
        return false;
    }
  };

  const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

  const handleGenerateSingleDoc = async (
    type: DocumentType,
    format: 'docx' | 'pdf' = 'docx',
    forceNew: boolean = false
  ) => {
    const existingRec = getDocRecord(type);
    // Jika dokumen sudah memiliki snapshot historis dan pengguna tidak sengaja meminta "Perbarui",
    // maka gunakan snapshot historis tersebut agar data sekolah/kepsek tidak ter-override secara tidak sengaja.
    const effectiveSnapshot: DocumentSnapshot =
      !forceNew && existingRec?.snapshot
        ? existingRec.snapshot
        : createDocumentSnapshot(context, format, documentMode);

    const effectiveContext = resolveEffectiveContext(context, effectiveSnapshot);

    const validation = validateDocumentRequirements(type, effectiveContext);
    if (!validation.isValid) {
      setExportErrorMessage(validation.message || 'Prasyarat dokumen belum lengkap.');
      return;
    }

    setGeneratingDocType(`${type}-${format}`);
    setExportErrorMessage(null);
    setExportSuccessMessage(null);

    try {
      let record: AppDocumentRecord;
      let title = '';

      if (format === 'pdf') {
        const pdfResult = await generatePdfDocument(type, effectiveContext);
        saveAs(pdfResult.blob, pdfResult.fileName);
        title = pdfResult.title;
        const finalSnapshot: DocumentSnapshot =
          type === 'ASESMEN' && pdfResult.snapshot
            ? pdfResult.snapshot
            : effectiveSnapshot;
        record = {
          id: existingRec?.id || `doc-${type.toLowerCase()}-${workspace?.id || 'ws'}-${Date.now()}`,
          type,
          title: pdfResult.title,
          status: 'completed',
          format: 'pdf',
          lastGenerated: finalSnapshot.generatedAt,
          fileName: pdfResult.fileName,
          academicSettingId: academicSetting.id,
          workspaceId: workspace?.id,
          snapshot: finalSnapshot,
        };
      } else {
        const docxResult = await generateDocument(type, effectiveContext);
        title = docxResult.title;
        const finalSnapshot: DocumentSnapshot =
          type === 'ASESMEN' && docxResult.record?.snapshot
            ? docxResult.record.snapshot
            : effectiveSnapshot;
        record = {
          ...docxResult.record,
          id: existingRec?.id || docxResult.record.id,
          format: 'docx',
          lastGenerated: finalSnapshot.generatedAt,
          snapshot: finalSnapshot,
        };
      }

      const updatedList = [
        ...localDocs.filter((d) => d.id !== record.id && !(d.type === type && (!d.workspaceId || d.workspaceId === workspace?.id))),
        record,
      ];
      setLocalDocs(updatedList);
      if (onUpdateDocuments) {
        onUpdateDocuments(updatedList);
      }
      const finalGeneratedAt = record.snapshot?.generatedAt || effectiveSnapshot.generatedAt;
      setExportSuccessMessage(
        forceNew
          ? `Dokumen ${title} (.${format}) berhasil diperbarui dengan data sekolah/kepsek terbaru!`
          : `Dokumen ${title} (.${format}) [Snapshot: ${formatOfficialSnapshotDate(finalGeneratedAt)}] berhasil diunduh!`
      );
      setTimeout(() => setExportSuccessMessage(null), 6000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghasilkan dokumen';
      setExportErrorMessage(msg);
    } finally {
      setGeneratingDocType(null);
    }
  };

  const handleExportZipBundle = async (format: ZipExportFormat = 'both') => {
    setIsExportingZip(true);
    setExportErrorMessage(null);
    setExportSuccessMessage(null);
    setZipProgressText('Menyiapkan struktur folder administrasi...');

    try {
      const result = await generateZipBundle(
        {
          format,
          documentMode,
          existingRecords: localDocs,
          onProgress: (curr, total, docTitle) => {
            setZipProgressText(`Mengepak dokumen (${curr}/${total}): ${docTitle}...`);
          },
        },
        context
      );

      const formatLabel = format === 'both' ? 'PDF & Word' : format.toUpperCase();
      setExportSuccessMessage(
        `Sukses! ${result.exportedCount} dokumen (${result.pdfCount} PDF, ${result.docxCount} Word) telah dikompresi ke dalam arsip ZIP "${result.zipFileName}" (6 Folder Administrasi).`
      );
      setTimeout(() => setExportSuccessMessage(null), 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat membuat paket ZIP';
      setExportErrorMessage(msg);
    } finally {
      setIsExportingZip(false);
      setZipProgressText(null);
    }
  };

  const handleGenerateAllDocs = async (format: 'docx' | 'pdf' = 'docx') => {
    setIsExportingAll(true);
    setExportErrorMessage(null);
    setExportSuccessMessage(null);

    const isK13 = getCurriculumType(academicSetting.curriculum || academicSetting.curriculumType) === 'K13';
    const docTypes: DocumentType[] = getCurriculumDocumentTypes(isK13 ? 'K13' : 'KURIKULUM_MERDEKA', {
      hasK13KKM: isK13KKMValid,
      includeKkm: isK13KKMValid,
    });
    let successCount = 0;
    const newRecords: AppDocumentRecord[] = [...localDocs];

    const snapshot: DocumentSnapshot = {
      generatedAt: new Date().toISOString(),
      format,
      documentMode,
      schoolName: school.name || '',
      npsn: school.npsn,
      principalName: school.principalName || '',
      principalNip: school.principalNip,
      teacherName: profile.name || '',
      teacherNip: profile.nip,
      subject: academicSetting.subject || '',
      grade: academicSetting.grade || '',
      academicYear: academicSetting.academicYear || '',
      semester: academicSetting.semester || '',
      curriculum: academicSetting.curriculum || '',
      curriculumType: getCurriculumType(academicSetting.curriculum || academicSetting.curriculumType),
      studentCount: context.students?.length || 0,
      sourceVersions: {
        cpUpdatedAt: cp?.updatedAt,
        tpUpdatedAt: tp?.updatedAt,
        atpUpdatedAt: atp?.updatedAt,
      },
    };

    try {
      for (const type of docTypes) {
        const val = validateDocumentRequirements(type, context);
        if (val.isValid) {
          if (format === 'pdf') {
            const pdfRes = await generatePdfDocument(type, context);
            saveAs(pdfRes.blob, pdfRes.fileName);
            const finalSnapshot: DocumentSnapshot =
              type === 'ASESMEN' && pdfRes.snapshot
                ? pdfRes.snapshot
                : snapshot;
            const rec: AppDocumentRecord = {
              id: `doc-${type.toLowerCase()}-${workspace?.id || 'ws'}-${Date.now()}`,
              type,
              title: pdfRes.title,
              status: 'completed',
              format: 'pdf',
              lastGenerated: finalSnapshot.generatedAt,
              fileName: pdfRes.fileName,
              academicSettingId: academicSetting.id,
              workspaceId: workspace?.id,
              snapshot: finalSnapshot,
            };
            const existingIdx = newRecords.findIndex((d) => d.type === type && (!d.workspaceId || d.workspaceId === workspace?.id));
            if (existingIdx >= 0) {
              newRecords[existingIdx] = rec;
            } else {
              newRecords.push(rec);
            }
          } else {
            const res = await generateDocument(type, context);
            const finalSnapshot: DocumentSnapshot =
              type === 'ASESMEN' && res.record?.snapshot
                ? res.record.snapshot
                : snapshot;
            const rec: AppDocumentRecord = {
              ...res.record,
              format: 'docx',
              lastGenerated: finalSnapshot.generatedAt,
              snapshot: finalSnapshot,
            };
            const existingIdx = newRecords.findIndex((d) => d.type === type && (!d.workspaceId || d.workspaceId === workspace?.id));
            if (existingIdx >= 0) {
              newRecords[existingIdx] = rec;
            } else {
              newRecords.push(rec);
            }
          }
          successCount++;
          // Delay between downloads to prevent browser throttling
          await new Promise((r) => setTimeout(r, 600));
        }
      }
      setLocalDocs(newRecords);
      if (onUpdateDocuments) {
        onUpdateDocuments(newRecords);
      }
      setExportSuccessMessage(
        documentMode === 'blank'
          ? `Sukses! ${successCount} format dokumen kosong (.${format}) siap cetak/tulis telah selesai diunduh.`
          : `Sukses! ${successCount} dokumen administrasi berbasis data (.${format}) telah selesai diunduh.`
      );
      setTimeout(() => setExportSuccessMessage(null), 8000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Terjadi kendala saat menghasilkan berkas';
      setExportErrorMessage(msg);
    } finally {
      setIsExportingAll(false);
    }
  };

  const today = new Date();
  const dateFormatted = `${school.district?.replace(/^Kec\.\s*/i, '') || school.regency || school.village || 'Tempat'}, ${today.getDate()} ${
    INDONESIAN_MONTHS[today.getMonth()]
  } ${today.getFullYear()}`;

  const isSemesterGanjil =
    academicSetting.semester?.includes('1') || academicSetting.semester?.toLowerCase().includes('ganjil');
  const semesterMonths = isSemesterGanjil
    ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

  const isK13 = getCurriculumType(academicSetting.curriculum || academicSetting.curriculumType) === 'K13';

  // Categories defined in official sequence
  const catalogCategories = isK13
    ? [
        { key: 'Kurikulum 2013', label: '1. KURIKULUM 2013 (SKL / KI / KD / KKM)' },
        { key: 'Perencanaan Utama', label: '2. PERENCANAAN WAKTU & PROGRAM' },
        { key: 'Pelaksanaan & Asesmen', label: '3. PELAKSANAAN & ASESMEN' },
        { key: 'Tindak Lanjut', label: '4. TINDAK LANJUT' },
      ]
    : [
        { key: 'Perencanaan Utama', label: '1. PERENCANAAN UTAMA (CP / TP / ATP / PROTA / PROMES)' },
        { key: 'Perangkat Pembelajaran', label: '2. PERANGKAT PEMBELAJARAN (MODUL AJAR)' },
        { key: 'Pelaksanaan & Asesmen', label: '3. PELAKSANAAN & ASESMEN (KKTP, PRESENSI, NILAI, JURNAL)' },
        { key: 'Tindak Lanjut', label: '4. TINDAK LANJUT (REMEDIAL & PENGAYAAN)' },
      ];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                06
              </span>
              <h3 className="text-lg font-bold text-slate-900">Pusat Generator Dokumen Administrasi Pembelajaran</h3>
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Generator dokumen {academicSetting.curriculum} nyata dalam format <strong>Microsoft Word (.docx)</strong> dan <strong>PDF Siap Cetak</strong> berstandar resmi (PPA Revisi 2025/Kepmendikbudristek No. 12/2024).
            </p>
            {workspace && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                <FolderTree className="w-3.5 h-3.5 text-blue-600" />
                <span>Workspace: <strong>{workspace.name}</strong></span>
              </div>
            )}
          </div>

          {/* Mode Selector & Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Mode Switcher: Data vs Blank */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
              <button
                type="button"
                id="btn-mode-data"
                onClick={() => setDocumentMode('data')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  documentMode === 'data'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Dokumen dari Data
              </button>
              <button
                type="button"
                id="btn-mode-blank"
                onClick={() => setDocumentMode('blank')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  documentMode === 'blank'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Format Kosong
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex rounded-xl shadow-md overflow-hidden bg-emerald-700">
                <button
                  id="btn-export-zip-bundle-both"
                  onClick={() => handleExportZipBundle('both')}
                  disabled={isExportingZip || isExportingAll}
                  className="inline-flex items-center justify-center gap-1.5 hover:bg-emerald-800 text-white px-3.5 py-2 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 border-r border-emerald-600/60"
                  title="Unduh seluruh arsip administrasi kombinasi PDF & Word lengkap"
                >
                  {isExportingZip ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      <span>{zipProgressText || 'Membuat ZIP...'}</span>
                    </>
                  ) : (
                    <>
                      <FolderArchive className="w-4 h-4 text-emerald-200" />
                      <span>Paket ZIP (PDF + Word)</span>
                    </>
                  )}
                </button>

                <button
                  id="btn-export-zip-bundle-pdf"
                  onClick={() => handleExportZipBundle('pdf')}
                  disabled={isExportingZip || isExportingAll}
                  className="inline-flex items-center justify-center gap-1 hover:bg-emerald-800 text-white px-2.5 py-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 border-r border-emerald-600/60"
                  title="Unduh arsip ZIP format PDF saja"
                >
                  <Printer className="w-3.5 h-3.5 text-rose-300" />
                  <span>PDF</span>
                </button>

                <button
                  id="btn-export-zip-bundle-docx"
                  onClick={() => handleExportZipBundle('docx')}
                  disabled={isExportingZip || isExportingAll}
                  className="inline-flex items-center justify-center gap-1 hover:bg-emerald-800 text-white px-2.5 py-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 border-r border-emerald-600/60"
                  title="Unduh arsip ZIP format Word (DOCX) saja"
                >
                  <Files className="w-3.5 h-3.5 text-blue-300" />
                  <span>Word</span>
                </button>

                <button
                  id="btn-open-zip-modal"
                  onClick={() => setIsZipModalOpen(true)}
                  disabled={isExportingZip || isExportingAll}
                  className="inline-flex items-center justify-center px-2 py-2 hover:bg-emerald-800 text-emerald-200 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                  title="Kustomisasi pilihan dokumen & struktur ZIP"
                >
                  <Archive className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                id="btn-export-all-docs-docx"
                onClick={() => handleGenerateAllDocs('docx')}
                disabled={isExportingAll || isExportingZip || !isBulkExportEligible}
                className="inline-flex items-center justify-center gap-1.5 bg-blue-900 hover:bg-blue-950 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md shadow-blue-900/15 transition-all cursor-pointer disabled:opacity-50"
                title="Unduh semua berkas Word satu per satu"
              >
                {isExportingAll ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    <span>Memproses...</span>
                  </>
                ) : (
                  <>
                    <Files className="w-4 h-4 text-blue-300" />
                    <span>Semua DOCX</span>
                  </>
                )}
              </button>

              <button
                id="btn-export-all-docs-pdf"
                onClick={() => handleGenerateAllDocs('pdf')}
                disabled={isExportingAll || isExportingZip || !isBulkExportEligible}
                className="inline-flex items-center justify-center gap-1.5 bg-rose-800 hover:bg-rose-900 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md shadow-rose-900/15 transition-all cursor-pointer disabled:opacity-50"
                title="Unduh semua berkas PDF satu per satu"
              >
                <Printer className="w-4 h-4 text-rose-300" />
                <span>Semua PDF</span>
              </button>

              <button
                type="button"
                id="btn-open-snapshot-validation"
                onClick={() => setIsValidationModalOpen(true)}
                className="inline-flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
                title="Buka Audit & Validasi Skenario Immutability Snapshot Dokumen"
              >
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                <span>Audit Snapshot</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mode Explanatory Banner */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
            documentMode === 'blank'
              ? 'bg-amber-100 text-amber-800 border border-amber-200'
              : 'bg-blue-100 text-blue-800 border border-blue-200'
          }`}>
            {documentMode === 'blank' ? 'Mode Format Kosong' : 'Mode Dokumen dari Data'}
          </span>
          <span className="text-slate-600">
            {documentMode === 'blank'
              ? 'Template dokumen siap cetak (PDF) atau siap edit (Word) dengan tabel kosong & format tanda tangan formal untuk pengisian manual.'
              : 'Menghasilkan dokumen otomatis berdasarkan data sekolah, guru, siswa, kurikulum, capaian pembelajaran (CP), dan tujuan pembelajaran (TP).'}
          </span>
        </div>

        {exportSuccessMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exportSuccessMessage}</span>
          </div>
        )}

        {exportErrorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs whitespace-pre-line flex items-start gap-2 animate-fadeIn">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold">Perhatian: </span>
              {exportErrorMessage}
            </div>
          </div>
        )}
      </div>

      {/* Grid: Workflow Integrity, Document Catalog & Live Paper Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Integrity & Document Engine List (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Integrity Checklist */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Integritas Rantai Administrasi</span>
              </h4>
              <span className="text-[11px] text-slate-400">Prasyarat Dokumen</span>
            </div>

            <div className="space-y-2 text-xs">
              <div
                onClick={() => onBackToStep('profile')}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
              >
                <span className="font-semibold text-slate-700">1. Profil Guru & Sekolah</span>
                {isProfileValid && isSchoolValid ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Lengkap
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Belum Lengkap
                  </span>
                )}
              </div>

              <div
                onClick={() => onBackToStep('academic')}
                className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
              >
                <span className="font-semibold text-slate-700">2. Data Akademik Mapel</span>
                {isAcademicValid ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {academicSetting.subject}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Belum Diisi
                  </span>
                )}
              </div>

              {isK13Curriculum ? (
                <>
                  <div
                    onClick={() => onBackToStep('k13-kd')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700">3. SKL / KI / KD</span>
                    {isK13KDValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {k13Analysis?.items?.length || 0} KD
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Kosong
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => onBackToStep('k13-indikator')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700">4. Analisis KD & Materi</span>
                    {isK13IndikatorValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terisi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-amber-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600" /> Belum Lengkap
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => onBackToStep('k13-tujuan')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700">5. Tujuan & Indikator Pencapaian (IPK)</span>
                    {isK13TujuanValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Terisi
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Kosong
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div
                    onClick={() => onBackToStep('cp')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700">3. Capaian Pembelajaran (CP)</span>
                    {isCPValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {cp?.elements?.length || 1} Elemen
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Kosong
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => onBackToStep('tp')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700">4. Tujuan Pembelajaran (TP)</span>
                    {isTPValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {tp?.items?.length || 0} Butir TP
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Kosong
                      </span>
                    )}
                  </div>

                  <div
                    onClick={() => onBackToStep('atp')}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                  >
                    <span className="font-semibold text-slate-700">5. Alur Pembelajaran (ATP)</span>
                    {isATPValid ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> {atp?.items?.length || 0} Unit ({totalJP} JP)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> Kosong
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Document Engine Catalog with Categories */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-blue-600" />
                <span>
                  Katalog Dokumen Administrasi ({DOCUMENT_CATALOG.filter((c) => isK13Curriculum ? !['ANALISIS_CP_TP', 'ATP', 'MODUL_AJAR', 'KKTP', 'ASESMEN', 'CP', 'TP'].includes(c.type) : !['ANALISIS_SKL_KI_KD', 'PENETAPAN_KKM'].includes(c.type)).length})
                </span>
              </h4>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Format Resmi .docx
              </span>
            </div>

            <div className="space-y-5">
              {catalogCategories.map((category) => {
                const itemsInCategory = DOCUMENT_CATALOG.filter((c) => {
                  if (c.category !== category.key) return false;
                  if (isK13Curriculum) {
                    return !['ANALISIS_CP_TP', 'ATP', 'MODUL_AJAR', 'KKTP', 'ASESMEN', 'CP', 'TP'].includes(c.type);
                  } else {
                    return !['ANALISIS_SKL_KI_KD', 'PENETAPAN_KKM'].includes(c.type);
                  }
                });
                if (itemsInCategory.length === 0) return null;

                return (
                  <div key={category.key} className="space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100 pb-1">
                      {category.label}
                    </div>

                    <div className="space-y-2.5">
                      {itemsInCategory.map((catItem) => {
                        const record = getDocRecord(catItem.type);
                        const validation = validateDocumentRequirements(catItem.type, context);
                        const isOutdated = isDocOutdated(catItem.type, record);
                        const isGenerating = generatingDocType === catItem.type;
                        const isSelectedForPreview = activePreviewType === catItem.type;

                        // Status resolution:
                        let statusText = 'Siap dibuat';
                        let statusColor = 'bg-blue-100 text-blue-800 border-blue-200';

                        if (!validation.isValid) {
                          statusText = 'Belum lengkap datanya';
                          statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                        } else if (record && isOutdated) {
                          statusText = 'Perlu diperbarui';
                          statusColor = 'bg-amber-100 text-amber-900 border-amber-300';
                        } else if (record) {
                          statusText = 'Siap diunduh';
                          statusColor = 'bg-emerald-100 text-emerald-900 border-emerald-300';
                        }

                        return (
                          <div
                            key={catItem.id}
                            className={`p-3.5 rounded-xl border transition cursor-pointer ${
                              isSelectedForPreview
                                ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                                : 'border-slate-200/80 bg-white hover:border-slate-300'
                            }`}
                            onClick={() => setActivePreviewType(catItem.type)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-bold text-slate-900">{catItem.title}</span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${statusColor}`}
                                  >
                                    {statusText}
                                  </span>
                                </div>
                                <span className="text-[10px] text-blue-700 font-semibold bg-blue-100/60 px-1.5 py-0.2 rounded inline-block">
                                  {catItem.category}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  id={`btn-download-docx-${catItem.type.toLowerCase()}`}
                                  disabled={isGenerating || isExportingAll || !validation.isValid}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateSingleDoc(catItem.type, 'docx');
                                  }}
                                  title="Unduh Format Microsoft Word (.docx)"
                                  className="px-2.5 py-1.5 bg-blue-800 hover:bg-blue-900 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  {isGenerating && generatingDocType === `${catItem.type}-docx` ? (
                                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <Download className="w-3 h-3 text-blue-200" />
                                      <span>DOCX</span>
                                    </>
                                  )}
                                </button>

                                <button
                                  type="button"
                                  id={`btn-download-pdf-${catItem.type.toLowerCase()}`}
                                  disabled={isGenerating || isExportingAll || !validation.isValid}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGenerateSingleDoc(catItem.type, 'pdf');
                                  }}
                                  title="Unduh Format PDF Siap Cetak Langsung"
                                  className="px-2.5 py-1.5 bg-rose-700 hover:bg-rose-800 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shrink-0 transition flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  {isGenerating && generatingDocType === `${catItem.type}-pdf` ? (
                                    <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <>
                                      <Printer className="w-3 h-3 text-rose-200" />
                                      <span>PDF</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-500 mt-1.5 leading-normal">{catItem.description}</p>

                            {record?.snapshot && (
                              <div className="mt-2 text-[10px] bg-slate-50 border border-slate-200/90 rounded-md p-1.5 space-y-1">
                                <div className="flex items-center justify-between text-slate-700">
                                  <div className="flex items-center gap-1 font-semibold">
                                    <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                    <span>Kepsek: {record.snapshot.principalName || 'Kepala Sekolah'}</span>
                                  </div>
                                  <span className="text-slate-500">{formatOfficialSnapshotDate(record.snapshot.generatedAt)}</span>
                                </div>
                                {isContextDriftedFromSnapshot(context, record.snapshot) && (
                                  <div className="text-[9.5px] text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                    <AlertCircle className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                    <span>Data sistem berubah ({school.principalName}). Snapshot ini tetap aman terlindungi.</span>
                                  </div>
                                )}
                              </div>
                            )}

                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                              <span>Sumber data: {catItem.requiredSources.join(' → ')}</span>
                              {isSelectedForPreview ? (
                                <span className="text-blue-700 font-bold flex items-center gap-0.5">
                                  Sedang Ditinjau <ChevronRight className="w-3 h-3" />
                                </span>
                              ) : (
                                <span className="hover:text-slate-600">Klik untuk pratinjau</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Document Paper Preview with Switcher (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {(() => {
            const activeRecord = getDocRecord(activePreviewType);
            const activeSnapshot = activeRecord?.snapshot;

            const previewSchoolName = activeSnapshot?.schoolName || school.name || '-';
            const previewSchoolNpsn = activeSnapshot?.schoolNpsn || activeSnapshot?.npsn || school.npsn || '-';
            const previewSchoolAddress = activeSnapshot?.schoolAddress || school.address || '-';
            const previewPrincipalName = activeSnapshot?.principalName || school.principalName || '';
            const previewPrincipalNip = activeSnapshot?.principalNip || school.principalNip || '';
            const previewTeacherName = activeSnapshot?.teacherName || profile.name || '';
            const previewTeacherNip = activeSnapshot?.teacherNip || profile.nip || '';
            const previewCurriculum = activeSnapshot?.curriculum || academicSetting.curriculum || '-';
            const previewAcademicYear = activeSnapshot?.academicYear || academicSetting.academicYear || '-';
            const previewSemester = activeSnapshot?.semester || academicSetting.semester || '-';
            const previewGrade = activeSnapshot?.grade || academicSetting.grade || '-';
            const previewPhase = activeSnapshot?.phase || academicSetting.phase || '-';
            const previewSubject = activeSnapshot?.subject || academicSetting.subject || '-';
            const previewDate = activeSnapshot?.generatedAt
              ? formatOfficialSnapshotDate(activeSnapshot.generatedAt)
              : dateFormatted;

            return (
              <>
                {/* Document Type Switcher Tabs */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto pb-1 max-w-full">
                    {DOCUMENT_CATALOG.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActivePreviewType(cat.type)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                          activePreviewType === cat.type
                            ? 'bg-blue-900 text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat.type}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleGenerateSingleDoc(activePreviewType, 'docx', false)}
                      disabled={generatingDocType === `${activePreviewType}-docx` || !validateDocumentRequirements(activePreviewType, context).isValid}
                      className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 cursor-pointer bg-blue-50 px-2.5 py-1.5 rounded-lg border border-blue-200 disabled:opacity-50"
                      title={activeSnapshot ? 'Unduh DOCX sesuai snapshot historis tersimpan' : 'Unduh Dokumen DOCX'}
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{activeSnapshot ? 'Unduh DOCX (Snapshot)' : 'Unduh DOCX'}</span>
                    </button>

                    <button
                      onClick={() => handleGenerateSingleDoc(activePreviewType, 'pdf', false)}
                      disabled={generatingDocType === `${activePreviewType}-pdf` || !validateDocumentRequirements(activePreviewType, context).isValid}
                      className="text-xs font-bold text-rose-700 hover:text-rose-900 flex items-center gap-1 cursor-pointer bg-rose-50 px-2.5 py-1.5 rounded-lg border border-rose-200 disabled:opacity-50"
                      title={activeSnapshot ? 'Unduh PDF sesuai snapshot historis tersimpan' : 'Unduh Dokumen PDF'}
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{activeSnapshot ? 'Unduh PDF (Snapshot)' : 'Unduh PDF'}</span>
                    </button>

                    {activeSnapshot && (
                      <button
                        onClick={() => handleGenerateSingleDoc(activePreviewType, 'docx', true)}
                        disabled={generatingDocType === `${activePreviewType}-docx`}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200"
                        title="Perbarui dokumen dengan data sekolah dan kepsek terbaru"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Perbarui Data</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Snapshot Context Banner */}
                {activeSnapshot ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50/90 border border-indigo-200 text-xs text-indigo-950 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                      <div>
                        <span className="font-bold">Dokumen Historis Terkunci:</span>{' '}
                        <span>
                          Dibuat {formatOfficialSnapshotDate(activeSnapshot.generatedAt)} · Kepala Sekolah:{' '}
                          <strong>{activeSnapshot.principalName || '-'}</strong>
                        </span>
                      </div>
                    </div>
                    {isContextDriftedFromSnapshot(context, activeSnapshot) && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Data sistem saat ini berbeda ({school.principalName})
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/80 border border-slate-200 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                      <span>Pratinjau draf langsung menggunakan data live. Klik tombol &ldquo;Unduh&rdquo; untuk merekam snapshot permanen.</span>
                    </div>
                  </div>
                )}

                {/* Paper Canvas */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-300 shadow-md space-y-6 text-slate-900 font-sans text-xs min-h-[580px]">
                  {/* Header / KOP */}
                  <div className="text-center space-y-1 border-b-2 border-slate-900 pb-3">
                    <h2 className="text-base sm:text-lg font-extrabold tracking-tight uppercase text-blue-950">
                      {activePreviewType === 'ANALISIS_CP_TP' && 'ANALISIS CAPAIAN PEMBELAJARAN (CP) MENUJU TUJUAN PEMBELAJARAN (TP)'}
                      {activePreviewType === 'ATP' && 'ALUR TUJUAN PEMBELAJARAN (ATP)'}
                      {activePreviewType === 'PROTA' && 'PROGRAM TAHUNAN (PROTA)'}
                      {activePreviewType === 'PROMES' && 'PROGRAM SEMESTER (PROMES)'}
                      {activePreviewType === 'MODUL_AJAR' && 'MODUL AJAR / RPP BERDIFERENSIASI'}
                      {activePreviewType === 'KKTP' && 'KRITERIA KETERCAPAIAN TUJUAN PEMBELAJARAN (KKTP)'}
                      {activePreviewType === 'DAFTAR_HADIR' && 'DAFTAR HADIR SISWA & REKAPITULASI PRESENSI'}
                      {activePreviewType === 'DAFTAR_NILAI' && 'BUKU DAFTAR NILAI & REKAPITULASI ASESMEN'}
                      {activePreviewType === 'ASESMEN' && 'PANDUAN INSTRUMEN ASESMEN & RUBRIK KKTP'}
                      {activePreviewType === 'JURNAL' && 'JURNAL HARIAN PELAKSANAAN PEMBELAJARAN'}
                      {activePreviewType === 'REMEDIAL_PENGAYAAN' && 'PROGRAM & LAPORAN TINDAK LANJUT REMEDIAL DAN PENGAYAAN'}
                      {activePreviewType === 'ALOKASI_WAKTU' && 'DISTRIBUSI ALOKASI WAKTU PEMBELAJARAN'}
                      {activePreviewType === 'KALENDER_AKADEMIK' && 'KALENDER PENDIDIKAN SATUAN PENDIDIKAN'}
                      {activePreviewType === 'ANALISIS_SKL_KI_KD' && 'ANALISIS SKL, KI, DAN KD (K13)'}
                      {activePreviewType === 'PENETAPAN_KKM' && 'PENETAPAN KRITERIA KETUNTASAN MINIMAL (KKM)'}
                      {documentMode === 'blank' && ' (FORMAT KOSONG)'}
                    </h2>
                    <h3 className="text-xs sm:text-sm font-bold uppercase text-slate-700">
                      {previewCurriculum} — TP {previewAcademicYear}
                    </h3>
                  </div>

                  {/* Metadata Identity Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-800 border-b border-slate-200 pb-3 bg-slate-50/50 p-3 rounded-xl">
                    <div>
                      <span className="font-semibold text-slate-600">Satuan Pendidikan:</span>{' '}
                      <span className="font-bold">{previewSchoolName}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">NPSN / Alamat:</span>{' '}
                      <span className="font-bold">{previewSchoolNpsn} · {previewSchoolAddress}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Mata Pelajaran:</span>{' '}
                      <span className="font-bold">{previewSubject}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">
                        {isK13Curriculum ? 'Tingkat / Kelas:' : 'Fase / Kelas:'}
                      </span>{' '}
                      <span className="font-bold">
                        {isK13Curriculum ? previewGrade : `${previewPhase} / ${previewGrade}`}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Tahun Ajaran / Sem:</span>{' '}
                      <span className="font-bold">
                        {previewAcademicYear} / {previewSemester}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Guru Pengampu:</span>{' '}
                      <span className="font-bold">{previewTeacherName}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">NIP Guru:</span>{' '}
                      <span>{previewTeacherNip || '-'}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-slate-600">Tanggal Dibuat:</span>{' '}
                      <span>{previewDate}</span>
                    </div>
                  </div>

            {/* DOCUMENT-SPECIFIC PREVIEW CONTENT */}

            {/* 0. ANALISIS CP -> TP PREVIEW */}
            {activePreviewType === 'ANALISIS_CP_TP' && (
              <div className="space-y-4">
                {cp?.generalDescription && (
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 uppercase">A. Capaian Pembelajaran Umum Fase {academicSetting.phase}</h5>
                    <p className="text-slate-700 leading-relaxed text-justify bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {cp.generalDescription}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">B. Tabel Analisis Penurunan CP Menjadi TP</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1.5 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1.5 border border-blue-800 w-28">Elemen CP</th>
                          <th className="p-1.5 border border-blue-800 min-w-[140px]">Teks Capaian Pembelajaran</th>
                          <th className="p-1.5 border border-blue-800 min-w-[100px]">Analisis Kompetensi (KKO)</th>
                          <th className="p-1.5 border border-blue-800 min-w-[100px]">Analisis Lingkup Materi</th>
                          <th className="p-1.5 border border-blue-800 min-w-[140px]">Rumusan Tujuan Pembelajaran (TP)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(cp?.elements && cp.elements.length > 0) ? (
                          cp.elements.map((elem, idx) => {
                            const relatedTps = (tp?.items || []).filter((t) => t.elementId === elem.id || t.element === elem.name);
                            return (
                              <tr key={elem.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                                <td className="p-1.5 border border-slate-300 font-bold text-blue-950">{elem.name}</td>
                                <td className="p-1.5 border border-slate-300 text-slate-700">{elem.description}</td>
                                <td className="p-1.5 border border-slate-300">
                                  <div className="text-[10px] text-slate-600">
                                    Mengidentifikasi, memahami, menerapkan, mengevaluasi materi {elem.name}
                                  </div>
                                </td>
                                <td className="p-1.5 border border-slate-300">
                                  <div className="text-[10px] text-slate-600">
                                    Konsep dan aplikasi esensial {elem.name}
                                  </div>
                                </td>
                                <td className="p-1.5 border border-slate-300">
                                  {relatedTps.length > 0 ? (
                                    <ul className="space-y-1 list-disc list-inside">
                                      {relatedTps.map((t) => (
                                        <li key={t.id} className="text-[10px]">
                                          <strong className="text-blue-900">{t.code}:</strong> {t.statement}
                                        </li>
                                      ))}
                                    </ul>
                                  ) : (
                                    <span className="text-[10px] text-slate-400 italic">Rumusan TP diturunkan dari CP elemen ini</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-slate-400 italic">
                              Capaian Pembelajaran (CP) belum tersedia. Silakan lengkapi pada langkah 03.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 1. ATP PREVIEW */}
            {activePreviewType === 'ATP' && (
              <div className="space-y-4">
                {atp?.rationale && (
                  <div className="space-y-1">
                    <h5 className="font-bold text-slate-900 uppercase">A. Rasionalisasi Alur Pembelajaran</h5>
                    <p className="text-slate-700 leading-relaxed text-justify bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      {atp.rationale}
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">B. Matriks Alur Tujuan Pembelajaran</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1.5 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1.5 border border-blue-800 w-14">Kode</th>
                          <th className="p-1.5 border border-blue-800 min-w-[160px]">Tujuan Pembelajaran</th>
                          <th className="p-1.5 border border-blue-800 min-w-[100px]">Materi Pokok</th>
                          <th className="p-1.5 border border-blue-800 min-w-[90px]">Profil Pancasila</th>
                          <th className="p-1.5 border border-blue-800 text-center w-10">JP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(atp?.items || []).map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-mono font-bold text-blue-900">{item.tpCode}</td>
                            <td className="p-1.5 border border-slate-300">{item.tpStatement}</td>
                            <td className="p-1.5 border border-slate-300">{item.materialScope}</td>
                            <td className="p-1.5 border border-slate-300">{item.p3Dimensions?.join(', ') || '-'}</td>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{item.jp || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. PROTA PREVIEW */}
            {activePreviewType === 'PROTA' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">Distribusi Alokasi Waktu Pembelajaran Tahunan</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1.5 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1.5 border border-blue-800 w-16">Kode TP</th>
                          <th className="p-1.5 border border-blue-800">Tujuan Pembelajaran & Ruang Lingkup Materi</th>
                          <th className="p-1.5 border border-blue-800 text-center w-16">Alokasi</th>
                          <th className="p-1.5 border border-blue-800 text-center w-24">Semester</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(atp?.items || []).map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-mono font-bold text-blue-900 text-center">{item.tpCode}</td>
                            <td className="p-1.5 border border-slate-300">
                              <div className="font-medium">{item.tpStatement}</div>
                              {item.materialScope && <div className="text-[10px] text-slate-500 italic">Materi: {item.materialScope}</div>}
                            </td>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{item.jp || 4} JP</td>
                            <td className="p-1.5 border border-slate-300 text-center">{academicSetting.semester || '-'}</td>
                          </tr>
                        ))}
                        <tr className="bg-slate-100 font-bold">
                          <td colSpan={3} className="p-1.5 border border-slate-300 text-right">TOTAL ALOKASI TAHUNAN:</td>
                          <td className="p-1.5 border border-slate-300 text-center text-blue-900">{totalJP + 4} JP</td>
                          <td className="p-1.5 border border-slate-300"></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. PROMES PREVIEW */}
            {activePreviewType === 'PROMES' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">Matriks Distribusi Jam Pembelajaran Mingguan per Bulan</h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1 border border-blue-800 text-center w-6">No</th>
                          <th className="p-1 border border-blue-800 w-12">Kode</th>
                          <th className="p-1 border border-blue-800 min-w-[120px]">Tujuan Pembelajaran</th>
                          <th className="p-1 border border-blue-800 text-center w-10">JP</th>
                          {semesterMonths.map((m) => (
                            <th key={m} className="p-1 border border-blue-800 text-center w-10">
                              {m.slice(0, 3)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(atp?.items || []).map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                            <td className="p-1 border border-slate-300 font-mono font-bold text-blue-900">{item.tpCode}</td>
                            <td className="p-1 border border-slate-300 truncate max-w-[140px]">{item.tpStatement}</td>
                            <td className="p-1 border border-slate-300 text-center font-bold">{item.jp || 4}</td>
                            {semesterMonths.map((_, mIdx) => (
                              <td key={mIdx} className="p-1 border border-slate-300 text-center">
                                {mIdx === idx % 6 ? `${item.jp || 4}` : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 4. MODUL AJAR PREVIEW */}
            {activePreviewType === 'MODUL_AJAR' && (() => {
              const activePlan = (learningPlans && learningPlans.length > 0)
                ? (learningPlans.find((p) => p.status === 'SIAP') || learningPlans[0])
                : null;
              
              const resolvedTPs = activePlan
                ? (tp?.items || []).filter((t) => activePlan.tpIds.includes(t.id))
                : (tp?.items || []);

              return (
                <div className="space-y-3 text-slate-800">
                  <div className="bg-blue-50/60 p-3 rounded-xl border border-blue-100 space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-blue-950 uppercase text-[11px]">I. Informasi Umum & Alokasi Waktu</div>
                      {activePlan && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          activePlan.status === 'SIAP'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {activePlan.status === 'SIAP' ? 'SIAP (Terkonfirmasi)' : `DRAF (${activePlan.status})`}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      {activePlan?.learningModel
                        ? `Model: ${activePlan.learningModel}. `
                        : ''}
                      Alokasi Waktu:{' '}
                      <strong>{activePlan?.allocatedJP ? `${activePlan.allocatedJP} JP` : `${atp?.items?.reduce((a, b) => a + (Number(b.jp) || 0), 0) || 0} JP (Total ATP)`}</strong>.
                      {activePlan?.targetStudents && ` Target: ${activePlan.targetStudents}.`}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 uppercase text-[11px]">II. Tujuan Pembelajaran (Canonical TP)</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      {resolvedTPs.length > 0 ? (
                        <ul className="list-disc pl-4 space-y-0.5 mt-1">
                          {resolvedTPs.map((t) => (
                            <li key={t.id}>
                              <strong>[{t.code || 'TP'}]</strong> {t.statement}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="italic text-slate-400">Belum ada TP yang dipilih pada rencana pembelajaran ini.</p>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                    <div className="font-bold text-slate-900 uppercase text-[11px]">III. Langkah Kegiatan Pembelajaran</div>
                    <div className="text-[11px] text-slate-600 leading-relaxed">
                      {activePlan?.learningSteps ? (
                        <div className="space-y-1 mt-1">
                          <div>
                            <span className="font-semibold">Pendahuluan:</span>{' '}
                            {activePlan.learningSteps.opening?.map((s) => s.description).join('; ') || '-'}
                          </div>
                          <div>
                            <span className="font-semibold">Inti:</span>{' '}
                            {activePlan.learningSteps.core?.map((s) => s.description).join('; ') || '-'}
                          </div>
                          <div>
                            <span className="font-semibold">Penutup:</span>{' '}
                            {activePlan.learningSteps.closing?.map((s) => s.description).join('; ') || '-'}
                          </div>
                        </div>
                      ) : (
                        <p className="italic text-slate-400">
                          Buka tab <strong>Rencana Pembelajaran</strong> untuk menyusun atau mengonfirmasi langkah-langkah kegiatan secara terstruktur.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 5. ASESMEN PREVIEW */}
            {activePreviewType === 'ASESMEN' && (() => {
              const activePkg =
                (assessmentPackages || []).find((p) => p.id === selectedAssessmentPackageId) ||
                (readyAssessmentPackages.length === 1 ? readyAssessmentPackages[0] : undefined);

              if (documentMode === 'blank') {
                return (
                  <div className="space-y-4">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                      <strong>Mode Format Kosong:</strong> Dokumen asesmen akan diekspor dengan format tabel kisi-kisi, lembar soal, dan rubrik kosong siap isi/tulis tangan.
                    </div>
                    <div className="space-y-2">
                      <h5 className="font-bold text-slate-900 uppercase">I. Kisi-Kisi Asesmen Pembelajaran (Format Kosong)</h5>
                      <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                        <thead>
                          <tr className="bg-blue-900 text-white font-semibold">
                            <th className="p-1.5 border border-blue-800 text-center w-10">No</th>
                            <th className="p-1.5 border border-blue-800">Tujuan Pembelajaran</th>
                            <th className="p-1.5 border border-blue-800">Indikator Asesmen</th>
                            <th className="p-1.5 border border-blue-800">Materi</th>
                            <th className="p-1.5 border border-blue-800">Bentuk</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <tr key={i}>
                              <td className="p-1.5 border border-slate-300 text-center">{i}</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400 italic">........................................</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400 italic">........................................</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400 italic">....................</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400 italic">....................</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              }

              if (readyAssessmentPackages.length === 0) {
                return (
                  <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-3">
                    <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
                    <h5 className="font-bold text-amber-900 text-sm">Belum Ada Perangkat Asesmen Berstatus SIAP</h5>
                    <p className="text-xs text-amber-800 max-w-md mx-auto">
                      Dokumen Asesmen hanya dapat diekspor dari Perangkat Asesmen yang telah tervalidasi dan dikonfirmasi berstatus <strong>SIAP</strong> oleh guru.
                    </p>
                    <button
                      onClick={() => onBackToStep('assessment')}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shadow inline-flex items-center gap-1.5"
                    >
                      Buka Tab Perangkat Asesmen <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              }

              return (
                <div className="space-y-5">
                  {readyAssessmentPackages.length > 1 && (
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3">
                      <span className="text-xs font-semibold text-slate-700">Pilih Perangkat Asesmen SIAP:</span>
                      <select
                        value={selectedAssessmentPackageId}
                        onChange={(e) => setSelectedAssessmentPackageId(e.target.value)}
                        className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Pilih Perangkat Asesmen --</option>
                        {readyAssessmentPackages.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} (Revisi {p.revision || 1})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {activePkg ? (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-emerald-950 text-xs">{activePkg.title}</span>
                            <span className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">SIAP</span>
                          </div>
                          <p className="text-[11px] text-emerald-800 mt-0.5">
                            {activePkg.blueprintItems.length} Kisi-kisi • {activePkg.instruments.length} Instrumen • {activePkg.answerKeys.length} Kunci/Rubrik
                          </p>
                        </div>
                      </div>

                      {/* Kisi-kisi */}
                      <div className="space-y-2">
                        <h5 className="font-bold text-slate-900 uppercase text-xs">I. Kisi-Kisi Asesmen Pembelajaran</h5>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                            <thead>
                              <tr className="bg-blue-900 text-white font-semibold">
                                <th className="p-1.5 border border-blue-800 text-center w-8">No</th>
                                <th className="p-1.5 border border-blue-800">Tujuan Pembelajaran</th>
                                <th className="p-1.5 border border-blue-800">Indikator Asesmen</th>
                                <th className="p-1.5 border border-blue-800">Lingkup Materi</th>
                                <th className="p-1.5 border border-blue-800">Bentuk Instrumen</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activePkg.blueprintItems.map((bp, idx) => (
                                <tr key={bp.id || idx}>
                                  <td className="p-1.5 border border-slate-300 text-center font-medium">{idx + 1}</td>
                                  <td className="p-1.5 border border-slate-300">{bp.objectiveRefId || '-'}</td>
                                  <td className="p-1.5 border border-slate-300">{bp.assessmentIndicator}</td>
                                  <td className="p-1.5 border border-slate-300">{bp.materialOrContext}</td>
                                  <td className="p-1.5 border border-slate-300 capitalize">{bp.instrumentType.replace(/_/g, ' ')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Instrumen Summary */}
                      <div className="space-y-2">
                        <h5 className="font-bold text-slate-900 uppercase text-xs">II. Daftar Instrumen Asesmen ({activePkg.instruments.length})</h5>
                        <div className="space-y-2">
                          {activePkg.instruments.map((inst, idx) => (
                            <div key={inst.id || idx} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs">
                              <div className="font-bold text-slate-800">
                                {idx + 1}. {inst.title} ({inst.type.replace(/_/g, ' ')})
                              </div>
                              <p className="text-[11px] text-slate-600 mt-0.5">{inst.instructions}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-100 rounded-lg text-center text-xs text-slate-600">
                      Silakan pilih salah satu Perangkat Asesmen di atas untuk melihat pratinjau.
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 6. JURNAL PREVIEW */}
            {activePreviewType === 'JURNAL' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">
                    {documentMode === 'blank' ? 'Format Jurnal Harian Mengajar & Refleksi' : 'Jurnal Harian Mengajar & Refleksi'}
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1.5 border border-blue-800 text-center w-8">No</th>
                          <th className="p-1.5 border border-blue-800 w-24">Hari / Tanggal</th>
                          <th className="p-1.5 border border-blue-800 w-16 text-center">Kode TP</th>
                          <th className="p-1.5 border border-blue-800">Aktivitas di Kelas</th>
                          <th className="p-1.5 border border-blue-800 w-28 text-center">Kehadiran</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentMode === 'blank' ? (
                          Array.from({ length: 6 }, (_, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1.5 border border-slate-300 text-center text-slate-400 text-[10px]">.... / .... / 20...</td>
                              <td className="p-1.5 border border-slate-300 text-center text-slate-400 font-mono">TP .....</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400">......................................................................................</td>
                              <td className="p-1.5 border border-slate-300 text-center text-slate-400 text-[10px]">H: ... S: ... I: ... A: ...</td>
                            </tr>
                          ))
                        ) : (atp?.items || []).slice(0, 4).map((item, idx) => (
                          <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                            <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 text-center text-[10px]">Minggu ke-{idx + 1}</td>
                            <td className="p-1.5 border border-slate-300 font-mono font-bold text-blue-900 text-center">{item.tpCode}</td>
                            <td className="p-1.5 border border-slate-300">
                              <div className="font-medium">{item.materialScope}</div>
                              <div className="text-[10px] text-slate-500">Eksplorasi konsep, diskusi aktif, dan LKPD.</div>
                            </td>
                            <td className="p-1.5 border border-slate-300 text-[10px] text-center">Hadir: Lengkap</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 7. KKTP PREVIEW */}
            {activePreviewType === 'KKTP' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">
                    {documentMode === 'blank' ? 'Format Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)' : 'Kriteria Ketercapaian Tujuan Pembelajaran (KKTP)'}
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1.5 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1.5 border border-blue-800 w-16 text-center">Kode TP</th>
                          <th className="p-1.5 border border-blue-800 min-w-[140px]">Tujuan Pembelajaran (TP)</th>
                          <th className="p-1.5 border border-blue-800 min-w-[180px]">Indikator Ketercapaian & Kriteria Interval</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentMode === 'blank' ? (
                          Array.from({ length: 6 }, (_, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1.5 border border-slate-300 text-center font-mono text-blue-900">TP.{idx + 1}</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400">....................................................................................</td>
                              <td className="p-1.5 border border-slate-300 text-slate-400">
                                <div>1. ................................................................................</div>
                                <div>2. ................................................................................</div>
                                <div>• Interval Ketercapaian: ............................................</div>
                              </td>
                            </tr>
                          ))
                        ) : (tp?.items && tp.items.length > 0) ? (
                          tp.items.slice(0, 6).map((item, idx) => (
                            <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1.5 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1.5 border border-slate-300 text-center font-mono font-bold text-blue-900">{item.code || `TP.${idx + 1}`}</td>
                              <td className="p-1.5 border border-slate-300">{item.statement}</td>
                              <td className="p-1.5 border border-slate-300">
                                <div>• Memahami konsep dasar dan menerapkan prosedur.</div>
                                <div className="text-[10px] text-slate-500 font-semibold">• Kriteria Ketercapaian: Interval nilai ≥ 75 (Tuntas)</div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-slate-400 italic">
                              Tujuan Pembelajaran belum terisi. Beralih ke Format Kosong untuk mencetak template.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 8. DAFTAR_HADIR PREVIEW */}
            {activePreviewType === 'DAFTAR_HADIR' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">
                    {documentMode === 'blank' ? 'Format Daftar Presensi Kehadiran Siswa' : 'Daftar Presensi Kehadiran Siswa'}
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1 border border-blue-800 w-20 text-center">NISN</th>
                          <th className="p-1 border border-blue-800 min-w-[120px]">Nama Peserta Didik</th>
                          <th className="p-1 border border-blue-800 text-center w-8">L/P</th>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                            <th key={p} className="p-1 border border-blue-800 text-center w-6">P{p}</th>
                          ))}
                          <th className="p-1 border border-blue-800 text-center w-6">S</th>
                          <th className="p-1 border border-blue-800 text-center w-6">I</th>
                          <th className="p-1 border border-blue-800 text-center w-6">A</th>
                          <th className="p-1 border border-blue-800 text-center w-10">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentMode === 'blank' ? (
                          Array.from({ length: 8 }, (_, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">..........</td>
                              <td className="p-1 border border-slate-300 text-slate-400">................................................</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">....</td>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                                <td key={p} className="p-1 border border-slate-300 text-center"></td>
                              ))}
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                            </tr>
                          ))
                        ) : (students && students.length > 0) ? (
                          students.slice(0, 8).map((st, idx) => (
                            <tr key={st.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1 border border-slate-300 text-center font-mono">{st.nisn || '-'}</td>
                              <td className="p-1 border border-slate-300 font-medium">{st.name}</td>
                              <td className="p-1 border border-slate-300 text-center">{st.gender || 'L'}</td>
                              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => (
                                <td key={p} className="p-1 border border-slate-300 text-center text-emerald-700 font-bold">H</td>
                              ))}
                              <td className="p-1 border border-slate-300 text-center">0</td>
                              <td className="p-1 border border-slate-300 text-center">0</td>
                              <td className="p-1 border border-slate-300 text-center">0</td>
                              <td className="p-1 border border-slate-300 text-center font-bold text-blue-900">100%</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={18} className="p-4 text-center text-slate-400 italic">
                              Belum ada data siswa terdaftar. Beralih ke Format Kosong untuk mencetak template presensi.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 9. DAFTAR_NILAI PREVIEW */}
            {activePreviewType === 'DAFTAR_NILAI' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">
                    {documentMode === 'blank' ? 'Format Buku Daftar Nilai Asesmen' : 'Buku Daftar Nilai & Rekapitulasi Asesmen'}
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1 border border-blue-800 w-20 text-center">NISN</th>
                          <th className="p-1 border border-blue-800 min-w-[120px]">Nama Peserta Didik</th>
                          <th className="p-1 border border-blue-800 text-center w-8">L/P</th>
                          <th className="p-1 border border-blue-800 text-center w-12">TP 1</th>
                          <th className="p-1 border border-blue-800 text-center w-12">TP 2</th>
                          <th className="p-1 border border-blue-800 text-center w-12">TP 3</th>
                          <th className="p-1 border border-blue-800 text-center w-12">SAS</th>
                          <th className="p-1 border border-blue-800 text-center w-14">Nilai Akhir</th>
                          <th className="p-1 border border-blue-800 min-w-[90px]">Ketercapaian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentMode === 'blank' ? (
                          Array.from({ length: 8 }, (_, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">..........</td>
                              <td className="p-1 border border-slate-300 text-slate-400">................................................</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">....</td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-center"></td>
                              <td className="p-1 border border-slate-300 text-slate-400">....................</td>
                            </tr>
                          ))
                        ) : (students && students.length > 0) ? (
                          students.slice(0, 8).map((st, idx) => (
                            <tr key={st.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1 border border-slate-300 text-center font-mono">{st.nisn || '-'}</td>
                              <td className="p-1 border border-slate-300 font-medium">{st.name}</td>
                              <td className="p-1 border border-slate-300 text-center">{st.gender || 'L'}</td>
                              <td className="p-1 border border-slate-300 text-center">82</td>
                              <td className="p-1 border border-slate-300 text-center">85</td>
                              <td className="p-1 border border-slate-300 text-center">80</td>
                              <td className="p-1 border border-slate-300 text-center">84</td>
                              <td className="p-1 border border-slate-300 text-center font-bold text-blue-900">83</td>
                              <td className="p-1 border border-slate-300 text-emerald-700 font-semibold">Tercapai</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={10} className="p-4 text-center text-slate-400 italic">
                              Belum ada data nilai tersimpan. Beralih ke Format Kosong untuk mencetak format nilai.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 10. REMEDIAL_PENGAYAAN PREVIEW */}
            {activePreviewType === 'REMEDIAL_PENGAYAAN' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-900 uppercase">
                    {documentMode === 'blank' ? 'Format Program Remedial & Pengayaan' : 'Program & Laporan Pelaksanaan Remedial dan Pengayaan'}
                  </h5>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[10px] border border-slate-300 border-collapse">
                      <thead>
                        <tr className="bg-blue-900 text-white font-semibold">
                          <th className="p-1 border border-blue-800 text-center w-7">No</th>
                          <th className="p-1 border border-blue-800 min-w-[100px]">Nama Peserta Didik</th>
                          <th className="p-1 border border-blue-800 w-16 text-center">Kode TP</th>
                          <th className="p-1 border border-blue-800 min-w-[100px]">Materi / Indikator Belum Tuntas</th>
                          <th className="p-1 border border-blue-800 min-w-[110px]">Bentuk Intervensi / Kegiatan</th>
                          <th className="p-1 border border-blue-800 text-center w-12">Nilai Awal</th>
                          <th className="p-1 border border-blue-800 text-center w-12">Nilai Akhir</th>
                          <th className="p-1 border border-blue-800 text-center w-16">Keterangan</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documentMode === 'blank' ? (
                          Array.from({ length: 6 }, (_, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                              <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                              <td className="p-1 border border-slate-300 text-slate-400">................................................</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">TP .....</td>
                              <td className="p-1 border border-slate-300 text-slate-400">................................................</td>
                              <td className="p-1 border border-slate-300 text-slate-400">................................................</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">.....</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">.....</td>
                              <td className="p-1 border border-slate-300 text-center text-slate-400">..................</td>
                            </tr>
                          ))
                        ) : (remedials && remedials.length > 0) ? (
                          remedials.map((r, idx) => {
                            const st = (students || []).find((s) => s.id === r.studentId);
                            const t = (tp?.items || []).find((item) => item.id === r.tpId);
                            return (
                              <tr key={r.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="p-1 border border-slate-300 text-center font-bold">{idx + 1}</td>
                                <td className="p-1 border border-slate-300 font-medium">{st?.name || 'Siswa'}</td>
                                <td className="p-1 border border-slate-300 text-center font-mono text-blue-900">{t?.code || 'TP'}</td>
                                <td className="p-1 border border-slate-300">{r.reason || 'Perlu bimbingan'}</td>
                                <td className="p-1 border border-slate-300">{r.intervention || 'Bimbingan khusus'}</td>
                                <td className="p-1 border border-slate-300 text-center">60</td>
                                <td className="p-1 border border-slate-300 text-center font-bold text-emerald-700">{r.reassessmentScore || 78}</td>
                                <td className="p-1 border border-slate-300 text-center font-semibold text-emerald-700">Tuntas</td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={8} className="p-4 text-center text-slate-400 italic">
                              Belum ada catatan remedial/pengayaan tersimpan. Beralih ke Format Kosong untuk format manual.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Official Sign-off Block Preview */}
            <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-800">
              {documentMode === 'blank' ? (
                <>
                  <div className="space-y-1">
                    <div>Mengetahui,</div>
                    <div className="font-semibold">Kepala Sekolah</div>
                    <div className="h-14" />
                    <div>(........................)</div>
                    <div className="text-[11px] text-slate-600">
                      NIP. ....................
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="font-semibold">Guru Mata Pelajaran</div>
                    <div className="h-14" />
                    <div>(........................)</div>
                    <div className="text-[11px] text-slate-600">
                      NIP. ....................
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <div>Mengetahui,</div>
                    <div className="font-semibold">Kepala Satuan Pendidikan</div>
                    <div className="h-14 flex items-end">
                      <div className="font-bold underline">
                        {previewPrincipalName || '...................................................'}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      NIP. {previewPrincipalNip || '...................................................'}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div>{previewDate}</div>
                    <div className="font-semibold">Guru Mata Pelajaran</div>
                    <div className="h-14 flex items-end">
                      <div className="font-bold underline">
                        {previewTeacherName || '...................................................'}
                      </div>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      NIP. {previewTeacherNip || '...................................................'}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      );
    })()}
  </div>
</div>

      <SnapshotValidationModal
        isOpen={isValidationModalOpen}
        onClose={() => setIsValidationModalOpen(false)}
        currentSchool={school}
        currentProfile={profile}
        currentAcademicSetting={academicSetting}
        documents={localDocs}
        onApplyNewDoc={(newDoc) => {
          setLocalDocs((prev) => [...prev.filter((d) => d.id !== newDoc.id), newDoc]);
          if (onUpdateDocuments) {
            onUpdateDocuments([...localDocs.filter((d) => d.id !== newDoc.id), newDoc]);
          }
        }}
      />

      <ZipExportModal
        isOpen={isZipModalOpen}
        onClose={() => setIsZipModalOpen(false)}
        context={context}
        existingRecords={localDocs}
        onSuccess={(result) => {
          setExportSuccessMessage(
            `Sukses! ${result.exportedCount} dokumen (${result.pdfCount} PDF, ${result.docxCount} Word) telah dikompresi ke dalam arsip ZIP "${result.zipFileName}".`
          );
          setTimeout(() => setExportSuccessMessage(null), 8000);
        }}
      />
    </div>
  );
};
