import React, { useState } from 'react';
import {
  Award,
  Sparkles,
  FileDown,
  Save,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Plus,
  Trash2,
  Layers,
  Calculator,
  Info,
  ShieldCheck,
} from 'lucide-react';
import {
  AssessmentCriterion,
  AcademicSetting,
  TeacherProfile,
  SchoolData,
  TPData,
  K13Analysis,
  K13KKM,
  KKTPLevel,
} from '../../types';
import { generateKKTP, generatePenetapanKKM } from '../../services/documentEngine';
import { isK13 } from '../../services/curriculumRouter';
import { validateKKTPCriterion, calculateLegacyKKM, isValidKkmAspect } from '../../services/cpWorkflowService';

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

  // Items source: TP for Merdeka (preserving canonical code), KD for K13
  const targetItems = isK13Curriculum
    ? (k13Analysis?.items || []).map((k) => ({
        id: k.id,
        code: '',
        statement: k.kd,
        contentScope: k.materi,
        competency: k.indikator || k.tujuanPembelajaran,
      }))
    : (tp?.items || []).map((t) => ({
        id: t.id,
        code: t.code || '',
        statement: t.statement,
        contentScope: t.contentScope,
        competency: t.competency,
      }));

  const [selectedItemId, setSelectedItemId] = useState<string>(targetItems[0]?.id || '');
  const [approach, setApproach] = useState<'rubrik' | 'deskripsi' | 'skala_interval' | 'legacy_kkm'>('rubrik');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'warning' | 'info' } | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Active target item
  const activeItem = targetItems.find((t) => t.id === selectedItemId) || targetItems[0];
  const activeCriterion = criteriaList.find((c) => c.tpId === activeItem?.id);

  // Indicators / Levels state - No fabricated initial content
  const [indicators, setIndicators] = useState<string[]>(activeCriterion?.indicators || []);
  const [levels, setLevels] = useState<KKTPLevel[]>(activeCriterion?.levels || []);

  // Legacy KKM sub-state - strictly no fabricated 75 default (NO DATA > FAKE DATA)
  const initialKkmItem = k13KKM?.items?.find((k) => k.id === (activeItem?.id || targetItems[0]?.id));
  const [kompleksitas, setKompleksitas] = useState<number | null>(
    activeCriterion?.kompleksitas ?? (typeof initialKkmItem?.kompleksitas === 'number' ? initialKkmItem.kompleksitas : null)
  );
  const [dayaDukung, setDayaDukung] = useState<number | null>(
    activeCriterion?.dayaDukung ?? (typeof initialKkmItem?.dayaDukung === 'number' ? initialKkmItem.dayaDukung : null)
  );
  const [intake, setIntake] = useState<number | null>(
    activeCriterion?.intake ?? (typeof initialKkmItem?.intake === 'number' ? initialKkmItem.intake : null)
  );

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    const found = criteriaList.find((c) => c.tpId === id);
    const kkmMatch = k13KKM?.items?.find((k) => k.id === id);
    if (found) {
      setApproach(found.approach);
      setIndicators(found.indicators || []);
      setLevels(found.levels || []);
      if (found.kompleksitas !== undefined || found.dayaDukung !== undefined || found.intake !== undefined) {
        setKompleksitas(found.kompleksitas ?? null);
        setDayaDukung(found.dayaDukung ?? null);
        setIntake(found.intake ?? null);
      } else {
        setKompleksitas(typeof kkmMatch?.kompleksitas === 'number' ? kkmMatch.kompleksitas : null);
        setDayaDukung(typeof kkmMatch?.dayaDukung === 'number' ? kkmMatch.dayaDukung : null);
        setIntake(typeof kkmMatch?.intake === 'number' ? kkmMatch.intake : null);
      }
    } else {
      // Empty state is valid: Guru menentukan kriteria manual atau meminta rekomendasi AI
      setIndicators([]);
      setLevels([]);
      setKompleksitas(typeof kkmMatch?.kompleksitas === 'number' ? kkmMatch.kompleksitas : null);
      setDayaDukung(typeof kkmMatch?.dayaDukung === 'number' ? kkmMatch.dayaDukung : null);
      setIntake(typeof kkmMatch?.intake === 'number' ? kkmMatch.intake : null);
    }
  };

  // KKM computation strictly adheres to: NO DATA > FAKE DATA
  const hasCompleteKkmInputs =
    isValidKkmAspect(kompleksitas) &&
    isValidKkmAspect(dayaDukung) &&
    isValidKkmAspect(intake);

  const calculatedKkm = hasCompleteKkmInputs
    ? calculateLegacyKKM(kompleksitas, dayaDukung, intake)
    : null;

  const handleGenerateAI = () => {
    if (!activeItem) return;
    if (!isK13Curriculum && (!tp || tp.workflowStatus !== 'SIAP' || tp.needsReview)) {
      setNotification({
        message: `TP belum SIAP untuk rekomendasi KKTP (${tp?.workflowStatus || 'BELUM_DIMULAI'}). Tinjau TP terlebih dahulu.`,
        type: 'warning',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    const scope = activeItem.contentScope || activeItem.statement;
    const comp = activeItem.competency || 'kompetensi inti';

    const aiIndicators = [
      `Mengidentifikasi dan menjelaskan materi: ${scope}`,
      `Mempraktikkan atau menganalisis ${comp} dalam situasi kontekstual`,
      `Menyelesaikan evaluasi terkait ${scope} secara mandiri dan akurat`,
    ];
    setIndicators(aiIndicators);

    const aiLevels: KKTPLevel[] = [
      {
        level: 'Perlu Bimbingan',
        label: 'Perlu Bimbingan',
        description: `Belum mampu menguasai konsep dasar ${scope}, masih membutuhkan pendampingan penuh dari pendidik.`,
      },
      {
        level: 'Cukup',
        label: 'Cukup',
        description: `Mampu memahami sebagian materi ${scope}, namun masih memerlukan bimbingan berkala.`,
      },
      {
        level: 'Baik',
        label: 'Baik',
        description: `Mampu menguasai materi ${scope} secara tepat dan mandiri sesuai kriteria esensial.`,
      },
      {
        level: 'Sangat Baik',
        label: 'Sangat Baik',
        description: `Menguasai materi ${scope} melampaui kriteria esensial, mampu bernalar kritis dan membimbing rekan.`,
      },
    ];
    setLevels(aiLevels);

    // Create DRAFT recommendation criterion
    const candidateCriterion: AssessmentCriterion = {
      id: activeCriterion?.id || `criterion-${Date.now()}-${activeItem.id}`,
      academicSettingId: academicSetting.id,
      tpId: activeItem.id,
      description: `Kriteria Ketercapaian: ${activeItem.statement}`,
      approach,
      passingThreshold: approach === 'legacy_kkm' ? calculatedKkm : null,
      kompleksitas: approach === 'legacy_kkm' ? kompleksitas : undefined,
      dayaDukung: approach === 'legacy_kkm' ? dayaDukung : undefined,
      intake: approach === 'legacy_kkm' ? intake : undefined,
      indicators: aiIndicators,
      levels: aiLevels,
      basedOnTpUpdatedAt: tp?.updatedAt,
      workflowStatus: 'DRAFT',
      generatedBy: 'AI',
      needsReview: false,
      updatedAt: new Date().toISOString(),
    };

    const updated = criteriaList.filter((c) => c.tpId !== activeItem.id).concat(candidateCriterion);
    setCriteriaList(updated);
    onSaveCriteria(updated);

    setNotification({
      message: 'Rekomendasi Kriteria Pembelajaran digenerate sebagai DRAFT oleh AI. Silakan tinjau dan lakukan konfirmasi.',
      type: 'info',
    });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSaveCurrent = () => {
    if (!activeItem) return;

    if (approach === 'legacy_kkm' && !hasCompleteKkmInputs) {
      setNotification({
        message: 'Lengkapi kompleksitas, daya dukung, dan intake sebelum menyimpan KKM.',
        type: 'warning',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }

    const currentGenBy =
      activeCriterion?.generatedBy === 'AI' ? 'AI_EDITED_BY_TEACHER' : activeCriterion?.generatedBy || 'TEACHER';

    const newCriterion: AssessmentCriterion = {
      id: activeCriterion?.id || `criterion-${Date.now()}-${activeItem.id}`,
      academicSettingId: academicSetting.id,
      tpId: activeItem.id,
      description: `Kriteria Ketercapaian: ${activeItem.statement}`,
      approach,
      passingThreshold: approach === 'legacy_kkm' ? calculatedKkm : null,
      kompleksitas: approach === 'legacy_kkm' ? kompleksitas : undefined,
      dayaDukung: approach === 'legacy_kkm' ? dayaDukung : undefined,
      intake: approach === 'legacy_kkm' ? intake : undefined,
      indicators,
      levels,
      basedOnTpUpdatedAt: activeCriterion?.basedOnTpUpdatedAt || tp?.updatedAt,
      workflowStatus: 'DRAFT',
      generatedBy: currentGenBy,
      needsReview: false,
      updatedAt: new Date().toISOString(),
    };

    const updated = criteriaList.filter((c) => c.tpId !== activeItem.id).concat(newCriterion);
    setCriteriaList(updated);
    onSaveCriteria(updated);

    // If K13 and Legacy KKM approach is selected with complete inputs, sync to K13KKM state
    if (isK13Curriculum && approach === 'legacy_kkm' && onSaveK13KKM && calculatedKkm !== null) {
      const existingKkmItems = k13KKM?.items || [];
      const updatedKkmItems = existingKkmItems
        .filter((k) => k.id !== activeItem.id)
        .concat({
          id: activeItem.id,
          kd: activeItem.statement,
          indikator: indicators[0] || 'Indikator Ketercapaian KD',
          kompleksitas: kompleksitas!,
          dayaDukung: dayaDukung!,
          intake: intake!,
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

    setNotification({
      message: 'Kriteria Ketercapaian berhasil disimpan sebagai DRAFT.',
      type: 'success',
    });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleConfirmCurrent = () => {
    if (!activeItem) return;
    if (!isK13Curriculum && (!tp || tp.workflowStatus !== 'SIAP' || tp.needsReview)) {
      setNotification({
        message: `KKTP belum dapat dikonfirmasi karena TP belum SIAP (${tp?.workflowStatus || 'BELUM_DIMULAI'}).`,
        type: 'warning',
      });
      setTimeout(() => setNotification(null), 4000);
      return;
    }
    const currentGenBy =
      activeCriterion?.generatedBy === 'AI' ? 'AI_EDITED_BY_TEACHER' : activeCriterion?.generatedBy || 'TEACHER';

    const candidate: AssessmentCriterion = {
      id: activeCriterion?.id || `criterion-${Date.now()}-${activeItem.id}`,
      academicSettingId: academicSetting.id,
      tpId: activeItem.id,
      description: `Kriteria Ketercapaian: ${activeItem.statement}`,
      approach,
      passingThreshold: approach === 'legacy_kkm' ? calculatedKkm : null,
      kompleksitas: approach === 'legacy_kkm' ? kompleksitas : undefined,
      dayaDukung: approach === 'legacy_kkm' ? dayaDukung : undefined,
      intake: approach === 'legacy_kkm' ? intake : undefined,
      indicators,
      levels,
      basedOnTpUpdatedAt: tp?.updatedAt,
      workflowStatus: 'DRAFT',
      generatedBy: currentGenBy,
      updatedAt: new Date().toISOString(),
    };

    const valResult = validateKKTPCriterion(candidate, tp?.items || [], k13Analysis, tp?.updatedAt);

    if (valResult.isValid) {
      candidate.workflowStatus = 'SIAP';
      candidate.needsReview = false;
      candidate.basedOnTpUpdatedAt = tp?.updatedAt || new Date().toISOString();
      setNotification({
        message: 'Kriteria Ketercapaian berhasil divalidasi dan dikonfirmasi berstatus SIAP!',
        type: 'success',
      });
    } else {
      candidate.workflowStatus = 'PERLU_DILENGKAPI';
      candidate.needsReview = true;
      candidate.reviewReason = valResult.issues.join('; ');
      setNotification({
        message: `Kriteria belum memenuhi syarat: ${valResult.issues[0]}`,
        type: 'warning',
      });
    }

    const updated = criteriaList.filter((c) => c.tpId !== activeItem.id).concat(candidate);
    setCriteriaList(updated);
    onSaveCriteria(updated);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (isK13Curriculum) {
        if (!k13KKM || k13KKM.kkmTotal === undefined || k13KKM.kkmTotal === null || !k13KKM.items || k13KKM.items.length === 0) {
          alert('Data Penetapan KKM Kurikulum 2013 belum ditetapkan. Silakan lengkapi perhitungan KKM terlebih dahulu sebelum mengekspor.');
          return;
        }
        await generatePenetapanKKM({
          school,
          profile,
          academicSetting,
          k13KKM,
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

  const hasConfiguredCriteria =
    indicators.length > 0 || levels.length > 0 || (approach === 'legacy_kkm' && isK13Curriculum);

  return (
    <div className="space-y-6" id="kktp-manager-container">
      {notification && (
        <div
          className={`border px-4 py-3 rounded-lg flex items-center gap-3 ${
            notification.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : notification.type === 'warning'
              ? 'bg-amber-50 border-amber-300 text-amber-800'
              : 'bg-indigo-50 border-indigo-300 text-indigo-800'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : notification.type === 'warning' ? (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          ) : (
            <Info className="w-5 h-5 text-indigo-600 shrink-0" />
          )}
          <p className="text-sm font-medium">{notification.message}</p>
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
              Kriteria dan bukti ketercapaian tujuan pembelajaran ({academicSetting.subject} - {academicSetting.grade})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-export-kktp"
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
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
            {targetItems.map((item, idx) => {
              const matchedCrit = criteriaList.find((c) => c.tpId === item.id);
              const isSiap = matchedCrit?.workflowStatus === 'SIAP';
              const isSelected = (activeItem?.id || targetItems[0]?.id) === item.id;
              const displayLabel = item.code || (isK13Curriculum ? `KD ${idx + 1}` : `TP ${idx + 1}`);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{displayLabel}</span>
                  {isSiap && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-600'}`}
                      title="Status SIAP"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Item Detail & Criteria Setup */}
      {activeItem ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-5">
          {/* Active Banner with Workflow Badges */}
          <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-indigo-700">
                  {activeItem.code || (isK13Curriculum ? 'Kompetensi Dasar' : 'Tujuan Pembelajaran')}
                </span>
                {activeCriterion && (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                      activeCriterion.workflowStatus === 'SIAP'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeCriterion.workflowStatus === 'PERLU_DILENGKAPI'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {activeCriterion.workflowStatus || 'DRAFT'}
                  </span>
                )}
                {activeCriterion?.generatedBy === 'AI' && (
                  <span className="text-[10px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-md">
                    AI Recommendation
                  </span>
                )}
                {activeCriterion?.generatedBy === 'AI_EDITED_BY_TEACHER' && (
                  <span className="text-[10px] font-semibold bg-violet-100 text-violet-800 px-2 py-0.5 rounded-md">
                    AI + Guru
                  </span>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-800 mt-1">{activeItem.statement}</p>
              {activeItem.contentScope && (
                <p className="text-xs text-slate-600 mt-0.5">
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

          {/* Empty State for Non-Configured Criterion */}
          {!hasConfiguredCriteria ? (
            <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Belum ada kriteria ketercapaian untuk TP ini.</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Tujuan pembelajaran ini belum memiliki kriteria atau bukti capaian. Anda dapat menambahkan kriteria secara mandiri atau meminta rekomendasi AI.
                </p>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (approach === 'deskripsi') {
                      setIndicators(['Indikator 1: ']);
                    } else if (approach === 'rubrik') {
                      setLevels([
                        { level: 'Perlu Bimbingan', label: 'Perlu Bimbingan', description: '' },
                        { level: 'Cukup', label: 'Cukup', description: '' },
                        { level: 'Baik', label: 'Baik', description: '' },
                        { level: 'Sangat Baik', label: 'Sangat Baik', description: '' },
                      ]);
                    } else if (approach === 'skala_interval') {
                      setLevels([
                        { level: 'Interval 1', label: 'Perlu Bimbingan', scoreRange: '0 - 50', description: 'Remedial' },
                        { level: 'Interval 2', label: 'Tuntas', scoreRange: '51 - 100', description: 'Mencapai tujuan' },
                      ]);
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-500" />
                  <span>Tambah Kriteria Manual</span>
                </button>
                <button
                  type="button"
                  onClick={handleGenerateAI}
                  className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-all cursor-pointer shadow-xs"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>Rekomendasi AI</span>
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Render by approach */}
              {approach === 'rubrik' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Deskripsi Rubrik Per Kategori Ketercapaian
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setLevels([
                          ...levels,
                          {
                            level: `Tingkat ${levels.length + 1}`,
                            label: `Tingkat ${levels.length + 1}`,
                            description: '',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Kategori
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {levels.map((lvl, idx) => (
                      <div key={idx} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
                        <div className="flex justify-between items-center mb-2">
                          <input
                            type="text"
                            value={lvl.label}
                            onChange={(e) => {
                              const updated = [...levels];
                              updated[idx] = { ...updated[idx], label: e.target.value, level: e.target.value };
                              setLevels(updated);
                            }}
                            className="text-xs font-bold text-slate-800 bg-transparent border-b border-slate-300 pb-0.5 focus:outline-hidden focus:border-indigo-500"
                          />
                          <button
                            type="button"
                            onClick={() => setLevels(levels.filter((_, i) => i !== idx))}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <textarea
                          value={lvl.description}
                          onChange={(e) => {
                            const updated = [...levels];
                            updated[idx] = { ...updated[idx], description: e.target.value };
                            setLevels(updated);
                          }}
                          rows={3}
                          placeholder="Tuliskan deskripsi kompetensi untuk kategori ini..."
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
                      Daftar Indikator Ketercapaian
                    </h4>
                    <button
                      type="button"
                      onClick={() => setIndicators([...indicators, ''])}
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
                          placeholder="Tuliskan rumusan indikator ketercapaian..."
                          onChange={(e) => {
                            const updated = [...indicators];
                            updated[idx] = e.target.value;
                            setIndicators(updated);
                          }}
                          className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                      Konfigurasi Skala Interval (Ditentukan oleh Pendidik / Satuan Pendidikan)
                    </h4>
                    <button
                      type="button"
                      onClick={() =>
                        setLevels([
                          ...levels,
                          {
                            level: `Interval ${levels.length + 1}`,
                            label: `Kategori ${levels.length + 1}`,
                            scoreRange: '',
                            description: '',
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> Tambah Interval
                    </button>
                  </div>

                  {levels.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl">
                      Belum ada skala interval yang dikonfigurasi. Silakan tambahkan interval atau minta rekomendasi AI.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3 w-32">Interval Nilai</th>
                            <th className="py-2.5 px-3 w-48">Kategori Ketercapaian</th>
                            <th className="py-2.5 px-3">Tindak Lanjut Pembelajaran</th>
                            <th className="py-2.5 px-2 w-10 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {levels.map((lvl, idx) => (
                            <tr key={idx} className="bg-white">
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={lvl.scoreRange || ''}
                                  placeholder="cth: 0 - 40"
                                  onChange={(e) => {
                                    const updated = [...levels];
                                    updated[idx] = { ...updated[idx], scoreRange: e.target.value };
                                    setLevels(updated);
                                  }}
                                  className="w-full text-xs font-semibold px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={lvl.label}
                                  placeholder="cth: Perlu Bimbingan"
                                  onChange={(e) => {
                                    const updated = [...levels];
                                    updated[idx] = { ...updated[idx], label: e.target.value, level: e.target.value };
                                    setLevels(updated);
                                  }}
                                  className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                              </td>
                              <td className="py-2 px-3">
                                <input
                                  type="text"
                                  value={lvl.description}
                                  placeholder="cth: Remedial seluruh bagian materi"
                                  onChange={(e) => {
                                    const updated = [...levels];
                                    updated[idx] = { ...updated[idx], description: e.target.value };
                                    setLevels(updated);
                                  }}
                                  className="w-full text-xs px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => setLevels(levels.filter((_, i) => i !== idx))}
                                  className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {approach === 'legacy_kkm' && isK13Curriculum && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                      Perhitungan KKM Kurikulum 2013 Berdasarkan Unsur Penilaian Sekolah
                    </h4>
                    {!hasCompleteKkmInputs && (
                      <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Input KKM belum lengkap
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Kompleksitas (1-100)</label>
                      <input
                        type="number"
                        value={kompleksitas !== null ? kompleksitas : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') setKompleksitas(null);
                          else {
                            const n = Number(val);
                            setKompleksitas(isNaN(n) ? null : n);
                          }
                        }}
                        placeholder="Belum diisi"
                        min={0}
                        max={100}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Daya Dukung (1-100)</label>
                      <input
                        type="number"
                        value={dayaDukung !== null ? dayaDukung : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') setDayaDukung(null);
                          else {
                            const n = Number(val);
                            setDayaDukung(isNaN(n) ? null : n);
                          }
                        }}
                        placeholder="Belum diisi"
                        min={0}
                        max={100}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">Intake Siswa (1-100)</label>
                      <input
                        type="number"
                        value={intake !== null ? intake : ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') setIntake(null);
                          else {
                            const n = Number(val);
                            setIntake(isNaN(n) ? null : n);
                          }
                        }}
                        placeholder="Belum diisi"
                        min={0}
                        max={100}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                      />
                    </div>
                    <div className="bg-indigo-50 border border-indigo-200 p-2.5 rounded-lg flex flex-col justify-center items-center">
                      <span className="text-[10px] uppercase font-bold text-indigo-700">Hasil KKM</span>
                      <span className="text-base font-bold text-indigo-950">
                        {calculatedKkm !== null ? calculatedKkm : '-'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons: Save DRAFT and Konfirmasi Guru */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3">
                <button
                  id="btn-save-kktp"
                  type="button"
                  onClick={handleSaveCurrent}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <Save className="w-4 h-4 text-slate-500" />
                  <span>Simpan DRAFT</span>
                </button>

                <button
                  id="btn-confirm-kktp"
                  type="button"
                  onClick={handleConfirmCurrent}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-200" />
                  <span>Konfirmasi & Tetapkan SIAP</span>
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
          Belum ada data Tujuan Pembelajaran atau Kompetensi Dasar yang terdaftar.
        </div>
      )}
    </div>
  );
};
