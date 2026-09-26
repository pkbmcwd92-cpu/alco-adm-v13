import {
  AssessmentAllocationUnit,
  AssessmentAnswerKey,
  AssessmentAnswerType,
  AssessmentBlueprintItem,
  AssessmentCoverageUnit,
  AssessmentDifficultyTarget,
  AssessmentEvidenceType,
  AssessmentGeneratedContentSource,
  AssessmentGenerationContract,
  AssessmentGenerationContractUnit,
  AssessmentGenerationIssue,
  AssessmentGenerationPlan,
  AssessmentGenerationResult,
  AssessmentGenerationResultStatus,
  AssessmentGenerationSource,
  AssessmentGenerationSpec,
  AssessmentInstrument,
  AssessmentInstrumentType,
  AssessmentPackage,
  AssessmentRubric,
  AssessmentScoringGuide,
  AssessmentStimulusOrigin,
  AssessmentStimulusType,
  AssessmentTeacherContext,
  AssessmentAIGenerationProvider,
  AssessmentAIGenerationRawResponse,
  AssessmentAIGenerationRequest,
  CategoryResponseCategory,
  CategoryResponseStatement,
  CognitiveDemand,
  GenerateAssessmentPackageInput,
  GeneratedAssessmentUnit,
  GeneratedEvidenceUnit,
  GeneratedItemUnit,
  GeneratedObservationUnit,
  GeneratedTaskUnit,
  MatchingAssessmentEntry,
  ObservationAspect,
  OralAssessmentItem,
  PerformanceAspect,
  RubricCriterion,
  RubricScaleLevel,
  SelfPeerAssessmentInstrument,
  SelfPeerAssessmentItem,
  WrittenAssessmentItem,
  WrittenAssessmentItemType,
  WrittenAssessmentOption,
} from '../types';

const VALID_INSTRUMENT_TYPES: Set<AssessmentInstrumentType> = new Set([
  'WRITTEN_TEST',
  'ORAL_TEST',
  'PERFORMANCE',
  'OBSERVATION',
  'ASSIGNMENT',
  'PROJECT',
  'PRODUCT',
  'PORTFOLIO',
  'SELF_ASSESSMENT',
  'PEER_ASSESSMENT',
]);

const VALID_WRITTEN_ITEM_TYPES: Set<WrittenAssessmentItemType> = new Set([
  'MULTIPLE_CHOICE',
  'MULTIPLE_SELECT',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'ESSAY',
  'MATCHING',
  'CATEGORY_RESPONSE',
]);

// ==========================================
// DETERMINISTIC ID GENERATORS
// ==========================================

export function createDeterministicBlueprintId(
  packageId: string,
  coverageUnitId: string
): string {
  const cleanPkg = (packageId || 'pkg').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCov = (coverageUnitId || 'cov').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `bp:${cleanPkg}:${cleanCov}`;
}

export function createDeterministicInstrumentId(
  packageId: string,
  instrumentType: AssessmentInstrumentType
): string {
  const cleanPkg = (packageId || 'pkg').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanType = (instrumentType || 'inst').trim().toLowerCase().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `inst:${cleanPkg}:${cleanType}`;
}

export function createDeterministicItemId(
  instrumentId: string,
  index: number
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `item:${cleanInst}:${index + 1}`;
}

export function createDeterministicOptionId(
  itemId: string,
  optionIndex: number
): string {
  const cleanItem = (itemId || 'item').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const optLetter = String.fromCharCode(65 + (optionIndex % 26));
  return `opt:${cleanItem}:${optLetter}`;
}

export function createDeterministicAspectId(
  instrumentId: string,
  index: number
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `asp:${cleanInst}:${index + 1}`;
}

export function createDeterministicAnswerKeyId(
  instrumentId: string,
  itemId: string
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanItem = (itemId || 'item').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `ans:${cleanInst}:${cleanItem}`;
}

export function createDeterministicRubricId(
  instrumentId: string,
  index: number
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `rubric:${cleanInst}:${index + 1}`;
}

export function createDeterministicScoringGuideId(
  instrumentId: string,
  itemIdOrInstId: string
): string {
  const cleanInst = (instrumentId || 'inst').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanRef = (itemIdOrInstId || 'main').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return `sg:${cleanInst}:${cleanRef}`;
}

// ==========================================
// PRE-GENERATION GUARDS
// ==========================================

export interface PreGenerationGuardResult {
  valid: boolean;
  issues: AssessmentGenerationIssue[];
}

export function resolveAuthoritativeAcademicSettingId(
  input?: Partial<GenerateAssessmentPackageInput>
): string | undefined {
  if (
    input?.academicSettingId &&
    typeof input.academicSettingId === 'string' &&
    input.academicSettingId.trim() !== ''
  ) {
    return input.academicSettingId.trim();
  }
  if (
    input?.existingPackage?.academicSettingId &&
    typeof input.existingPackage.academicSettingId === 'string' &&
    input.existingPackage.academicSettingId.trim() !== ''
  ) {
    return input.existingPackage.academicSettingId.trim();
  }
  const planAny = input?.generationPlan as any;
  if (
    planAny?.academicSettingId &&
    typeof planAny.academicSettingId === 'string' &&
    planAny.academicSettingId.trim() !== ''
  ) {
    return planAny.academicSettingId.trim();
  }
  const specAny = input?.generationPlan?.generationSpec as any;
  if (
    specAny?.academicSettingId &&
    typeof specAny.academicSettingId === 'string' &&
    specAny.academicSettingId.trim() !== ''
  ) {
    return specAny.academicSettingId.trim();
  }
  return undefined;
}

