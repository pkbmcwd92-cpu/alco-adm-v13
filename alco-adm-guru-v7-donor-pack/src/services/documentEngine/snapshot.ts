import { DocumentSnapshot, DocumentMode, CurriculumType } from '../../types';
import { DocumentGenerationContext } from './types';
import { getCurriculumType } from '../curriculumRules';

/**
 * Creates an immutable DocumentSnapshot capturing the exact identity and academic context
 * at the moment of document generation.
 */
export function createDocumentSnapshot(
  context: DocumentGenerationContext,
  format: 'docx' | 'pdf' | 'all' = 'docx',
  modeOverride?: DocumentMode
): DocumentSnapshot {
  const { school, profile, academicSetting, cp, tp, atp, students } = context;
  const docMode = modeOverride || context.documentMode || 'data';

  return {
    schoolName: (school?.name || 'Satuan Pendidikan').trim(),
    npsn: (school?.npsn || '').trim(),
    schoolNpsn: (school?.npsn || '').trim(),
    schoolAddress: (school?.address || '').trim(),
    schoolVillage: (school?.village || '').trim(),
    schoolDistrict: (school?.district || '').trim(),
    schoolRegency: (school?.regency || '').trim(),
    schoolProvince: (school?.province || '').trim(),
    principalName: (school?.principalName || '').trim(),
    principalNip: (school?.principalNip || '').trim(),
    principalSource: school?.principalSource || '',
    teacherName: (profile?.name || '').trim(),
    teacherNip: (profile?.nip || '').trim(),
    teacherStatus: profile?.status || '',
    academicYear: (academicSetting?.academicYear || '').trim(),
    semester: (academicSetting?.semester || '').trim(),
    grade: (academicSetting?.grade || '').trim(),
    subject: (academicSetting?.subject || '').trim(),
    phase: (academicSetting?.phase || '').trim(),
    curriculum: (academicSetting?.curriculum || 'Kurikulum Merdeka').trim(),
    curriculumType: getCurriculumType(academicSetting?.curriculum || academicSetting?.curriculumType),
    documentMode: docMode,
    studentCount: students?.length || 0,
    generatedAt: new Date().toISOString(),
    format,
    sourceVersions: {
      cpUpdatedAt: cp?.updatedAt,
      tpUpdatedAt: tp?.updatedAt,
      atpUpdatedAt: atp?.updatedAt,
    },
  };
}

/**
 * Resolves an effective DocumentGenerationContext by applying snapshot overrides.
 * If a snapshot is present, the identity fields (school, teacher, academic, mode)
 * are locked to the snapshot values so that subsequent changes to live state
 * will NEVER inadvertently alter the historical document content.
 */
export function resolveEffectiveContext(
  context: DocumentGenerationContext,
  snapshotOverride?: DocumentSnapshot
): DocumentGenerationContext {
  const snap = snapshotOverride || context.snapshot;
  if (!snap) {
    return context;
  }

  return {
    ...context,
    school: {
      ...context.school,
      name: snap.schoolName || context.school?.name || '',
      npsn: snap.schoolNpsn || snap.npsn || context.school?.npsn || '',
      address: snap.schoolAddress !== undefined ? snap.schoolAddress : (context.school?.address || ''),
      village: snap.schoolVillage !== undefined ? snap.schoolVillage : (context.school?.village || ''),
      district: snap.schoolDistrict !== undefined ? snap.schoolDistrict : (context.school?.district || ''),
      regency: snap.schoolRegency !== undefined ? snap.schoolRegency : (context.school?.regency || ''),
      province: snap.schoolProvince !== undefined ? snap.schoolProvince : (context.school?.province || ''),
      principalName: snap.principalName || context.school?.principalName || '',
      principalNip: snap.principalNip !== undefined ? snap.principalNip : (context.school?.principalNip || ''),
      principalSource: snap.principalSource !== undefined ? snap.principalSource : context.school?.principalSource,
    },
    profile: {
      ...context.profile,
      name: snap.teacherName || context.profile?.name || '',
      nip: snap.teacherNip !== undefined ? snap.teacherNip : (context.profile?.nip || ''),
      status: (snap.teacherStatus as any) || context.profile?.status,
    },
    academicSetting: {
      ...context.academicSetting,
      academicYear: snap.academicYear || context.academicSetting?.academicYear || '',
      semester: ((snap.semester as '1 (Ganjil)' | '2 (Genap)') || context.academicSetting?.semester || '1 (Ganjil)') as '1 (Ganjil)' | '2 (Genap)',
      grade: snap.grade || context.academicSetting?.grade || '',
      phase: snap.phase || context.academicSetting?.phase || '',
      subject: snap.subject || context.academicSetting?.subject || '',
      curriculum: snap.curriculum || context.academicSetting?.curriculum || 'Kurikulum Merdeka',
      curriculumType: snap.curriculumType || getCurriculumType(snap.curriculum || context.academicSetting?.curriculum),
    },
    documentMode: snap.documentMode || context.documentMode || 'data',
    snapshot: snap,
  };
}

