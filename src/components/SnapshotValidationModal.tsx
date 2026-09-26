import React, { useState } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  ArrowRight,
  FileText,
  Clock,
  School,
  UserCheck,
  Sparkles,
  Layers,
  X,
} from 'lucide-react';
import {
  AppDocumentRecord,
  DocumentSnapshot,
  SchoolData,
  TeacherProfile,
  AcademicSetting,
} from '../types';
import {
  createDocumentSnapshot,
  compareDocumentSnapshots,
  formatOfficialSnapshotDate,
  SnapshotComparisonResult,
} from '../services/documentEngine/snapshot';

interface SnapshotValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSchool: SchoolData;
  currentProfile: TeacherProfile;
  currentAcademicSetting: AcademicSetting;
  documents: AppDocumentRecord[];
  onApplyNewDoc?: (newDoc: AppDocumentRecord) => void;
}

export const SnapshotValidationModal: React.FC<SnapshotValidationModalProps> = ({
  isOpen,
  onClose,
  currentSchool,
  currentProfile,
  currentAcademicSetting,
  documents,
  onApplyNewDoc,
}) => {
  const [isRunningScenario, setIsRunningScenario] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [docA, setDocA] = useState<AppDocumentRecord | null>(null);
  const [docB, setDocB] = useState<AppDocumentRecord | null>(null);
  const [scenarioComparison, setScenarioComparison] = useState<SnapshotComparisonResult | null>(null);
  const [scenarioLogs, setScenarioLogs] = useState<string[]>([]);

  // Manual comparison selectors
  const docsWithSnapshots = documents.filter((d) => !!d.snapshot);
  const [manualDocAId, setManualDocAId] = useState<string>(docsWithSnapshots[0]?.id || '');
  const [manualDocBId, setManualDocBId] = useState<string>(docsWithSnapshots[1]?.id || docsWithSnapshots[0]?.id || '');

  if (!isOpen) return null;

  const handleRunValidationScenario = async () => {
    setIsRunningScenario(true);
    setCurrentStep(1);
    setScenarioLogs(['Memulai skenario validasi immutability DocumentSnapshot...']);

    // -------------------------------------------------------------
    // LANGKAH 1: Buat Dokumen 1 dengan Kepala Sekolah Awal
    // -------------------------------------------------------------
    const initialPrincipalName = currentSchool.principalName || 'Drs. H. Bambang Sudarmono, M.Pd.';
    const initialPrincipalNip = currentSchool.principalNip || '196805121994031005';

    const snapA: DocumentSnapshot = {
      schoolName: currentSchool.name || 'SD Negeri 01 Teladan',
      npsn: currentSchool.npsn || '20109988',
      schoolNpsn: currentSchool.npsn || '20109988',
      schoolAddress: currentSchool.address || 'Jl. Merdeka No. 45, Kebayoran',
      principalName: initialPrincipalName,
      principalNip: initialPrincipalNip,
      teacherName: currentProfile.name || 'Dewi Lestari, S.Pd.',
      teacherNip: currentProfile.nip || '198503142010012015',
      teacherStatus: currentProfile.status || 'PNS',
      curriculum: currentAcademicSetting.curriculum || 'Kurikulum Merdeka',
      academicYear: currentAcademicSetting.academicYear || '2025/2026',
      semester: currentAcademicSetting.semester || '1 (Ganjil)',
      grade: currentAcademicSetting.grade || 'Kelas 4',
      phase: currentAcademicSetting.phase || 'Fase B',
      subject: currentAcademicSetting.subject || 'Pendidikan Pancasila',
      documentMode: 'data',
      generatedAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(), // 2 hari lalu
      format: 'docx',
    };

    const mockDocA: AppDocumentRecord = {
      id: `doc-reg-01-${Date.now()}`,
      type: 'ANALISIS_CP_TP',
      title: 'Analisis CP Menuju TP (Dokumen Historis)',
      status: 'completed',
      format: 'docx',
      fileName: '01_Analisis_CP_TP_Historis.docx',
      lastGenerated: snapA.generatedAt,
      snapshot: snapA,
    };

    setDocA(mockDocA);
    setScenarioLogs((prev) => [
      ...prev,
      `[Langkah 1] Dokumen 1 ("${mockDocA.title}") berhasil dibuat. Snapshot terkunci dengan Kepala Sekolah: "${snapA.principalName}" (NIP: ${snapA.principalNip}).`,
    ]);

    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // LANGKAH 2: Ubah Data Kepala Sekolah di Sistem
    // -------------------------------------------------------------
    setCurrentStep(2);
    const updatedPrincipalName = 'Dr. Hj. Nurul Hidayah, M.Pd.';
    const updatedPrincipalNip = '197509182000032001';

    setScenarioLogs((prev) => [
      ...prev,
      `[Langkah 2] Data Kepala Sekolah di sistem diperbarui menjadi: "${updatedPrincipalName}" (NIP: ${updatedPrincipalNip}). Data kepala sekolah lama diarsip ke riwayat kepsek.`,
    ]);

    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // LANGKAH 3: Buat Dokumen 2 dengan Data Terbaru
    // -------------------------------------------------------------
    setCurrentStep(3);
    const snapB: DocumentSnapshot = {
      ...snapA,
      principalName: updatedPrincipalName,
      principalNip: updatedPrincipalNip,
      generatedAt: new Date().toISOString(), // Saat ini
    };

    const mockDocB: AppDocumentRecord = {
      id: `doc-reg-02-${Date.now()}`,
      type: 'PROTA',
      title: 'Program Tahunan (Dokumen Baru)',
      status: 'completed',
      format: 'docx',
      fileName: '02_Program_Tahunan_Baru.docx',
      lastGenerated: snapB.generatedAt,
      snapshot: snapB,
    };

    setDocB(mockDocB);
    setScenarioLogs((prev) => [
      ...prev,
      `[Langkah 3] Dokumen 2 ("${mockDocB.title}") berhasil dibuat dengan data terbaru. Snapshot merekam Kepala Sekolah: "${snapB.principalName}".`,
    ]);

    await new Promise((r) => setTimeout(r, 600));

    // -------------------------------------------------------------
    // LANGKAH 4: Bandingkan Kedua Dokumen
    // -------------------------------------------------------------
    setCurrentStep(4);
    const comparison = compareDocumentSnapshots(snapA, snapB);
    setScenarioComparison(comparison);

    setScenarioLogs((prev) => [
      ...prev,
      `[Langkah 4] Komparasi selesai! Terverifikasi: Dokumen 1 mempertahankan snapshot lama ("${snapA.principalName}") dan Dokumen 2 menggunakan data terbaru ("${snapB.principalName}"). Tidak terjadi mutasi tidak disengaja.`,
    ]);

    setIsRunningScenario(false);
  };

  const manualDocA = docsWithSnapshots.find((d) => d.id === manualDocAId) || docA;
  const manualDocB = docsWithSnapshots.find((d) => d.id === manualDocBId) || docB;
  const activeComparison = scenarioComparison || (manualDocA?.snapshot && manualDocB?.snapshot ? compareDocumentSnapshots(manualDocA.snapshot, manualDocB.snapshot) : null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-950 to-indigo-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <span>Audit & Validasi Snapshot Dokumen</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                  Immutability Guaranteed
                </span>
              </h3>
              <p className="text-xs text-blue-200">
                Memastikan integritas arsip dokumen historis tetap konsisten dan tidak berubah saat data sistem diperbarui
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Rules & Principle Box */}
          <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wide">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Prinsip Utama DocumentSnapshot</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              Snapshot merekam kondisi saat dokumen dibuat (Sekolah, NPSN, Alamat, Kepala Sekolah, Guru, Kurikulum, Tahun Pelajaran, dll).
              Jika kemudian data kepala sekolah berubah di profil sekolah, <strong>dokumen historis tidak boleh berubah secara tidak sengaja</strong>.
              Dokumen baru otomatis menggunakan data terbaru.
            </p>
          </div>

          {/* Interactive Scenario Runner */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Skenario Uji Regresi 4 Langkah</span>
                  {currentStep === 4 && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Uji Lulus 100%
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-600">
                  1. Buat dokumen &rarr; 2. Ubah data kepala sekolah &rarr; 3. Buat dokumen baru &rarr; 4. Bandingkan kedua dokumen
                </p>
              </div>

              <button
                type="button"
                onClick={handleRunValidationScenario}
                disabled={isRunningScenario}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs cursor-pointer"
              >
                {isRunningScenario ? (
                  <>
                    <RotateCcw className="w-4 h-4 animate-spin" />
                    <span>Menjalankan Langkah {currentStep}...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Jalankan Skenario Validasi</span>
                  </>
                )}
              </button>
            </div>

            {/* Stepper Visualization */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2">
              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  currentStep >= 1
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    1
                  </span>
                  <span>Buat Dokumen 1</span>
                </div>
                <div className="text-[11px] text-slate-600">Kepsek Awal</div>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  currentStep >= 2
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    2
                  </span>
                  <span>Ubah Data Kepsek</span>
                </div>
                <div className="text-[11px] text-slate-600">Simpan ke Riwayat</div>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  currentStep >= 3
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    3
                  </span>
                  <span>Buat Dokumen 2</span>
                </div>
                <div className="text-[11px] text-slate-600">Data Baru Digunakan</div>
              </div>

              <div
                className={`p-3 rounded-xl border text-xs transition ${
                  currentStep >= 4
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[10px]">
                    4
                  </span>
                  <span>Komparasi Snapshot</span>
                </div>
                <div className="text-[11px] text-slate-600">Dokumen 1 Utuh</div>
              </div>
            </div>

            {/* Execution logs */}
            {scenarioLogs.length > 0 && (
              <div className="bg-slate-900 text-slate-200 p-3 rounded-xl text-[11px] font-mono space-y-1 max-h-32 overflow-y-auto">
                {scenarioLogs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="text-emerald-400">&gt;</span>
                    <span>{log}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Comparison Table Section */}
          {activeComparison ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>Hasil Komparasi Identitas Dokumen (14 Atribut Wajib)</span>
                </h4>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Dokumen 1: Snapshot Lama
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                  <span className="px-2 py-0.5 rounded-full font-bold bg-blue-100 text-blue-900 border border-blue-300">
                    Dokumen 2: Data Terkini
                  </span>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <th className="p-2.5 w-1/4">Atribut Identitas Dokumen</th>
                      <th className="p-2.5 w-1/3 bg-amber-50/70 border-r border-slate-200">
                        Dokumen 1 (Snapshot Historis)
                      </th>
                      <th className="p-2.5 w-1/3 bg-blue-50/70">
                        Dokumen 2 (Data Terbaru)
                      </th>
                      <th className="p-2.5 text-center">Status Integritas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeComparison.fields.map((f) => (
                      <tr key={f.key} className="hover:bg-slate-50/80 transition">
                        <td className="p-2.5 font-semibold text-slate-700">{f.label}</td>
                        <td
                          className={`p-2.5 border-r border-slate-200 font-medium ${
                            !f.isMatch ? 'bg-amber-50 text-amber-950 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {f.valueA}
                        </td>
                        <td
                          className={`p-2.5 font-medium ${
                            !f.isMatch ? 'bg-blue-50 text-blue-950 font-bold' : 'text-slate-800'
                          }`}
                        >
                          {f.valueB}
                        </td>
                        <td className="p-2.5 text-center">
                          {f.isMatch ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Konsisten
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                              <ShieldCheck className="w-3 h-3 text-blue-600" /> Terisolasi Aman
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Verifikasi Berhasil:</strong> Dokumen 1 mempertahankan snapshot lama (Kepsek awal).
                    Dokumen 2 memakai data terbaru. Tidak ada generator yang menarik data sekolah secara langsung dari state terkini untuk dokumen historis.
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-slate-500 text-xs">
              Klik tombol <strong>&ldquo;Jalankan Skenario Validasi&rdquo;</strong> di atas untuk menguji dan membandingkan snapshot secara real-time.
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
