import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  AlignmentType,
  WidthType,
  HeadingLevel,
  BorderStyle,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import { formatOfficialDate } from '../docxStyles';
import { LearningPlan, SchoolData, TeacherProfile } from '../../../types';
import { validateLearningPlan, createEmptyLearningPlan } from '../../learningPlanService';
import { getCurriculumTypeFromSetting, isMerdeka } from '../../curriculumRouter';
import { resolveCanonicalLearningPlan } from '../index';

/**
 * Creates professional standard Modul Ajar identity metadata table in Times New Roman.
 * Strictly excludes AI indicators, internal status/sourceType, and student count.
 */
function createModulAjarIdentityTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: rows.map(
      ([label, val]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { line: 276, after: 60 },
                  children: [new TextRun({ text: label, bold: true, size: 24, font: 'Times New Roman' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  spacing: { line: 276, after: 60 },
                  children: [new TextRun({ text: val, size: 24, font: 'Times New Roman' })],
                }),
              ],
            }),
          ],
        })
    ),
  });
}

function createModulAjarSignoffBlock(
  school: SchoolData,
  profile: TeacherProfile,
  isBlankMode: boolean = false,
  customDate?: string
): (Paragraph | Table)[] {
  const dateStr = formatOfficialDate(school, customDate);
  const principalTitle = 'Kepala Sekolah';
  const teacherTitle = 'Guru Mata Pelajaran';

  const principalNameText = isBlankMode
    ? '(........................)'
    : school.principalName
    ? school.principalName
    : '(........................)';

  const principalNipText = isBlankMode
    ? 'NIP. ....................'
    : school.principalNip
    ? `NIP. ${school.principalNip}`
    : 'NIP. ....................';

  const teacherNameText = isBlankMode
    ? '(........................)'
    : profile.name
    ? profile.name
    : '(........................)';

  const teacherNipText = isBlankMode
    ? 'NIP. ....................'
    : profile.nip
    ? `NIP. ${profile.nip}`
    : 'NIP. ....................';

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Mengetahui,', size: 24, font: 'Times New Roman' })],
              }),
              new Paragraph({
                children: [new TextRun({ text: principalTitle, size: 24, font: 'Times New Roman' })],
              }),
              new Paragraph({ spacing: { after: 720 } }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: principalNameText,
                    bold: !isBlankMode && !!school.principalName,
                    size: 24,
                    font: 'Times New Roman',
                    underline: !isBlankMode && school.principalName ? {} : undefined,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: principalNipText,
                    size: 24,
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            children: [
              isBlankMode
                ? new Paragraph({ children: [] })
                : new Paragraph({
                    children: [new TextRun({ text: dateStr, size: 24, font: 'Times New Roman' })],
                  }),
              new Paragraph({
                children: [new TextRun({ text: teacherTitle, size: 24, font: 'Times New Roman' })],
              }),
              new Paragraph({ spacing: { after: 720 } }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: teacherNameText,
                    bold: !isBlankMode && !!profile.name,
                    size: 24,
                    font: 'Times New Roman',
                    underline: !isBlankMode && profile.name ? {} : undefined,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: teacherNipText,
                    size: 24,
                    font: 'Times New Roman',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return [new Paragraph({ spacing: { before: 240, after: 120 } }), table];
}

/**
 * Pure Canonical Document Renderer for Modul Ajar / RPP.
 * Strict M1 Standard:
 * - Times New Roman 12pt black
 * - Margins: Left 3.0cm, Right 2.5cm, Top 2.5cm, Bottom 2.5cm
 * - Prose: Justified with 1.25cm first-line indent, line spacing 1.15
 * - Lists: Left-aligned, no first-line indent, line spacing 1.15
 * - Zero AI metadata, zero product branding, zero student count in final output
 */
export async function generateModulAjar(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, tp, atp } = context;

  // 1. Resolve canonical LearningPlan
  let plan: LearningPlan | undefined = undefined;
  if (context.documentMode === 'blank') {
    plan = createEmptyLearningPlan({
      academicSetting,
      curriculumType: getCurriculumTypeFromSetting(academicSetting),
      tpIds: [],
      atpItemIds: [],
      context: { tp, atp },
    });
  } else {
    const resolved = resolveCanonicalLearningPlan(context);
    if (resolved.error || !resolved.plan) {
      throw new Error(resolved.error || 'Rancangan Pembelajaran (LearningPlan) berstatus SIAP tidak ditemukan.');
    }
    plan = resolved.plan;
  }

  // 2. Validate Plan against active context
  const validation = validateLearningPlan(plan, {
    academicSetting,
    tp,
    atp,
    k13Analysis: context.k13Analysis,
    timeAllocations: context.timeAllocations,
    assessmentCriteria: context.assessmentCriteria,
  });

  // Strict Final Export Guard
  if (context.documentMode !== 'blank') {
    if (plan.status !== 'SIAP') {
      throw new Error(
        `Rancangan Pembelajaran (Modul Ajar) belum berstatus 'SIAP' (Status saat ini: '${plan.status}'). Silakan verifikasi dan konfirmasi SIAP terlebih dahulu.`
      );
    }
    if (!validation.valid) {
      throw new Error(`Rancangan Pembelajaran tidak valid untuk ekspor dokumen final: ${validation.errors.join('; ')}`);
    }
  }

  const isBlankMode = context.documentMode === 'blank';
  const docChildren: (Paragraph | Table)[] = [];

  // Official Title - Clean, centered, bold, black, 14pt (no [DRAFT] or AI tags)
  const docTitle = 'MODUL AJAR';
  const subTitle = `${academicSetting.curriculum || '-'} — ${academicSetting.grade || '-'} (${academicSetting.phase || '-'})`;

  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [
        new TextRun({
          text: docTitle,
          bold: true,
          size: 28, // 14pt
          font: 'Times New Roman',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 180 },
      children: [
        new TextRun({
          text: subTitle.toUpperCase(),
          bold: true,
          size: 24, // 12pt
          font: 'Times New Roman',
        }),
      ],
    })
  );

  // Time / JP allocation resolution
  const timeAllocationDisplay =
    validation.resolvedAllocatedJP !== undefined
      ? `${validation.resolvedAllocatedJP} Jam Pelajaran (JP)`
      : typeof plan.allocatedJP === 'number'
      ? `${plan.allocatedJP} Jam Pelajaran (JP)`
      : 'Belum Ditetapkan';

  // Identity Table
  const isK13Curriculum =
    academicSetting.curriculumType === 'K13' ||
    (academicSetting.curriculum &&
      (academicSetting.curriculum.includes('2013') || academicSetting.curriculum.includes('K13')));

  const classRow: [string, string] = isK13Curriculum
    ? ['Kelas', `: ${academicSetting.grade || '-'}`]
    : ['Fase / Kelas', `: ${academicSetting.phase || '-'} / ${academicSetting.grade || '-'}`];

  const identityRows: [string, string][] = [
    ['Satuan Pendidikan', `: ${school.name || '-'}`],
    ['NPSN', `: ${school.npsn || '-'}`],
    ['Mata Pelajaran', `: ${academicSetting.subject || '-'}`],
    classRow,
    ['Tahun Ajaran / Semester', `: ${academicSetting.academicYear || '-'} / ${academicSetting.semester || '-'}`],
    ['Guru Mata Pelajaran', `: ${profile.name || '-'}`],
    ['NIP', `: ${profile.nip || '-'}`],
    ['Alokasi Waktu', `: ${timeAllocationDisplay}`],
    ['Topik / Materi', `: ${plan.topic || plan.title || '-'}`],
  ];

  docChildren.push(createModulAjarIdentityTable(identityRows));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Helper: Section Title (12pt Bold Black)
  const addSectionTitle = (title: string) => {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 80 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 24, // 12pt
            font: 'Times New Roman',
          }),
        ],
      })
    );
  };

  // Helper: Subsection Title (12pt Bold Black)
  const addSubSectionTitle = (title: string) => {
    docChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 40 },
        children: [
          new TextRun({
            text: title,
            bold: true,
            size: 24, // 12pt
            font: 'Times New Roman',
          }),
        ],
      })
    );
  };

  // Helper: Narrative Prose Paragraph (12pt Justified, 1.25cm first-line indent, line spacing 1.15, 6pt after)
  const addProseParagraph = (text: string) => {
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        indent: { firstLine: 709 }, // 1.25 cm = 708.66 twips
        spacing: { line: 276, after: 120 }, // 1.15 line spacing, 6pt after
        children: [
          new TextRun({
            text,
            size: 24, // 12pt
            font: 'Times New Roman',
          }),
        ],
      })
    );
  };

  // Helper: List Paragraph (12pt Left-aligned, NO first-line indent, line spacing 1.15, 4pt after)
  const addListParagraph = (text: string) => {
    docChildren.push(
      new Paragraph({
        spacing: { line: 276, after: 80 },
        children: [
          new TextRun({
            text,
            size: 24, // 12pt
            font: 'Times New Roman',
          }),
        ],
      })
    );
  };

  // Compile Profil dimensions (prefer canonical graduateProfileDimensions, backward compatible with p3Dimensions)
  const explicitDimensions =
    plan.graduateProfileDimensions && plan.graduateProfileDimensions.length > 0
      ? plan.graduateProfileDimensions
      : plan.p3Dimensions && plan.p3Dimensions.length > 0
      ? plan.p3Dimensions
      : [];
  const dimensionsText = explicitDimensions.length > 0 ? explicitDimensions.join(', ') : '-';

  // I. INFORMASI UMUM
  addSectionTitle('I. INFORMASI UMUM');

  // A. Kompetensi Awal
  addSubSectionTitle('A. Kompetensi Awal');
  addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.initialCompetency || '-'));

  // B. Dimensi Profil Lulusan
  addSubSectionTitle('B. Dimensi Profil Lulusan');
  addListParagraph(isBlankMode ? '........................................................................................................................' : dimensionsText);

  // C. Sarana dan Prasarana
  addSubSectionTitle('C. Sarana dan Prasarana');
  if (isBlankMode) {
    addListParagraph('........................................................................................................................');
  } else if (plan.resources && plan.resources.length > 0) {
    plan.resources.forEach((r, i) => {
      addListParagraph(`${i + 1}. ${r.title}${r.source ? ` (${r.source})` : ''}`);
    });
  } else {
    addListParagraph('-');
  }

  // D. Karakteristik/Kebutuhan Belajar Murid (OPTIONAL: only render if meaningful text exists)
  let nextLetterCode = 68; // ASCII 'D'
  if (plan.targetStudents && plan.targetStudents.trim().length > 0) {
    addSubSectionTitle(`${String.fromCharCode(nextLetterCode)}. Karakteristik/Kebutuhan Belajar Murid`);
    addProseParagraph(plan.targetStudents.trim());
    nextLetterCode++;
  }

  // Model/Praktik Pembelajaran
  addSubSectionTitle(`${String.fromCharCode(nextLetterCode)}. Model/Praktik Pembelajaran`);
  addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.learningModel || '-'));

  // II. KOMPONEN INTI
  addSectionTitle('II. KOMPONEN INTI');

  // A. Tujuan Pembelajaran (TP)
  addSubSectionTitle('A. Tujuan Pembelajaran (TP)');
  if (isBlankMode) {
    addListParagraph('........................................................................................................................');
  } else if (validation.resolvedTPs.length > 0) {
    validation.resolvedTPs.forEach((t, idx) => {
      addListParagraph(`${idx + 1}. ${t.code ? `[${t.code}] ` : ''}${t.statement}${t.materialScope ? ` (Materi: ${t.materialScope})` : ''}`);
    });
  } else if (plan.objectives && plan.objectives.length > 0) {
    plan.objectives.forEach((obj, idx) => {
      addListParagraph(`${idx + 1}. ${obj.code ? `[${obj.code}] ` : ''}${obj.statement}${obj.materialScope ? ` (Materi: ${obj.materialScope})` : ''}`);
    });
  } else {
    addListParagraph('-');
  }

  // B. Pemahaman Bermakna
  addSubSectionTitle('B. Pemahaman Bermakna');
  addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.meaningfulUnderstanding || '-'));

  // C. Pertanyaan Pemantik
  addSubSectionTitle('C. Pertanyaan Pemantik');
  if (isBlankMode) {
    addListParagraph('........................................................................................................................');
  } else if (plan.triggerQuestions && plan.triggerQuestions.length > 0) {
    plan.triggerQuestions.forEach((q, idx) => {
      addListParagraph(`${idx + 1}. ${q}`);
    });
  } else {
    addListParagraph('-');
  }

  // III. KEGIATAN / PENGALAMAN PEMBELAJARAN
  const experiences = plan.learningExperiences || [];
  const openingSteps = plan.learningSteps?.opening || [];
  const coreSteps = plan.learningSteps?.core || [];
  const closingSteps = plan.learningSteps?.closing || [];

  const isMerdekaCurriculum = isMerdeka(academicSetting);
  if (experiences.length > 0 || (isBlankMode && isMerdekaCurriculum)) {
    addSectionTitle('III. PENGALAMAN BELAJAR');

    const renderExpPhase = (subLetter: string, phase: 'UNDERSTAND' | 'APPLY' | 'REFLECT', label: string) => {
      addSubSectionTitle(`${subLetter}. ${label}`);
      const filtered = experiences.filter((e) => e.phase === phase);
      if (isBlankMode) {
        addListParagraph('........................................................................................................................');
      } else if (filtered.length === 0) {
        addListParagraph('-');
      } else {
        filtered.forEach((e) => {
          addListParagraph(`• ${e.description}${typeof e.durationMinutes === 'number' && e.durationMinutes > 0 ? ` (${e.durationMinutes} Menit)` : ''}`);
        });
      }
    };

    renderExpPhase('A', 'UNDERSTAND', 'Memahami');
    renderExpPhase('B', 'APPLY', 'Mengaplikasi');
    renderExpPhase('C', 'REFLECT', 'Merefleksi');
  } else {
    addSectionTitle('III. KEGIATAN PEMBELAJARAN');

    const renderStepPhase = (subLetter: string, label: string, steps: typeof openingSteps) => {
      addSubSectionTitle(`${subLetter}. ${label}`);
      if (isBlankMode) {
        addListParagraph('........................................................................................................................');
      } else if (steps.length === 0) {
        addListParagraph('-');
      } else {
        steps.forEach((s) => {
          addListParagraph(`• ${s.title ? `[${s.title}] ` : ''}${s.description}${typeof s.durationMinutes === 'number' && s.durationMinutes > 0 ? ` (${s.durationMinutes} Menit)` : ''}`);
        });
      }
    };

    renderStepPhase('A', 'Kegiatan Pendahuluan', openingSteps);
    renderStepPhase('B', 'Kegiatan Inti', coreSteps);
    renderStepPhase('C', 'Kegiatan Penutup', closingSteps);
  }

  if (plan.differentiation && (plan.differentiation.content || plan.differentiation.process || plan.differentiation.product || plan.differentiation.notes)) {
    addSubSectionTitle('D. Rencana Pembelajaran Berdiferensiasi');
    if (plan.differentiation.content) addListParagraph(`• Diferensiasi Konten: ${plan.differentiation.content}`);
    if (plan.differentiation.process) addListParagraph(`• Diferensiasi Proses: ${plan.differentiation.process}`);
    if (plan.differentiation.product) addListParagraph(`• Diferensiasi Produk: ${plan.differentiation.product}`);
    if (plan.differentiation.notes) addListParagraph(`• Catatan: ${plan.differentiation.notes}`);
  }

  // IV. ASESMEN PEMBELAJARAN
  addSectionTitle('IV. ASESMEN PEMBELAJARAN');

  const renderAssessmentGroup = (subLetter: string, label: string, items?: typeof plan.assessmentPlan.initial) => {
    addSubSectionTitle(`${subLetter}. ${label}`);
    if (isBlankMode) {
      addListParagraph('........................................................................................................................');
    } else if (!items || items.length === 0) {
      addListParagraph('-');
    } else {
      items.forEach((a) => {
        addListParagraph(`• ${a.description || a.method || a.technique || 'Asesmen'}${a.technique ? ` (Teknik: ${a.technique})` : ''}${a.instrument ? ` (Instrumen: ${a.instrument})` : ''}`);
      });
    }
  };

  renderAssessmentGroup('A', 'Asesmen Awal (Diagnostik)', plan.assessmentPlan?.initial);
  renderAssessmentGroup('B', 'Asesmen Formatif', plan.assessmentPlan?.formative);
  renderAssessmentGroup('C', 'Asesmen Sumatif', plan.assessmentPlan?.summative);

  // V. PENGAYAAN DAN REMEDIAL
  addSectionTitle('V. PENGAYAAN DAN REMEDIAL');
  addSubSectionTitle('A. Rencana Pengayaan');
  addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.enrichmentPlan || '-'));
  addSubSectionTitle('B. Rencana Remedial');
  addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.remedialPlan || '-'));

  // VI. REFLEKSI
  if (plan.reflection?.teacherReflection || plan.reflection?.studentReflection || isBlankMode) {
    addSectionTitle('VI. REFLEKSI');
    if (plan.reflection?.teacherReflection || isBlankMode) {
      addSubSectionTitle('A. Refleksi Guru');
      addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.reflection?.teacherReflection || '-'));
    }
    if (plan.reflection?.studentReflection || isBlankMode) {
      addSubSectionTitle('B. Refleksi Murid');
      addProseParagraph(isBlankMode ? '........................................................................................................................' : (plan.reflection?.studentReflection || '-'));
    }
  }

  // Signoff Block in Times New Roman
  docChildren.push(
    ...createModulAjarSignoffBlock(
      school,
      profile,
      isBlankMode,
      context.documentDate
    )
  );

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1417, // 2.5 cm (2.5 * 566.929 = 1417 twips)
              bottom: 1417, // 2.5 cm
              left: 1701, // 3.0 cm (3.0 * 566.929 = 1701 twips)
              right: 1417, // 2.5 cm
            },
          },
        },
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `MODUL_AJAR_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'MODUL_AJAR',
    title: docTitle,
    fileName,
    blob,
    document: doc,
    record: {
      id: `doc-modul-${Date.now()}`,
      type: 'MODUL_AJAR',
      title: docTitle,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