export interface SnapshotFieldComparison {
  key: string;
  label: string;
  valueA: string;
  valueB: string;
  isMatch: boolean;
}

export interface SnapshotComparisonResult {
  isIdentical: boolean;
  principalChanged: boolean;
  schoolChanged: boolean;
  teacherChanged: boolean;
  academicChanged: boolean;
  dateA: string;
  dateB: string;
  fields: SnapshotFieldComparison[];
}

/**
 * Compares two DocumentSnapshots across all 14 required identity fields:
 * 1. Sekolah (schoolName)
 * 2. NPSN (npsn)
 * 3. Alamat (schoolAddress)
 * 4. Kepala Sekolah (principalName)
 * 5. NIP Kepala Sekolah (principalNip)
 * 6. Guru (teacherName)
 * 7. NIP Guru (teacherNip)
 * 8. Kurikulum (curriculum)
 * 9. Tahun Pelajaran (academicYear)
 * 10. Semester (semester)
 * 11. Kelas (grade)
 * 12. Fase (phase)
 * 13. Mata Pelajaran (subject)
 * 14. Tanggal Dibuat (generatedAt)
 */
export function compareDocumentSnapshots(
  snapA: DocumentSnapshot,
  snapB: DocumentSnapshot
): SnapshotComparisonResult {
  const fields: SnapshotFieldComparison[] = [
    {
      key: 'schoolName',
      label: 'Nama Satuan Pendidikan (Sekolah)',
      valueA: snapA.schoolName || '-',
      valueB: snapB.schoolName || '-',
      isMatch: (snapA.schoolName || '').trim() === (snapB.schoolName || '').trim(),
    },
    {
      key: 'npsn',
      label: 'NPSN',
      valueA: snapA.npsn || snapA.schoolNpsn || '-',
      valueB: snapB.npsn || snapB.schoolNpsn || '-',
      isMatch: (snapA.npsn || snapA.schoolNpsn || '').trim() === (snapB.npsn || snapB.schoolNpsn || '').trim(),
    },
    {
      key: 'schoolAddress',
      label: 'Alamat Sekolah',
      valueA: snapA.schoolAddress || '-',
      valueB: snapB.schoolAddress || '-',
      isMatch: (snapA.schoolAddress || '').trim() === (snapB.schoolAddress || '').trim(),
    },
    {
      key: 'principalName',
      label: 'Kepala Sekolah',
      valueA: snapA.principalName || '-',
      valueB: snapB.principalName || '-',
      isMatch: (snapA.principalName || '').trim() === (snapB.principalName || '').trim(),
    },
    {
      key: 'principalNip',
      label: 'NIP Kepala Sekolah',
      valueA: snapA.principalNip || '-',
      valueB: snapB.principalNip || '-',
      isMatch: (snapA.principalNip || '').trim() === (snapB.principalNip || '').trim(),
    },
    {
      key: 'teacherName',
      label: 'Guru Pengampu',
      valueA: snapA.teacherName || '-',
      valueB: snapB.teacherName || '-',
      isMatch: (snapA.teacherName || '').trim() === (snapB.teacherName || '').trim(),
    },
    {
      key: 'teacherNip',
      label: 'NIP Guru',
      valueA: snapA.teacherNip || '-',
      valueB: snapB.teacherNip || '-',
      isMatch: (snapA.teacherNip || '').trim() === (snapB.teacherNip || '').trim(),
    },
    {
      key: 'curriculum',
      label: 'Kurikulum',
      valueA: snapA.curriculum || 'Kurikulum Merdeka',
      valueB: snapB.curriculum || 'Kurikulum Merdeka',
      isMatch: (snapA.curriculum || '').trim() === (snapB.curriculum || '').trim(),
    },
    {
      key: 'academicYear',
      label: 'Tahun Pelajaran',
      valueA: snapA.academicYear || '-',
      valueB: snapB.academicYear || '-',
      isMatch: (snapA.academicYear || '').trim() === (snapB.academicYear || '').trim(),
    },
    {
      key: 'semester',
      label: 'Semester',
      valueA: snapA.semester || '-',
      valueB: snapB.semester || '-',
      isMatch: (snapA.semester || '').trim() === (snapB.semester || '').trim(),
    },
    {
      key: 'grade',
      label: 'Kelas',
      valueA: snapA.grade || '-',
      valueB: snapB.grade || '-',
      isMatch: (snapA.grade || '').trim() === (snapB.grade || '').trim(),
    },
    {
      key: 'phase',
      label: 'Fase',
      valueA: snapA.phase || '-',
      valueB: snapB.phase || '-',
      isMatch: (snapA.phase || '').trim() === (snapB.phase || '').trim(),
    },
    {
      key: 'subject',
      label: 'Mata Pelajaran',
      valueA: snapA.subject || '-',
      valueB: snapB.subject || '-',
      isMatch: (snapA.subject || '').trim() === (snapB.subject || '').trim(),
    },
    {
      key: 'generatedAt',
      label: 'Tanggal Dibuat',
      valueA: formatOfficialSnapshotDate(snapA.generatedAt),
      valueB: formatOfficialSnapshotDate(snapB.generatedAt),
      isMatch: snapA.generatedAt === snapB.generatedAt,
    },
  ];

  const principalChanged =
    (snapA.principalName || '').trim() !== (snapB.principalName || '').trim() ||
    (snapA.principalNip || '').trim() !== (snapB.principalNip || '').trim();

  const schoolChanged =
    (snapA.schoolName || '').trim() !== (snapB.schoolName || '').trim() ||
    (snapA.npsn || '').trim() !== (snapB.npsn || '').trim() ||
    (snapA.schoolAddress || '').trim() !== (snapB.schoolAddress || '').trim();

  const teacherChanged =
    (snapA.teacherName || '').trim() !== (snapB.teacherName || '').trim() ||
    (snapA.teacherNip || '').trim() !== (snapB.teacherNip || '').trim();

  const academicChanged =
    (snapA.curriculum || '').trim() !== (snapB.curriculum || '').trim() ||
    (snapA.academicYear || '').trim() !== (snapB.academicYear || '').trim() ||
    (snapA.semester || '').trim() !== (snapB.semester || '').trim() ||
    (snapA.grade || '').trim() !== (snapB.grade || '').trim() ||
    (snapA.subject || '').trim() !== (snapB.subject || '').trim();

  const isIdentical = fields.every((f) => f.isMatch);

  return {
    isIdentical,
    principalChanged,
    schoolChanged,
    teacherChanged,
    academicChanged,
    dateA: snapA.generatedAt,
    dateB: snapB.generatedAt,
    fields,
  };
}

