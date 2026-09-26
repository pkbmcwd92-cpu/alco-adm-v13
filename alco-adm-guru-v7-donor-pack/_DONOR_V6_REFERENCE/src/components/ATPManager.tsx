import React, { useState, useEffect } from 'react';
import {
  GitMerge,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Check,
  Clock,
  BookOpen,
  Target,
  AlertCircle,
  RefreshCw,
  HelpCircle,
  FileCheck2,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import { ATPData, ATPItem, TPData, CPData, AcademicSetting, TeacherProfile, ActiveContext } from '../types';
import { generateATPWithAI, refineTextWithAI } from '../services/aiService';
import { validateATPReferences, resolveATPItemTPReference, normalizeATPReferences } from '../services/cpWorkflowService';
import { P3_DIMENSIONS } from '../data/curriculumDefaults';

interface ATPManagerProps {
  atp: ATPData;
  tp: TPData;
  cp: CPData;
  context: ActiveContext;
  academicSetting: AcademicSetting;
  profile: TeacherProfile;
  onSaveATP: (atp: ATPData) => void;
  onNextStep: () => void;
  onBackToTP: () => void;
}

export const ATPManager: React.FC<ATPManagerProps> = ({
  atp,
  tp,
  cp,
  context,
  academicSetting,
  profile,
  onSaveATP,
  onNextStep,
  onBackToTP,
}) => {
  const [rationale, setRationale] = useState(atp.rationale || '');
  const [items, setItems] = useState<ATPItem[]>(atp.items || []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState(false);

  // Edit / Add Item Modal
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState<ATPItem | null>(null);
  const [isRefiningRationale, setIsRefiningRationale] = useState(false);

  useEffect(() => {
    setRationale(atp.rationale || '');
    setItems(atp.items || []);
  }, [atp]);

  const hasTP = tp.items && tp.items.length > 0;
  const knownTotalJP = items.reduce((acc, curr) => acc + (curr.jp !== undefined && curr.jp !== null ? Number(curr.jp) : 0), 0);
  const hasUnknownJP = items.some((item) => item.jp === undefined || item.jp === null);

  // Integrity Check: TP was modified after ATP was formed
  const isTPOutdated =
    hasTP &&
    items.length > 0 &&
    atp.basedOnTpUpdatedAt &&
    tp.updatedAt &&
    new Date(tp.updatedAt).getTime() > new Date(atp.basedOnTpUpdatedAt).getTime() + 1000;

  // Handle AI Generate ATP from TP
  const handleGenerateAI = async () => {
    if (!hasTP) {
      alert('Daftar TP belum tersedia. Harap rumuskan TP pada tahap 04 terlebih dahulu.');
      return;
    }

    if (
      items.length > 0 &&
      !confirm('Menyusun ATP dengan AI akan menata ulang matriks alur saat ini. Lanjutkan?')
    ) {
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      const generated = await generateATPWithAI({
        tps: tp.items,
        cpGeneral: cp.generalDescription,
        subject: context.subject,
        grade: context.grade,
        phase: context.phase,
        semester: context.semester,
        academicYear: context.academicYear,
        totalHoursPerWeek: context.totalHoursPerWeek,
      });

      const formattedItems: ATPItem[] = generated.items.map((item, idx) => {
        const candidateItem: ATPItem = {
          id: `atp-item-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
          stepNumber: item.stepNumber || idx + 1,
          tpId: (item as any).tpId || '',
          tpCode: item.tpCode || '',
          tpStatement: item.tpStatement || '',
          materialScope: item.materialScope || '',
          jp: item.jp !== undefined && item.jp !== null && Number(item.jp) > 0 ? Number(item.jp) : undefined,
          semester: (item.semester === 1 || item.semester === 2) ? item.semester : (context.semester === 1 || context.semester === 2 ? context.semester : undefined),
          p3Dimensions: Array.isArray(item.p3Dimensions) ? item.p3Dimensions : [],
          assessmentPlan: item.assessmentPlan || '',
          glossary: item.glossary || '',
          resources: item.resources || '',
        };

        const refResult = resolveATPItemTPReference(candidateItem, tp.items);
        if (refResult.status === 'RESOLVED_REFERENCE' || refResult.status === 'LEGACY_MIGRATED') {
          const canonical = refResult.canonicalTPItem!;
          candidateItem.tpId = canonical.id;
          candidateItem.tpCode = canonical.code;
          candidateItem.tpStatement = canonical.statement;
          if (!candidateItem.materialScope) {
            candidateItem.materialScope = canonical.contentScope || '';
          }
          if (candidateItem.p3Dimensions.length === 0 && canonical.p3Dimensions) {
            candidateItem.p3Dimensions = [...canonical.p3Dimensions];
          }
        }
        return candidateItem;
      });

      setRationale(generated.rationale);
      setItems(formattedItems);

      const genKnownTotal = formattedItems.reduce((acc, curr) => acc + (curr.jp !== undefined && curr.jp !== null ? Number(curr.jp) : 0), 0);
      const genHasUnknown = formattedItems.some((i) => i.jp === undefined || i.jp === null);

      // Auto save as DRAFT (Teacher review required)
      const updated: ATPData = {
        ...atp,
        academicSettingId: academicSetting.id,
        tpDataId: tp.id,
        tpId: tp.id,
        academicYear: context.academicYear,
        subjectCode: context.subjectCode || context.subject,
        phase: context.phase,
        rationale: generated.rationale,
        items: formattedItems,
        totalJP: genKnownTotal,
        knownTotalJP: genKnownTotal,
        hasUnknownJP: genHasUnknown,
        allocationComplete: !genHasUnknown,
        generatedBy: 'AI',
        workflowStatus: 'DRAFT',
        generatedAt: new Date().toISOString(),
        needsReview: false,
        reviewReason: undefined,
        basedOnTpUpdatedAt: tp.updatedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      onSaveATP(updated);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyusun ATP dengan AI';
      setGenerationError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = () => {
    const isAiOrigin = atp.generatedBy === 'AI' || atp.generatedBy === 'AI_EDITED_BY_TEACHER';
    const updated: ATPData = {
      ...atp,
      academicSettingId: academicSetting.id,
      rationale,
      items: items.map((item, idx) => ({ ...item, stepNumber: idx + 1 })),
      totalJP: knownTotalJP,
      knownTotalJP,
      hasUnknownJP,
      allocationComplete: !hasUnknownJP,
      generatedBy: isAiOrigin ? 'AI_EDITED_BY_TEACHER' : 'TEACHER',
      basedOnTpUpdatedAt: tp.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveATP(updated);
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 2500);
  };

  const handleConfirmAndFinalize = () => {
    const isAiOrigin = atp.generatedBy === 'AI' || atp.generatedBy === 'AI_EDITED_BY_TEACHER';
    const candidate: ATPData = {
      ...atp,
      academicSettingId: academicSetting.id,
      tpDataId: tp.id,
      tpId: tp.id,
      academicYear: context.academicYear,
      subjectCode: context.subjectCode || context.subject,
      phase: context.phase,
      rationale,
      items: items.map((item, idx) => ({ ...item, stepNumber: idx + 1 })),
      totalJP: knownTotalJP,
      knownTotalJP,
      hasUnknownJP,
      allocationComplete: !hasUnknownJP,
      workflowStatus: 'SIAP',
      generatedBy: isAiOrigin ? 'AI_EDITED_BY_TEACHER' : (atp.generatedBy || 'TEACHER'),
      basedOnTpUpdatedAt: tp.updatedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const valRes = validateATPReferences(candidate, tp);
    if (valRes.isSiap) {
      candidate.workflowStatus = 'SIAP';
      candidate.needsReview = false;
      candidate.reviewReason = undefined;
      onSaveATP(candidate);
      setSaveNotice(true);
      setTimeout(() => setSaveNotice(false), 2500);
    } else {
      candidate.workflowStatus = 'PERLU_DILENGKAPI';
      candidate.needsReview = true;
      candidate.reviewReason = valRes.issues.join('; ');
      onSaveATP(candidate);
      alert(`ATP belum dapat difinalisasi karena ditemukan isu validasi:\n\n• ${valRes.issues.join('\n• ')}`);
    }
  };

  const handleSaveAndNext = () => {
    if (items.length === 0) {
      alert('Susun minimal 1 butir Alur Tujuan Pembelajaran (ATP) sebelum mengekspor dokumen.');
      return;
    }
    handleSave();
    onNextStep();
  };

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newItems = [...items];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIdx];
    newItems[targetIdx] = temp;

    setItems(newItems.map((it, idx) => ({ ...it, stepNumber: idx + 1 })));
  };

  const handleDelete = (id: string) => {
    if (confirm('Hapus baris alur pembelajaran ini?')) {
      setItems(items.filter((i) => i.id !== id).map((it, idx) => ({ ...it, stepNumber: idx + 1 })));
    }
  };

  const handleOpenAdd = () => {
    const nextStep = items.length + 1;
    const firstTP = tp.items[0];
    const gradeNum = context.grade.replace(/[^0-9]/g, '') || '4';
    setCurrentItem({
      id: `atp-item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      stepNumber: nextStep,
      tpId: firstTP?.id,
      tpCode: firstTP?.code || `TP ${gradeNum}.${nextStep}`,
      tpStatement: firstTP?.statement || '',
      materialScope: firstTP?.contentScope || '',
      jp: undefined,
      semester: (context.semester === 1 || context.semester === 2) ? context.semester : undefined,
      p3Dimensions: firstTP?.p3Dimensions ? [...firstTP.p3Dimensions] : [],
      assessmentPlan: '',
      glossary: '',
      resources: '',
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (item: ATPItem) => {
    setCurrentItem({ ...item });
    setIsEditing(true);
  };

  const handleSaveItemModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentItem || !currentItem.tpStatement.trim()) {
      alert('Rumusan Tujuan Pembelajaran wajib diisi.');
      return;
    }

    const exists = items.some((i) => i.id === currentItem.id);
    let newItems: ATPItem[];
    if (exists) {
      newItems = items.map((i) => (i.id === currentItem.id ? currentItem : i));
    } else {
      newItems = [...items, currentItem];
    }

    setItems(newItems.map((it, idx) => ({ ...it, stepNumber: idx + 1 })));
    setIsEditing(false);
    setCurrentItem(null);
  };

  const handleRefineRationale = async () => {
    if (!rationale.trim()) {
      alert('Tulis draf rasionalisasi alur terlebih dahulu.');
      return;
    }
    setIsRefiningRationale(true);
    try {
      const refined = await refineTextWithAI({
        text: rationale,
        instruction:
          'Sempurnakan penjelasan rasionalisasi alur tujuan pembelajaran ini agar profesional, berlandaskan prinsip pedagogis bertahap (mudah ke sukar/konkret ke abstrak).',
        context: `${context.subject} ${context.grade} (${context.phase})`,
      });
      setRationale(refined);
    } catch {
      alert('Gagal menyempurnakan rasionalisasi dengan AI.');
    } finally {
      setIsRefiningRationale(false);
    }
  };

  if (!hasTP) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xs text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Daftar Tujuan Pembelajaran (TP) Belum Ada</h3>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Alur Tujuan Pembelajaran (ATP) disusun dengan mengurutkan dan memetakan alokasi waktu dari TP yang telah dibuat sebelumnya.
        </p>
        <button
          onClick={onBackToTP}
          className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold shadow-xs transition"
        >
          <Target className="w-4 h-4" />
          <span>Kembali ke Tahap TP (05)</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Integrity Alert if TP was modified */}
      {isTPOutdated && (
        <div className="bg-amber-50 border border-amber-300 p-4 rounded-2xl flex items-start gap-3 text-amber-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-sm text-amber-950">
              Pembaruan Terdeteksi pada Daftar Tujuan Pembelajaran (TP)
            </h4>
            <p className="text-amber-800">
              Daftar TP telah diperbarui setelah penyusunan matriks ATP ini. Anda dapat meninjau langkah alur di bawah atau klik tombol <strong>"Susun ATP dari TP (AI)"</strong> untuk menyelaraskan ulang alur secara otomatis.
            </p>
          </div>
        </div>
      )}

      {/* Step Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-800 text-xs font-bold flex items-center justify-center">
                06
              </span>
              <h3 className="text-lg font-bold text-slate-900">Penyusunan Alur Tujuan Pembelajaran (ATP)</h3>
              {atp.workflowStatus === 'DRAFT' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  DRAFT (Perlu Konfirmasi Guru)
                </span>
              )}
              {atp.workflowStatus === 'PERLU_DILENGKAPI' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300">
                  PERLU DILENGKAPI
                </span>
              )}
              {atp.workflowStatus === 'SIAP' && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  SIAP
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">
              Petakan alur pengurutan materi, estimasi Jam Pelajaran (JP), asesmen, dan kata kunci glosarium untuk <strong>{context.subject}</strong> ({context.grade} - Semester {context.semester}).
            </p>
          </div>

          {/* AI Generator Button */}
          <button
            id="btn-ai-generate-atp"
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer disabled:opacity-50 self-start sm:self-auto"
          >
            {isGenerating ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>AI Sedang Menyusun Alur ATP...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Susun ATP dari TP (AI)</span>
              </>
            )}
          </button>
        </div>

        {generationError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
            ⚠️ {generationError}
          </div>
        )}
      </div>

      {/* Rationale Section */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-blue-600" />
            <span>Rasionalisasi Alur Pembelajaran</span>
          </label>
          <button
            type="button"
            onClick={handleRefineRationale}
            disabled={isRefiningRationale}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg transition"
          >
            <Wand2 className="w-3.5 h-3.5 text-blue-600" />
            <span>{isRefiningRationale ? 'Memoles...' : 'Poles Rasionalisasi (AI)'}</span>
          </button>
        </div>
        <textarea
          id="textarea-atp-rationale"
          rows={3}
          placeholder="Jelaskan alasan pedagogis pengurutan alur pembelajaran ini (misal: dimulai dari pengenalan konsep dasar menuju penerapan aplikatif)..."
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          className="w-full text-sm p-3.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 leading-relaxed"
        />
      </div>

      {/* ATP Table Matrix View */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <GitMerge className="w-4 h-4 text-blue-600" />
              <span>Matriks Alur Pembelajaran ({items.length} Langkah)</span>
            </h4>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              <Clock className="w-3 h-3 text-blue-600" /> Total: {knownTotalJP} JP {hasUnknownJP ? '*' : ''}
            </span>
          </div>

          <button
            id="btn-add-atp-step"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Langkah Alur</span>
          </button>
        </div>

        {items.length === 0 ? (
          <div className="p-10 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-3">
            <GitMerge className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500">
              Belum ada baris ATP. Klik tombol <strong>"Susun ATP dari TP (AI)"</strong> di atas untuk membuat matriks secara otomatis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white font-semibold">
                  <th className="p-3 w-12 text-center">No.</th>
                  <th className="p-3 w-28">Kode & Status</th>
                  <th className="p-3 min-w-[240px]">Tujuan Pembelajaran (TP Canonical)</th>
                  <th className="p-3 min-w-[140px]">Lingkup Materi</th>
                  <th className="p-3 min-w-[120px]">Profil Pancasila</th>
                  <th className="p-3 min-w-[150px]">Rencana Asesmen</th>
                  <th className="p-3 w-20 text-center">Sem / JP</th>
                  <th className="p-3 w-24 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {items.map((item, idx) => {
                  const refStatus = resolveATPItemTPReference(item, tp.items);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center font-bold text-slate-700 bg-slate-50/50">
                        {idx + 1}
                      </td>
                      <td className="p-3 font-mono text-xs">
                        <div className="font-bold text-blue-900">{item.tpCode || '-'}</div>
                        {refStatus.status === 'DANGLING_REFERENCE' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            ⚠️ TP Terhapus
                          </span>
                        )}
                        {refStatus.status === 'AMBIGUOUS_REFERENCE' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                            ⚠️ TP Ambigu
                          </span>
                        )}
                        {refStatus.status === 'UNRESOLVED_REFERENCE' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            ⚠️ Terputus
                          </span>
                        )}
                        {refStatus.status === 'LEGACY_MIGRATED' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            ℹ️ Migrasi
                          </span>
                        )}
                        {refStatus.status === 'RESOLVED_REFERENCE' && (
                          <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Canonical
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-900 leading-relaxed">
                        {item.tpStatement || refStatus.canonicalTPItem?.statement || '-'}
                        {item.glossary && (
                          <div className="text-[11px] text-slate-500 mt-1">
                            <span className="font-semibold text-slate-700">Glosarium:</span> {item.glossary}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-slate-700 font-semibold">{item.materialScope || '-'}</td>
                      <td className="p-3 text-blue-800">
                        {item.p3Dimensions && item.p3Dimensions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {item.p3Dimensions.map((d, di) => (
                              <span
                                key={di}
                                className="px-1.5 py-0.5 rounded bg-blue-50 text-[10px] font-medium text-blue-700 border border-blue-100"
                              >
                                {d}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-[11px] leading-relaxed">
                        {item.assessmentPlan || '-'}
                      </td>
                      <td className="p-3 text-center bg-slate-50/50">
                        <div className="font-bold text-slate-900">
                          {item.jp !== undefined && item.jp !== null ? `${item.jp} JP` : '-'}
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          {item.semester ? `Sem ${item.semester}` : '-'}
                        </div>
                      </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleMove(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition disabled:opacity-20"
                          title="Geser naik"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMove(idx, 'down')}
                          disabled={idx === items.length - 1}
                          className="p-1 text-slate-400 hover:text-slate-700 rounded transition disabled:opacity-20"
                          title="Geser turun"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(item)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded transition"
                          title="Edit baris ATP"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          title="Hapus baris"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-300">
                  <td colSpan={6} className="p-3 text-right">
                    Total Alokasi Waktu Semester:
                  </td>
                  <td className="p-3 text-center bg-blue-50 text-blue-900 font-extrabold">
                    {knownTotalJP} JP {hasUnknownJP ? '*' : ''}
                  </td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        {hasUnknownJP && (
          <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 mt-2 font-medium">
            * Terdapat langkah ATP yang belum memiliki alokasi JP. Harap lengkapi JP sebelum memfinalisasi alur.
          </p>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-save-atp-draft"
            type="button"
            onClick={handleSave}
            className="px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-xs transition"
          >
            Simpan Matriks ATP
          </button>
          <button
            id="btn-confirm-atp-siap"
            type="button"
            onClick={handleConfirmAndFinalize}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 shadow-sm transition flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Konfirmasi & Finalisasi ATP (SIAP)</span>
          </button>
          {saveNotice && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check className="w-4 h-4 text-emerald-600" /> Data ATP tersimpan
            </span>
          )}
        </div>

        <button
          id="btn-next-to-admin"
          type="button"
          onClick={handleSaveAndNext}
          className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-950 text-white py-2.5 px-6 rounded-xl text-sm font-semibold shadow-sm transition cursor-pointer"
        >
          <span>Lanjut ke Administrasi & Ekspor Dokumen (07)</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* MODAL: Add / Edit ATP Step */}
      {isEditing && currentItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {currentItem.tpStatement ? 'Edit Langkah ATP' : 'Tambah Langkah ATP'}
              </h3>
              <button
                onClick={() => setIsEditing(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItemModal} className="space-y-4">
              {/* Select Canonical TP */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Pilih Tujuan Pembelajaran (TP Canonical) <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={currentItem.tpId || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const matched = tp.items.find((t) => t.id === selectedId);
                    if (matched) {
                      setCurrentItem({
                        ...currentItem,
                        tpId: matched.id,
                        tpCode: matched.code,
                        tpStatement: matched.statement,
                        materialScope: currentItem.materialScope || matched.contentScope || '',
                        p3Dimensions: matched.p3Dimensions && matched.p3Dimensions.length > 0 ? matched.p3Dimensions : currentItem.p3Dimensions,
                      });
                    }
                  }}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-medium"
                >
                  <option value="">-- Pilih Butir TP Canonical --</option>
                  {tp.items.map((tItem) => (
                    <option key={tItem.id} value={tItem.id}>
                      [{tItem.code}] {tItem.statement.substring(0, 90)}{tItem.statement.length > 90 ? '...' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Read-only Canonical TP Statement */}
              {currentItem.tpStatement && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-700 space-y-1">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase">
                    <span>Rumusan TP Canonical</span>
                    <span className="text-blue-700 font-semibold text-[10px] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Read-Only
                    </span>
                  </div>
                  <p className="font-medium text-slate-900 leading-relaxed">{currentItem.tpStatement}</p>
                  <p className="text-[10px] text-slate-500 italic">
                    * Rumusan TP bersifat terpusat. Untuk mengubah kalimat TP, silakan kembali ke Tahap 05 (TP).
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Urutan Ke
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={currentItem.stepNumber}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, stepNumber: parseInt(e.target.value, 10) || 1 })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Semester
                  </label>
                  <select
                    value={currentItem.semester || ''}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        semester: e.target.value ? (parseInt(e.target.value, 10) as 1 | 2) : undefined,
                      })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600 font-medium"
                  >
                    <option value="">-- Belum ditentukan --</option>
                    <option value={1}>Semester 1</option>
                    <option value={2}>Semester 2</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Alokasi JP
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Belum ada JP"
                    value={currentItem.jp ?? ''}
                    onChange={(e) =>
                      setCurrentItem({
                        ...currentItem,
                        jp: e.target.value ? parseInt(e.target.value, 10) : undefined,
                      })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Lingkup Materi
                  </label>
                  <input
                    type="text"
                    placeholder="Materi pokok..."
                    value={currentItem.materialScope}
                    onChange={(e) =>
                      setCurrentItem({ ...currentItem, materialScope: e.target.value })
                    }
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    Glosarium / Kata Kunci
                  </label>
                  <input
                    type="text"
                    placeholder="Kata kunci penting..."
                    value={currentItem.glossary}
                    onChange={(e) => setCurrentItem({ ...currentItem, glossary: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Rencana Asesmen (Awal / Formatif / Sumatif)
                </label>
                <input
                  type="text"
                  placeholder="Formatif: Penugasan; Sumatif: Tes..."
                  value={currentItem.assessmentPlan}
                  onChange={(e) =>
                    setCurrentItem({ ...currentItem, assessmentPlan: e.target.value })
                  }
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Sumber / Media Belajar
                </label>
                <input
                  type="text"
                  placeholder="Buku Siswa & Guru..."
                  value={currentItem.resources || ''}
                  onChange={(e) => setCurrentItem({ ...currentItem, resources: e.target.value })}
                  className="w-full text-sm px-3 py-2 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 shadow-sm transition"
                >
                  Simpan Langkah
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
