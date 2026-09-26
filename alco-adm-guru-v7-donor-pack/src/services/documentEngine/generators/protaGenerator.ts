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
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
} from '../docxStyles';
import { getSubjectJP, calculateAvailableJP, calculateEffectiveDays, normalizeLearningAllocation } from '../../jpEngine';

export async function generatePROTA(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp, tp, cp, calendar, calendarDays, timeAllocations } = context;

  const docChildren: (Paragraph | Table)[] = [];

  // Look up verified official rule
  const officialRule = getSubjectJP({
    curriculum: academicSetting.curriculum,
    level: academicSetting.level,
    grade: academicSetting.grade,
    subject: academicSetting.subject,
  });

  const weeklyJP = academicSetting.subjectWeeklyJP || academicSetting.totalHoursPerWeek || officialRule.weeklyJP || null;
  const annualJP = officialRule.annualJP ?? null;

  // Normalize all allocations from context
  const normalizedAllocations = (timeAllocations || []).map(normalizeLearningAllocation);

  // 1. Header
  docChildren.push(
    ...createDocumentHeader(
      'PROGRAM TAHUNAN (PROTA)',
      `${academicSetting.curriculum} — TAHUN AJARAN ${academicSetting.academicYear || '2026/2027'}`
    )
  );

  // 2. Identity Box with Provenance Metadata
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Alokasi Intrakurikuler per Minggu', `: ${weeklyJP !== null ? `${weeklyJP} JP / Minggu` : 'Input Manual Diperlukan'}`],
      ['Total Alokasi Waktu Tahunan Resmi', `: ${annualJP !== null ? `${annualJP} JP / Tahun` : 'Belum Diverifikasi'}`],
      ['Dasar Regulasi Struktur Kurikulum', `: ${officialRule.regulation || 'Struktur Kustom Guru'}`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // 3. Capaian Pembelajaran (CP) / SKL Singkat
  const isK13Curriculum = academicSetting.curriculumType === 'K13' || academicSetting.curriculum === 'Kurikulum 2013';

  if (isK13Curriculum) {
    if (context.k13Analysis?.items && context.k13Analysis.items.length > 0) {
      const sklText = context.k13Analysis.items[0].skl || 'Memiliki perilaku yang mencerminkan sikap orang beriman, berakhlak mulia, dan bertanggung jawab sesuai standar kompetensi lulusan.';
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: 'A. Standar Kompetensi Lulusan (SKL) & Kompetensi Inti (KI)',
              bold: true,
              size: 22,
              font: 'Arial',
              color: '1E3A8A',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 160 },
          children: [
            new TextRun({
              text: sklText,
              size: 19,
              font: 'Arial',
            }),
          ],
        })
      );
    }
  } else if (cp?.generalDescription) {
    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({
            text: 'A. Capaian Pembelajaran (CP) Fase',
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({
            text: cp.generalDescription,
            size: 19,
            font: 'Arial',
          }),
        ],
      })
    );
  }

  // 4. Tabel Pemetaan Program Tahunan (Distribusi JP per TP / KD)
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'B. Distribusi Alokasi Waktu Pembelajaran Tahunan',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  const tableHeaderRow = isK13Curriculum
    ? new TableRow({
        tableHeader: true,
        children: [
          createTableHeaderCell('No', 6),
          createTableHeaderCell('Kompetensi Dasar (KD)', 30, AlignmentType.LEFT),
          createTableHeaderCell('Materi Pokok & Kegiatan Pembelajaran', 34, AlignmentType.LEFT),
          createTableHeaderCell('Alokasi Waktu (JP)', 15),
          createTableHeaderCell('Semester', 15),
        ],
      })
    : new TableRow({
        tableHeader: true,
        children: [
          createTableHeaderCell('No', 6),
          createTableHeaderCell('Kode TP', 14),
          createTableHeaderCell('Tujuan Pembelajaran & Ruang Lingkup Materi', 50, AlignmentType.LEFT),
          createTableHeaderCell('Alokasi Waktu (JP)', 15),
          createTableHeaderCell('Semester', 15),
        ],
      });

  let totalAllocatedJPSum = 0;
  let tableDataRows: TableRow[] = [];

  if (isK13Curriculum) {
    const k13Items = context.k13Analysis?.items || [];
    tableDataRows = k13Items.map((item, index) => {
      const matchingAlloc = normalizedAllocations.find(
        (a) => a.sourceId === item.id || a.sourceId === item.kd
      );
      const allocatedJP = matchingAlloc?.allocatedJP ?? (item.alokasiJp ? Number(item.alokasiJp) : null);
      if (allocatedJP !== null) {
        totalAllocatedJPSum += allocatedJP;
      }

      const itemSemester = matchingAlloc?.semester === '2' ? 'Semester 2 (Genap)' : 'Semester 1 (Ganjil)';

      return new TableRow({
        children: [
          createTableDataCell(`${index + 1}`, 6, AlignmentType.CENTER),
          createTableDataCell(item.kd, 30, AlignmentType.LEFT, true),
          createTableDataCell(`${item.materi || '-'}\nKegiatan: ${item.kegiatan || '-'}`, 34, AlignmentType.LEFT),
          createTableDataCell(allocatedJP !== null ? `${allocatedJP} JP` : '-', 15, AlignmentType.CENTER, true),
          createTableDataCell(itemSemester, 15, AlignmentType.CENTER),
        ],
      });
    });
  } else {
    const items = atp?.items && atp.items.length > 0 ? atp.items : [];

    tableDataRows = items.map((item, index) => {
      const matchingAlloc = normalizedAllocations.find(
        (a) => a.sourceId === item.id || a.sourceId === item.tpCode || a.tpId === item.id || a.atpItemId === item.id
      );
      const allocatedJP = matchingAlloc?.allocatedJP ?? (item.jp ? Number(item.jp) : null);
      if (allocatedJP !== null) {
        totalAllocatedJPSum += allocatedJP;
      }

      const itemSemester = matchingAlloc?.semester === '2' ? 'Semester 2 (Genap)' : 'Semester 1 (Ganjil)';

      return new TableRow({
        children: [
          createTableDataCell(`${index + 1}`, 6, AlignmentType.CENTER),
          createTableDataCell(item.tpCode || `TP.${index + 1}`, 14, AlignmentType.CENTER, true),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: item.tpStatement, size: 19, font: 'Arial' }),
                  item.materialScope
                    ? new TextRun({ text: `\nMateri Pokok: ${item.materialScope}`, italics: true, size: 18, color: '475569' })
                    : new TextRun({ text: '' }),
                ],
              }),
            ],
          }),
          createTableDataCell(allocatedJP !== null ? `${allocatedJP} JP` : '-', 15, AlignmentType.CENTER, true),
          createTableDataCell(itemSemester, 15, AlignmentType.CENTER),
        ],
      });
    });
  }

  // Explicit Assessment Allocations ONLY
  const assessmentAllocs = normalizedAllocations.filter((a) => a.sourceType === 'ASSESSMENT');
  assessmentAllocs.forEach((aAlloc, aIdx) => {
    const aJp = aAlloc.allocatedJP || 0;
    totalAllocatedJPSum += aJp;
    tableDataRows.push(
      new TableRow({
        children: [
          createTableDataCell(`${tableDataRows.length + 1}`, 6, AlignmentType.CENTER),
          createTableDataCell('ASESMEN', isK13Curriculum ? 30 : 14, AlignmentType.CENTER, true),
          createTableDataCell(aAlloc.notes || 'Asesmen Sumatif / Evaluasi Pembelajaran', isK13Curriculum ? 34 : 50, AlignmentType.LEFT),
          createTableDataCell(`${aJp} JP`, 15, AlignmentType.CENTER, true),
          createTableDataCell(aAlloc.semester === '2' ? 'Semester 2 (Genap)' : 'Semester 1 (Ganjil)', 15, AlignmentType.CENTER),
        ],
      })
    );
  });

  // Summary Row
  const totalRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 70, type: WidthType.PERCENTAGE },
        columnSpan: 3,
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: 'TOTAL ALOKASI JP TERCATAT: ',
                bold: true,
                size: 20,
                font: 'Arial',
              }),
            ],
          }),
        ],
      }),
      createTableDataCell(`${totalAllocatedJPSum} JP`, 15, AlignmentType.CENTER, true),
      new TableCell({
        width: { size: 15, type: WidthType.PERCENTAGE },
        children: [new Paragraph({})],
      }),
    ],
  });

  const protaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows, totalRow],
  });

  docChildren.push(protaTable);

  // Status Alokasi Waktu
  let allocationStatusText = 'Belum ada data alokasi waktu.';
  if (annualJP !== null) {
    const remainingJP = annualJP - totalAllocatedJPSum;
    if (remainingJP > 0) {
      allocationStatusText = `Sisa JP Belum Dialokasikan: ${remainingJP} JP dari standar tahunan (${annualJP} JP/tahun).`;
    } else if (remainingJP === 0) {
      allocationStatusText = `Alokasi Seimbang: Tepat ${totalAllocatedJPSum} JP sesuai kapasitas tahunan resmi (${annualJP} JP).`;
    } else {
      allocationStatusText = `Defisit JP: Total alokasi (${totalAllocatedJPSum} JP) melampaui kapasitas tahunan resmi (${annualJP} JP) sebesar ${Math.abs(remainingJP)} JP.`;
    }
  }

  docChildren.push(
    new Paragraph({
      spacing: { before: 140, after: 60 },
      children: [
        new TextRun({
          text: 'Status Alokasi Waktu Tahunan:',
          bold: true,
          size: 19,
          font: 'Arial',
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `• ${allocationStatusText}\n• Angka alokasi waktu berasal dari data perencanaan pembelajaran nyata yang telah disusun guru.\n• Item bertanda strip (-) menunjukkan unit kompetensi yang belum dialokasikan beban jam pelajarannya.`,
          size: 18,
          font: 'Arial',
          italics: true,
          color: '475569',
        }),
      ],
    })
  );

  // 5. Signoff
  docChildren.push(...createSignoffBlock(school, profile));

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,
              bottom: 1440,
              left: 1440,
              right: 1440,
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
  const fileName = `PROTA_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'PROTA',
    title: 'Program Tahunan (PROTA)',
    fileName,
    blob,
    record: {
      id: `doc-prota-${Date.now()}`,
      type: 'PROTA',
      title: 'Program Tahunan (PROTA)',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