/**
 * Checks whether live context identity has drifted from a document snapshot.
 */
export function isContextDriftedFromSnapshot(
  context: DocumentGenerationContext,
  snapshot: DocumentSnapshot
): boolean {
  const currentSchoolName = (context.school?.name || '').trim();
  const snapSchoolName = (snapshot.schoolName || '').trim();
  if (currentSchoolName && snapSchoolName && currentSchoolName !== snapSchoolName) return true;

  const currentPrincipal = (context.school?.principalName || '').trim();
  const snapPrincipal = (snapshot.principalName || '').trim();
  if (currentPrincipal && snapPrincipal && currentPrincipal !== snapPrincipal) return true;

  const currentPrincipalNip = (context.school?.principalNip || '').trim();
  const snapPrincipalNip = (snapshot.principalNip || '').trim();
  if (currentPrincipalNip !== snapPrincipalNip) return true;

  const currentTeacher = (context.profile?.name || '').trim();
  const snapTeacher = (snapshot.teacherName || '').trim();
  if (currentTeacher && snapTeacher && currentTeacher !== snapTeacher) return true;

  const currentCurriculum = (context.academicSetting?.curriculum || '').trim();
  const snapCurriculum = (snapshot.curriculum || '').trim();
  if (currentCurriculum && snapCurriculum && currentCurriculum !== snapCurriculum) return true;

  return false;
}

/**
 * Formats ISO date string into Indonesian official format.
 */
export function formatOfficialSnapshotDate(isoDateString?: string): string {
  if (!isoDateString) return '-';
  try {
    const d = new Date(isoDateString);
    if (isNaN(d.getTime())) return isoDateString;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoDateString;
  }
}
