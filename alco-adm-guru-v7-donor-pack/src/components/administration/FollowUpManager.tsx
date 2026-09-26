import React, { useState, useEffect } from 'react';
import {
  LifeBuoy,
  Sparkles,
  Plus,
  Trash2,
  FileDown,
  Save,
  CheckCircle2,
  CheckCheck,
} from 'lucide-react';
import {
  Student,
  RemedialRecord,
  EnrichmentRecord,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  TPData,
} from '../../types';
import { generateRemedialPengayaan } from '../../services/documentEngine';

interface FollowUpManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  tp?: TPData;
  students: Student[];
  remedials: RemedialRecord[];
  enrichments: EnrichmentRecord[];
  onSaveRemedials: (records: RemedialRecord[]) => void;
  onSaveEnrichments: (records: EnrichmentRecord[]) => void;
}

export const FollowUpManager: React.FC<FollowUpManagerProps> = ({
  school,
  profile,
  academicSetting,
  tp,
  students = [],
  remedials = [],
  enrichments = [],
  onSaveRemedials,
  onSaveEnrichments,
}) => {
  const [remedialList, setRemedialList] = useState<RemedialRecord[]>(remedials || []);
  const [enrichmentList, setEnrichmentList] = useState<EnrichmentRecord[]>(enrichments || []);

  useEffect(() => {
    setRemedialList(remedials || []);
    setEnrichmentList(enrichments || []);
    if (students && students.length > 0) {
      if (!students.some((s) => s.id === remStudentId)) {
        setRemStudentId(students[0].id);
      }
      if (!students.some((s) => s.id === enrStudentId)) {
        setEnrStudentId(students[0].id);
      }
    }
  }, [remedials, enrichments, students]);
  const [activeTab, setActiveTab] = useState<'remedial' | 'enrichment'>('remedial');

  // New Remedial Form
  const [remStudentId, setRemStudentId] = useState<string>(students?.[0]?.id || '');
  const [remTpId, setRemTpId] = useState<string>(tp?.items?.[0]?.id || '');
  const [remReason, setRemReason] = useState('');
  const [remIntervention, setRemIntervention] = useState('Bimbingan perorangan dan penugasan terstruktur');
  const [remDate, setRemDate] = useState(new Date().toISOString().split('T')[0]);
  const [remScore, setRemScore] = useState<number>(78);

  // New Enrichment Form
  const [enrStudentId, setEnrStudentId] = useState<string>(students[0]?.id || '');
  const [enrTpId, setEnrTpId] = useState<string>(tp?.items?.[0]?.id || '');
  const [enrActivity, setEnrActivity] = useState('Eksplorasi materi bernalar kritis (HOTS) & tutor sebaya');
  const [enrDate, setEnrDate] = useState(new Date().toISOString().split('T')[0]);

  const [notification, setNotification] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleAddRemedial = () => {
    if (!remStudentId) return;
    const newRecord: RemedialRecord = {
      id: `rem-${Date.now()}`,
      academicSettingId: academicSetting.id,
      studentId: remStudentId,
      tpId: remTpId,
      sourceAssessmentId: 'manual',
      reason: remReason.trim() || 'Perlu penguatan konsep dasar pada materi pembelajaran',
      intervention: remIntervention,
      date: remDate,
      reassessmentScore: remScore,
      status: 'planned',
      updatedAt: new Date().toISOString(),
    };
    const updated = [...remedialList, newRecord];
    setRemedialList(updated);
    onSaveRemedials(updated);
    setRemReason('');
    setNotification('Program remedial siswa berhasil ditambahkan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteRemedial = (id: string) => {
    const updated = remedialList.filter((r) => r.id !== id);
    setRemedialList(updated);
    onSaveRemedials(updated);
  };

  const handleToggleRemedialStatus = (id: string) => {
    const updated = remedialList.map((r) => {
      if (r.id === id) {
        const nextStatus: RemedialRecord['status'] =
          r.status === 'planned' ? 'ongoing' : r.status === 'ongoing' ? 'completed' : 'planned';
        return { ...r, status: nextStatus, updatedAt: new Date().toISOString() };
      }
      return r;
    });
    setRemedialList(updated);
    onSaveRemedials(updated);
  };

  const handleAddEnrichment = () => {
    if (!enrStudentId) return;
    const newRecord: EnrichmentRecord = {
      id: `enr-${Date.now()}`,
      academicSettingId: academicSetting.id,
      studentId: enrStudentId,
      tpId: enrTpId,
      sourceAssessmentId: 'manual',
      activity: enrActivity,
      date: enrDate,
      result: 'Sangat Baik',
      status: 'planned',
      updatedAt: new Date().toISOString(),
    };
    const updated = [...enrichmentList, newRecord];
    setEnrichmentList(updated);
    onSaveEnrichments(updated);
    setNotification('Program pengayaan siswa berhasil ditambahkan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteEnrichment = (id: string) => {
    const updated = enrichmentList.filter((e) => e.id !== id);
    setEnrichmentList(updated);
    onSaveEnrichments(updated);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateRemedialPengayaan({
        school,
        profile,
        academicSetting,
        students,
        remedials: remedialList,
        enrichments: enrichmentList,
      });
    } catch (e: any) {
      alert(`Gagal mengekspor laporan tindak lanjut: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="follow-up-manager-container">
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
              <LifeBuoy className="w-4 h-4" />
              <span>Modul Tindak Lanjut Pembelajaran</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Program Remedial & Pengayaan</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Fasilitasi pendampingan bagi siswa belum tuntas dan tantangan bagi siswa berpencapaian tinggi ({academicSetting.subject} - {academicSetting.grade})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-remedial-pengayaan"
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>{isExporting ? 'Mengekspor...' : 'Ekspor Laporan Tindak Lanjut (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mt-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('remedial')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'remedial'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Program Remedial ({remedialList.length} Siswa)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enrichment')}
            className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
              activeTab === 'enrichment'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Program Pengayaan ({enrichmentList.length} Siswa)
          </button>
        </div>
      </div>

      {/* Tab 1: Remedial */}
      {activeTab === 'remedial' && (
        <div className="space-y-6">
          {/* Add form */}
          <div className="bg-amber-50/50 rounded-xl border border-amber-200 p-5">
            <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <LifeBuoy className="w-4 h-4 text-amber-600" />
              <span>Tambah Rencana Kegiatan Remedial</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Nama Siswa</label>
                <select
                  value={remStudentId}
                  onChange={(e) => setRemStudentId(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Tujuan Pembelajaran (TP)</label>
                <select
                  value={remTpId}
                  onChange={(e) => setRemTpId(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {(tp?.items || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code || 'TP'}: {t.statement?.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Indikator Belum Tercapai</label>
                <input
                  type="text"
                  value={remReason}
                  onChange={(e) => setRemReason(e.target.value)}
                  placeholder="Cth: Kesulitan memahami konsep hitung pecahan"
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Nilai Remedial</label>
                <input
                  type="number"
                  value={remScore}
                  onChange={(e) => setRemScore(Number(e.target.value))}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-7">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Bentuk Bimbingan</label>
                <input
                  type="text"
                  value={remIntervention}
                  onChange={(e) => setRemIntervention(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Tanggal Pelaksanaan</label>
                <input
                  type="date"
                  value={remDate}
                  onChange={(e) => setRemDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddRemedial}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
            </div>
          </div>

          {/* List of Remedials */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-base mb-4">Daftar Pelaksanaan Remedial</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3">Indikator Belum Tercapai</th>
                    <th className="py-2.5 px-3">Bentuk Intervensi</th>
                    <th className="py-2.5 px-3 text-center">Tanggal</th>
                    <th className="py-2.5 px-3 text-center">Nilai Akhir</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {remedialList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-6 text-center text-slate-400">
                        Belum ada siswa yang didaftarkan ke program remedial.
                      </td>
                    </tr>
                  ) : (
                    remedialList.map((r, idx) => {
                      const std = students.find((s) => s.id === r.studentId);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{std?.name || 'Siswa'}</td>
                          <td className="py-2 px-3 text-slate-600">{r.reason}</td>
                          <td className="py-2 px-3 text-slate-600">{r.intervention}</td>
                          <td className="py-2 px-3 text-center text-slate-500">{r.date}</td>
                          <td className="py-2 px-3 text-center font-bold text-amber-700">{r.reassessmentScore || 78}</td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleRemedialStatus(r.id)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                                r.status === 'completed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : r.status === 'in_progress'
                                  ? 'bg-sky-100 text-sky-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {r.status === 'completed'
                                ? 'Selesai'
                                : r.status === 'in_progress'
                                ? 'Sedang Berjalan'
                                : 'Direncanakan'}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteRemedial(r.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Enrichment */}
      {activeTab === 'enrichment' && (
        <div className="space-y-6">
          {/* Add form */}
          <div className="bg-indigo-50/50 rounded-xl border border-indigo-200 p-5">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Tambah Program Pengayaan</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Nama Siswa</label>
                <select
                  value={enrStudentId}
                  onChange={(e) => setEnrStudentId(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Tujuan Pembelajaran (TP)</label>
                <select
                  value={enrTpId}
                  onChange={(e) => setEnrTpId(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {(tp?.items || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code || 'TP'}: {t.statement?.slice(0, 30)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Bentuk Kegiatan Pengayaan</label>
                <input
                  type="text"
                  value={enrActivity}
                  onChange={(e) => setEnrActivity(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-2 flex items-end">
                <button
                  type="button"
                  onClick={handleAddEnrichment}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm"
                >
                  <Plus className="w-4 h-4" /> Tambah
                </button>
              </div>
            </div>
          </div>

          {/* List of Enrichments */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-800 text-base mb-4">Daftar Pelaksanaan Pengayaan</h3>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Nama Siswa</th>
                    <th className="py-2.5 px-3">Bentuk Kegiatan Pengayaan</th>
                    <th className="py-2.5 px-3 text-center">Tanggal</th>
                    <th className="py-2.5 px-3 text-center">Hasil Capaian</th>
                    <th className="py-2.5 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrichmentList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        Belum ada siswa yang didaftarkan ke program pengayaan.
                      </td>
                    </tr>
                  ) : (
                    enrichmentList.map((e, idx) => {
                      const std = students.find((s) => s.id === e.studentId);
                      return (
                        <tr key={e.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold text-slate-800">{std?.name || 'Siswa'}</td>
                          <td className="py-2 px-3 text-slate-600">{e.activity}</td>
                          <td className="py-2 px-3 text-center text-slate-500">{e.date}</td>
                          <td className="py-2 px-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              {e.result || 'Sangat Baik'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteEnrichment(e.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Hapus"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
