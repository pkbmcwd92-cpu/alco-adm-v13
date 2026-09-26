import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  FileDown,
  Save,
  CheckCircle2,
  ListOrdered,
  Plus,
  Trash2,
  Layers,
  Calculator,
  Info,
} from 'lucide-react';
import {
  AssessmentCriterion,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  TPData,
  K13Analysis,
  K13KKM,
} from '../../types';
import { generateKKTP, generatePenetapanKKM } from '../../services/documentEngine';
import { isK13 } from '../../services/curriculumRouter';

interface KKTPManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  tp?: TPData;
  k13Analysis?: K13Analysis;
  k13KKM?: K13KKM;
  assessmentCriteria: AssessmentCriterion[];
  onSaveCriteria: (criteria: AssessmentCriterion[]) => void;
  onSaveK13KKM?: (kkm: K13KKM) => void;
}

export const KKTPManager: React.FC<KKTPManagerProps> = ({
  school,
  profile,
  academicSetting,
  tp,
  k13Analysis,
  k13KKM,
  assessmentCriteria,
  onSaveCriteria,
  onSaveK13KKM,
}) => {
  const isK13Curriculum = isK13(academicSetting);
  const [criteriaList, setCriteriaList] = useState<AssessmentCriterion[]>(assessmentCriteria || []);

  // Items source: TP for Merdeka, KD for K13
  const targetItems = isK13Curriculum
    ? (k13Analysis?.items || []).map((k, idx) => ({
        id: k.id,
        code: `KD.${idx + 1}`,
        statement: k.kd,
        contentScope: k.materi,
        competency: k.indikator || k.tujuanPembelajaran,
      }))
    : (tp?.items || []).map((t, idx) => ({
        id: t.id,
        code: t.code || `TP.${idx + 1}`,
        statement: t.statement,
        contentScope: t.contentScope,
        competency: t.competency,
      }));

  const [selectedItemId, setSelectedItemId] = useState<string>(targetItems[0]?.id || '');
  const [approach, setApproach] = useState<'rubrik' | 'deskripsi' | 'skala_interval' | 'legacy_kkm'>('rubrik');
  const [notification, setNotification] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Active target item
  const activeItem = targetItems.find((t) => t.id === selectedItemId) || targetItems[0];
  const activeCriterion = criteriaList.find((c) => c.tpId === activeItem?.id);

  // Indicators / Levels state
  const [indicators, setIndicators] = useState<string[]>(
    activeCriterion?.indicators || [
      'Menunjukkan pemahaman konsep inti secara tepat',
      'Menerapkan langkah kerja atau prosedur dengan mandiri',
      'Mengkomunikasikan hasil belajar secara terstruktur',
    ]
  );

  const [levels, setLevels] = useState(
    activeCriterion?.levels || [
      {
        level: 'Perlu Bimbingan',
        label: 'Perlu Bimbingan',
        description: 'Belum mampu memenuhi kriteria inti pembelajaran, memerlukan bimbingan intensif perorangan.',
        scoreRange: '0 - 65',
      },
      {
        level: 'Cukup',
        label: 'Cukup',
        description: 'Mampu memenuhi sebagian kriteria inti dengan bantuan berkala dari pendidik.',
        scoreRange: '66 - 74',
      },
      {
        level: 'Baik',
        label: 'Baik (Tuntas)',
        description: 'Mampu memenuhi seluruh kriteria ketercapaian secara tepat dan mandiri.',
        scoreRange: '75 - 84',
      },
      {
        level: 'Sangat Baik',
        label: 'Sangat Baik',
        description: 'Menguasai kompetensi melampaui kriteria, mampu bernalar kritis dan membantu rekan sebaya.',
        scoreRange: '85 - 100',
      },
    ]
  );

  // Legacy KKM sub-state
  const [kompleksitas, setKompleksitas] = useState(75);
  const [dayaDukung, setDayaDukung] = useState(78);
  const [intake, setIntake] = useState(74);

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const found = criteriaList.find((c) => c.tpId === id);
    if (found) {
      setApproach(found.approach);
      if (found.indicators) setIndicators(found.indicators);
      if (found.levels) setLevels(found.levels);
    } else {
      const target = targetItems.find((t) => t.id === id);
      setIndicators([
        `Mampu memahami konsep dasar terkait ${target?.contentScope || 'materi pokok'}`,
        `Mampu mempraktikkan kompetensi ${target?.competency || 'tujuan'} secara mandiri`,
        `Mampu memecahkan masalah kontekstual dengan tepat`,
      ]);
    }
  };

  const handleGenerateAI = () => {
    if (!activeItem) return;
    const scope = activeItem.contentScope || activeItem.statement;
    const comp = activeItem.competency || 'kompetensi inti';

    setIndicators([
      `Mengidentifikasi dan menjelaskan materi: ${scope}`,
      `Mempraktikkan atau menganalisis ${comp} dalam situasi kontekstual`,
      `Menyelesaikan evaluasi terkait ${scope} secara mandiri dan akurat`,
    ]);

    setLevels([
      {
        level: 'Perlu Bimbingan',
        label: 'Perlu Bimbingan',
        description: `Belum mampu menguasai konsep dasar ${scope}, masih membutuhkan pendampingan penuh.`,
        scoreRange: '0 - 65',
      },
      {
        level: 'Cukup',
        label: 'Cukup',
        description: `Mampu memahami sebagian materi ${scope}, namun masih perlu pendampingan berkala.`,
        scoreRange: '66 - 74',
      },
      {
        level: 'Baik',
        label: 'Baik (Tuntas)',
        description: `Mampu menguasai materi ${scope} secara tepat dan mandiri.`,
        scoreRange: '75 - 84',
      },
      {
        level: 'Sangat Baik',
        label: 'Sangat Baik',
        description: `Menguasai materi ${scope} melampaui kriteria, mampu bernalar kritis dan kreatif.`,
        scoreRange: '85 - 100',
      },
    ]);

    setNotification('Rekomendasi Kriteria Ketercapaian berhasil digenerate AI!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSaveCurrent = () => {
    if (!activeItem) return;
    const calculatedKkm = Math.round((kompleksitas + dayaDukung + intake) / 3);
    const newCriterion: AssessmentCriterion = {
      id: activeCriterion?.id || `criterion-${Date.now()}-${activeItem.id}`,
      academicSettingId: academicSetting.id,
      tpId: activeItem.id,
      description: `Kriteria Ketercapaian: ${activeItem.statement}`,
      approach,
      passingThreshold: approach === 'legacy_kkm' ? calculatedKkm : null,
      indicators,
      levels,
      basedOnTpUpdatedAt: tp?.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updated = criteriaList.filter((c) => c.tpId !== activeItem.id).concat(newCriterion);
    setCriteriaList(updated);
    onSaveCriteria(updated);

    // If K13 and Legacy KKM approach is selected, also sync to K13KKM state
    if (isK13Curriculum && approach === 'legacy_kkm' && onSaveK13KKM) {
      const existingKkmItems = k13KKM?.items || [];
      const updatedKkmItems = existingKkmItems
        .filter((k) => k.id !== activeItem.id)
        .concat({
          id: activeItem.id,
          kd: activeItem.statement,
          indikator: indicators[0] || 'Indikator Ketercapaian KD',
          kompleksitas,
          dayaDukung,
          intake,
          kkmIndikator: calculatedKkm,
        });
      const newTotal = Math.round(
        updatedKkmItems.reduce((acc, curr) => acc + curr.kkmIndikator, 0) / updatedKkmItems.length
      );
      onSaveK13KKM({
        id: k13KKM?.id || `k13-kkm-${Date.now()}`,
        academicSettingId: academicSetting.id,
        kkmTotal: newTotal,
        items: updatedKkmItems,
        updatedAt: new Date().toISOString(),
      });
    }

    setNotification('Kriteria Ketercapaian berhasil disimpan!');
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (isK13Curriculum) {
        await generatePenetapanKKM({
          school,
          profile,
          academicSetting,
          k13KKM: k13KKM || {
            id: 'k13-kkm-1',
            academicSettingId: academicSetting.id,
            kkmTotal: 75,
            items: [],
            updatedAt: new Date().toISOString(),
          },
        });
      } else {
        await generateKKTP({
          school,
          profile,
          academicSetting,
          tp,
          assessmentCriteria: criteriaList,
        });
      }
    } catch (e: any) {
      alert(`Gagal mengekspor dokumen: ${e.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6" id="kktp-manager-container">
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
              <Award className="w-4 h-4" />
              <span>Modul Kriteria Ketercapaian Pembelajaran</span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              {isK13Curriculum ? 'Kriteria Ketercapaian KD' : 'KKTP (Kriteria Ketercapaian Tujuan Pembelajaran)'}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Penetapan standar tuntas belajar berbasis bukti capaian ({academicSetting.subject} - {academicSetting.grade})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-kktp"
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-indigo-600" />
              <span>
                {isExporting
                  ? 'Mengekspor...'
                  : isK13Curriculum
                  ? 'Ekspor Kriteria / KKM (.docx)'
                  : 'Ekspor KKTP (.docx)'}
              </span>
            </button>
          </div>
        </div>

        {/* Selection Pill Bar */}
        <div className="mt-5">
          <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">
            {isK13Curriculum ? 'Pilih Kompetensi Dasar (KD):' : 'Pilih Tujuan Pembelajaran (TP):'}
          </label>
          <div className="flex flex-wrap gap-2">
            {targetItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectItem(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  (activeItem?.id || targetItems[0]?.id) === item.id
                    ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {item.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Item Detail & Criteria Setup */}
      {activeItem ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          {/* Active Banner */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-xs font-bold text-indigo-700">{activeItem.code}</span>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{activeItem.statement}</p>
              {activeItem.contentScope && (
                <p className="text-xs text-slate-600 mt-1">
                  Lingkup Materi: <span className="font-medium text-slate-800">{activeItem.contentScope}</span>
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={handleGenerateAI}
              className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Rekomendasi AI</span>
            </button>
          </div>

          {/* Approach Switcher */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-700">Pendekatan Kriteria:</span>
            {(
              [
                { id: 'rubrik', label: '1. Rubrik Performa' },
                { id: 'deskripsi', label: '2. Deskripsi Kriteria' },
                { id: 'skala_interval', label: '3. Skala Interval' },
                ...(isK13Curriculum
                  ? [{ id: 'legacy_kkm', label: '4. Legacy KKM (Kompleksitas/Daya Dukung/Intake)' }]
                  : []),
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setApproach(opt.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                  approach === opt.id
                    ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Render by approach */}
          {approach === 'rubrik' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                Deskripsi Rubrik Per Kategori Ketercapaian
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {levels.map((lvl, idx) => (
                  <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-800">{lvl.label}</span>
                      <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                        Rentang: {lvl.scoreRange}
                      </span>
                    </div>
                    <textarea
                      value={lvl.description}
                      onChange={(e) => {
                        const updated = [...levels];
                        updated[idx] = { ...updated[idx], description: e.target.value };
                        setLevels(updated);
                      }}
                      rows={3}
                      className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {approach === 'deskripsi' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                  Daftar Indikator Ketercapaian (Siswa dinyatakan TUNTAS jika seluruh kriteria terpenuhi)
                </h4>
                <button
                  type="button"
                  onClick={() => setIndicators([...indicators, 'Indikator kriteria baru'])}
                  className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Tambah Indikator
                </button>
              </div>

              <div className="space-y-2">
                {indicators.map((ind, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 w-6 text-center">{idx + 1}.</span>
                    <input
                      type="text"
                      value={ind}
                      onChange={(e) => {
                        const updated = [...indicators];
                        updated[idx] = e.target.value;
                        setIndicators(updated);
                      }}
                      className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setIndicators(indicators.filter((_, i) => i !== idx))}
                      className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {approach === 'skala_interval' && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 w-32">Interval Nilai</th>
                    <th className="py-2.5 px-3">Kategori Ketercapaian</th>
                    <th className="py-2.5 px-3">Tindak Lanjut Pembelajaran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="bg-rose-50/40">
                    <td className="py-2 px-3 font-bold text-rose-700">0 - 40%</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">Belum Mencapai Ketuntasan</td>
                    <td className="py-2 px-3 text-slate-600">Remedial di seluruh bagian materi</td>
                  </tr>
                  <tr className="bg-amber-50/40">
                    <td className="py-2 px-3 font-bold text-amber-700">41 - 74%</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">Belum Mencapai Ketuntasan</td>
                    <td className="py-2 px-3 text-slate-600">Remedial di indikator yang belum tuntas saja</td>
                  </tr>
                  <tr className="bg-emerald-50/40">
                    <td className="py-2 px-3 font-bold text-emerald-700">75 - 84%</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">Sudah Mencapai Ketuntasan (Tuntas)</td>
                    <td className="py-2 px-3 text-slate-600">Tidak perlu remedial, melanjutkan materi</td>
                  </tr>
                  <tr className="bg-indigo-50/40">
                    <td className="py-2 px-3 font-bold text-indigo-700">85 - 100%</td>
                    <td className="py-2 px-3 font-semibold text-slate-800">Sudah Mencapai Ketuntasan (Sangat Baik)</td>
                    <td className="py-2 px-3 text-slate-600">Perlu pengayaan kontekstual lebih lanjut</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {approach === 'legacy_kkm' && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                Perhitungan KKM Berdasarkan Unsur Penilaian Sekolah
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Kompleksitas (1-100)</label>
                  <input
                    type="number"
                    value={kompleksitas}
                    onChange={(e) => setKompleksitas(Number(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Daya Dukung (1-100)</label>
                  <input
                    type="number"
                    value={dayaDukung}
                    onChange={(e) => setDayaDukung(Number(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Intake Siswa (1-100)</label>
                  <input
                    type="number"
                    value={intake}
                    onChange={(e) => setIntake(Number(e.target.value) || 0)}
                    min={0}
                    max={100}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg flex flex-col justify-center items-center">
                  <span className="text-[10px] uppercase font-bold text-indigo-700">Hasil KKM</span>
                  <span className="text-base font-bold text-indigo-950">
                    {Math.round((kompleksitas + dayaDukung + intake) / 3)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Save Button */}
          <div className="pt-2">
            <button
              id="btn-save-kktp"
              type="button"
              onClick={handleSaveCurrent}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Kriteria Ketercapaian</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
          Belum ada data Tujuan Pembelajaran atau Kompetensi Dasar yang terdaftar.
        </div>
      )}
    </div>
  );
};
