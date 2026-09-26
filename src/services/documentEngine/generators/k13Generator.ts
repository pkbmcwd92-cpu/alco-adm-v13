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
  createDocxSectionProperties,
} from '../docxStyles';

export async function generateAnalisisK13(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, k13Analysis } = context;

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  docChildren.push(...createDocumentHeader('ANALISIS KETERKAITAN SKL, KI, DAN KD', 'KURIKULUM 2013'));

  // Metadata Table
  docChildren.push(createIdentityMetadataTable(school, profile, academicSetting));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Table
  const items = k13Analysis?.items || [];
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6, AlignmentType.CENTER),
        createTableHeaderCell('Standar Kompetensi Lulusan (SKL)', 20, AlignmentType.LEFT),
        createTableHeaderCell('Kompetensi Inti (KI)', 20, AlignmentType.LEFT),
        createTableHeaderCell('Kompetensi Dasar (KD)', 24, AlignmentType.LEFT),
        createTableHeaderCell('Indikator Pencapaian Kompetensi (IPK)', 30, AlignmentType.LEFT),
      ],
    }),
  ];

  if (items.length === 0) {
    rows.push(
      new TableRow({
        children: [
          createTableDataCell('1', 6, AlignmentType.CENTER),
          createTableDataCell('Memiliki perilaku yang mencerminkan sikap orang beriman, berakhlak mulia, dan percaya diri.', 20),
          createTableDataCell('KI-3 (Pengetahuan) & KI-4 (Keterampilan) memahami pengetahuan faktual dan konseptual.', 20),
          createTableDataCell('3.1 Memahami variasi pola gerak dasar lokomotor, non-lokomotor, dan manipulatif.', 24),
          createTableDataCell('3.1.1 Menjelaskan konsep pola gerak dasar secara tepat.\n4.1.1 Mempraktikkan gerak dasar.', 30),
        ],
      })
    );
  } else {
    items.forEach((item, index) => {
      rows.push(
        new TableRow({
          children: [
            createTableDataCell((index + 1).toString(), 6, AlignmentType.CENTER),
            createTableDataCell(item.skl || 'SKL Sikap, Pengetahuan, dan Keterampilan', 20),
            createTableDataCell(item.ki || 'KI-3 / KI-4', 20),
            createTableDataCell(item.kd || 'Kompetensi Dasar', 24),
            createTableDataCell(
              `${item.indikator || 'Indikator Pencapaian'}\n• Materi: ${item.materi || '-'}\n• Kegiatan: ${item.kegiatan || '-'}`,
              30
            ),
          ],
        })
      );
    });
  }

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  docChildren.push(new Paragraph({ spacing: { after: 220 } }));

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
  const fileName = `Analisis_SKL_KI_KD_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'ANALISIS_SKL_KI_KD',
    title: `Analisis SKL-KI-KD - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-k13-analisis-${Date.now()}`,
      type: 'ANALISIS_SKL_KI_KD',
      title: `Analisis SKL-KI-KD - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}

export async function generatePenetapanKKM(context: DocumentGenerationContext): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, k13KKM } = context;

  const docChildren: (Paragraph | Table)[] = [];

  // Header
  docChildren.push(...createDocumentHeader('PENETAPAN KRITERIA KETUNTASAN MINIMAL (KKM)', 'KURIKULUM 2013'));

  if (!k13KKM || k13KKM.kkmTotal === undefined || k13KKM.kkmTotal === null) {
    throw new Error('Data KKM Kurikulum 2013 belum ditetapkan. Silakan lengkapi perhitungan KKM terlebih dahulu.');
  }
  const items = k13KKM.items || [];
  if (items.length === 0) {
    throw new Error('Data butir KKM Kurikulum 2013 belum tersedia. Silakan lengkapi perhitungan KKM per KD terlebih dahulu.');
  }
  const kkmVal = k13KKM.kkmTotal;

  // Metadata Table
  docChildren.push(
    createIdentityMetadataTable(school, profile, academicSetting, [
      ['KKM Satuan Pendidikan / Mapel', `: ${kkmVal} (Tuntas ≥ ${kkmVal})`],
      ['Aspek Penentu KKM', ': Kompleksitas, Daya Dukung, dan Intake Siswa'],
    ])
  );
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // Table
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        createTableHeaderCell('No', 6, AlignmentType.CENTER),
        createTableHeaderCell('Kompetensi Dasar (KD) & Indikator', 40, AlignmentType.LEFT),
        createTableHeaderCell('Kompleksitas', 13, AlignmentType.CENTER),
        createTableHeaderCell('Daya Dukung', 13, AlignmentType.CENTER),
        createTableHeaderCell('Intake', 13, AlignmentType.CENTER),
        createTableHeaderCell('KKM KD', 15, AlignmentType.CENTER),
      ],
    }),
  ];

  items.forEach((item, index) => {
    rows.push(
      new TableRow({
        children: [
          createTableDataCell((index + 1).toString(), 6, AlignmentType.CENTER),
          createTableDataCell(`${item.kd}\n• Indikator: ${item.indikator}`, 40),
          createTableDataCell(item.kompleksitas.toString(), 13, AlignmentType.CENTER),
          createTableDataCell(item.dayaDukung.toString(), 13, AlignmentType.CENTER),
          createTableDataCell(item.intake.toString(), 13, AlignmentType.CENTER),
          createTableDataCell(item.kkmIndikator.toString(), 15, AlignmentType.CENTER),
        ],
      })
    );
  });

  // Footer row
  rows.push(
    new TableRow({
      children: [
        createTableHeaderCell('', 6, AlignmentType.CENTER),
        createTableHeaderCell('RATA-RATA KKM MATA PELAJARAN', 40, AlignmentType.LEFT),
        createTableHeaderCell('-', 13, AlignmentType.CENTER),
        createTableHeaderCell('-', 13, AlignmentType.CENTER),
        createTableHeaderCell('-', 13, AlignmentType.CENTER),
        createTableHeaderCell(kkmVal.toString(), 15, AlignmentType.CENTER),
      ],
    })
  );

  docChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
  docChildren.push(new Paragraph({ spacing: { after: 220 } }));

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
  const fileName = `Penetapan_KKM_${safeSubject}_${safeGrade}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'PENETAPAN_KKM',
    title: `Penetapan KKM - ${academicSetting.subject} ${academicSetting.grade}`,
    fileName,
    blob,
    record: {
      id: `doc-kkm-${Date.now()}`,
      type: 'PENETAPAN_KKM',
      title: `Penetapan KKM - ${academicSetting.subject} ${academicSetting.grade}`,
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting.id,
      workspaceId: context.workspace?.id,
    },
  };
}
