import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Calculator,
  Plus,
  Trash2,
  FileDown,
  Save,
  CheckCircle2,
  Info,
  ArrowRight,
  ArrowLeft,
  Target,
  Sparkles,
  Layers,
  ListChecks,
} from 'lucide-react';
import {
  K13Analysis,
  K13AnalysisItem,
  K13KKM,
  K13KKMItem,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
} from '../../types';
import { generateAnalisisK13, generatePenetapanKKM } from '../../services/documentEngine';

interface K13ManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  k13Analysis?: K13Analysis;
  k13KKM?: K13KKM;
  mode?: 'kd' | 'indikator' | 'tujuan' | 'kkm' | 'all';
  onSaveAnalysis: (analysis: K13Analysis) => void;
  onSaveKKM: (kkm: K13KKM) => void;
  onNextStep?: () => void;
  onBackToStep?: () => void;
}

export const K13Manager: React.FC<K13ManagerProps> = ({
  school,
  profile,
  academicSetting,
  k13Analysis,
  k13KKM,
  mode = 'all',
  onSaveAnalysis,
  onSaveKKM,
  onNextStep,
  onBackToStep,
}) => {
  const [activeTab, setActiveTab] = useState<'kd' | 'analisis' | 'tujuan' | 'kkm'>(
    mode === 'kkm'
      ? 'kkm'
      : mode === 'tujuan'
      ? 'tujuan'
      : mode === 'indikator'
      ? 'analisis'
      : 'kd'
  );

  useEffect(() => {
    if (mode === 'kkm') {
      setActiveTab('kkm');
    } else if (mode === 'tujuan') {
      setActiveTab('tujuan');
    } else if (mode === 'indikator') {
      setActiveTab('analisis');
    } else if (mode === 'kd') {
      setActiveTab('kd');
    }
  }, [mode]);

  // SKL / KI / KD Analysis
  const [analysisItems, setAnalysisItems] = useState<K13AnalysisItem[]>(
    k13Analysis?.items || [
      {
        id: 'k13-item-1',
        skl: 'Memiliki perilaku yang mencerminkan sikap orang beriman, berakhlak mulia, dan bertanggung jawab.',
        ki: 'KI-3 (Pengetahuan) & KI-4 (Keterampilan)',
        kd: '3.1 Memahami variasi pola gerak dasar lokomotor, non-lokomotor, dan manipulatif.',
        tujuanPembelajaran: 'Peserta didik mampu mengidentifikasi dan menjelaskan variasi pola gerak dasar lokomotor secara mandiri dan tepat.',
        indikator: '3.1.1 Menjelaskan konsep pola gerak dasar lari dan lompat.\n3.1.2 Membedakan gerak lokomotor dan non-lokomotor.',
        materi: 'Variasi pola gerak dasar lokomotor dan manipulatif.',
        kegiatan: 'Diskusi konsep gerak, peragaan contoh, dan latihan mandiri terbimbing.',
        alokasiJp: 4,
        penilaian: 'Tes Tertulis & Observasi Praktik',
      },
    ]
  );

  // KKM Items (Compatibility / Legacy)
  const [kkmItems, setKkmItems] = useState<K13KKMItem[]>(
    k13KKM?.items || [
      {
        id: 'kkm-1',
        kd: '3.1 Memahami variasi gerak dasar lokomotor',
        indikator: 'Menjelaskan pola koordinasi gerak langkah kaki dan ayunan lengan',
        kompleksitas: 75,
        dayaDukung: 78,
        intake: 74,
        kkmIndikator: 76,
      },
    ]
  );

  // Form input states
  const [newSkl, setNewSkl] = useState('Standar Kompetensi Lulusan (Sikap, Pengetahuan, Keterampilan)');
  const [newKi, setNewKi] = useState('KI-3 (Pengetahuan) & KI-4 (Keterampilan)');
  const [newKd, setNewKd] = useState('');
  const [newTujuan, setNewTujuan] = useState('');
  const [newIndikator, setNewIndikator] = useState('');
  const [newMateri, setNewMateri] = useState('');
  const [newKegiatan, setNewKegiatan] = useState('');
  const [newAlokasiJp, setNewAlokasiJp] = useState(4);
  const [newPenilaian, setNewPenilaian] = useState('Tes Tertulis & Kinerja');

  // New KKM Item state - NO fabricated 75 defaults (NO DATA > FAKE DATA)
  const [newKkmKd, setNewKkmKd] = useState('');
  const [newKkmIndikator, setNewKkmIndikator] = useState('');
  const [newKompleksitas, setNewKompleksitas] = useState<number | null>(null);
  const [newDayaDukung, setNewDayaDukung] = useState<number | null>(null);
  const [newIntake, setNewIntake] = useState<number | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  // Total KKM calculation
  const totalKKM =
    kkmItems.length > 0
      ? Math.round(kkmItems.reduce((acc, curr) => acc + curr.kkmIndikator, 0) / kkmItems.length)
      : undefined;

  const handleAddAnalysis = () => {
    if (!newKd.trim()) return;
    const newItem: K13AnalysisItem = {
      id: `item-${Date.now()}`,
      skl: newSkl,
      ki: newKi,
      kd: newKd,
      tujuanPembelajaran: newTujuan,
      indikator: newIndikator,
      materi: newMateri,
      kegiatan: newKegiatan,
      alokasiJp: Number(newAlokasiJp) || 4,
      penilaian: newPenilaian,
    };
    const updated = [...analysisItems, newItem];
    setAnalysisItems(updated);
    onSaveAnalysis({
      id: k13Analysis?.id || `k13-ana-${Date.now()}`,
      academicSettingId: academicSetting.id,
      items: updated,
      updatedAt: new Date().toISOString(),
    });
    setNewKd('');
    setNewTujuan('');
    setNewIndikator('');
    setNewMateri('');
    setNewKegiatan('');
    setNotification('Data Analisis Kompetensi Dasar berhasil ditambahkan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleUpdateItem = (id: string, updates: Partial<K13AnalysisItem>) => {
    const updated = analysisItems.map((item) => (item.id === id ? { ...item, ...updates } : item));
    setAnalysisItems(updated);
    onSaveAnalysis({
      id: k13Analysis?.id || `k13-ana-${Date.now()}`,
      academicSettingId: academicSetting.id,
      items: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteAnalysis = (id: string) => {
    const updated = analysisItems.filter((i) => i.id !== id);
    setAnalysisItems(updated);
    onSaveAnalysis({
      id: k13Analysis?.id || `k13-ana-${Date.now()}`,
      academicSettingId: academicSetting.id,
      items: updated,
      updatedAt: new Date().toISOString(),
    });
    setNotification('Butir KD berhasil dihapus');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleAddKKM = () => {
    if (!newKkmKd.trim()) return;
    if (
      newKompleksitas === null ||
      newDayaDukung === null ||
      newIntake === null ||
      isNaN(newKompleksitas) ||
      isNaN(newDayaDukung) ||
      isNaN(newIntake)
    ) {
      setNotification('Lengkapi kompleksitas, daya dukung, dan intake sebelum menambahkan KKM.');
      setTimeout(() => setNotification(null), 3000);
      return;
    }
    const kkmVal = Math.round((newKompleksitas + newDayaDukung + newIntake) / 3);
    const newItem: K13KKMItem = {
      id: `kkm-${Date.now()}`,
      kd: newKkmKd,
      indikator: newKkmIndikator || 'Indikator Ketuntasan KD',
      kompleksitas: newKompleksitas,
      dayaDukung: newDayaDukung,
      intake: newIntake,
      kkmIndikator: kkmVal,
    };
    const updated = [...kkmItems, newItem];
    setKkmItems(updated);
    const newTotal = Math.round(updated.reduce((a, b) => a + b.kkmIndikator, 0) / updated.length);
    onSaveKKM({
      id: k13KKM?.id || `k13-kkm-${Date.now()}`,
      academicSettingId: academicSetting.id,
      kkmTotal: newTotal,
      items: updated,
      updatedAt: new Date().toISOString(),
    });
    setNewKkmKd('');
    setNewKkmIndikator('');
    setNewKompleksitas(null);
    setNewDayaDukung(null);
    setNewIntake(null);
    setNotification('Butir KKM berhasil ditambahkan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteKKM = (id: string) => {
    const updated = kkmItems.filter((i) => i.id !== id);
    setKkmItems(updated);
    const newTotal =
      updated.length > 0
        ? Math.round(updated.reduce((a, b) => a + b.kkmIndikator, 0) / updated.length)
        : undefined;
    onSaveKKM({
      id: k13KKM?.id || `k13-kkm-${Date.now()}`,
      academicSettingId: academicSetting.id,
      kkmTotal: newTotal,
      items: updated,
      updatedAt: new Date().toISOString(),
    });
    setNotification('Butir KKM berhasil dihapus');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExportAnalysis = async () => {
    setIsExporting('analysis');
    try {
      await generateAnalisisK13({
        school,
        profile,
        academicSetting,
        k13Analysis: {
          id: k13Analysis?.id || 'k13-ana-1',
          academicSettingId: academicSetting.id,
          items: analysisItems,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      alert(`Gagal mengekspor Analisis K13: ${e.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportKKM = async () => {
    setIsExporting('kkm');
    try {
      await generatePenetapanKKM({
        school,
        profile,
        academicSetting,
        k13KKM: {
          id: k13KKM?.id || 'k13-kkm-1',
          academicSettingId: academicSetting.id,
          kkmTotal: totalKKM,
          items: kkmItems,
          updatedAt: new Date().toISOString(),
        },
      });
    } catch (e: any) {
      alert(`Gagal mengekspor KKM: ${e.message}`);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6" id="k13-manager-container">
      {notification && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-4 py-3 rounded-lg flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium">{notification}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2 text-indigo-700 font-semibold text-xs tracking-wider uppercase">
              <BookOpen className="w-4 h-4" />
              <span>
                {mode === 'kd' && 'Langkah 03 — Kurikulum 2013 (K13)'}
                {mode === 'indikator' && 'Langkah 04 — Analisis KD & Materi'}
                {mode === 'tujuan' && 'Langkah 05 — Tujuan Pembelajaran & IPK'}
                {mode === 'kkm' && 'Opsi Kompatibilitas — Penetapan KKM (Opsional)'}
                {mode === 'all' && 'Kurikulum 2013 (K13)'}
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {mode === 'kd' && 'SKL, Kompetensi Inti (KI) & Kompetensi Dasar (KD)'}
              {mode === 'indikator' && 'Analisis KD & Pemetaan Materi Pokok'}
              {mode === 'tujuan' && 'Perumusan Tujuan Pembelajaran & Indikator Pencapaian (IPK)'}
              {mode === 'kkm' && 'Penetapan KKM (Kompatibilitas Sekolah)'}
              {mode === 'all' && 'Pemetaan Kompetensi & Perencanaan K13'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {mode === 'kd' && `Telaah kompetensi dasar dan pemetaan KI (${academicSetting.subject} - ${academicSetting.grade})`}
              {mode === 'indikator' && `Analisis kedalaman materi dan kegiatan pembelajaran per KD (${academicSetting.subject} - ${academicSetting.grade})`}
              {mode === 'tujuan' && `Jabarkan KD ke dalam Tujuan Pembelajaran atau Indikator Pencapaian Kompetensi (${academicSetting.subject} - ${academicSetting.grade})`}
              {mode === 'kkm' && `Perhitungan KKM per KD dengan intake, kompleksitas, dan daya dukung sekolah (${academicSetting.subject} - ${academicSetting.grade})`}
              {mode === 'all' && `Kelola keterkaitan SKL, KD, indikator dan administrasi K13 (${academicSetting.subject} - ${academicSetting.grade})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="btn-export-analisis-k13"
              type="button"
              onClick={handleExportAnalysis}
              disabled={isExporting === 'analysis'}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>{isExporting === 'analysis' ? 'Mengekspor...' : 'Ekspor Analisis (.docx)'}</span>
            </button>
            <button
              id="btn-export-kkm-k13"
              type="button"
              onClick={handleExportKKM}
              disabled={isExporting === 'kkm'}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors"
            >
              <FileDown className="w-4 h-4 text-emerald-600" />
              <span>{isExporting === 'kkm' ? 'Mengekspor...' : 'Ekspor KKM (.docx)'}</span>
            </button>
          </div>
        </div>

        {/* Tab switcher for full mode */}
        {mode === 'all' && (
          <div className="flex gap-2 mt-5 border-b border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('kd')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'kd' || activeTab === 'analisis' || activeTab === 'tujuan'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Analisis SKL, KI & KD ({analysisItems.length} Entri)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('kkm')}
              className={`px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === 'kkm'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Penetapan KKM (KKM Mapel: {totalKKM != null ? totalKKM : '-'})
            </button>
          </div>
        )}
      </div>

      {/* Mode KD / Analisis / Tujuan */}
      {(activeTab === 'kd' || activeTab === 'analisis' || activeTab === 'tujuan') && (
        <div className="space-y-6">
          {/* Add form */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-600" />
                <span>Tambah / Petakan Kompetensi Dasar (KD)</span>
              </h3>
              <span className="text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200">
                {academicSetting.subject} • {academicSetting.grade}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Standar Kompetensi Lulusan (SKL)</label>
                <input
                  type="text"
                  value={newSkl}
                  onChange={(e) => setNewSkl(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Kompetensi Inti (KI)</label>
                <input
                  type="text"
                  value={newKi}
                  onChange={(e) => setNewKi(e.target.value)}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-12">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Kompetensi Dasar (KD) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={newKd}
                  onChange={(e) => setNewKd(e.target.value)}
                  placeholder="Cth: 3.1 Memahami variasi gerak dasar lokomotor"
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Penjabaran Tujuan Pembelajaran
                </label>
                <textarea
                  value={newTujuan}
                  onChange={(e) => setNewTujuan(e.target.value)}
                  placeholder="Cth: Peserta didik mampu menjelaskan konsep gerak dasar dengan benar"
                  rows={2}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Indikator Pencapaian Kompetensi (IPK)
                </label>
                <textarea
                  value={newIndikator}
                  onChange={(e) => setNewIndikator(e.target.value)}
                  placeholder="Cth: 3.1.1 Menyebutkan macam pola gerak dasar"
                  rows={2}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Materi Pokok</label>
                <input
                  type="text"
                  value={newMateri}
                  onChange={(e) => setNewMateri(e.target.value)}
                  placeholder="Cth: Gerak Dasar Lokomotor"
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Kegiatan Pembelajaran</label>
                <input
                  type="text"
                  value={newKegiatan}
                  onChange={(e) => setNewKegiatan(e.target.value)}
                  placeholder="Cth: Praktik dan diskusi kelompok"
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Alokasi JP</label>
                <input
                  type="number"
                  value={newAlokasiJp}
                  onChange={(e) => setNewAlokasiJp(Number(e.target.value) || 4)}
                  min={1}
                  max={20}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleAddAnalysis}
                disabled={!newKd.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-700 hover:bg-indigo-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Simpan Butir Kompetensi</span>
              </button>
            </div>
          </div>

          {/* Table List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">
                Daftar Kompetensi Dasar Terpetakan ({analysisItems.length} KD)
              </h3>
              <span className="text-xs text-slate-500">
                Total JP: {analysisItems.reduce((acc, curr) => acc + (Number(curr.alokasiJp) || 4), 0)} JP
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3 w-40">Kompetensi Dasar (KD)</th>
                    <th className="py-2.5 px-3">Tujuan & Indikator Pencapaian</th>
                    <th className="py-2.5 px-3 w-44">Materi & Kegiatan</th>
                    <th className="py-2.5 px-3 w-20 text-center">JP</th>
                    <th className="py-2.5 px-3 w-14 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analysisItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{item.kd}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.ki}</div>
                      </td>
                      <td className="py-2.5 px-3">
                        {item.tujuanPembelajaran && (
                          <div className="text-slate-800 font-medium mb-1">
                            <span className="text-indigo-700 font-bold">TP:</span> {item.tujuanPembelajaran}
                          </div>
                        )}
                        {item.indikator && (
                          <div className="text-slate-600 text-[11px] whitespace-pre-line">
                            <span className="text-slate-500 font-semibold">IPK:</span> {item.indikator}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">{item.materi || '-'}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.kegiatan || '-'}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {item.alokasiJp || 4} JP
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteAnalysis(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Mode KKM (Opsi Kompatibilitas) */}
      {activeTab === 'kkm' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl flex items-start gap-3">
            <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900">
              <p className="font-bold">Opsi Kompatibilitas KKM Satuan Pendidikan</p>
              <p className="mt-0.5">
                KKM dapat digunakan apabila satuan pendidikan masih menerapkannya. Penetapan KKM bersifat opsional dan tidak menjadi syarat mutlak untuk melangkah ke Administrasi Guru K13.
              </p>
            </div>
          </div>

          {/* KKM form */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Hitung KKM per Indikator / KD
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Kompetensi Dasar (KD)</label>
                <input
                  type="text"
                  value={newKkmKd}
                  onChange={(e) => setNewKkmKd(e.target.value)}
                  placeholder="Cth: 3.1 Memahami variasi pola gerak dasar"
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-6">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Indikator Pencapaian</label>
                <input
                  type="text"
                  value={newKkmIndikator}
                  onChange={(e) => setNewKkmIndikator(e.target.value)}
                  placeholder="Cth: Menjelaskan pola gerak dasar lari dan lompat"
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Kompleksitas (1-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Belum diisi"
                  value={newKompleksitas !== null ? newKompleksitas : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setNewKompleksitas(null);
                    else {
                      const n = Number(val);
                      setNewKompleksitas(isNaN(n) ? null : n);
                    }
                  }}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Daya Dukung (1-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Belum diisi"
                  value={newDayaDukung !== null ? newDayaDukung : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setNewDayaDukung(null);
                    else {
                      const n = Number(val);
                      setNewDayaDukung(isNaN(n) ? null : n);
                    }
                  }}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Intake Siswa (1-100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Belum diisi"
                  value={newIntake !== null ? newIntake : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') setNewIntake(null);
                    else {
                      const n = Number(val);
                      setNewIntake(isNaN(n) ? null : n);
                    }
                  }}
                  className="w-full text-xs px-2.5 py-2 border border-slate-300 rounded-lg bg-white"
                />
              </div>

              <div className="sm:col-span-3 flex items-end">
                <button
                  type="button"
                  onClick={handleAddKKM}
                  disabled={!newKkmKd.trim() || newKompleksitas === null || newDayaDukung === null || newIntake === null}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs cursor-pointer"
                >
                  <Calculator className="w-4 h-4" /> Hitung & Tambah
                </button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm">Rincian Perhitungan KKM per Indikator</h3>
              <div className="bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-800">
                KKM Total Mapel: {totalKKM != null ? totalKKM : '-'}
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Kompetensi Dasar & Indikator</th>
                    <th className="py-2.5 px-3 w-28 text-center">Kompleksitas</th>
                    <th className="py-2.5 px-3 w-28 text-center">Daya Dukung</th>
                    <th className="py-2.5 px-3 w-28 text-center">Intake Siswa</th>
                    <th className="py-2.5 px-3 w-28 text-center font-bold text-indigo-900 bg-indigo-50/50">KKM KD</th>
                    <th className="py-2.5 px-3 w-14 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {kkmItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-center text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-800">{item.kd}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{item.indikator}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-700">{item.kompleksitas}</td>
                      <td className="py-2.5 px-3 text-center text-slate-700">{item.dayaDukung}</td>
                      <td className="py-2.5 px-3 text-center text-slate-700">{item.intake}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-indigo-700 bg-indigo-50/30">
                        {item.kkmIndikator}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteKKM(item.id)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Footer for Step Workflow */}
      {mode !== 'all' && (
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {onBackToStep ? (
            <button
              type="button"
              onClick={onBackToStep}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>
                {mode === 'kd' && 'Kembali ke Data Pembelajaran (02)'}
                {mode === 'indikator' && 'Kembali ke SKL/KI/KD (03)'}
                {mode === 'tujuan' && 'Kembali ke Analisis KD (04)'}
                {mode === 'kkm' && 'Kembali ke Tujuan & IPK (05)'}
              </span>
            </button>
          ) : <div />}

          {onNextStep && (
            <button
              type="button"
              onClick={onNextStep}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-900 text-white hover:bg-indigo-800 flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <span>
                {mode === 'kd' && 'Lanjut ke Analisis KD (04)'}
                {mode === 'indikator' && 'Lanjut ke Tujuan & IPK (05)'}
                {mode === 'tujuan' && 'Lanjut ke Administrasi K13 (06)'}
                {mode === 'kkm' && 'Lanjut ke Administrasi K13 (06)'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
