import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  FileDown,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  Calculator,
} from 'lucide-react';
import {
  Student,
  Assessment,
  AssessmentResult,
  RemedialRecord,
  EnrichmentRecord,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  TPData,
} from '../../types';
import { generateDaftarNilai } from '../../services/documentEngine';

interface AssessmentGradeManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  tp?: TPData;
  students: Student[];
  assessments: Assessment[];
  assessmentResults: AssessmentResult[];
  onSaveAssessment: (assessment: Assessment, results: AssessmentResult[]) => void;
  onDeleteAssessment: (assessmentId: string) => void;
  onQuickAddRemedial?: (record: RemedialRecord) => void;
  onQuickAddEnrichment?: (record: EnrichmentRecord) => void;
}

export const AssessmentGradeManager: React.FC<AssessmentGradeManagerProps> = ({
  school,
  profile,
  academicSetting,
  tp,
  students = [],
  assessments = [],
  assessmentResults = [],
  onSaveAssessment,
  onDeleteAssessment,
  onQuickAddRemedial,
  onQuickAddEnrichment,
}) => {
  const [assessmentList, setAssessmentList] = useState<Assessment[]>(assessments || []);
  const [resultsList, setResultsList] = useState<AssessmentResult[]>(assessmentResults || []);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | null>(
    assessments?.[0]?.id || null
  );

  // New assessment form state
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<Assessment['type']>('formatif');
  const [newTpId, setNewTpId] = useState<string>(tp?.items?.[0]?.id || '');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPassingScore, setNewPassingScore] = useState<number>(75);

  const [notification, setNotification] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'assessment_scores' | 'matrix_gradebook'>('assessment_scores');

  const selectedAssessment = assessmentList.find((a) => a.id === selectedAssessmentId);

  const handleCreateAssessment = () => {
    if (!newTitle.trim()) return;
    const newId = `asm-${Date.now()}`;
    const newAsm: Assessment = {
      id: newId,
      academicSettingId: academicSetting.id,
      title: newTitle.trim(),
      type: newType,
      tpId: newTpId || tp?.items?.[0]?.id || 'tp-1',
      date: newDate,
      maxScore: 100,
      passingScore: newPassingScore,
      createdAt: new Date().toISOString(),
    };

    // Default results for all students: 80
    const initialResults: AssessmentResult[] = (students || []).map((std) => ({
      id: `res-${Date.now()}-${std.id}`,
      assessmentId: newId,
      studentId: std.id,
      score: 80,
      status: 80 >= newPassingScore ? 'tercapai' : 'belum_tercapai',
    }));

    const updatedAsm = [...assessmentList, newAsm];
    const updatedRes = [...resultsList, ...initialResults];

    setAssessmentList(updatedAsm);
    setResultsList(updatedRes);
    setSelectedAssessmentId(newId);
    setIsCreatingNew(false);
    setNewTitle('');
    onSaveAssessment(newAsm, initialResults);
    setNotification('Instrumen asesmen baru berhasil dibuat!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleScoreChange = (studentId: string, scoreVal: number) => {
    if (!selectedAssessmentId) return;
    const clamped = Math.max(0, Math.min(100, scoreVal));
    const passing = selectedAssessment?.passingScore || 75;

    setResultsList((prev) => {
      const idx = prev.findIndex(
        (r) => r.assessmentId === selectedAssessmentId && r.studentId === studentId
      );
      const status: AssessmentResult['status'] =
        clamped >= 85 ? 'sangat_baik' : clamped >= passing ? 'tercapai' : 'belum_tercapai';

      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], score: clamped, status };
        return updated;
      } else {
        return [
          ...prev,
          {
            id: `res-${Date.now()}-${studentId}`,
            assessmentId: selectedAssessmentId,
            studentId,
            score: clamped,
            status,
          },
        ];
      }
    });
  };

  const handleSaveCurrentScores = () => {
    if (!selectedAssessment) return;
    const currentResults = resultsList.filter((r) => r.assessmentId === selectedAssessment.id);
    onSaveAssessment(selectedAssessment, currentResults);
    setNotification('Nilai asesmen berhasil disimpan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteCurrent = (id: string) => {
    if (!confirm('Hapus instrumen asesmen ini beserta seluruh nilainya?')) return;
    onDeleteAssessment(id);
    const updated = assessmentList.filter((a) => a.id !== id);
    setAssessmentList(updated);
    setSelectedAssessmentId(updated[0]?.id || null);
  };

  const handleSendToRemedial = (student: Student, score: number) => {
    if (!selectedAssessment || !onQuickAddRemedial) return;
    const remRecord: RemedialRecord = {
      id: `rem-${Date.now()}-${student.id}`,
      academicSettingId: academicSetting.id,
      studentId: student.id,
      tpId: selectedAssessment.tpId || tp?.items?.[0]?.id || '',
      sourceAssessmentId: selectedAssessment.id,
      reason: `Nilai Asesmen ${selectedAssessment.title}: ${score} (Di bawah KKM/KKTP ${selectedAssessment.passingScore})`,
      intervention: 'Bimbingan khusus dan penugasan tutor sebaya',
      date: new Date().toISOString().split('T')[0],
      reassessmentScore: 78,
      status: 'planned',
      updatedAt: new Date().toISOString(),
    };
    onQuickAddRemedial(remRecord);
    setNotification(`${student.name} berhasil didaftarkan ke Program Remedial!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSendToEnrichment = (student: Student, score: number) => {
    if (!selectedAssessment || !onQuickAddEnrichment) return;
    const enrRecord: EnrichmentRecord = {
      id: `enr-${Date.now()}-${student.id}`,
      academicSettingId: academicSetting.id,
      studentId: student.id,
      tpId: selectedAssessment.tpId || tp?.items?.[0]?.id || '',
      sourceAssessmentId: selectedAssessment.id,
      activity: `Proyek penalaran tinggi & materi pendalaman untuk ${selectedAssessment.title} (Nilai: ${score})`,
      date: new Date().toISOString().split('T')[0],
      result: 'Sangat Baik',
      status: 'planned',
      updatedAt: new Date().toISOString(),
    };
    onQuickAddEnrichment(enrRecord);
    setNotification(`${student.name} berhasil didaftarkan ke Program Pengayaan!`);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateDaftarNilai({
        school,
        profile,
        academicSetting,
        students,
        assessments: assessmentList,
        assessmentResults: resultsList,
      });
    } catch (e: any) {
      alert(`Gagal mengekspor daftar nilai: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="assessment-grade-container">
      {notification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">{notification}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs tracking-wider uppercase">
              <FileSpreadsheet className="w-4 h-4" />
              <span>Modul Evaluasi & Penilaian Pembelajaran</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Asesmen & Buku Daftar Nilai</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Pengelolaan asesmen formatif & sumatif terhubung langsung dengan tindak lanjut ({academicSetting.subject} - {academicSetting.grade})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-daftar-nilai"
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor Daftar Nilai (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* View mode switcher */}
        <div className="flex gap-2 mt-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode('assessment_scores')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              viewMode === 'assessment_scores'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Input Nilai Asesmen ({assessmentList.length} Asesmen)
          </button>
          <button
            type="button"
            onClick={() => setViewMode('matrix_gradebook')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              viewMode === 'matrix_gradebook'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Matriks Rekapitulasi Rapor
          </button>
        </div>
      </div>

      {/* Mode 1: Assessment Input & Student Scoring */}
      {viewMode === 'assessment_scores' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Assessment selector & creation */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">Daftar Asesmen</h3>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(!isCreatingNew)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Asesmen
                </button>
              </div>

              {/* Create new form dropdown */}
              {isCreatingNew && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-3 space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Judul Asesmen</label>
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="Contoh: Asesmen Formatif 1 - Gerak Dasar"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Jenis Asesmen</label>
                    <select
                      value={newType}
                      onChange={(e) => setNewType(e.target.value as Assessment['type'])}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-700"
                    >
                      <option value="formatif">Formatif (Tatap Muka)</option>
                      <option value="sumatif_lingkup_materi">Sumatif Lingkup Materi</option>
                      <option value="sumatif_akhir_semester">Sumatif Akhir Semester (SAS)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">Tujuan Pembelajaran (TP)</label>
                    <select
                      value={newTpId}
                      onChange={(e) => setNewTpId(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white text-slate-700"
                    >
                      {(tp?.items || []).map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code || 'TP'}: {item.statement?.slice(0, 40)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Tanggal</label>
                      <input
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Batas Tuntas</label>
                      <input
                        type="number"
                        value={newPassingScore}
                        onChange={(e) => setNewPassingScore(Number(e.target.value))}
                        className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateAssessment}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg"
                  >
                    <Plus className="w-4 h-4" /> Simpan Asesmen
                  </button>
                </div>
              )}

              {/* List */}
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {assessmentList.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada asesmen yang dibuat.</p>
                ) : (
                  assessmentList.map((asm) => (
                    <div
                      key={asm.id}
                      onClick={() => setSelectedAssessmentId(asm.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        selectedAssessmentId === asm.id
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-semibold'
                          : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">{asm.title}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            asm.type === 'formatif'
                              ? 'bg-sky-100 text-sky-800'
                              : asm.type === 'sumatif_lingkup_materi'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {asm.type === 'formatif'
                            ? 'Formatif'
                            : asm.type === 'sumatif_lingkup_materi'
                            ? 'Sumatif LM'
                            : 'SAS'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex justify-between">
                        <span>Tgl: {asm.date}</span>
                        <span>KKTP: {asm.passingScore || 75}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Scoring table & Action to Remedial/Pengayaan */}
          <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            {selectedAssessment ? (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">{selectedAssessment.title}</h3>
                    <p className="text-xs text-slate-500">
                      Batas Ketuntasan (KKTP): <span className="font-bold text-indigo-700">{selectedAssessment.passingScore}</span> •
                      Maksimal: {selectedAssessment.maxScore}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteCurrent(selectedAssessment.id)}
                      className="text-xs text-rose-600 hover:text-rose-800 p-1.5"
                      title="Hapus Asesmen Ini"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCurrentScores}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>Simpan Nilai</span>
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 w-10 text-center">No</th>
                        <th className="py-2.5 px-3">Nama Siswa</th>
                        <th className="py-2.5 px-3 w-28 text-center">Nilai (0-100)</th>
                        <th className="py-2.5 px-3 w-28 text-center">Status</th>
                        <th className="py-2.5 px-3 w-36 text-center">Tindak Lanjut</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {students.map((std, idx) => {
                        const rec = resultsList.find(
                          (r) => r.assessmentId === selectedAssessment.id && r.studentId === std.id
                        );
                        const score = rec?.score ?? 80;
                        const passing = selectedAssessment.passingScore || 75;
                        const isFailed = score < passing;
                        const isExceeded = score >= 85;

                        return (
                          <tr key={std.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-slate-800">{std.name}</td>
                            <td className="py-2 px-3 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                value={score}
                                onChange={(e) => handleScoreChange(std.id, Number(e.target.value))}
                                className={`w-20 text-center text-xs font-bold px-2 py-1 border rounded focus:ring-2 focus:ring-indigo-500 focus:outline-none ${
                                  isFailed
                                    ? 'bg-rose-50 border-rose-300 text-rose-700'
                                    : isExceeded
                                    ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                                    : 'bg-white border-slate-300 text-slate-800'
                                }`}
                              />
                            </td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isFailed
                                    ? 'bg-rose-100 text-rose-800'
                                    : isExceeded
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {isFailed ? 'Belum Tuntas' : isExceeded ? 'Sangat Baik' : 'Tuntas'}
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {isFailed ? (
                                <button
                                  type="button"
                                  onClick={() => handleSendToRemedial(std, score)}
                                  className="inline-flex items-center gap-1 text-[11px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded border border-amber-300 font-semibold"
                                >
                                  <span>+ Remedial</span>
                                </button>
                              ) : isExceeded ? (
                                <button
                                  type="button"
                                  onClick={() => handleSendToEnrichment(std, score)}
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded border border-indigo-300 font-semibold"
                                >
                                  <span>+ Pengayaan</span>
                                </button>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400">
                Pilih atau buat asesmen di sebelah kiri untuk memasukkan nilai.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mode 2: Matrix Gradebook */}
      {viewMode === 'matrix_gradebook' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
            <div>
              <h3 className="font-bold text-slate-800 text-base">Buku Daftar Nilai Lengkap (Matriks Nilai Rapor)</h3>
              <p className="text-xs text-slate-500">Kompilasi nilai Formatif, Sumatif Lingkup Materi, dan Sumatif Akhir Semester</p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">No</th>
                  <th className="py-2.5 px-3 w-28">NISN</th>
                  <th className="py-2.5 px-3">Nama Siswa</th>
                  <th className="py-2.5 px-3 text-center">Rerata Formatif</th>
                  <th className="py-2.5 px-3 text-center">Sumatif LM</th>
                  <th className="py-2.5 px-3 text-center">Sumatif Akhir (SAS)</th>
                  <th className="py-2.5 px-3 text-center bg-indigo-50/70 text-indigo-900">Nilai Akhir (NA)</th>
                  <th className="py-2.5 px-3 text-center">Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((std, idx) => {
                  const studentRes = resultsList.filter((r) => r.studentId === std.id);
                  const formatifScores = studentRes
                    .filter((r) => {
                      const a = assessmentList.find((x) => x.id === r.assessmentId);
                      return a?.type === 'formatif';
                    })
                    .map((r) => r.score);

                  const sumatifLMScores = studentRes
                    .filter((r) => {
                      const a = assessmentList.find((x) => x.id === r.assessmentId);
                      return a?.type === 'sumatif_lingkup_materi';
                    })
                    .map((r) => r.score);

                  const sumatifSAS = studentRes
                    .filter((r) => {
                      const a = assessmentList.find((x) => x.id === r.assessmentId);
                      return a?.type === 'sumatif_akhir_semester';
                    })
                    .map((r) => r.score);

                  const avgFormatif =
                    formatifScores.length > 0
                      ? Math.round(formatifScores.reduce((a, b) => a + b, 0) / formatifScores.length)
                      : 80;
                  const avgSumatifLM =
                    sumatifLMScores.length > 0
                      ? Math.round(sumatifLMScores.reduce((a, b) => a + b, 0) / sumatifLMScores.length)
                      : 82;
                  const valSAS = sumatifSAS.length > 0 ? sumatifSAS[0] : 84;
                  const finalGrade = Math.round((avgFormatif + avgSumatifLM * 2 + valSAS * 2) / 5);

                  return (
                    <tr key={std.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono">{std.nisn || '-'}</td>
                      <td className="py-2 px-3 font-medium text-slate-800">{std.name}</td>
                      <td className="py-2 px-3 text-center text-slate-700">{avgFormatif}</td>
                      <td className="py-2 px-3 text-center text-slate-700">{avgSumatifLM}</td>
                      <td className="py-2 px-3 text-center text-slate-700">{valSAS}</td>
                      <td className="py-2 px-3 text-center font-bold text-indigo-700 bg-indigo-50/40">
                        {finalGrade}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            finalGrade >= 85
                              ? 'bg-emerald-100 text-emerald-800'
                              : finalGrade >= 75
                              ? 'bg-sky-100 text-sky-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {finalGrade >= 85 ? 'Sangat Baik' : finalGrade >= 75 ? 'Baik' : 'Perlu Bimbingan'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
