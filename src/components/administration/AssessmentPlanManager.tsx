import React, { useState } from 'react';
import {
  FileCheck,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  HelpCircle,
  FileSpreadsheet,
  ArrowRight,
  ShieldCheck,
  Search,
  Filter,
  Info,
} from 'lucide-react';
import {
  SchoolData,
  TeacherProfile,
  AcademicSetting,
  AdministrationWorkspace,
  TPData,
  K13Analysis,
  AssessmentCriterion,
  LearningPlan,
  AssessmentPlan,
  AssessmentPurpose,
  AssessmentTiming,
  AssessmentScopeType,
  AssessmentInstrumentType,
  AssessmentInstrumentRef,
  Assessment,
} from '../../types';
import {
  createEmptyAssessmentPlan,
  createAIDraftAssessmentPlan,
  validateAssessmentPlan,
  confirmAssessmentPlan,
  migrateLegacyAssessment,
  recommendInstrumentsForCompetency,
  generateAutoDraftPlansFromCanonicalContext,
  deriveAutoDraftAssessmentPlan,
  getInstrumentLabel,
} from '../../services/assessmentPlanService';
import { resolveAssessmentAlias } from '../../services/assessmentTypeResolver';
import { isMerdeka, isK13 } from '../../services/curriculumRouter';

interface AssessmentPlanManagerProps {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  workspace?: AdministrationWorkspace;
  tp?: TPData;
  k13Analysis?: K13Analysis;
  assessmentCriteria?: AssessmentCriterion[];
  learningPlans?: LearningPlan[];
  assessmentPlans?: AssessmentPlan[];
  assessments?: Assessment[];
  onSaveAssessmentPlan: (plan: AssessmentPlan) => void;
  onDeleteAssessmentPlan: (planId: string) => void;
}

const INSTRUMENT_OPTIONS: { type: AssessmentInstrumentType; label: string }[] = [
  { type: 'WRITTEN_TEST', label: 'Tes Tertulis' },
  { type: 'ORAL_TEST', label: 'Tes Lisan' },
  { type: 'PERFORMANCE', label: 'Tes Kinerja / Praktik' },
  { type: 'OBSERVATION', label: 'Lembar Observasi' },
  { type: 'ASSIGNMENT', label: 'Penugasan' },
  { type: 'PROJECT', label: 'Tugas Proyek' },
  { type: 'PRODUCT', label: 'Penilaian Produk' },
  { type: 'PORTFOLIO', label: 'Dokumen Portofolio' },
  { type: 'SELF_ASSESSMENT', label: 'Penilaian Diri' },
  { type: 'PEER_ASSESSMENT', label: 'Penilaian Antarteman' },
];

