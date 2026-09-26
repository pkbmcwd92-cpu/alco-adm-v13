/**
 * Regression Test Scenario for DocumentSnapshot Immutability
 *
 * Skenario Validasi:
 * 1. Buat dokumen pertama (Dokumen A) dengan Kepala Sekolah awal
 * 2. Ubah data kepala sekolah di sistem (dan arsipkan ke principal history)
 * 3. Buat dokumen kedua (Dokumen B) dengan data terbaru
 * 4. Bandingkan kedua dokumen:
 *    - Dokumen pertama mempertahankan snapshot lama (Drs. H. Bambang Sudarmono, M.Pd.)
 *    - Dokumen kedua menggunakan data terbaru (Dr. Hj. Nurul Hidayah, M.Pd.)
 *    - Generator tidak boleh mengambil identitas sekolah secara langsung dari state terbaru setelah snapshot dibuat.
 */

import {
  createDocumentSnapshot,
  resolveEffectiveContext,
  compareDocumentSnapshots,
  isContextDriftedFromSnapshot,
} from '../src/services/documentEngine/snapshot';
import { DocumentGenerationContext } from '../src/services/documentEngine/types';
import { SchoolData, TeacherProfile, AcademicSetting } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ REGRESSION TEST FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runSnapshotRegressionTest() {
  console.log('===========================================================');
  console.log('🧪 RUNNING AUDIT & REGRESSION TEST: DocumentSnapshot Immutability');
  console.log('===========================================================');

  // Baseline School Data (Principal A)
  const initialSchool: SchoolData = {
    id: 'sch-001',
    name: 'SD Negeri 01 Teladan',
    npsn: '20109988',
    address: 'Jl. Merdeka No. 45, Kebayoran',
    village: 'Kebayoran Baru',
    district: 'Kebayoran Baru',
    regency: 'Jakarta Selatan',
    province: 'DKI Jakarta',
    principalName: 'Drs. H. Bambang Sudarmono, M.Pd.',
    principalNip: '196805121994031005',
    principalSource: 'Dapodik Resmi Kemendikbudristek',
    verificationStatus: 'verified',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const teacherProfile: TeacherProfile = {
    id: 'prof-001',
    name: 'Dewi Lestari, S.Pd.',
    nip: '198503142010012015',
    status: 'PNS',
    defaultSubject: 'Pendidikan Pancasila',
    defaultLevel: 'SD',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const academicSetting: AcademicSetting = {
    id: 'acad-001',
    profileId: 'prof-001',
    academicYear: '2025/2026',
    semester: '1 (Ganjil)',
    level: 'SD',
    grade: 'Kelas 4',
    subject: 'Pendidikan Pancasila',
    phase: 'Fase B',
    curriculum: 'Kurikulum Merdeka',
    totalHoursPerWeek: 4,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  const contextA: DocumentGenerationContext = {
    school: { ...initialSchool },
    profile: { ...teacherProfile },
    academicSetting: { ...academicSetting },
    documentMode: 'data',
    cp: {
      id: 'cp-001',
      academicSettingId: 'acad-001',
      generalDescription: 'Peserta didik mampu memahami nilai-nilai Pancasila dalam kehidupan sehari-hari.',
      elements: [],
      updatedAt: '2026-02-01T10:00:00.000Z',
    },
    tp: {
      id: 'tp-001',
      academicSettingId: 'acad-001',
      items: [
        {
          id: 'tp-1',
          code: 'TP 1.1',
          statement: 'Menjelaskan makna sila-sila Pancasila',
          competence: 'Menjelaskan',
          contentScope: 'Makna sila Pancasila',
          p3Dimensions: ['Bernalar Kritis'],
          order: 1,
        },
      ],
      updatedAt: '2026-02-01T11:00:00.000Z',
    },
    atp: {
      id: 'atp-001',
      academicSettingId: 'acad-001',
      rationale: 'Alur disusun logis',
      items: [
        {
          id: 'atp-1',
          stepNumber: 1,
          tpCode: 'TP 1.1',
          tpStatement: 'Menjelaskan makna sila Pancasila',
          materialScope: 'Makna sila Pancasila',
          jp: 8,
          p3Dimensions: ['Bernalar Kritis'],
          assessmentPlan: 'Formatif',
          glossary: 'Pancasila',
        },
      ],
      totalJP: 8,
      updatedAt: '2026-02-01T12:00:00.000Z',
    },
    students: [
      { id: 'std-1', name: 'Ahmad Dahlan', nisn: '0123456789', gender: 'L', academicSettingId: 'acad-001' },
    ],
  };

  // -------------------------------------------------------------
  // LANGKAH 1: Buat Dokumen 1 (Snapshot Awal)
  // -------------------------------------------------------------
  console.log('\n--- LANGKAH 1: Membuat Dokumen Pertama (Dokumen A) ---');
  const snapshotA = createDocumentSnapshot(contextA, 'docx', 'data');

  assert(snapshotA.schoolName === 'SD Negeri 01 Teladan', 'Dokumen A mencatat Satuan Pendidikan');
  assert(snapshotA.npsn === '20109988', 'Dokumen A mencatat NPSN');
  assert(snapshotA.schoolAddress === 'Jl. Merdeka No. 45, Kebayoran', 'Dokumen A mencatat Alamat');
  assert(snapshotA.principalName === 'Drs. H. Bambang Sudarmono, M.Pd.', 'Dokumen A mencatat Kepala Sekolah awal');
  assert(snapshotA.principalNip === '196805121994031005', 'Dokumen A mencatat NIP Kepala Sekolah awal');
  assert(snapshotA.teacherName === 'Dewi Lestari, S.Pd.', 'Dokumen A mencatat Guru Pengampu');
  assert(snapshotA.teacherNip === '198503142010012015', 'Dokumen A mencatat NIP Guru');
  assert(snapshotA.curriculum === 'Kurikulum Merdeka', 'Dokumen A mencatat Kurikulum');
  assert(snapshotA.academicYear === '2025/2026', 'Dokumen A mencatat Tahun Pelajaran');
  assert(snapshotA.semester === '1 (Ganjil)', 'Dokumen A mencatat Semester');
  assert(snapshotA.grade === 'Kelas 4', 'Dokumen A mencatat Kelas');
  assert(snapshotA.phase === 'Fase B', 'Dokumen A mencatat Fase');
  assert(snapshotA.subject === 'Pendidikan Pancasila', 'Dokumen A mencatat Mata Pelajaran');
  assert(!!snapshotA.generatedAt, 'Dokumen A mencatat Tanggal Dibuat');

  // -------------------------------------------------------------
  // LANGKAH 2: Ubah Data Kepala Sekolah di Sistem
  // -------------------------------------------------------------
  console.log('\n--- LANGKAH 2: Memperbarui Data Kepala Sekolah di Sistem ---');
  const updatedSchool: SchoolData = {
    ...initialSchool,
    principalName: 'Dr. Hj. Nurul Hidayah, M.Pd.',
    principalNip: '197509182000032001',
    principalSource: 'SK Pelantikan Kepala Sekolah No. 421/2026',
    updatedAt: new Date().toISOString(),
  };

  const contextB: DocumentGenerationContext = {
    ...contextA,
    school: { ...updatedSchool },
  };

  assert(contextB.school.principalName === 'Dr. Hj. Nurul Hidayah, M.Pd.', 'Sistem kini memiliki data Kepala Sekolah baru');
  assert(
    isContextDriftedFromSnapshot(contextB, snapshotA) === true,
    'Sistem mendeteksi bahwa data sekolah telah berubah dibanding snapshot Dokumen A'
  );

  // -------------------------------------------------------------
  // LANGKAH 3: Buat Dokumen Kedua (Dokumen B) dengan Data Terbaru
  // -------------------------------------------------------------
  console.log('\n--- LANGKAH 3: Membuat Dokumen Kedua (Dokumen B) ---');
  const snapshotB = createDocumentSnapshot(contextB, 'docx', 'data');

  assert(snapshotB.schoolName === 'SD Negeri 01 Teladan', 'Dokumen B mencatat Satuan Pendidikan');
  assert(snapshotB.principalName === 'Dr. Hj. Nurul Hidayah, M.Pd.', 'Dokumen B menggunakan Kepala Sekolah terbaru');
  assert(snapshotB.principalNip === '197509182000032001', 'Dokumen B menggunakan NIP Kepala Sekolah terbaru');

  // -------------------------------------------------------------
  // LANGKAH 4: Bandingkan Kedua Dokumen
  // -------------------------------------------------------------
  console.log('\n--- LANGKAH 4: Membandingkan Kedua Dokumen (Snapshot A vs Snapshot B) ---');
  const comparison = compareDocumentSnapshots(snapshotA, snapshotB);

  // Verifikasi Dokumen 1 TIDAK BERUBAH (Immutability check)
  assert(
    snapshotA.principalName === 'Drs. H. Bambang Sudarmono, M.Pd.',
    'Dokumen pertama MEMPERTAHANKAN snapshot lama (Drs. H. Bambang Sudarmono, M.Pd.)'
  );
  assert(
    snapshotA.principalNip === '196805121994031005',
    'Dokumen pertama MEMPERTAHANKAN NIP snapshot lama'
  );

  // Verifikasi Dokumen 2 MENGGUNAKAN DATA BARU
  assert(
    snapshotB.principalName === 'Dr. Hj. Nurul Hidayah, M.Pd.',
    'Dokumen kedua MENGGUNAKAN data terbaru (Dr. Hj. Nurul Hidayah, M.Pd.)'
  );
  assert(
    snapshotB.principalNip === '197509182000032001',
    'Dokumen kedua MENGGUNAKAN NIP data terbaru'
  );

  assert(comparison.principalChanged === true, 'Komparasi mendeteksi perubahan Kepala Sekolah antar dokumen');
  assert(comparison.schoolChanged === false, 'Komparasi memastikan nama sekolah dan alamat tetap konsisten');
  assert(comparison.teacherChanged === false, 'Komparasi memastikan data guru tetap konsisten');
  assert(comparison.academicChanged === false, 'Komparasi memastikan setelan akademik tetap konsisten');

  // -------------------------------------------------------------
  // AUDIT: Pastikan Generator Menggunakan Snapshot dan Tidak Bocor dari Live State
  // -------------------------------------------------------------
  console.log('\n--- AUDIT: Pengujian Context Resolution untuk Generator ---');
  // Ketika Dokumen 1 dirender/diunduh ulang menggunakan snapshot-nya,
  // meskipun live state saat ini memiliki Kepala Sekolah baru (Dr. Nurul),
  // resolved context HARUS tetap menggunakan Kepala Sekolah lama (Drs. Bambang)!
  const effectiveContextForDocA = resolveEffectiveContext(contextB, snapshotA);

  assert(
    effectiveContextForDocA.school.principalName === 'Drs. H. Bambang Sudarmono, M.Pd.',
    'resolveEffectiveContext() mengunci Kepala Sekolah ke snapshot Dokumen 1 saat diekspor kembali'
  );
  assert(
    effectiveContextForDocA.school.principalNip === '196805121994031005',
    'resolveEffectiveContext() mengunci NIP Kepala Sekolah ke snapshot Dokumen 1'
  );

  console.log('\n===========================================================');
  console.log('🎉 REGRESSION TEST COMPLETED SUCCESSFULLY: 100% PASSED');
  console.log('Integritas DocumentSnapshot terbukti IMMUTABLE.');
  console.log('===========================================================');
}

runSnapshotRegressionTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