export function validatePreGenerationGuards(
  input: GenerateAssessmentPackageInput
): PreGenerationGuardResult {
  const issues: AssessmentGenerationIssue[] = [];

  // 1. Missing Input or Plan
  if (!input || !input.generationPlan) {
    issues.push({
      code: 'PLAN_MISSING',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationPlan wajib disertakan untuk generasi paket asesmen.',
    });
    return { valid: false, issues };
  }

  const plan = input.generationPlan;

  // 2. Plan Resolution Status BLOCKED
  if (plan.resolution?.status === 'BLOCKED') {
    issues.push({
      code: 'PLAN_BLOCKED',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationPlan berstatus BLOCKED dan tidak dapat dilanjutkan ke generasi AI.',
    });
  }

  // 3. Missing GenerationSpec
  if (!plan.generationSpec) {
    issues.push({
      code: 'SPEC_MISSING',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationSpec pada GenerationPlan tidak tersedia atau kosong.',
    });
    return { valid: false, issues };
  }

  const spec = plan.generationSpec;

  // 4. Spec Resolution Status BLOCKED
  if (spec.resolution?.status === 'BLOCKED') {
    issues.push({
      code: 'SPEC_BLOCKED',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationSpec berstatus BLOCKED dan tidak dapat dilanjutkan ke generasi AI.',
    });
  }

  // 5. Academic Setting ID Resolution Guard (Fail-closed on unresolved / empty)
  const resolvedSettingId = resolveAuthoritativeAcademicSettingId(input);
  if (!resolvedSettingId) {
    issues.push({
      code: 'ACADEMIC_SETTING_ID_UNRESOLVED',
      severity: 'BLOCKING',
      message: 'ID AcademicSetting kanonikal tidak ditemukan atau tidak valid. Generasi dibatalkan demi integritas data.',
    });
  }

  // 6. Coverage Units Checks
  if (!plan.coverageUnits || plan.coverageUnits.length === 0) {
    issues.push({
      code: 'NO_COVERAGE_UNITS',
      severity: 'BLOCKING',
      message: 'AssessmentGenerationPlan tidak memiliki coverage unit untuk digenerasi.',
    });
    return { valid: false, issues };
  }

  const validObjectiveIds = new Set((spec.objectives || []).map((o) => o.id));
  const criteriaMap = new Map((spec.criteria || []).map((c) => [c.id, c]));

  plan.coverageUnits.forEach((unit, idx) => {
    // Blocked Unit
    if (unit.status === 'BLOCKED') {
      issues.push({
        code: 'COVERAGE_UNIT_BLOCKED',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} (${unit.id}) berstatus BLOCKED.`,
        objectiveRefId: unit.objectiveRefId,
        criterionId: unit.criterionId,
      });
    }

    // Objective Reference Check
    if (!unit.objectiveRefId || !validObjectiveIds.has(unit.objectiveRefId)) {
      issues.push({
        code: 'UNRESOLVED_OBJECTIVE_REF',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} merujuk pada objectiveRefId [${unit.objectiveRefId}] yang tidak ditemukan pada GenerationSpec.`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Criterion Reference Check
    if (unit.criterionId) {
      const crit = criteriaMap.get(unit.criterionId);
      if (!crit) {
        issues.push({
          code: 'DANGLING_CRITERION_REF',
          severity: 'BLOCKING',
          message: `Coverage unit #${idx + 1} merujuk pada criterionId [${unit.criterionId}] yang tidak ditemukan pada GenerationSpec.`,
          objectiveRefId: unit.objectiveRefId,
          criterionId: unit.criterionId,
        });
      } else if (crit.objectiveRefId !== unit.objectiveRefId) {
        issues.push({
          code: 'CRITERION_OBJECTIVE_MISMATCH',
          severity: 'BLOCKING',
          message: `Coverage unit #${idx + 1} merujuk pada criterionId [${unit.criterionId}] yang terhubung ke objective berbeda [${crit.objectiveRefId}].`,
          objectiveRefId: unit.objectiveRefId,
          criterionId: unit.criterionId,
        });
      }
    }

    // Instrument Type Check
    if (!unit.instrumentType || !VALID_INSTRUMENT_TYPES.has(unit.instrumentType)) {
      issues.push({
        code: 'UNRESOLVED_INSTRUMENT_TYPE',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} memiliki tipe instrumen yang belum terselesaikan atau tidak valid [${unit.instrumentType}].`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Allocation Unit Check
    if (!unit.allocationUnit) {
      issues.push({
        code: 'UNRESOLVED_ALLOCATION_UNIT',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} belum memiliki allocationUnit yang terselesaikan.`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Required Count Check
    if (
      unit.recommendedCount === undefined ||
      typeof unit.recommendedCount !== 'number' ||
      !Number.isFinite(unit.recommendedCount) ||
      !Number.isInteger(unit.recommendedCount) ||
      unit.recommendedCount <= 0
    ) {
      issues.push({
        code: 'INVALID_UNIT_COUNT',
        severity: 'BLOCKING',
        message: `Coverage unit #${idx + 1} memiliki unit count tidak valid [${unit.recommendedCount}] (harus integer >= 1).`,
        objectiveRefId: unit.objectiveRefId,
      });
    }

    // Structural ambiguity in unit issues
    if (unit.issues && unit.issues.some((i) => i.severity === 'BLOCKING')) {
      unit.issues
        .filter((i) => i.severity === 'BLOCKING')
        .forEach((bi) => {
          issues.push(bi);
        });
    }
  });

  // 7. Existing Package Protection Check
  if (input.existingPackage) {
    const existing = input.existingPackage;
    if (existing.workflowStatus === 'SIAP') {
      issues.push({
        code: 'EXISTING_PACKAGE_CONFIRMED_SIAP',
        severity: 'BLOCKING',
        message: 'Paket asesmen yang sudah berstatus SIAP tidak dapat ditimpa otomatis oleh generasi AI awal (gunakan alur revisi terkontrol).',
      });
    } else if (existing.provenance?.generatedBy === 'USER') {
      if (
        (existing.instruments && existing.instruments.length > 0) ||
        (existing.blueprintItems && existing.blueprintItems.length > 0)
      ) {
        issues.push({
          code: 'EXISTING_PACKAGE_TEACHER_PROTECTED',
          severity: 'BLOCKING',
          message: 'Paket asesmen berisi konten yang telah dibuat/diubah oleh guru dan tidak boleh ditimpa secara silent.',
        });
      }
    }
  }

  // 8. Structural review check on plan
  if (plan.resolution?.status === 'NEEDS_REVIEW') {
    const structuralIssues = (plan.resolution?.issues || []).filter(
      (iss) =>
        iss.code === 'INSTRUMENT_RESOLUTION_AMBIGUOUS' ||
        iss.code === 'MULTIPLE_PLANNED_INSTRUMENTS' ||
        iss.code === 'NO_COMMON_INSTRUMENTS'
    );
    if (structuralIssues.length > 0) {
      issues.push({
        code: 'STRUCTURAL_AMBIGUITY_BLOCKS_GENERATION',
        severity: 'BLOCKING',
        message: 'Ambiguity struktural pada instrumen menghalangi generasi AI yang deterministik.',
      });
    }
  }

  const hasBlocking = issues.some((iss) => iss.severity === 'BLOCKING');
  return { valid: !hasBlocking, issues };
}

// ==========================================
// GENERATION CONTRACT BUILDER
// ==========================================

export function buildGenerationContract(
  plan: AssessmentGenerationPlan,
  teacherContext?: AssessmentTeacherContext,
  sourceMaterials?: AssessmentGenerationSource[],
  academicSettingId?: string
): AssessmentGenerationContract {
  const spec = plan.generationSpec!;
  const resolvedSettingId =
    academicSettingId || resolveAuthoritativeAcademicSettingId({ generationPlan: plan }) || '';

  const objMap = new Map((spec.objectives || []).map((o) => [o.id, o]));
  const critMap = new Map((spec.criteria || []).map((c) => [c.id, c]));

  const units: AssessmentGenerationContractUnit[] = plan.coverageUnits.map((cov) => {
    const obj = objMap.get(cov.objectiveRefId);
    const crit = cov.criterionId ? critMap.get(cov.criterionId) : undefined;

    const objectiveText = obj ? obj.text : '';
    const criterionText = crit
      ? crit.description
        ? `${crit.name}: ${crit.description}`
        : crit.name
      : undefined;

    const assessmentIndicator =
      typeof cov.assessmentIndicator === 'string' && cov.assessmentIndicator.trim()
        ? cov.assessmentIndicator.trim()
        : undefined;

    const indicatorSource: AssessmentGeneratedContentSource | undefined = assessmentIndicator
      ? ((cov as any).indicatorSource || 'TEACHER')
      : undefined;

    const materialOrContext =
      typeof cov.materialOrContext === 'string' && cov.materialOrContext.trim()
        ? cov.materialOrContext.trim()
        : undefined;

    const materialSource: AssessmentGeneratedContentSource | undefined = materialOrContext
      ? ((cov as any).materialSource || 'TEACHER')
      : undefined;

    return {
      coverageUnitId: cov.id,
      objectiveRefId: cov.objectiveRefId,
      criterionId: cov.criterionId,
      objectiveText,
      criterionText,
      instrumentType: cov.instrumentType!,
      allocationUnit: cov.allocationUnit!,
      requiredCount: cov.recommendedCount || 1,
      cognitiveDemand: cov.cognitiveDemand,
      stimulusType: cov.stimulusType,
      difficultyTarget: cov.difficultyTarget,
      assessmentIndicator,
      materialOrContext,
      indicatorSource,
      materialSource,
    };
  });

  return {
    assessmentPlanId: spec.assessmentPlanId,
    assessmentPackageId: spec.assessmentPackageId,
    academicSettingId: resolvedSettingId,
    curriculumContext: spec.curriculumContext,
    gradeCalibration: spec.generationProfile?.gradeCalibration,
    subjectProfile: spec.subjectProfile,
    sourceContext: spec.sourceContext || [],
    units,
  };
}

// ==========================================
// PROMPT BUILDER
// ==========================================

export function buildGenerationPrompts(
  contract: AssessmentGenerationContract,
  teacherContext?: AssessmentTeacherContext,
  sourceMaterials?: AssessmentGenerationSource[]
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `Anda adalah Asisten Penulis Soal dan Asesmen Pembelajaran (AI Assessment Content Generator).
Peran Anda adalah menghasilkan draf butir asesmen (soal, tugas, rubrik, bukti, observasi) secara terstruktur berdasarkan kontrak yang telah disepakati.

ATURAN GENERASI KETAT:
1. AI ADALAH CONTENT GENERATOR, BUKAN RESOLVER:
   - JANGAN mengubah atau mengarang Tujuan Pembelajaran (TP) / Kompetensi Dasar (KD).
   - JANGAN mengubah atau mengarang kriteria KKTP.
   - coverageUnitId WAJIB dikembalikan pada setiap unit dan HARUS identik dengan coverageUnitId pada kontrak.
   - objectiveRefId, criterionId, instrumentType, dan allocationUnit adalah metadata canonical milik aplikasi dan BOLEH tidak diulang pada keluaran AI.
   - Jika objectiveRefId, criterionId, instrumentType, atau allocationUnit diulang oleh AI, nilainya HARUS identik dengan kontrak.
   - JANGAN mengubah jumlah butir/tugas (requiredCount). Hasilkan PERSIS sesuai requiredCount.
   - JANGAN mengklaim konten sintetis buatan AI sebagai dokumen resmi (OFFICIAL) atau regulasi pemerintah.
   - JANGAN menandai draf sebagai SIAP atau FINAL (seluruh keluaran adalah DRAFT).

2. SEMANTIK ALOKASI & KONTRAK FIELD OUTPUT:

   A. ITEM — WRITTEN_TEST
   Gunakan field:
   - coverageUnitId: WAJIB.
   - itemType: WAJIB. Pilihan valid: MULTIPLE_CHOICE, MULTIPLE_SELECT, TRUE_FALSE, SHORT_ANSWER, ESSAY, MATCHING, CATEGORY_RESPONSE.
   - prompt: WAJIB, berupa teks soal.
   - options: WAJIB untuk MULTIPLE_CHOICE dan MULTIPLE_SELECT, minimal 2 opsi.
   - stimulus: opsional.
   - proposedAnswer: opsional tetapi sangat dianjurkan jika jawaban dapat ditentukan.
   - scoringGuideDraft: gunakan bila bentuk soal memerlukan pedoman penskoran.

   Untuk pilihan ganda:
   {
     "coverageUnitId": "...",
     "itemType": "MULTIPLE_CHOICE",
     "prompt": "...",
     "options": [
       { "text": "...", "isCorrect": true },
       { "text": "...", "isCorrect": false }
     ]
   }

   B. ITEM — ORAL_TEST
   Gunakan field:
   - coverageUnitId: WAJIB.
   - itemType: gunakan SHORT_ANSWER atau ESSAY.
   - prompt: WAJIB, berupa pertanyaan lisan.
   - proposedAnswer: opsional sebagai respons yang diharapkan.
   JANGAN mengubah tes lisan menjadi MULTIPLE_CHOICE kecuali kontrak/konteks secara eksplisit memerlukannya.

   C. ITEM — SELF_ASSESSMENT / PEER_ASSESSMENT
   Gunakan field:
   - coverageUnitId: WAJIB.
   - itemType: WAJIB, gunakan SHORT_ANSWER sebagai transport-compatible itemType.
   - prompt: WAJIB, berupa pernyataan (statement) penilaian diri atau penilaian antar-teman (refleksi/perilaku/sikap murid), bukan soal akademik yang memiliki satu jawaban benar.
   - proposedAnswer tidak diperlukan (dilarang membuat kunci jawaban atau correct answer).
   - jangan membuat pedoman penskoran atau kunci jawaban untuk SELF_ASSESSMENT atau PEER_ASSESSMENT.

   Contoh Penilaian Diri:
   {
     "coverageUnitId": "...",
     "itemType": "SHORT_ANSWER",
     "prompt": "Saya dapat menjelaskan bagian yang sudah saya kuasai."
   }

   Contoh Penilaian Antar-Teman:
   {
     "coverageUnitId": "...",
     "itemType": "SHORT_ANSWER",
     "prompt": "Teman saya berkontribusi aktif dalam kerja kelompok."
   }

   D. TASK — PERFORMANCE / ASSIGNMENT / PROJECT / PRODUCT
   Gunakan field:
   - coverageUnitId: WAJIB.
   - taskPrompt: WAJIB, berupa instruksi tugas yang dapat dilakukan murid.
   - taskTitle: opsional.
   - instructions: opsional.
   - expectedDeliverable: opsional.
   - aspects: opsional, berupa array objek dengan field "label" dan dapat memiliki "description" atau "weight".
   - rubricDraft: opsional.
   - scoringGuideDraft: opsional.

   Contoh:
   {
     "coverageUnitId": "...",
     "taskTitle": "Praktik Gerak Dasar",
     "taskPrompt": "Lakukan rangkaian gerak sesuai instruksi guru.",
     "instructions": "Lakukan secara tertib dan aman.",
     "aspects": [
       {
         "label": "Ketepatan gerakan",
         "description": "Gerakan sesuai contoh."
       }
     ]
   }

   JANGAN menggunakan field generik seperti:
   - "task"
   - "description" sebagai pengganti taskPrompt
   - "activity"
   - "content"

   sebagai field utama tugas.

   E. EVIDENCE — PORTFOLIO
   Gunakan field:
   - coverageUnitId: WAJIB.
   - evidenceRequirements: WAJIB, array string minimal 1 bukti.
   - instructions: opsional.
   - rubricDraft: opsional.
   - scoringGuideDraft: opsional.

   Contoh:
   {
     "coverageUnitId": "...",
     "instructions": "Kumpulkan bukti hasil pembelajaran.",
     "evidenceRequirements": [
       "Dokumentasi hasil praktik",
       "Catatan refleksi murid"
     ]
   }

   F. OBSERVATION — OBSERVATION
   Gunakan field:
   - coverageUnitId: WAJIB.
   - aspects: WAJIB, array minimal 1 objek.
   - setiap aspek WAJIB memiliki "label".
   - "indicator" sangat dianjurkan agar perilaku dapat diamati.
   - instructions: opsional.
   - recordingScheme: opsional.
   - rubricDraft: opsional.

   Contoh:
   {
     "coverageUnitId": "...",
     "instructions": "Amati murid selama aktivitas.",
     "aspects": [
       {
         "label": "Partisipasi aktif",
         "indicator": "Murid mengikuti aktivitas sesuai instruksi."
       }
     ]
   }

   JANGAN menggunakan:
   - "observations"
   - "criteria"
   - "indicators"

   sebagai pengganti field utama "aspects".

3. KOGNISI & BAHASA:
   - Pertahankan cognitiveDemand jika diberikan pada kontrak (RECALL_UNDERSTAND, APPLY, ANALYZE_REASON, EVALUATE_CREATE).
   - JANGAN memaksakan rumus persentase baku seperti 30% LOTS / 40% MOTS / 30% HOTS.
   - JANGAN menganggap HOTS = HARD atau LOTS = EASY.
   - Sesuaikan beban membaca dan bahasa dengan kalibrasi kelas murid tanpa mencetak metadata internal di dalam teks soal.

FORMAT KELUARAN:
Keluarkan HANYA JSON murni berupa array objek unit generasi.
Setiap objek WAJIB memiliki coverageUnitId yang identik dengan kontrak.
Fokuskan keluaran pada konten asesmen yang perlu dibuat.
Metadata canonical objectiveRefId, criterionId, instrumentType, dan allocationUnit tidak wajib diulang.
Jangan menambahkan teks pembuka, penutup, atau penjelasan di luar JSON.

Ikuti nama field JSON PERSIS sebagaimana kontrak semantic di atas.
JANGAN mengganti nama field dengan sinonim.
Untuk setiap coverage unit, gunakan bentuk output yang sesuai dengan allocationUnit pada kontrak:
- ITEM → itemType + prompt
- TASK → taskPrompt
- EVIDENCE → evidenceRequirements
- OBSERVATION → aspects

Jika beberapa instrumen berbeda berada dalam satu permintaan, hasilkan semua objek tersebut dalam SATU array JSON dan gunakan bentuk field masing-masing sesuai allocationUnit.`;

  const userPrompt = `Kontrak Generasi Asesmen:
Konteks Kurikulum: ${contract.curriculumContext.curriculumType || 'Kurikulum Merdeka'}, Tingkat: ${contract.curriculumContext.schoolLevel || ''}, Kelas: ${contract.curriculumContext.grade ? 'Kelas ' + contract.curriculumContext.grade : ''}, Fase: ${contract.curriculumContext.phase || ''}
Mata Pelajaran: ${contract.subjectProfile.subjectLabel || contract.subjectProfile.subjectKey}

${
  contract.gradeCalibration
    ? `Kalibrasi Tingkat Kelas:
- Reading Load: ${contract.gradeCalibration.readingLoad}
- Instruction Load: ${contract.gradeCalibration.instructionLoad}
- Abstraction Level: ${contract.gradeCalibration.abstractionLevel}
- Visual Support: ${contract.gradeCalibration.visualSupport}`
    : ''
}

${
  teacherContext
    ? `Konteks Tambahan dari Guru:
${teacherContext.instructions ? `- Instruksi: ${teacherContext.instructions}` : ''}
${teacherContext.localContext ? `- Konteks Lokal: ${teacherContext.localContext}` : ''}
${teacherContext.focusAreas?.length ? `- Fokus: ${teacherContext.focusAreas.join(', ')}` : ''}`
    : ''
}

${
  sourceMaterials?.length
    ? `Materi Sumber Belajar:
${sourceMaterials.map((s, i) => `[Sumber ${i + 1}: ${s.title}] ${s.content}`).join('\n')}`
    : ''
}

DAFTAR UNIT YANG WAJIB DIGENERASI (${contract.units.length} UNIT):
${JSON.stringify(contract.units, null, 2)}

Hasilkan JSON array dari objek GeneratedAssessmentUnit yang mencakup setiap unit di atas sesuai requiredCount masing-masing.`;

  return { systemPrompt, userPrompt };
}

// ==========================================
// RUNTIME PARSING & REFERENCE VALIDATION
// ==========================================

export interface ParsedAIResponseResult {
  validatedUnits: GeneratedAssessmentUnit[];
  failedCoverageUnitIds: string[];
  issues: AssessmentGenerationIssue[];
}

export function parseAndValidateRawAIResponse(
  rawText: string,
  contract: AssessmentGenerationContract
): ParsedAIResponseResult {
  const issues: AssessmentGenerationIssue[] = [];
  const validatedUnits: GeneratedAssessmentUnit[] = [];
  const contractMap = new Map(contract.units.map((u) => [u.coverageUnitId, u]));

  let parsedRaw: any;
  try {
    let cleanText = (rawText || '').trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    parsedRaw = JSON.parse(cleanText);
  } catch (err: any) {
    return {
      validatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'MALFORMED_AI_RESPONSE',
          severity: 'BLOCKING',
          message: `Gagal mem-parsing keluaran AI sebagai JSON: ${err.message || 'SyntaxError'}`,
        },
      ],
    };
  }

  let candidates: any[] = [];
  if (Array.isArray(parsedRaw)) {
    candidates = parsedRaw;
  } else if (parsedRaw && Array.isArray(parsedRaw.units)) {
    candidates = parsedRaw.units;
  } else if (parsedRaw && Array.isArray(parsedRaw.items)) {
    candidates = parsedRaw.items;
  } else if (parsedRaw && typeof parsedRaw === 'object') {
    // Single unit wrapped in object
    candidates = [parsedRaw];
  } else {
    return {
      validatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'INVALID_AI_RESPONSE_STRUCTURE',
          severity: 'BLOCKING',
          message: 'Keluaran AI bukan merupakan array unit generasi yang valid.',
        },
      ],
    };
  }

  const generatedCountPerCoverage = new Map<string, number>();

  candidates.forEach((candidate, idx) => {
    if (!candidate || typeof candidate !== 'object') {
      issues.push({
        code: 'INVALID_CANDIDATE_OBJECT',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} bukan objek yang valid.`,
      });
      return;
    }

    const covId = candidate.coverageUnitId;
    if (!covId || typeof covId !== 'string') {
      issues.push({
        code: 'MISSING_COVERAGE_UNIT_ID',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} tidak memiliki coverageUnitId.`,
      });
      return;
    }

    const contractUnit = contractMap.get(covId);
    if (!contractUnit) {
      issues.push({
        code: 'UNKNOWN_COVERAGE_UNIT_ID',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} memiliki coverageUnitId [${covId}] yang tidak terdaftar pada kontrak.`,
      });
      return;
    }

    // Reference Integrity Checks against Contract (ID > TEXT MATCH)
    //
    // coverageUnitId is the mandatory canonical lookup key.
    // Once a valid coverageUnitId resolves to a contract unit,
    // canonical metadata may be omitted by the AI and hydrated
    // from the GenerationContract.
    //
    // Missing canonical echo != mismatch.
    // Explicit conflicting canonical value = mismatch.

    if (
      candidate.objectiveRefId !== undefined &&
      candidate.objectiveRefId !== contractUnit.objectiveRefId
    ) {
      issues.push({
        code: 'OBJECTIVE_REF_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} mengubah objectiveRefId [${candidate.objectiveRefId}] (harus [${contractUnit.objectiveRefId}]).`,
        objectiveRefId: contractUnit.objectiveRefId,
      });
      return;
    }

    if (candidate.criterionId !== undefined) {
      const candidateCrit = candidate.criterionId || undefined;
      const contractCrit = contractUnit.criterionId || undefined;

      if (candidateCrit !== contractCrit) {
        issues.push({
          code: 'CRITERION_REF_MISMATCH',
          severity: 'REVIEW',
          message: `Kandidat unit #${idx + 1} tidak cocok criterionId [${candidateCrit}] vs [${contractCrit}].`,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
        });
        return;
      }
    }

    if (
      candidate.instrumentType !== undefined &&
      candidate.instrumentType !== contractUnit.instrumentType
    ) {
      issues.push({
        code: 'INSTRUMENT_TYPE_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} mengubah instrumentType [${candidate.instrumentType}] vs [${contractUnit.instrumentType}].`,
        objectiveRefId: contractUnit.objectiveRefId,
      });
      return;
    }

    if (
      candidate.allocationUnit !== undefined &&
      candidate.allocationUnit !== contractUnit.allocationUnit
    ) {
      issues.push({
        code: 'ALLOCATION_UNIT_MISMATCH',
        severity: 'REVIEW',
        message: `Kandidat unit #${idx + 1} mengubah allocationUnit [${candidate.allocationUnit}] vs [${contractUnit.allocationUnit}].`,
        objectiveRefId: contractUnit.objectiveRefId,
      });
      return;
    }

    // Extract candidate provenance & metadata
    const candIndicator =
      typeof candidate.assessmentIndicator === 'string' && candidate.assessmentIndicator.trim()
        ? candidate.assessmentIndicator.trim()
        : undefined;

    const assessmentIndicator = contractUnit.assessmentIndicator || candIndicator;
    const indicatorSource: AssessmentGeneratedContentSource | undefined = contractUnit.assessmentIndicator
      ? contractUnit.indicatorSource || 'TEACHER'
      : candIndicator
      ? 'AI_DRAFT'
      : undefined;

    const candMaterial =
      typeof candidate.materialOrContext === 'string' && candidate.materialOrContext.trim()
        ? candidate.materialOrContext.trim()
        : undefined;

    const materialOrContext = contractUnit.materialOrContext || candMaterial;
    const materialSource: AssessmentGeneratedContentSource | undefined = contractUnit.materialOrContext
      ? contractUnit.materialSource || 'TEACHER'
      : candMaterial
      ? 'AI_SYNTHETIC'
      : undefined;

    // Semantic Family Validation
    switch (contractUnit.allocationUnit) {
      case 'ITEM': {
        const isSelfPeerAssessment =
          contractUnit.instrumentType === 'SELF_ASSESSMENT' ||
          contractUnit.instrumentType === 'PEER_ASSESSMENT';

        if (
          isSelfPeerAssessment &&
          candidate.itemType !== 'SHORT_ANSWER'
        ) {
          issues.push({
            code: 'INVALID_SELF_PEER_ITEM_TYPE',
            severity: 'REVIEW',
            message:
              `Kandidat ITEM #${idx + 1} untuk ${contractUnit.instrumentType} wajib menggunakan itemType SHORT_ANSWER.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const itemType =
          candidate.itemType ||
          (contractUnit.instrumentType === 'ORAL_TEST'
            ? 'SHORT_ANSWER'
            : 'MULTIPLE_CHOICE');
        if (!VALID_WRITTEN_ITEM_TYPES.has(itemType)) {
          issues.push({
            code: 'INVALID_ITEM_TYPE',
            severity: 'REVIEW',
            message: `Kandidat ITEM #${idx + 1} memiliki itemType tidak valid [${itemType}].`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : '';
        if (!prompt) {
          issues.push({
            code: 'EMPTY_ITEM_PROMPT',
            severity: 'REVIEW',
            message: `Kandidat ITEM #${idx + 1} memiliki prompt kosong.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        let parsedOptions: { id?: string; text: string; isCorrect?: boolean }[] | undefined;

        if (itemType === 'MULTIPLE_CHOICE' || itemType === 'MULTIPLE_SELECT' || Array.isArray(candidate.options)) {
          if (!Array.isArray(candidate.options) || candidate.options.length < 2) {
            issues.push({
              code: 'INVALID_OPTION_STRUCTURE',
              severity: 'REVIEW',
              message: `Kandidat ITEM #${idx + 1} tipe ${itemType} wajib memiliki minimal 2 opsi jawaban.`,
              objectiveRefId: contractUnit.objectiveRefId,
            });
            return;
          }

          const validOpts: { id?: string; text: string; isCorrect?: boolean }[] = [];
          let hasInvalidOption = false;

          for (let oIdx = 0; oIdx < candidate.options.length; oIdx++) {
            const opt = candidate.options[oIdx];
            if (typeof opt === 'string') {
              const trimmed = opt.trim();
              if (!trimmed) {
                hasInvalidOption = true;
                break;
              }
              validOpts.push({ text: trimmed });
            } else if (opt && typeof opt === 'object' && !Array.isArray(opt)) {
              if (typeof opt.text !== 'string' || !opt.text.trim()) {
                hasInvalidOption = true;
                break;
              }
              validOpts.push({
                id: typeof opt.id === 'string' && opt.id.trim() ? opt.id.trim() : undefined,
                text: opt.text.trim(),
                isCorrect: typeof opt.isCorrect === 'boolean' ? opt.isCorrect : undefined,
              });
            } else {
              hasInvalidOption = true;
              break;
            }
          }

          if (hasInvalidOption || validOpts.length < 2) {
            issues.push({
              code: 'INVALID_OPTION_TEXT',
              severity: 'REVIEW',
              message: `Kandidat ITEM #${idx + 1} memiliki opsi jawaban yang kosong, tidak valid, atau bukan string.`,
              objectiveRefId: contractUnit.objectiveRefId,
            });
            return;
          }

          parsedOptions = validOpts;
        }

        const scoringGuideDraft =
          candidate.scoringGuideDraft && typeof candidate.scoringGuideDraft === 'object'
            ? {
                instructions:
                  typeof candidate.scoringGuideDraft.instructions === 'string' &&
                  candidate.scoringGuideDraft.instructions.trim()
                    ? candidate.scoringGuideDraft.instructions.trim()
                    : undefined,
                maxScore:
                  typeof candidate.scoringGuideDraft.maxScore === 'number' &&
                  Number.isFinite(candidate.scoringGuideDraft.maxScore) &&
                  candidate.scoringGuideDraft.maxScore > 0
                    ? candidate.scoringGuideDraft.maxScore
                    : undefined,
              }
            : undefined;

        const itemUnit: GeneratedItemUnit = {
          allocationUnit: 'ITEM',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          itemType,
          prompt,
          stimulus: typeof candidate.stimulus === 'string' && candidate.stimulus.trim() ? candidate.stimulus.trim() : undefined,
          stimulusOrigin: candidate.stimulus ? 'AI_SYNTHETIC' : undefined,
          stimulusSource: typeof candidate.stimulusSource === 'string' && candidate.stimulusSource.trim() ? candidate.stimulusSource.trim() : undefined,
          options: parsedOptions,
          matchingPremises: Array.isArray(candidate.matchingPremises) ? candidate.matchingPremises : undefined,
          matchingResponses: Array.isArray(candidate.matchingResponses) ? candidate.matchingResponses : undefined,
          categoryStatements: Array.isArray(candidate.categoryStatements) ? candidate.categoryStatements : undefined,
          categoryCategories: Array.isArray(candidate.categoryCategories) ? candidate.categoryCategories : undefined,
          proposedAnswer: candidate.proposedAnswer
            ? {
                answerType: candidate.proposedAnswer.answerType || 'OPTION',
                value: candidate.proposedAnswer.value,
                optionIndices: Array.isArray(candidate.proposedAnswer.optionIndices)
                  ? candidate.proposedAnswer.optionIndices
                  : undefined,
                matchingPairs: Array.isArray(candidate.proposedAnswer.matchingPairs)
                  ? candidate.proposedAnswer.matchingPairs
                  : undefined,
                categoryAnswers: Array.isArray(candidate.proposedAnswer.categoryAnswers)
                  ? candidate.proposedAnswer.categoryAnswers
                  : undefined,
                explanation: candidate.proposedAnswer.explanation,
              }
            : undefined,
          scoringGuideDraft,
          assessmentIndicator,
          indicatorSource,
          materialOrContext,
          materialSource,
        };

        validatedUnits.push(itemUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }

      case 'TASK': {
        const taskPrompt =
          typeof candidate.taskPrompt === 'string' && candidate.taskPrompt.trim()
            ? candidate.taskPrompt.trim()
            : typeof candidate.instructions === 'string' && candidate.instructions.trim()
            ? candidate.instructions.trim()
            : typeof candidate.taskTitle === 'string' && candidate.taskTitle.trim()
            ? candidate.taskTitle.trim()
            : '';

        if (!taskPrompt) {
          issues.push({
            code: 'EMPTY_TASK_PROMPT',
            severity: 'REVIEW',
            message: `Kandidat TASK #${idx + 1} tidak memiliki instruksi/tugas yang jelas.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const taskTitle =
          typeof candidate.taskTitle === 'string' && candidate.taskTitle.trim()
            ? candidate.taskTitle.trim()
            : taskPrompt.length > 40
            ? `${taskPrompt.slice(0, 40)}...`
            : taskPrompt;

        const taskInstructions =
          typeof candidate.instructions === 'string' && candidate.instructions.trim()
            ? candidate.instructions.trim()
            : undefined;

        const expectedDeliverable =
          typeof candidate.expectedDeliverable === 'string' && candidate.expectedDeliverable.trim()
            ? candidate.expectedDeliverable.trim()
            : undefined;

        const aspects = Array.isArray(candidate.aspects)
          ? candidate.aspects
              .filter(
                (asp: any) =>
                  asp &&
                  typeof asp === 'object' &&
                  typeof (asp.label || asp.name) === 'string' &&
                  (asp.label || asp.name).trim()
              )
              .map((asp: any) => ({
                label: (asp.label || asp.name).trim(),
                description:
                  typeof asp.description === 'string' && asp.description.trim() ? asp.description.trim() : undefined,
                weight:
                  typeof asp.weight === 'number' && Number.isFinite(asp.weight) && asp.weight > 0
                    ? asp.weight
                    : undefined,
              }))
          : undefined;

        const rubricDraft =
          candidate.rubricDraft && typeof candidate.rubricDraft === 'object'
            ? {
                title:
                  typeof candidate.rubricDraft.title === 'string' && candidate.rubricDraft.title.trim()
                    ? candidate.rubricDraft.title.trim()
                    : undefined,
                criteria: Array.isArray(candidate.rubricDraft.criteria)
                  ? candidate.rubricDraft.criteria
                      .filter(
                        (c: any) =>
                          c &&
                          typeof c === 'object' &&
                          typeof (c.label || c.name) === 'string' &&
                          (c.label || c.name).trim()
                      )
                      .map((c: any) => ({
                        label: (c.label || c.name).trim(),
                        indicator:
                          typeof c.indicator === 'string' && c.indicator.trim() ? c.indicator.trim() : undefined,
                        weight:
                          typeof c.weight === 'number' && Number.isFinite(c.weight) && c.weight > 0
                            ? c.weight
                            : undefined,
                      }))
                  : [],
                scale: Array.isArray(candidate.rubricDraft.scale)
                  ? candidate.rubricDraft.scale
                      .filter(
                        (s: any) =>
                          s &&
                          typeof s === 'object' &&
                          typeof s.label === 'string' &&
                          s.label.trim()
                      )
                      .map((s: any, sIdx: number) => ({
                        label: s.label.trim(),
                        score: typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : sIdx + 1,
                        descriptor:
                          typeof s.descriptor === 'string' && s.descriptor.trim() ? s.descriptor.trim() : undefined,
                        order: typeof s.order === 'number' && Number.isFinite(s.order) ? s.order : sIdx + 1,
                      }))
                  : [],
              }
            : undefined;

        const scoringGuideDraft =
          candidate.scoringGuideDraft && typeof candidate.scoringGuideDraft === 'object'
            ? {
                instructions:
                  typeof candidate.scoringGuideDraft.instructions === 'string' &&
                  candidate.scoringGuideDraft.instructions.trim()
                    ? candidate.scoringGuideDraft.instructions.trim()
                    : undefined,
                maxScore:
                  typeof candidate.scoringGuideDraft.maxScore === 'number' &&
                  Number.isFinite(candidate.scoringGuideDraft.maxScore) &&
                  candidate.scoringGuideDraft.maxScore > 0
                    ? candidate.scoringGuideDraft.maxScore
                    : undefined,
              }
            : undefined;

        const taskUnit: GeneratedTaskUnit = {
          allocationUnit: 'TASK',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          taskTitle,
          taskPrompt,
          instructions: taskInstructions,
          expectedDeliverable,
          aspects: aspects && aspects.length > 0 ? aspects : undefined,
          rubricDraft: rubricDraft && rubricDraft.criteria.length > 0 ? rubricDraft : undefined,
          scoringGuideDraft,
          assessmentIndicator,
          indicatorSource,
          materialOrContext,
          materialSource,
        };

        validatedUnits.push(taskUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }

      case 'EVIDENCE': {
        const rawReqs = Array.isArray(candidate.evidenceRequirements)
          ? candidate.evidenceRequirements
          : typeof candidate.instructions === 'string' && candidate.instructions.trim()
          ? [candidate.instructions.trim()]
          : [];

        const evidenceRequirements = rawReqs
          .filter((r: any) => typeof r === 'string' && r.trim().length > 0)
          .map((r: string) => r.trim());

        if (evidenceRequirements.length === 0) {
          issues.push({
            code: 'EMPTY_EVIDENCE_REQUIREMENTS',
            severity: 'REVIEW',
            message: `Kandidat EVIDENCE #${idx + 1} tidak memiliki persyaratan bukti portofolio.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const instructions =
          typeof candidate.instructions === 'string' && candidate.instructions.trim()
            ? candidate.instructions.trim()
            : undefined;

        const rubricDraft =
          candidate.rubricDraft && typeof candidate.rubricDraft === 'object'
            ? {
                title:
                  typeof candidate.rubricDraft.title === 'string' && candidate.rubricDraft.title.trim()
                    ? candidate.rubricDraft.title.trim()
                    : undefined,
                criteria: Array.isArray(candidate.rubricDraft.criteria)
                  ? candidate.rubricDraft.criteria
                      .filter(
                        (c: any) =>
                          c &&
                          typeof c === 'object' &&
                          typeof (c.label || c.name) === 'string' &&
                          (c.label || c.name).trim()
                      )
                      .map((c: any) => ({
                        label: (c.label || c.name).trim(),
                        indicator:
                          typeof c.indicator === 'string' && c.indicator.trim() ? c.indicator.trim() : undefined,
                        weight:
                          typeof c.weight === 'number' && Number.isFinite(c.weight) && c.weight > 0
                            ? c.weight
                            : undefined,
                      }))
                  : [],
                scale: Array.isArray(candidate.rubricDraft.scale)
                  ? candidate.rubricDraft.scale
                      .filter(
                        (s: any) =>
                          s &&
                          typeof s === 'object' &&
                          typeof s.label === 'string' &&
                          s.label.trim()
                      )
                      .map((s: any, sIdx: number) => ({
                        label: s.label.trim(),
                        score: typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : sIdx + 1,
                        descriptor:
                          typeof s.descriptor === 'string' && s.descriptor.trim() ? s.descriptor.trim() : undefined,
                        order: typeof s.order === 'number' && Number.isFinite(s.order) ? s.order : sIdx + 1,
                      }))
                  : [],
              }
            : undefined;

        const scoringGuideDraft =
          candidate.scoringGuideDraft && typeof candidate.scoringGuideDraft === 'object'
            ? {
                instructions:
                  typeof candidate.scoringGuideDraft.instructions === 'string' &&
                  candidate.scoringGuideDraft.instructions.trim()
                    ? candidate.scoringGuideDraft.instructions.trim()
                    : undefined,
                maxScore:
                  typeof candidate.scoringGuideDraft.maxScore === 'number' &&
                  Number.isFinite(candidate.scoringGuideDraft.maxScore) &&
                  candidate.scoringGuideDraft.maxScore > 0
                    ? candidate.scoringGuideDraft.maxScore
                    : undefined,
              }
            : undefined;

        const evidenceUnit: GeneratedEvidenceUnit = {
          allocationUnit: 'EVIDENCE',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          instructions,
          evidenceRequirements,
          rubricDraft: rubricDraft && rubricDraft.criteria.length > 0 ? rubricDraft : undefined,
          scoringGuideDraft,
          assessmentIndicator,
          indicatorSource,
          materialOrContext,
          materialSource,
        };

        validatedUnits.push(evidenceUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }

      case 'OBSERVATION': {
        const rawAspects = Array.isArray(candidate.aspects) ? candidate.aspects : [];
        const aspects = rawAspects
          .filter(
            (asp: any) =>
              asp &&
              typeof asp === 'object' &&
              typeof (asp.label || asp.name) === 'string' &&
              (asp.label || asp.name).trim()
          )
          .map((asp: any) => ({
            label: (asp.label || asp.name).trim(),
            indicator:
              typeof asp.indicator === 'string' && asp.indicator.trim() ? asp.indicator.trim() : undefined,
          }));

        if (aspects.length === 0) {
          issues.push({
            code: 'EMPTY_OBSERVATION_ASPECTS',
            severity: 'REVIEW',
            message: `Kandidat OBSERVATION #${idx + 1} tidak memiliki aspek pengamatan yang valid.`,
            objectiveRefId: contractUnit.objectiveRefId,
          });
          return;
        }

        const recordingScheme =
          typeof candidate.recordingScheme === 'string' && candidate.recordingScheme.trim()
            ? candidate.recordingScheme.trim()
            : undefined;

        const instructions =
          typeof candidate.instructions === 'string' && candidate.instructions.trim()
            ? candidate.instructions.trim()
            : undefined;

        const rubricDraft =
          candidate.rubricDraft && typeof candidate.rubricDraft === 'object'
            ? {
                title:
                  typeof candidate.rubricDraft.title === 'string' && candidate.rubricDraft.title.trim()
                    ? candidate.rubricDraft.title.trim()
                    : undefined,
                criteria: Array.isArray(candidate.rubricDraft.criteria)
                  ? candidate.rubricDraft.criteria
                      .filter(
                        (c: any) =>
                          c &&
                          typeof c === 'object' &&
                          typeof (c.label || c.name) === 'string' &&
                          (c.label || c.name).trim()
                      )
                      .map((c: any) => ({
                        label: (c.label || c.name).trim(),
                        indicator:
                          typeof c.indicator === 'string' && c.indicator.trim() ? c.indicator.trim() : undefined,
                      }))
                  : [],
                scale: Array.isArray(candidate.rubricDraft.scale)
                  ? candidate.rubricDraft.scale
                      .filter(
                        (s: any) =>
                          s &&
                          typeof s === 'object' &&
                          typeof s.label === 'string' &&
                          s.label.trim()
                      )
                      .map((s: any, sIdx: number) => ({
                        label: s.label.trim(),
                        score: typeof s.score === 'number' && Number.isFinite(s.score) ? s.score : sIdx + 1,
                        descriptor:
                          typeof s.descriptor === 'string' && s.descriptor.trim() ? s.descriptor.trim() : undefined,
                        order: typeof s.order === 'number' && Number.isFinite(s.order) ? s.order : sIdx + 1,
                      }))
                  : [],
              }
            : undefined;

        const observationUnit: GeneratedObservationUnit = {
          allocationUnit: 'OBSERVATION',
          coverageUnitId: contractUnit.coverageUnitId,
          objectiveRefId: contractUnit.objectiveRefId,
          criterionId: contractUnit.criterionId,
          instrumentType: contractUnit.instrumentType,
          recordingScheme,
          instructions,
          aspects,
          rubricDraft: rubricDraft && rubricDraft.criteria.length > 0 ? rubricDraft : undefined,
          assessmentIndicator,
          indicatorSource,
          materialOrContext,
          materialSource,
        };

        validatedUnits.push(observationUnit);
        generatedCountPerCoverage.set(covId, (generatedCountPerCoverage.get(covId) || 0) + 1);
        break;
      }
    }
  });

  // Verify Required Counts per Contract Unit (Count is Authoritative, NO Fake Data)
  const failedCoverageUnitIds: string[] = [];
  contract.units.forEach((cu) => {
    const generatedCount = generatedCountPerCoverage.get(cu.coverageUnitId) || 0;
    if (generatedCount < cu.requiredCount) {
      failedCoverageUnitIds.push(cu.coverageUnitId);
      issues.push({
        code: 'INSUFFICIENT_GENERATED_UNITS',
        severity: 'REVIEW',
        message: `Coverage unit [${cu.coverageUnitId}] menghasilkan ${generatedCount} dari ${cu.requiredCount} unit yang diminta.`,
        objectiveRefId: cu.objectiveRefId,
        criterionId: cu.criterionId,
      });
    }
  });

  return { validatedUnits, failedCoverageUnitIds, issues };
}

// ==========================================
// DETERMINISTIC ASSESSMENT PACKAGE MAPPER
// ==========================================

export function mapGeneratedUnitsToAssessmentPackage(
  validatedUnits: GeneratedAssessmentUnit[],
  contract: AssessmentGenerationContract,
  plan: AssessmentGenerationPlan
): AssessmentPackage {
  const now = new Date().toISOString();
  const pkgId = contract.assessmentPackageId || `pkg-${plan.generationSpec?.assessmentPlanId || 'ai'}`;
  const spec = plan.generationSpec;

  const blueprintItems: AssessmentBlueprintItem[] = [];
  const instruments: AssessmentInstrument[] = [];
  const answerKeys: AssessmentAnswerKey[] = [];
  const scoringGuides: AssessmentScoringGuide[] = [];
  const rubrics: AssessmentRubric[] = [];

  // Group generated units by instrumentType
  const unitsByInstrument = new Map<AssessmentInstrumentType, GeneratedAssessmentUnit[]>();
  validatedUnits.forEach((u) => {
    const list = unitsByInstrument.get(u.instrumentType) || [];
    list.push(u);
    unitsByInstrument.set(u.instrumentType, list);
  });

  // Keep track of item/aspect IDs per coverageUnit for Blueprint item mapping
  const coverageToItemIds = new Map<string, string[]>();

  // Map Instruments
  unitsByInstrument.forEach((units, instType) => {
    const instId = createDeterministicInstrumentId(pkgId, instType);

    switch (instType) {
      case 'WRITTEN_TEST': {
        const writtenItems: WrittenAssessmentItem[] = [];

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'ITEM') return;
          const itemUnit = u as GeneratedItemUnit;
          const itemId = createDeterministicItemId(instId, uIdx);

          // Track for blueprint
          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(itemId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          // Build Options with deterministic IDs
          const options: WrittenAssessmentOption[] = (itemUnit.options || []).map((opt, optIdx) => ({
            id: opt.id || createDeterministicOptionId(itemId, optIdx),
            label: String.fromCharCode(65 + (optIdx % 26)),
            text: opt.text,
            isCorrect: opt.isCorrect,
          }));

          const item: WrittenAssessmentItem = {
            id: itemId,
            blueprintItemId: createDeterministicBlueprintId(pkgId, u.coverageUnitId),
            itemType: itemUnit.itemType,
            prompt: itemUnit.prompt,
            stimulus: itemUnit.stimulus,
            stimulusOrigin: itemUnit.stimulus ? 'AI_SYNTHETIC' : undefined,
            stimulusSource: itemUnit.stimulusSource,
            options: options.length > 0 ? options : undefined,
            order: uIdx + 1,
          };
          writtenItems.push(item);

          // Answer Key (Proposed / Unverified)
          if (itemUnit.proposedAnswer) {
            const ansKeyId = createDeterministicAnswerKeyId(instId, itemId);
            const matchedOptionIds = options
              .filter((opt, oIdx) => {
                if (itemUnit.proposedAnswer?.optionIndices?.includes(oIdx)) return true;
                if (itemUnit.proposedAnswer?.value && opt.text.includes(itemUnit.proposedAnswer.value)) return true;
                if (opt.isCorrect) return true;
                return false;
              })
              .map((o) => o.id);

            answerKeys.push({
              id: ansKeyId,
              instrumentId: instId,
              instrumentItemId: itemId,
              answerType: itemUnit.proposedAnswer.answerType,
              value: itemUnit.proposedAnswer.value,
              optionIds: matchedOptionIds.length > 0 ? matchedOptionIds : undefined,
              notes: itemUnit.proposedAnswer.explanation,
            });
          }

          // Scoring Guide
          if (itemUnit.scoringGuideDraft) {
            const sgId = createDeterministicScoringGuideId(instId, itemId);
            scoringGuides.push({
              id: sgId,
              title: `Pedoman Penskoran Butir #${uIdx + 1}`,
              instrumentId: instId,
              instrumentItemId: itemId,
              guideType: itemUnit.itemType === 'ESSAY' ? 'ESSAY' : 'OBJECTIVE',
              instructions: itemUnit.scoringGuideDraft.instructions,
              maxScore: itemUnit.scoringGuideDraft.maxScore,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'WRITTEN_TEST',
          title: 'Instrumen Tes Tertulis',
          instructions: undefined,
          items: writtenItems,
        });
        break;
      }

      case 'ORAL_TEST': {
        const oralItems: OralAssessmentItem[] = [];
        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'ITEM') return;
          const itemUnit = u as GeneratedItemUnit;
          const itemId = createDeterministicItemId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(itemId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          oralItems.push({
            id: itemId,
            blueprintItemId: createDeterministicBlueprintId(pkgId, u.coverageUnitId),
            prompt: itemUnit.prompt,
            expectedResponse: itemUnit.proposedAnswer?.value || itemUnit.proposedAnswer?.explanation,
            order: uIdx + 1,
          });
        });

        instruments.push({
          id: instId,
          type: 'ORAL_TEST',
          title: 'Instrumen Tes Lisan',
          instructions: undefined,
          items: oralItems,
        });
        break;
      }

      case 'SELF_ASSESSMENT':
      case 'PEER_ASSESSMENT': {
        const selfPeerItems: SelfPeerAssessmentItem[] = [];
        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'ITEM') return;
          const itemUnit = u as GeneratedItemUnit;
          const itemId = createDeterministicItemId(instId, uIdx);

          const covItems = coverageToItemIds.get(u.coverageUnitId) || [];
          covItems.push(itemId);
          coverageToItemIds.set(u.coverageUnitId, covItems);

          selfPeerItems.push({
            id: itemId,
            statement: itemUnit.prompt,
            category: undefined,
          });
        });

        const isSelf = instType === 'SELF_ASSESSMENT';
        instruments.push({
          id: instId,
          type: instType,
          title: isSelf
            ? 'Instrumen Penilaian Diri'
            : 'Instrumen Penilaian Antar-Teman',
          instructions: undefined,
          items: selfPeerItems,
        } as SelfPeerAssessmentInstrument);
        break;
      }

      case 'PERFORMANCE': {
        const aspects: PerformanceAspect[] = [];
        let combinedTask: string | undefined;
        let performanceInstructions: string | undefined;
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          if (!combinedTask) {
            combinedTask = taskUnit.taskPrompt || taskUnit.instructions || taskUnit.taskTitle || taskUnit.expectedDeliverable;
          }

          if (!performanceInstructions && taskUnit.instructions) {
            performanceInstructions = taskUnit.instructions;
          }

          const covItems =
            coverageToItemIds.get(u.coverageUnitId) || [];

          if (
            taskUnit.aspects &&
            taskUnit.aspects.length > 0
          ) {
            taskUnit.aspects.forEach((asp, aIdx) => {
              const actualAspectId =
                `${aspId}-${aIdx + 1}`;

              aspects.push({
                id: actualAspectId,
                label: asp.label,
                description: asp.description,
                weight: asp.weight,
              });

              covItems.push(actualAspectId);
            });
          } else {
            aspects.push({
              id: aspId,
              label: taskUnit.taskTitle,
              description: taskUnit.instructions,
            });

            covItems.push(aspId);
          }

          coverageToItemIds.set(
            u.coverageUnitId,
            covItems
          );

          // Rubric Draft
          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            const critList: RubricCriterion[] = (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
              id: `crit-${rubricId}-${cIdx + 1}`,
              label: c.label,
              indicator: c.indicator,
              weight: c.weight,
            }));
            const scaleList: RubricScaleLevel[] = (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
              id: `scale-${rubricId}-${sIdx + 1}`,
              label: s.label,
              score: s.score,
              descriptor: s.descriptor,
              order: s.order || sIdx + 1,
            }));

            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || `Rubrik ${taskUnit.taskTitle}`,
              instrumentId: instId,
              criteria: critList,
              scale: scaleList,
              status: 'DRAFT',
            });
          }

          // Scoring Guide Draft
          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Kinerja',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions,
              maxScore: taskUnit.scoringGuideDraft.maxScore,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PERFORMANCE',
          title: 'Instrumen Penilaian Kinerja / Praktik',
          task: combinedTask!,
          instructions: performanceInstructions,
          aspects: aspects.length > 0 ? aspects : undefined,
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'OBSERVATION': {
        const aspects: ObservationAspect[] = [];
        let rubricId: string | undefined;
        let recordingScheme: string | undefined;
        let obsInstructions: string | undefined;

        units.forEach((u, uIdx) => {
          if (u.allocationUnit !== 'OBSERVATION') return;
          const obsUnit = u as GeneratedObservationUnit;
          const aspId = createDeterministicAspectId(instId, uIdx);

          const covItems =
            coverageToItemIds.get(u.coverageUnitId) || [];

          if (!recordingScheme && obsUnit.recordingScheme) {
            recordingScheme = obsUnit.recordingScheme;
          }
          if (!obsInstructions && obsUnit.instructions) {
            obsInstructions = obsUnit.instructions;
          }

          obsUnit.aspects.forEach((asp, aIdx) => {
            const actualAspectId =
              `${aspId}-${aIdx + 1}`;

            aspects.push({
              id: actualAspectId,
              label: asp.label,
              indicator: asp.indicator,
            });

            covItems.push(actualAspectId);
          });

          coverageToItemIds.set(
            u.coverageUnitId,
            covItems
          );

          if (obsUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            const critList: RubricCriterion[] = (obsUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
              id: `crit-${rubricId}-${cIdx + 1}`,
              label: c.label,
              indicator: c.indicator,
            }));
            const scaleList: RubricScaleLevel[] = (obsUnit.rubricDraft.scale || []).map((s, sIdx) => ({
              id: `scale-${rubricId}-${sIdx + 1}`,
              label: s.label,
              score: s.score,
              descriptor: s.descriptor,
              order: s.order || sIdx + 1,
            }));

            rubrics.push({
              id: rubricId,
              title: obsUnit.rubricDraft.title || 'Rubrik Lembar Observasi',
              instrumentId: instId,
              criteria: critList,
              scale: scaleList,
              status: 'DRAFT',
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'OBSERVATION',
          title: 'Instrumen Lembar Pengamatan / Observasi',
          instructions: obsInstructions,
          recordingScheme,
          aspects,
        });
        break;
      }

      case 'PORTFOLIO': {
        const evidenceReqs: string[] = [];
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;
        let portfolioInstructions: string | undefined;

        units.forEach((u) => {
          if (u.allocationUnit !== 'EVIDENCE') return;
          const evUnit = u as GeneratedEvidenceUnit;

          if (!portfolioInstructions && evUnit.instructions) {
            portfolioInstructions = evUnit.instructions;
          }

          evUnit.evidenceRequirements.forEach((req) => {
            if (!evidenceReqs.includes(req)) evidenceReqs.push(req);
          });

          if (evUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: evUnit.rubricDraft.title || 'Rubrik Penilaian Portofolio',
              instrumentId: instId,
              criteria: (evUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
                weight: c.weight,
              })),
              scale: (evUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (evUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Portofolio',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: evUnit.scoringGuideDraft.instructions,
              maxScore: evUnit.scoringGuideDraft.maxScore,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PORTFOLIO',
          title: 'Instrumen Asesmen Portofolio',
          instructions: portfolioInstructions,
          evidenceRequirements: evidenceReqs,
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'ASSIGNMENT': {
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;
        let assignmentInstructions: string | undefined;
        let expectedOutput: string | undefined;

        units.forEach((u) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;

          if (!assignmentInstructions) {
            assignmentInstructions = taskUnit.instructions || taskUnit.taskPrompt || taskUnit.taskTitle || taskUnit.expectedDeliverable;
          }
          if (!expectedOutput && taskUnit.expectedDeliverable) {
            expectedOutput = taskUnit.expectedDeliverable;
          }

          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Penugasan',
              instrumentId: instId,
              criteria: (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
                weight: c.weight,
              })),
              scale: (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Penugasan',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions,
              maxScore: taskUnit.scoringGuideDraft.maxScore,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'ASSIGNMENT',
          title: 'Instrumen Penugasan',
          instructions: assignmentInstructions!,
          expectedOutput,
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'PROJECT': {
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;
        let projectBrief: string | undefined;
        let expectedDeliverable: string | undefined;

        units.forEach((u) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;

          if (!projectBrief) {
            projectBrief = taskUnit.taskPrompt || taskUnit.instructions || taskUnit.taskTitle || taskUnit.expectedDeliverable;
          }
          if (!expectedDeliverable && taskUnit.expectedDeliverable) {
            expectedDeliverable = taskUnit.expectedDeliverable;
          }

          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Proyek',
              instrumentId: instId,
              criteria: (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
                weight: c.weight,
              })),
              scale: (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Proyek',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions,
              maxScore: taskUnit.scoringGuideDraft.maxScore,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PROJECT',
          title: 'Instrumen Penilaian Proyek',
          projectBrief: projectBrief!,
          expectedDeliverable,
          rubricId,
          scoringGuideId,
        });
        break;
      }

      case 'PRODUCT': {
        let rubricId: string | undefined;
        let scoringGuideId: string | undefined;
        let productBrief: string | undefined;
        let expectedProduct: string | undefined;

        units.forEach((u) => {
          if (u.allocationUnit !== 'TASK') return;
          const taskUnit = u as GeneratedTaskUnit;

          if (!productBrief) {
            productBrief = taskUnit.taskPrompt || taskUnit.instructions || taskUnit.taskTitle || taskUnit.expectedDeliverable;
          }
          if (!expectedProduct && taskUnit.expectedDeliverable) {
            expectedProduct = taskUnit.expectedDeliverable;
          }

          if (taskUnit.rubricDraft && !rubricId) {
            rubricId = createDeterministicRubricId(instId, 1);
            rubrics.push({
              id: rubricId,
              title: taskUnit.rubricDraft.title || 'Rubrik Penilaian Produk',
              instrumentId: instId,
              criteria: (taskUnit.rubricDraft.criteria || []).map((c, cIdx) => ({
                id: `crit-${rubricId}-${cIdx + 1}`,
                label: c.label,
                indicator: c.indicator,
                weight: c.weight,
              })),
              scale: (taskUnit.rubricDraft.scale || []).map((s, sIdx) => ({
                id: `scale-${rubricId}-${sIdx + 1}`,
                label: s.label,
                score: s.score,
                descriptor: s.descriptor,
                order: s.order || sIdx + 1,
              })),
              status: 'DRAFT',
            });
          }

          if (taskUnit.scoringGuideDraft && !scoringGuideId) {
            scoringGuideId = createDeterministicScoringGuideId(instId, 'main');
            scoringGuides.push({
              id: scoringGuideId,
              title: 'Pedoman Penilaian Produk',
              instrumentId: instId,
              guideType: 'RUBRIC_BASED',
              instructions: taskUnit.scoringGuideDraft.instructions,
              maxScore: taskUnit.scoringGuideDraft.maxScore,
            });
          }
        });

        instruments.push({
          id: instId,
          type: 'PRODUCT',
          title: 'Instrumen Penilaian Produk',
          productBrief: productBrief!,
          expectedProduct,
          rubricId,
          scoringGuideId,
        });
        break;
      }
    }
  });

  // Map Blueprint Items
  contract.units.forEach((cu, idx) => {
    const itemIds = coverageToItemIds.get(cu.coverageUnitId) || [];
    const generatedForUnit = validatedUnits.filter((u) => u.coverageUnitId === cu.coverageUnitId);

    // PARTIAL GENERATION FAIL-CLOSED:
    // A GenerationContract unit without any validated generated content
    // must NOT become a blueprint item with synthetic linkage.
    //
    // Missing generated content is represented by ABSENCE of blueprint.
    // Coverage validation will deterministically report
    // MISSING_PLANNED_COVERAGE.
    if (generatedForUnit.length === 0) {
      return;
    }

    const expectedInstrumentId =
      createDeterministicInstrumentId(
        pkgId,
        cu.instrumentType
      );

    const resolvedInstrumentId =
      instruments.some(
        (inst) => inst.id === expectedInstrumentId
      )
        ? expectedInstrumentId
        : undefined;

    const bpItem: AssessmentBlueprintItem = {
      id: createDeterministicBlueprintId(
        pkgId,
        cu.coverageUnitId
      ),
      coverageUnitId: cu.coverageUnitId,
      objectiveRefId: cu.objectiveRefId,
      criterionId: cu.criterionId,
      assessmentIndicator:
        cu.assessmentIndicator ||
        generatedForUnit[0]?.assessmentIndicator ||
        undefined,
      materialOrContext:
        cu.materialOrContext ||
        generatedForUnit[0]?.materialOrContext ||
        undefined,
      instrumentType: cu.instrumentType,
      instrumentId: resolvedInstrumentId,
      instrumentItemIds: itemIds,
      order: idx + 1,
      status: 'DRAFT',
      cognitiveDemand: cu.cognitiveDemand,
      evidenceType: plan.coverageUnits.find((u) => u.id === cu.coverageUnitId)?.evidenceType,
      stimulusType: cu.stimulusType,
      difficultyTarget: cu.difficultyTarget,
      recommendedItemCount: cu.requiredCount,
    };
    blueprintItems.push(bpItem);
  });

  const pkg: AssessmentPackage = {
    id: pkgId,
    assessmentPlanId: contract.assessmentPlanId,
    academicSettingId: contract.academicSettingId,
    title: `Perangkat Asesmen - ${contract.subjectProfile.subjectLabel || contract.subjectProfile.subjectKey}`,
    blueprintItems,
    instruments,
    answerKeys,
    scoringGuides,
    rubrics,
    workflowStatus: 'DRAFT', // CRITICAL: AI GENERATION ALWAYS PRODUCES DRAFT, NEVER SIAP
    needsReview: true,
    reviewReason: 'Draf hasil generasi AI, wajib ditinjau dan divalidasi oleh guru.',
    revision: 1,
    provenance: {
      generatedBy: 'AI',
      generatedAt: now,
    },
    createdAt: now,
    updatedAt: now,
  };

  return pkg;
}

