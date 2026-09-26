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
import { getSubjectJP, calculateAvailableJP, calculateEffectiveDays, normalizeLearningAllocation, getEffectiveWeeksList } from '../../jpEngine';

export async function generatePROMES(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp, calendar, calendarDays, timeAllocations } = context;

  const docChildren: (Paragraph | Table)[] = [];

  const isSemesterGanjil =
    academicSetting.semester?.includes('1') || academicSetting.semester?.toLowerCase().includes('ganjil');
  const semesterLabel = isSemesterGanjil ? 'Semester 1 (Ganjil)' : 'Semester 2 (Genap)';
  const semesterKey = isSemesterGanjil ? '1' : '2';
  const months = isSemesterGanjil
    ? ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    : ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni'];

  // Look up verified official rule
  const officialRule = getSubjectJP({
    curriculum: academicSetting.curriculum,
    level: academicSetting.level,
    grade: academicSetting.grade,
    subject: academicSetting.subject,
  });

  const weeklyJP = academicSetting.subjectWeeklyJP || academicSetting.totalHoursPerWeek || officialRule.weeklyJP || null;

  // Read calendar strictly from context
  const hasCalendar = !!(calendar?.startDate && calendar?.endDate);
  const schoolDaysPerWeek = calendar?.schoolDaysPerWeek ?? null;

  let effectiveDaysCount = 0;
  let effectiveWeeksCount = 0;
  let availableJPCount = 0;
  let calendarStatusNote = 'Data kalender satuan pendidikan terhubung';

  if (hasCalendar && calendar) {
    const effectiveResult = calculateEffectiveDays(calendar, calendarDays || []);
    effectiveDaysCount = effectiveResult.effectiveLearningDays;
    const availableJP = calculateAvailableJP({
      subjectWeeklyJP: weeklyJP || 0,
      effectiveLearningDays: effectiveDaysCount,
      schoolDaysPerWeek: calendar.schoolDaysPerWeek,
      semester: semesterLabel,
      academicYear: academicSetting.academicYear,
      level: academicSetting.level,
      grade: academicSetting.grade,
      subject: academicSetting.subject,
      officialAnnualJP: officialRule.annualJP,
    });
    effectiveWeeksCount = availableJP.effectiveWeeksRounded ?? 0;
    availableJPCount = availableJP.availableJP ?? 0;
  } else {
    calendarStatusNote = 'Data kalender belum dikonfigurasi pada sistem';
  }

  const effectiveWeeksList = hasCalendar ? getEffectiveWeeksList(calendar, calendarDays || []) : [];

  // Helper for Month Resolution (Patch: Effective-week actual date to month)
  const resolveMonthIndex = (alloc?: { month?: number; startWeek?: number }): number | null => {
    if (!alloc) return null;

    // 1. Use allocation.month if available
    if (alloc.month && alloc.month >= 1 && alloc.month <= 6) {
      return alloc.month - 1;
    }
    if (alloc.month && alloc.month >= 7 && alloc.month <= 12) {
      return isSemesterGanjil ? alloc.month - 7 : (!isSemesterGanjil ? alloc.month - 1 : null);
    }

    // 2. Resolve startWeek via effectiveWeeksList to actual effective week's month
    if (alloc.startWeek && alloc.startWeek > 0 && effectiveWeeksList.length > 0) {
      const match = effectiveWeeksList.find(w => w.weekIndex === alloc.startWeek);
      if (match) {
        const calMonth = match.month; // 1..12
        if (isSemesterGanjil && calMonth >= 7 && calMonth <= 12) {
          return calMonth - 7;
        } else if (!isSemesterGanjil && calMonth >= 1 && calMonth <= 6) {
          return calMonth - 1;
        }
      }
    }

    // 3. Unresolved / cannot determine month deterministically (no synthetic guessing)
    return null;
  };

  // Normalize all allocations from context
  const normalizedAllocations = (timeAllocations || []).map(normalizeLearningAllocation);

  // 1. Header
  docChildren.push(
    ...createDocumentHeader(
      'PROGRAM SEMESTER (PROMES)',
      `${academicSetting.curriculum} — ${semesterLabel.toUpperCase()} TP ${academicSetting.academicYear || '2026/2027'}`
    )
  );

  // 2. Identity Box
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Alokasi Intrakurikuler per Minggu', `: ${weeklyJP !== null ? `${weeklyJP} JP / Minggu` : 'Input Manual Diperlukan'}`],
      ['Minggu Efektif Semester', `: ${hasCalendar ? `${effectiveWeeksCount} Minggu (${effectiveDaysCount} Hari Efektif)` : calendarStatusNote}`],
      ['Total Kapasitas JP Tersedia', `: ${hasCalendar ? `${availableJPCount} JP` : '-'}`],
      ['Dasar Regulasi Struktur', `: ${officialRule.regulation || 'Struktur Kustom Guru'}`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // 3. Matrix Table
  docChildren.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_3,
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: 'Matriks Distribusi Alokasi Waktu Pembelajaran Bulanan',
          bold: true,
          size: 22,
          font: 'Arial',
          color: '1E3A8A',
        }),
      ],
    })
  );

  const isK13Curriculum = academicSetting.curriculumType === 'K13' || academicSetting.curriculum === 'Kurikulum 2013';
  const monthHeaderCells = months.map((m) => createTableHeaderCell(m, 7));

  const tableHeaderRow1 = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 5),
      createTableHeaderCell(isK13Curriculum ? 'Kompetensi Dasar (KD)' : 'Kode TP', isK13Curriculum ? 15 : 10),
      createTableHeaderCell(
        isK13Curriculum ? 'Indikator & Materi Pembelajaran' : 'Tujuan Pembelajaran & Ruang Lingkup Materi',
        isK13Curriculum ? 28 : 33,
        AlignmentType.LEFT
      ),
      createTableHeaderCell('Alokasi JP', 10),
      ...monthHeaderCells,
    ],
  });

  let totalAllocatedJPSum = 0;
  let dataRows: TableRow[] = [];

  if (isK13Curriculum) {
    const k13Items = context.k13Analysis?.items || [];
    dataRows = k13Items.map((item, idx) => {
      // Find matching allocation by sourceId (item.id or item.kd)
      const matchingAlloc = normalizedAllocations.find(
        (a) => a.sourceId === item.id || a.sourceId === item.kd
      );

      const allocatedJP = matchingAlloc?.allocatedJP ?? (item.alokasiJp ? Number(item.alokasiJp) : null);
      if (allocatedJP !== null) {
        totalAllocatedJPSum += allocatedJP;
      }

      // Determine month strictly using resolveMonthIndex (Patch C)
      const targetMonthIdx = resolveMonthIndex(matchingAlloc);

      const monthDistributionCells = months.map((_, mIdx) => {
        const isTarget = targetMonthIdx !== null && mIdx === targetMonthIdx;
        return createTableDataCell(isTarget && allocatedJP !== null ? `${allocatedJP}` : '-', 7, AlignmentType.CENTER);
      });

      return new TableRow({
        children: [
          createTableDataCell(`${idx + 1}`, 5, AlignmentType.CENTER),
          createTableDataCell(item.kd, 15, AlignmentType.LEFT, true),
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: item.indikator || item.materi || '-', size: 19, font: 'Arial' }),
                  item.materi
                    ? new TextRun({ text: `\nMateri: ${item.materi}`, italics: true, size: 18, color: '475569' })
                    : new TextRun({ text: '' }),
                ],
              }),
            ],
          }),
          createTableDataCell(allocatedJP !== null ? `${allocatedJP} JP` : '-', 10, AlignmentType.CENTER, true),
          ...monthDistributionCells,
        ],
      });
    });
  } else {
    const items = atp?.items && atp.items.length > 0 ? atp.items : [];

    dataRows = items.map((item, idx) => {
      // Find matching allocation by sourceId (item.id or item.tpCode)
      const matchingAlloc = normalizedAllocations.find(
        (a) => a.sourceId === item.id || a.sourceId === item.tpCode || a.tpId === item.id || a.atpItemId === item.id
      );

      const allocatedJP = matchingAlloc?.allocatedJP ?? (item.jp ? Number(item.jp) : null);
      if (allocatedJP !== null) {
        totalAllocatedJPSum += allocatedJP;
      }

      // Determine month strictly using resolveMonthIndex (Patch C)
      const targetMonthIdx = resolveMonthIndex(matchingAlloc);

      const monthDistributionCells = months.map((_, mIdx) => {
        const isTarget = targetMonthIdx !== null && mIdx === targetMonthIdx;
        return createTableDataCell(isTarget && allocatedJP !== null ? `${allocatedJP}` : '-', 7, AlignmentType.CENTER);
      });

      return new TableRow({
        children: [
          createTableDataCell(`${idx + 1}`, 5, AlignmentType.CENTER),
          createTableDataCell(item.tpCode || `TP.${idx + 1}`, 10, AlignmentType.CENTER, true),
          new TableCell({
            width: { size: 33, type: WidthType.PERCENTAGE },
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: item.tpStatement, size: 19, font: 'Arial' }),
                  item.materialScope
                    ? new TextRun({ text: `\nMateri: ${item.materialScope}`, italics: true, size: 18, color: '475569' })
                    : new TextRun({ text: '' }),
                ],
              }),
            ],
          }),
          createTableDataCell(allocatedJP !== null ? `${allocatedJP} JP` : '-', 10, AlignmentType.CENTER, true),
          ...monthDistributionCells,
        ],
      });
    });
  }

  // Explicit Assessment Allocations ONLY
  const assessmentAllocs = normalizedAllocations.filter((a) => a.sourceType === 'ASSESSMENT');
  const assessmentRows: TableRow[] = [];

  assessmentAllocs.forEach((aAlloc, aIdx) => {
    const aJp = aAlloc.allocatedJP || 0;
    totalAllocatedJPSum += aJp;
    const aMonthIdx = resolveMonthIndex(aAlloc);

    const aMonthCells = months.map((_, mIdx) =>
      createTableDataCell(aMonthIdx !== null && mIdx === aMonthIdx ? `${aJp}` : '-', 7, AlignmentType.CENTER)
    );

    assessmentRows.push(
      new TableRow({
        children: [
          createTableDataCell(`${dataRows.length + aIdx + 1}`, 5, AlignmentType.CENTER),
          createTableDataCell('ASESMEN', isK13Curriculum ? 15 : 10, AlignmentType.CENTER),
          createTableDataCell(aAlloc.notes || 'Asesmen Sumatif / Evaluasi Pembelajaran', isK13Curriculum ? 28 : 33),
          createTableDataCell(`${aJp} JP`, 10, AlignmentType.CENTER, true),
          ...aMonthCells,
        ],
      })
    );
  });

  // Total Summary Row
  const totalMonthCells = months.map(() => createTableDataCell('-', 7, AlignmentType.CENTER));
  const totalRow = new TableRow({
    children: [
      new TableCell({
        width: { size: 48, type: WidthType.PERCENTAGE },
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
      createTableDataCell(`${totalAllocatedJPSum} JP`, 10, AlignmentType.CENTER, true),
      ...totalMonthCells,
    ],
  });

  const promesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow1, ...dataRows, ...assessmentRows, totalRow],
  });

  docChildren.push(promesTable);

  // Keterangan Pelaksanaan & Status Alokasi
  const remainingJP = hasCalendar ? availableJPCount - totalAllocatedJPSum : null;
  let allocationStatusText = 'Belum dilakukan verifikasi kalender.';
  if (remainingJP !== null) {
    if (remainingJP > 0) {
      allocationStatusText = `Sisa JP Belum Dialokasikan: ${remainingJP} JP dari kapasitas ${availableJPCount} JP.`;
    } else if (remainingJP === 0) {
      allocationStatusText = `Alokasi Seimbang: Tepat ${totalAllocatedJPSum} JP sesuai kapasitas tersedia.`;
    } else {
      allocationStatusText = `Defisit JP: Alokasi (${totalAllocatedJPSum} JP) melebihi kapasitas tersedia (${availableJPCount} JP) sebesar ${Math.abs(remainingJP)} JP.`;
    }
  }

  docChildren.push(
    new Paragraph({
      spacing: { before: 140, after: 60 },
      children: [
        new TextRun({
          text: 'Status & Catatan Pelaksanaan:',
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
          text: `• Status Alokasi Waktu: ${allocationStatusText}\n• Angka pada kolom bulan menunjukkan Jam Pelajaran (JP) intrakurikuler tatap muka yang telah dijadwalkan guru.\n• Item tanpa alokasi bulan diberi tanda strip (-) yang berarti belum dijadwalkan pada kalender aktif.`,
          size: 18,
          font: 'Arial',
          italics: true,
          color: '475569',
        }),
      ],
    })
  );

  // 4. Signoff Block
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
  const fileName = `PROMES_${cleanSubject}_${cleanGrade}_${new Date().toISOString().slice(0, 10)}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'PROMES',
    title: 'Program Semester (PROMES)',
    fileName,
    blob,
    record: {
      id: `doc-promes-${Date.now()}`,
      type: 'PROMES',
      title: 'Program Semester (PROMES)',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
