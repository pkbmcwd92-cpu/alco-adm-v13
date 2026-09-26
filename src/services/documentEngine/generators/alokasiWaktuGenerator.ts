import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  AlignmentType,
  WidthType,
} from 'docx';
import saveAs from 'file-saver';
import { DocumentGenerationContext, GeneratedDocumentResult } from '../types';
import {
  createDocumentHeader,
  createIdentityMetadataTable,
  createTableHeaderCell,
  createTableDataCell,
  createSignoffBlock,
  createSectionHeading,
  createDocxSectionProperties,
} from '../docxStyles';
import { getSubjectJP, normalizeLearningAllocation } from '../../jpEngine';

export async function generateAlokasiWaktu(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, atp, calendar, timeAllocations, k13Analysis } = context;

  const docChildren: (Paragraph | Table)[] = [];

  const isK13Curriculum = academicSetting.curriculumType === 'K13' || academicSetting.curriculum === 'Kurikulum 2013';

  // Look up verified official rule
  const officialRule = getSubjectJP({
    curriculum: academicSetting.curriculum,
    level: academicSetting.level,
    grade: academicSetting.grade,
    subject: academicSetting.subject,
  });

  const weeklyJP = academicSetting.subjectWeeklyJP || calendar?.jpPerWeek || academicSetting.totalHoursPerWeek || officialRule.weeklyJP || null;

  // Normalize allocations
  const normalizedAllocations = (timeAllocations || []).map(normalizeLearningAllocation);

  // Compute total planned JP from recorded allocations or explicit unit JP
  let totalAllocatedJP = 0;
  if (isK13Curriculum) {
    (k13Analysis?.items || []).forEach((item) => {
      const match = normalizedAllocations.find((a) => a.sourceId === item.id || a.sourceId === item.kd);
      const jp = match?.allocatedJP ?? (item.alokasiJp ? Number(item.alokasiJp) : 0);
      totalAllocatedJP += jp;
    });
  } else {
    (atp?.items || []).forEach((item) => {
      const match = normalizedAllocations.find(
        (a) => a.sourceId === item.id || a.sourceId === item.tpCode || a.tpId === item.id || a.atpItemId === item.id
      );
      const jp = match?.allocatedJP ?? (item.jp ? Number(item.jp) : 0);
      totalAllocatedJP += jp;
    });
  }

  // Header
  docChildren.push(
    ...createDocumentHeader(
      'RINCIAN DISTRIBUSI ALOKASI WAKTU PEMBELAJARAN',
      `${academicSetting.curriculum} — TP ${academicSetting.academicYear || '-'}`
    )
  );

  // Metadata Table
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['Tahun Ajaran / Semester', `: ${academicSetting.academicYear || '-'} / ${academicSetting.semester || '-'}`],
      ['Beban JP Intrakurikuler per Minggu', `: ${weeklyJP !== null ? `${weeklyJP} JP / Minggu` : 'Input Manual Diperlukan'}`],
      ['Total Alokasi Pembelajaran Terdata', `: ${totalAllocatedJP} Jam Pelajaran (JP)`],
      ['Dasar Regulasi Struktur', `: ${officialRule.regulation || 'Struktur Kustom Guru'}`],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Section
  docChildren.push(
    createSectionHeading(
      isK13Curriculum
        ? 'A. Pemetaan Waktu Berdasarkan Analisis Kompetensi Dasar (KD)'
        : 'A. Pemetaan Waktu Berdasarkan Alur Tujuan Pembelajaran (ATP)',
      1
    )
  );

  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 8, AlignmentType.CENTER),
        createTableHeaderCell(isK13Curriculum ? 'Kompetensi Dasar (KD)' : 'Kode TP', 16, AlignmentType.CENTER),
        createTableHeaderCell(isK13Curriculum ? 'Materi Pokok & Kegiatan' : 'Tujuan Pembelajaran (TP) & Lingkup Materi', 48, AlignmentType.LEFT),
        createTableHeaderCell('Alokasi JP', 14, AlignmentType.CENTER),
        createTableHeaderCell('Distribusi Pekan Ke-', 14, AlignmentType.CENTER),
      ],
    }),
  ];

  if (isK13Curriculum) {
    const k13Items = k13Analysis?.items || [];
    if (k13Items.length === 0) {
      rows.push(
        new TableRow({
          children: [
            createTableDataCell('1', 8, AlignmentType.CENTER),
            createTableDataCell('KD -', 16, AlignmentType.CENTER),
            createTableDataCell('Belum ada butir analisis KD yang disusun.', 48),
            createTableDataCell('-', 14, AlignmentType.CENTER),
            createTableDataCell('-', 14, AlignmentType.CENTER),
          ],
        })
      );
    } else {
      k13Items.forEach((item, index) => {
        const matchingAlloc = normalizedAllocations.find(
          (a) => a.sourceId === item.id || a.sourceId === item.kd
        );
        const itemJP = matchingAlloc?.allocatedJP ?? (item.alokasiJp ? Number(item.alokasiJp) : null);
        
        let weekDisplay = '-';
        if (matchingAlloc?.startWeek && matchingAlloc?.endWeek) {
          weekDisplay = matchingAlloc.startWeek === matchingAlloc.endWeek
            ? `Pekan ${matchingAlloc.startWeek}`
            : `Pekan ${matchingAlloc.startWeek} - ${matchingAlloc.endWeek}`;
        } else if (matchingAlloc?.weekNumber) {
          weekDisplay = `Pekan ${matchingAlloc.weekNumber}`;
        }

        rows.push(
          new TableRow({
            children: [
              createTableDataCell((index + 1).toString(), 8, AlignmentType.CENTER),
              createTableDataCell(item.kd, 16, AlignmentType.LEFT, true),
              createTableDataCell(`${item.materi || '-'}\n• Kegiatan: ${item.kegiatan || '-'}`, 48),
              createTableDataCell(itemJP !== null ? `${itemJP} JP` : '-', 14, AlignmentType.CENTER, true),
              createTableDataCell(weekDisplay, 14, AlignmentType.CENTER),
            ],
          })
        );
      });
    }
  } else {
    const atpItems = atp?.items || [];
    if (atpItems.length === 0) {
      rows.push(
        new TableRow({
          children: [
            createTableDataCell('1', 8, AlignmentType.CENTER),
            createTableDataCell('TP -', 16, AlignmentType.CENTER),
            createTableDataCell('Belum ada Alur Tujuan Pembelajaran yang disusun.', 48),
            createTableDataCell('-', 14, AlignmentType.CENTER),
            createTableDataCell('-', 14, AlignmentType.CENTER),
          ],
        })
      );
    } else {
      atpItems.forEach((item, index) => {
        const matchingAlloc = normalizedAllocations.find(
          (a) => a.sourceId === item.id || a.sourceId === item.tpCode || a.tpId === item.id || a.atpItemId === item.id
        );
        const itemJP = matchingAlloc?.allocatedJP ?? (item.jp ? Number(item.jp) : null);

        let weekDisplay = '-';
        if (matchingAlloc?.startWeek && matchingAlloc?.endWeek) {
          weekDisplay = matchingAlloc.startWeek === matchingAlloc.endWeek
            ? `Pekan ${matchingAlloc.startWeek}`
            : `Pekan ${matchingAlloc.startWeek} - ${matchingAlloc.endWeek}`;
        } else if (matchingAlloc?.weekNumber) {
          weekDisplay = `Pekan ${matchingAlloc.weekNumber}`;
        }

        rows.push(
          new TableRow({
            children: [
              createTableDataCell((index + 1).toString(), 8, AlignmentType.CENTER),
              createTableDataCell(item.tpCode || `TP.${index + 1}`, 16, AlignmentType.CENTER),
              createTableDataCell(
                `${item.tpStatement || '-'}\n• Ruang Lingkup Materi: ${item.materialScope || '-'}`,
                48
              ),
              createTableDataCell(itemJP !== null ? `${itemJP} JP` : '-', 14, AlignmentType.CENTER, true),
              createTableDataCell(weekDisplay, 14, AlignmentType.CENTER),
            ],
          })
        );
      });
    }
  }

  // Summary row
  rows.push(
    new TableRow({
      children: [
        createTableHeaderCell('', 8, AlignmentType.CENTER),
        createTableHeaderCell('TOTAL', 16, AlignmentType.CENTER),
        createTableHeaderCell('Total Alokasi Waktu Pembelajaran Terjadwal', 48, AlignmentType.LEFT),
        createTableHeaderCell(`${totalAllocatedJP} JP`, 14, AlignmentType.CENTER),
        createTableHeaderCell('-', 14, AlignmentType.CENTER),
      ],
    })
  );

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  docChildren.push(new Paragraph({ spacing: { after: 240 } }));

  // Signatures
  docChildren.push(...createSignoffBlock(school, profile, context.documentMode === 'blank', context.documentDate));

  // Build Document (Portrait A4)
  const doc = new Document({
    sections: [
      {
        properties: createDocxSectionProperties('portrait'),
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeSubject = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const safeGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Alokasi_Waktu_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'ALOKASI_WAKTU',
    title: `Alokasi Waktu - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-alokasi-${Date.now()}`,
      type: 'ALOKASI_WAKTU',
      title: `Alokasi Waktu - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