// ==========================================
// MAIN GENERATOR ENTRY POINT
// ==========================================

export async function generateAssessmentPackageDraft(
  input: GenerateAssessmentPackageInput
): Promise<AssessmentGenerationResult> {
  // 1. Pre-generation Guards Check (Fail-closed, no AI call if blocked)
  const guardResult = validatePreGenerationGuards(input);
  if (!guardResult.valid) {
    const failedCoverageUnitIds = input?.generationPlan?.coverageUnits?.map((u) => u.id) || [];
    return {
      status: 'BLOCKED',
      generatedPackage: undefined,
      contract: undefined,
      generatedUnits: [],
      failedCoverageUnitIds,
      issues: guardResult.issues,
    };
  }

  const plan = input.generationPlan;

  // 2. Build Deterministic Generation Contract
  const contract = buildGenerationContract(plan, input.teacherContext, input.sourceMaterials);

  // 3. Build Prompts
  const { systemPrompt, userPrompt } = buildGenerationPrompts(
    contract,
    input.teacherContext,
    input.sourceMaterials
  );

  const request: AssessmentAIGenerationRequest = {
    systemPrompt,
    userPrompt,
    generationContract: contract,
  };

  // 4. Provider Execution
  if (!input.provider) {
    return {
      status: 'FAILED',
      contract,
      generatedPackage: undefined,
      generatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'PROVIDER_MISSING',
          severity: 'BLOCKING',
          message: 'AssessmentAIGenerationProvider tidak tersedia atau belum disuntikkan.',
        },
      ],
    };
  }

  let rawResponse: AssessmentAIGenerationRawResponse;
  try {
    rawResponse = await input.provider.generate(request);
  } catch (err: any) {
    return {
      status: 'FAILED',
      contract,
      generatedPackage: undefined,
      generatedUnits: [],
      failedCoverageUnitIds: contract.units.map((u) => u.coverageUnitId),
      issues: [
        {
          code: 'PROVIDER_EXECUTION_ERROR',
          severity: 'BLOCKING',
          message: `Eksekusi AI provider mengalami kegagalan: ${err.message || 'UnknownError'}`,
        },
      ],
    };
  }

  // 5. Runtime Parsing & Reference Validation
  const parseResult = parseAndValidateRawAIResponse(rawResponse.rawText, contract);

  let status: AssessmentGenerationResultStatus;
  if (parseResult.validatedUnits.length === 0) {
    status = 'FAILED';
  } else if (parseResult.failedCoverageUnitIds.length > 0) {
    status = 'PARTIAL';
  } else {
    status = 'GENERATED';
  }

  // 6. Map to AssessmentPackage (Always DRAFT, never SIAP, no auto-confirmation)
  let generatedPackage: AssessmentPackage | undefined;
  if (parseResult.validatedUnits.length > 0) {
    generatedPackage = mapGeneratedUnitsToAssessmentPackage(
      parseResult.validatedUnits,
      contract,
      plan
    );
  }

  return {
    status,
    generatedPackage,
    contract,
    generatedUnits: parseResult.validatedUnits,
    failedCoverageUnitIds: parseResult.failedCoverageUnitIds,
    issues: [...guardResult.issues, ...parseResult.issues],
  };
}