export const AssessmentPlanManager: React.FC<AssessmentPlanManagerProps> = ({
  school,
  profile,
  academicSetting,
  workspace,
  tp,
  k13Analysis,
  assessmentCriteria = [],
  learningPlans = [],
  assessmentPlans = [],
  assessments = [],
  onSaveAssessmentPlan,
  onDeleteAssessmentPlan,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'DRAFT' | 'PERLU_DILENGKAPI' | 'SIAP'>('ALL');
  const [purposeFilter, setPurposeFilter] = useState<'ALL' | 'FORMATIVE' | 'SUMMATIVE'>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AssessmentPlan | null>(null);

  // Form Fields State
  const [formTitle, setFormTitle] = useState('');
  const [formAlias, setFormAlias] = useState('');
  const [formPurpose, setFormPurpose] = useState<AssessmentPurpose>('FORMATIVE');
  const [formTiming, setFormTiming] = useState<AssessmentTiming>('POST');
  const [formCustomTiming, setFormCustomTiming] = useState('');
  const [formScope, setFormScope] = useState<AssessmentScopeType>('TP');
  const [formCustomScope, setFormCustomScope] = useState('');
  const [formTpIds, setFormTpIds] = useState<string[]>([]); // INITIAL SELECTION EMPTY!
  const [formCriterionIds, setFormCriterionIds] = useState<string[]>([]);
  const [formInstruments, setFormInstruments] = useState<AssessmentInstrumentRef[]>([]);
  const [aliasNotification, setAliasNotification] = useState<string | null>(null);

  // Available Objectives (Merdeka TPs or K13 KDs)
  const isMerdekaTpReady = !isMerdeka(academicSetting) || (tp?.workflowStatus === 'SIAP' && tp.needsReview !== true);
  const availableObjectives = React.useMemo(() => {
    if (isMerdeka(academicSetting) && isMerdekaTpReady && tp?.items && tp.items.length > 0) {
      return tp.items.map((item) => ({
        id: item.id,
        code: item.code,
        statement: item.statement || item.description || (item.competence ? `${item.competence} ${item.contentScope || ''}`.trim() : item.code),
        competence: item.competence,
        contentScope: item.contentScope,
      }));
    }
    if (k13Analysis?.items && k13Analysis.items.length > 0) {
      return k13Analysis.items.map((item) => ({
        id: item.id,
        code: item.kdCode || item.kd || '',
        statement: item.kdDisplay || item.materiPokok || item.indikator || item.materi || item.kdCode || item.id,
        competence: item.indikator || item.materi || '',
        contentScope: item.materiPokok || item.materi || '',
      }));
    }
    return [];
  }, [academicSetting, isMerdekaTpReady, tp, k13Analysis]);

  // Handle Open Create New
  const handleOpenNew = (presetAlias?: string) => {
    let resolvedPurpose: AssessmentPurpose = 'FORMATIVE';
    let resolvedTiming: AssessmentTiming = 'POST';
    let resolvedScope: AssessmentScopeType = 'TP';

    if (presetAlias) {
      const resolved = resolveAssessmentAlias(presetAlias, { tpCount: availableObjectives.length === 1 ? 1 : undefined });
      if (resolved.status === 'RESOLVED') {
        if (resolved.purpose) resolvedPurpose = resolved.purpose;
        if (resolved.timing) resolvedTiming = resolved.timing;
        if (resolved.scopeType) resolvedScope = resolved.scopeType;
      }
    }

    // Context-aware auto-draft prefill (Requirement 4 & 11)
    let initialTpIds: string[] = [];
    let initialInstruments: AssessmentInstrumentRef[] = [];
    let initialCriterionIds: string[] = [];
    let initialTitle = presetAlias || '';

    // If context has exactly 1 TP unambiguously:
    if (availableObjectives.length === 1) {
      const singleObj = availableObjectives[0];
      initialTpIds = [singleObj.id];
      initialTitle = presetAlias
        ? `${presetAlias}: [${singleObj.code}] ${singleObj.statement.slice(0, 45)}${singleObj.statement.length > 45 ? '...' : ''}`
        : `Asesmen: [${singleObj.code}] ${singleObj.statement.slice(0, 45)}${singleObj.statement.length > 45 ? '...' : ''}`;

      initialInstruments = recommendInstrumentsForCompetency({
        competence: singleObj.competence,
        statement: singleObj.statement,
        contentScope: singleObj.contentScope,
        subject: academicSetting.subject,
      });

      initialCriterionIds = (assessmentCriteria || [])
        .filter((c) => c.tpId === singleObj.id)
        .map((c) => c.id);
    }

    const newPlan = createEmptyAssessmentPlan({
      academicSettingId: academicSetting.id,
      workspaceId: workspace?.id,
      title: initialTitle,
      purpose: resolvedPurpose,
      timing: resolvedTiming,
      scopeType: resolvedScope,
      tpIds: initialTpIds,
      criterionIds: initialCriterionIds,
      instruments: initialInstruments,
      displayLabel: presetAlias,
    });

    setFormTitle(initialTitle);
    setFormAlias(presetAlias || '');
    setFormPurpose(resolvedPurpose);
    setFormTiming(resolvedTiming);
    setFormCustomTiming('');
    setFormScope(resolvedScope);
    setFormCustomScope('');
    setFormTpIds(initialTpIds);
    setFormInstruments(initialInstruments);
    setFormCriterionIds(initialCriterionIds);
    setEditingPlan(newPlan);
    setAliasNotification(null);
    setIsModalOpen(true);
  };

  // Guard to track TP IDs provisioned during this component session to prevent in-flight duplicate calls
  const provisionedTpIdsRef = React.useRef<Set<string>>(new Set());

  // Automatic Assessment Draft Provisioning (AUTO GENERATE FIRST)
  // Ensures that whenever canonical TP/KD are present, missing AssessmentPlan DRAFTs are created automatically
  // without requiring the teacher to click any button. Idempotent and non-destructive.
  React.useEffect(() => {
    if (!academicSetting) return;
    if (isMerdeka(academicSetting) && !isMerdekaTpReady) return;

    // 1. Gather all canonical objective IDs
    const canonicalIds: string[] = [];
    if (isMerdeka(academicSetting) && tp?.items) {
      tp.items.forEach((item) => canonicalIds.push(item.id));
    } else if (isK13(academicSetting) && k13Analysis?.items) {
      k13Analysis.items.forEach((item) => canonicalIds.push(item.id));
    }

    if (canonicalIds.length === 0) return;

    // 2. Identify all objective IDs already represented in existing plans
    const representedIds = new Set<string>();
    (assessmentPlans || []).forEach((plan) => {
      (plan.tpIds || []).forEach((id) => {
        representedIds.add(id);
        provisionedTpIdsRef.current.add(id);
      });
    });

    // 3. Check if there are any canonical objectives not yet represented and not yet provisioned in-flight
    const unprovisionedIds = canonicalIds.filter(
      (id) => !representedIds.has(id) && !provisionedTpIdsRef.current.has(id)
    );

    if (unprovisionedIds.length === 0) return;

    // Immediately record unprovisioned IDs in the ref to prevent re-entrant or duplicate calls before async state flush
    unprovisionedIds.forEach((id) => provisionedTpIdsRef.current.add(id));

    // 4. Generate missing drafts using the canonical existing generator
    const newDrafts = generateAutoDraftPlansFromCanonicalContext({
      academicSetting,
      workspaceId: workspace?.id,
      tp,
      k13Analysis,
      assessmentCriteria,
      learningPlans,
      existingPlans: assessmentPlans,
    });

    if (newDrafts.length > 0) {
      newDrafts.forEach((draft) => {
        (draft.tpIds || []).forEach((id) => provisionedTpIdsRef.current.add(id));
        onSaveAssessmentPlan(draft);
      });
    }
  }, [
    academicSetting,
    isMerdekaTpReady,
    tp,
    k13Analysis,
    assessmentCriteria,
    learningPlans,
    assessmentPlans,
    workspace?.id,
    onSaveAssessmentPlan,
  ]);

  // Batch Auto-Draft from Canonical Context (Manual Sync / Recovery Action)
  const handleBatchAutoDraft = () => {
    if (isMerdeka(academicSetting) && !isMerdekaTpReady) {
      alert('TP kanonikal belum SIAP atau masih perlu review. Rencana Asesmen baru dapat dibuat setelah TP dikonfirmasi siap.');
      return;
    }

    const newDrafts = generateAutoDraftPlansFromCanonicalContext({
      academicSetting,
      workspaceId: workspace?.id,
      tp,
      k13Analysis,
      assessmentCriteria,
      learningPlans,
      existingPlans: assessmentPlans,
    });

    if (newDrafts.length === 0) {
      alert('Semua TP/KD sudah memiliki Rencana Asesmen.');
      return;
    }

    newDrafts.forEach((draft) => {
      (draft.tpIds || []).forEach((id) => provisionedTpIdsRef.current.add(id));
      onSaveAssessmentPlan(draft);
    });
  };

  // Handle Open Edit
  const handleOpenEdit = (plan: AssessmentPlan) => {
    setEditingPlan(plan);
    setFormTitle(plan.title);
    setFormAlias(plan.displayLabel || '');
    setFormPurpose(plan.purpose);
    setFormTiming(plan.timing);
    setFormCustomTiming(plan.customTimingLabel || '');
    setFormScope(plan.scopeType);
    setFormCustomScope(plan.customScopeLabel || '');
    setFormTpIds(plan.tpIds || []);
    setFormCriterionIds(plan.criterionIds || []);
    setFormInstruments(plan.instruments || []);
    setAliasNotification(null);
    setIsModalOpen(true);
  };

  // Run Alias Resolver on Form Input
  const handleResolveAliasInput = () => {
    if (!formAlias.trim()) return;
    const res = resolveAssessmentAlias(formAlias, { tpCount: formTpIds.length });
    if (res.status === 'RESOLVED') {
      if (res.purpose) setFormPurpose(res.purpose);
      if (res.timing) setFormTiming(res.timing);
      if (res.scopeType) setFormScope(res.scopeType);
      setAliasNotification(`Terdeteksi: ${res.displayLabel} (${res.purpose} • ${res.timing} • ${res.scopeType})`);
    } else if (res.status === 'AMBIGUOUS') {
      setAliasNotification(`Perhatian: ${res.reason}`);
    } else {
      setAliasNotification(`Informasi: ${res.reason}`);
    }
  };

  // Toggle Instrument Checkbox
  const handleToggleInstrument = (type: AssessmentInstrumentType, label: string) => {
    const exists = formInstruments.some((i) => i.type === type);
    if (exists) {
      setFormInstruments(formInstruments.filter((i) => i.type !== type));
    } else {
      setFormInstruments([
        ...formInstruments,
        { id: `inst-${Date.now()}-${type}`, type, label },
      ]);
    }
  };

  // Toggle TP Checkbox
  const handleToggleTp = (tpId: string) => {
    let nextTpIds: string[];
    if (formTpIds.includes(tpId)) {
      nextTpIds = formTpIds.filter((id) => id !== tpId);
    } else {
      nextTpIds = [...formTpIds, tpId];
    }
    setFormTpIds(nextTpIds);

    // If exactly 1 TP is selected, auto-link its criteria and suggest instruments if empty
    if (nextTpIds.length === 1) {
      const targetObj = availableObjectives.find((o) => o.id === nextTpIds[0]);
      if (targetObj) {
        // Auto-link criteria
        const matchingCrits = (assessmentCriteria || [])
          .filter((c) => c.tpId === targetObj.id)
          .map((c) => c.id);
        setFormCriterionIds(matchingCrits);

        // If instruments empty, recommend
        if (formInstruments.length === 0) {
          const recs = recommendInstrumentsForCompetency({
            competence: targetObj.competence,
            statement: targetObj.statement,
            contentScope: targetObj.contentScope,
            subject: academicSetting.subject,
          });
          setFormInstruments(recs);
        }

        // Suggest title if empty
        if (!formTitle.trim()) {
          setFormTitle(`Asesmen: [${targetObj.code}] ${targetObj.statement.slice(0, 45)}...`);
        }
      }
    }
  };

  // Toggle Criterion Checkbox
  const handleToggleCriterion = (criterionId: string) => {
    if (formCriterionIds.includes(criterionId)) {
      setFormCriterionIds(formCriterionIds.filter((id) => id !== criterionId));
    } else {
      setFormCriterionIds([...formCriterionIds, criterionId]);
    }
  };

  // Live Validation Object
  const currentFormPlan: AssessmentPlan = {
    id: editingPlan?.id || `asp-${Date.now()}`,
    academicSettingId: academicSetting.id,
    workspaceId: workspace?.id,
    title: formTitle,
    purpose: formPurpose,
    timing: formTiming,
    scopeType: formScope,
    tpIds: formTpIds,
    criterionIds: formCriterionIds,
    instruments: formInstruments,
    displayLabel: formAlias,
    customTimingLabel: formCustomTiming,
    customScopeLabel: formCustomScope,
    workflowStatus: 'DRAFT',
    createdAt: editingPlan?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const validationResult = validateAssessmentPlan(currentFormPlan, {
    academicSetting,
    tp,
    k13Analysis,
    assessmentCriteria,
    learningPlans,
  });

  // Save Draft
  const handleSaveDraft = () => {
    if (!formTitle.trim()) return;
    const planToSave: AssessmentPlan = {
      ...currentFormPlan,
      workflowStatus: 'DRAFT',
      needsReview: false,
      reviewReason: undefined,
    };
    onSaveAssessmentPlan(planToSave);
    setIsModalOpen(false);
  };

  // Confirm SIAP
  const handleConfirmSiap = () => {
    const res = confirmAssessmentPlan(currentFormPlan, {
      academicSetting,
      tp,
      k13Analysis,
      assessmentCriteria,
      learningPlans,
    });
    if (res.success) {
      onSaveAssessmentPlan(res.plan);
      setIsModalOpen(false);
    }
  };

  // Migrate Legacy Assessments
  const handleMigrateLegacy = () => {
    if (!assessments || assessments.length === 0) return;
    let count = 0;
    assessments.forEach((legacy) => {
      const migrated = migrateLegacyAssessment(legacy, { academicSetting, tp, k13Analysis, assessmentCriteria }, assessmentPlans);
      onSaveAssessmentPlan(migrated);
      count++;
    });
    alert(`Berhasil memigrasikan ${count} perangkat asesmen legacy ke dalam Assessment Master.`);
  };

  // Filtered Assessment Plans
  const filteredPlans = assessmentPlans.filter((plan) => {
    const matchesSearch =
      plan.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (plan.displayLabel && plan.displayLabel.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || plan.workflowStatus === statusFilter;
    const matchesPurpose = purposeFilter === 'ALL' || plan.purpose === purposeFilter;
    return matchesSearch && matchesStatus && matchesPurpose;
  });

  const stats = {
    total: assessmentPlans.length,
    draft: assessmentPlans.filter((p) => p.workflowStatus === 'DRAFT').length,
    perluDilengkapi: assessmentPlans.filter((p) => p.workflowStatus === 'PERLU_DILENGKAPI').length,
    siap: assessmentPlans.filter((p) => p.workflowStatus === 'SIAP').length,
  };

  return (
    <div className="space-y-6" id="assessment-plan-manager">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs tracking-wider uppercase mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Assessment Master — Fondasi Perangkat Penilaian</span>
            </div>
            <h2 className="text-2xl font-bold text-white">Perencanaan & Perangkat Asesmen</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Perencanaan perangkat asesmen yang terhubung dengan tujuan pembelajaran dan kriteria ketercapaian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleBatchAutoDraft}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              title="Sinkronisasi manual untuk TP/KD yang belum memiliki Rencana Asesmen"
            >
              <Sparkles className="w-4 h-4" />
              <span>
                Draf Otomatis
                {availableObjectives.length > 0 ? ` (${availableObjectives.length} ${isMerdeka(academicSetting) ? 'TP' : 'KD'})` : ''}
              </span>
            </button>
            <button
              type="button"
              onClick={() => handleOpenNew()}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Rencana Asesmen</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-slate-400">Total Perangkat</div>
            <div className="text-xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-amber-400">Status DRAFT</div>
            <div className="text-xl font-bold text-amber-300 mt-1">{stats.draft}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-rose-400">Perlu Dilengkapi</div>
            <div className="text-xl font-bold text-rose-300 mt-1">{stats.perluDilengkapi}</div>
          </div>
          <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/50">
            <div className="text-xs text-emerald-400">Siap Diterapkan</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">{stats.siap}</div>
          </div>
        </div>
      </div>

      {/* Operational Launcher & Quick Actions */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="w-4 h-4 text-indigo-500" />
          <span>Quick Launcher Nomenklatur Asesmen</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            'Ulangan Harian (UH)',
            'Pre-test / Diagnostik Awal',
            'PTS / UTS (Tengah Semester)',
            'PAS / SAS (Akhir Semester)',
            'Sumatif Akhir Tahun (PAT)',
            'Ujian Sekolah (US)',
          ].map((alias) => (
            <button
              key={alias}
              onClick={() => handleOpenNew(alias)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-medium border border-slate-200 transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-500" />
              <span>{alias}</span>
            </button>
          ))}
        </div>

        {/* Migration Alert */}
        {assessments && assessments.length > 0 && (
          <div className="mt-4 p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Terdeteksi <strong>{assessments.length}</strong> asesmen legacy. Anda dapat memigrasikan data tersebut ke dalam Assessment Master tanpa menghapus nilai siswa.
              </span>
            </div>
            <button
              onClick={handleMigrateLegacy}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg shrink-0 transition-colors"
            >
              Migrasikan Sekarang
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari judul / alias asesmen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter:</span>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border border-slate-200 rounded-xl text-xs px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="ALL">Semua Status</option>
            <option value="DRAFT">Status DRAFT</option>
            <option value="PERLU_DILENGKAPI">Perlu Dilengkapi</option>
            <option value="SIAP">Status SIAP</option>
          </select>

          <select
            value={purposeFilter}
            onChange={(e) => setPurposeFilter(e.target.value as any)}
            className="border border-slate-200 rounded-xl text-xs px-2.5 py-1.5 bg-slate-50 text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
          >
            <option value="ALL">Semua Fungsi</option>
            <option value="FORMATIVE">Formatif</option>
            <option value="SUMMATIVE">Sumatif</option>
          </select>
        </div>
      </div>

      {/* Assessment Plans List */}
      {filteredPlans.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200">
          <FileCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Belum Ada Rencana Asesmen</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {availableObjectives.length > 0
              ? `Tersedia ${availableObjectives.length} ${isMerdeka(academicSetting) ? 'Tujuan Pembelajaran' : 'Kompetensi Dasar'} kanonikal. Anda dapat meng-generate seluruh draf rencana asesmen secara otomatis atau membuatnya secara manual.`
              : 'Belum ada data tujuan pembelajaran kanonikal. Silakan lengkapi TP/KD terlebih dahulu.'}
          </p>
          {availableObjectives.length > 0 && (
            <div className="mt-5 flex justify-center gap-3">
              <button
                type="button"
                onClick={handleBatchAutoDraft}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Draf Otomatis ({availableObjectives.length} {isMerdeka(academicSetting) ? 'TP' : 'KD'})</span>
              </button>
              <button
                type="button"
                onClick={() => handleOpenNew()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Manual</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPlans.map((plan) => {
            const isSiap = plan.workflowStatus === 'SIAP';
            const isDraft = plan.workflowStatus === 'DRAFT';

            return (
              <div
                key={plan.id}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between space-y-4"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                          plan.purpose === 'FORMATIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                        }`}
                      >
                        {plan.purpose === 'FORMATIVE' ? 'Formatif' : 'Sumatif'}
                      </span>
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        {plan.timing}
                      </span>
                      <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
                        {plan.scopeType}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        isSiap
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isDraft
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}
                    >
                      {plan.workflowStatus}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug">{plan.title}</h3>
                  {plan.displayLabel && (
                    <div className="text-xs text-indigo-600 font-medium mt-0.5">
                      Alias: {plan.displayLabel}
                    </div>
                  )}

                  {/* Target TPs / KDs */}
                  <div className="mt-3 text-xs text-slate-600">
                    <span className="font-medium text-slate-700">Target TP/KD:</span>
                    {plan.tpIds && plan.tpIds.length > 0 ? (
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-600 text-[11px]">
                        {plan.tpIds.map((id) => {
                          const obj = availableObjectives.find((o) => o.id === id);
                          return (
                            <li key={id} className="truncate">
                              <strong>{obj?.code || id}:</strong> {obj?.statement || id}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="text-slate-400 italic ml-1">(Belum memilih TP/KD)</span>
                    )}
                  </div>

                  {/* Instruments */}
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {plan.instruments.map((inst) => (
                      <span
                        key={inst.id}
                        className="text-[10px] bg-slate-50 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-md"
                      >
                        {inst.label || inst.type}
                      </span>
                    ))}
                  </div>

                  {/* KKTP Info */}
                  <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="font-medium text-slate-600">Kriteria KKTP:</span>
                    {plan.criterionIds && plan.criterionIds.length > 0 ? (
                      <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-medium">
                        {plan.criterionIds.length} kriteria terhubung
                      </span>
                    ) : (
                      <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        Belum ditautkan
                      </span>
                    )}
                  </div>

                  {/* Needs Review Alert */}
                  {plan.needsReview && (
                    <div className="mt-3 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Perlu Ditinjau:</strong> {plan.reviewReason || 'Perangkat memerlukan perhatian guru.'}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[11px] text-slate-400">
                    Revisi {plan.revision || 1}
                  </span>
                  <div className="flex items-center gap-2">
                    {isDraft ? (
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="px-3 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Tinjau spesifikasi asesmen dan konfirmasi SIAP"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Tinjau & Siapkan</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleOpenEdit(plan)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    <button
                      onClick={() => onDeleteAssessmentPlan(plan.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                      title="Hapus"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Editor Modal / Drawer */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="p-5 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {editingPlan?.createdAt ? 'Edit Perangkat Asesmen' : 'Buat Perangkat Asesmen Baru'}
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Lengkapi spesifikasi kanonikal perangkat penilaian guru
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
              {/* Title Input */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Judul Perangkat Asesmen *</label>
                <input
                  type="text"
                  placeholder="Contoh: Sumatif Lingkup Materi 1 - Teks Laporan Hasil Observasi"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {/* Alias / Nomenclature Input */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Nomenklatur / Display Alias</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Contoh: Ulangan Harian 1, PTS, Pre-Test"
                    value={formAlias}
                    onChange={(e) => setFormAlias(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={handleResolveAliasInput}
                    className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-xl text-xs border border-indigo-200 transition-colors"
                  >
                    Uji Pemetaan
                  </button>
                </div>
                {aliasNotification && (
                  <p className="text-[11px] text-indigo-600 font-medium mt-1">{aliasNotification}</p>
                )}
              </div>

              {/* Purpose & Timing Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Purpose */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-800">Fungsi Asesmen (Purpose) *</label>
                  <select
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value as AssessmentPurpose)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="FORMATIVE">FORMATIVE (Formatif)</option>
                    <option value="SUMMATIVE">SUMMATIVE (Sumatif)</option>
                  </select>
                </div>

                {/* Timing */}
                <div className="space-y-1">
                  <label className="font-semibold text-slate-800">Waktu Pelaksanaan (Timing) *</label>
                  <select
                    value={formTiming}
                    onChange={(e) => setFormTiming(e.target.value as AssessmentTiming)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  >
                    <option value="PRE">PRE (Awal Pembelajaran / Pre-test)</option>
                    <option value="DURING">DURING (Proses Pembelajaran)</option>
                    <option value="POST">POST (Akhir Pembelajaran / Post-test)</option>
                    <option value="MID_SEMESTER">MID_SEMESTER (Tengah Semester / PTS)</option>
                    <option value="END_SEMESTER">END_SEMESTER (Akhir Semester / PAS)</option>
                    <option value="END_YEAR">END_YEAR (Akhir Tahun / PAT)</option>
                    <option value="END_LEVEL">END_LEVEL (Akhir Jenjang / Ujian Sekolah)</option>
                    <option value="CUSTOM">CUSTOM (Kustom)</option>
                  </select>
                  {formTiming === 'CUSTOM' && (
                    <input
                      type="text"
                      placeholder="Tuliskan label waktu kustom..."
                      value={formCustomTiming}
                      onChange={(e) => setFormCustomTiming(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                    />
                  )}
                </div>
              </div>

              {/* Scope Selection */}
              <div className="space-y-1">
                <label className="font-semibold text-slate-800">Cakupan Asesmen (Scope) *</label>
                <select
                  value={formScope}
                  onChange={(e) => setFormScope(e.target.value as AssessmentScopeType)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                >
                  <option value="TP">TP (Tujuan Pembelajaran Tunggal)</option>
                  <option value="MULTI_TP">MULTI_TP (Beberapa TP Lintas Materi)</option>
                  <option value="UNIT">UNIT (Lingkup Modul / Unit)</option>
                  <option value="SEMESTER">SEMESTER (Seluruh Materi Semester)</option>
                  <option value="YEAR">YEAR (Seluruh Materi Tahun Ajaran)</option>
                  <option value="LEVEL">LEVEL (Seluruh Jenjang)</option>
                  <option value="CUSTOM">CUSTOM (Kustom)</option>
                </select>
                {formScope === 'CUSTOM' && (
                  <input
                    type="text"
                    placeholder="Tuliskan label cakupan kustom..."
                    value={formCustomScope}
                    onChange={(e) => setFormCustomScope(e.target.value)}
                    className="w-full mt-1 px-3 py-1.5 border border-slate-300 rounded-lg text-xs"
                  />
                )}
              </div>

              {/* Non-blocking Calendar Indicator */}
              <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl text-[11px] text-blue-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  Jadwal dan alokasi waktu pelaksanaan asesmen dapat disesuaikan secara fleksibel setelah kalender/ATP final. Ketiadaan kalender waktu tidak menghalangi pembuatan draf rencana asesmen.
                </span>
              </div>

              {/* Target TPs Checkboxes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Target Tujuan Pembelajaran (TP / KD) *</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      Kanonikal TP
                    </span>
                  </label>
                  {availableObjectives.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      {formTpIds.length} dari {availableObjectives.length} dipilih
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500">
                  Pilih TP kanonikal yang diukur. Guru memiliki kontrol penuh untuk menentukan TP target.
                </p>
                {availableObjectives.length === 0 ? (
                  <p className="text-xs text-rose-500 italic">
                    Belum ada data TP/KD pada alur hulu. Selesaikan perancangan TP terlebih dahulu.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1.5 bg-slate-50">
                    {availableObjectives.map((obj) => (
                      <label
                        key={obj.id}
                        className="flex items-start gap-2 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formTpIds.includes(obj.id)}
                          onChange={() => handleToggleTp(obj.id)}
                          className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-800 leading-snug">
                          <strong>{obj.code}:</strong> {obj.statement}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* KKTP Criteria Checkboxes */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Kriteria Ketercapaian (KKTP) Terkait</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      Kanonikal KKTP
                    </span>
                  </label>
                  {formTpIds.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      {formCriterionIds.length} kriteria ditautkan
                    </span>
                  )}
                </div>
                {formTpIds.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    Pilih TP terlebih dahulu untuk menampilkan kriteria ketercapaian yang relevan.
                  </p>
                ) : (
                  (() => {
                    const relevantCriteria = (assessmentCriteria || []).filter((c) =>
                      formTpIds.includes(c.tpId)
                    );
                    if (relevantCriteria.length === 0) {
                      return (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800">
                          KKTP belum dirumuskan untuk TP ini. Rencana tetap dapat disimpan sebagai DRAFT, namun disarankan merumuskan KKTP sebelum konfirmasi SIAP.
                        </div>
                      );
                    }
                    return (
                      <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-2.5 space-y-1 bg-slate-50">
                        {relevantCriteria.map((crit) => (
                          <label
                            key={crit.id}
                            className="flex items-start gap-2 p-1 hover:bg-white rounded-md cursor-pointer transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={formCriterionIds.includes(crit.id)}
                              onChange={() => handleToggleCriterion(crit.id)}
                              className="mt-0.5 rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="text-[11px] text-slate-700 leading-tight">
                              <span className="font-semibold uppercase text-slate-500 text-[10px] mr-1">
                                [{crit.approach}]
                              </span>
                              {crit.description}
                            </div>
                          </label>
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Instruments Checkbox Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 flex items-center gap-1.5">
                    <span>Bentuk & Instrumen Asesmen *</span>
                    <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      Rekomendasi / Input Guru
                    </span>
                  </label>
                  {formTpIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        const selectedObjs = availableObjectives.filter((o) => formTpIds.includes(o.id));
                        if (selectedObjs.length > 0) {
                          const combinedCompetence = selectedObjs.map((o) => o.competence).filter(Boolean).join('; ');
                          const combinedStatement = selectedObjs.map((o) => o.statement).filter(Boolean).join('; ');
                          const combinedScope = selectedObjs.map((o) => o.contentScope).filter(Boolean).join('; ');
                          const recs = recommendInstrumentsForCompetency({
                            competence: combinedCompetence,
                            statement: combinedStatement,
                            contentScope: combinedScope,
                            subject: academicSetting.subject,
                          });
                          setFormInstruments(recs);
                        }
                      }}
                      className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-indigo-500" />
                      <span>Rekomendasikan dari Kompetensi TP</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2.5 bg-slate-50">
                  {INSTRUMENT_OPTIONS.map((inst) => (
                    <label
                      key={inst.type}
                      className="flex items-center gap-2 p-1 hover:bg-white rounded-md cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={formInstruments.some((i) => i.type === inst.type)}
                        onChange={() => handleToggleInstrument(inst.type, inst.label)}
                        className="rounded-sm border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-xs text-slate-700">{inst.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Validation Box */}
              {validationResult.errors.length > 0 && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-rose-800">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600" />
                    <span>Perlu Dilengkapi sebelum Status SIAP:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 text-rose-700">
                    {validationResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
              >
                Batal
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl transition-colors"
                >
                  Simpan DRAFT
                </button>
                <button
                  type="button"
                  disabled={!validationResult.valid}
                  onClick={handleConfirmSiap}
                  className={`px-4 py-2 text-white text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                    validationResult.valid
                      ? 'bg-emerald-600 hover:bg-emerald-500 cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Konfirmasi SIAP</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
