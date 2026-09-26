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
  createProseParagraph,
  createDocxSectionProperties,
} from '../docxStyles';

export async function generateTP(
  context: DocumentGenerationContext
): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, tp } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // 1. Header Judul Resmi
  docChildren.push(
    ...createDocumentHeader(
      'DOKUMEN TUJUAN PEMBELAJARAN (TP)',
      academicSetting?.curriculum || 'Kurikulum Merdeka'
    )
  );

  // 2. Metadata Tabel Identitas
  docChildren.push(createIdentityMetadataTable(school, profile, academicSetting, [], { scope: 'YEAR' }));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // 3. Landasan Perumusan TP
  docChildren.push(
    createSectionHeading('A. Rasional dan Prinsip Perumusan TP', 1),
    createProseParagraph(
      'Tujuan Pembelajaran (TP) dirumuskan berdasarkan Capaian Pembelajaran (CP) dengan memuat kompetensi konkret dan lingkup materi esensial. Setiap rumusan TP diintegrasikan dengan penguatan Dimensi Profil Lulusan serta disusun bertahap untuk memandu proses belajar dan asesmen bermakna.'
    ),
    new Paragraph({ spacing: { after: 140 } })
  );

  // 4. Tabel Daftar Tujuan Pembelajaran
  docChildren.push(
    createSectionHeading('B. Daftar Rumusan Tujuan Pembelajaran (TP)', 1)
  );

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 5, AlignmentType.CENTER),
      createTableHeaderCell('Kode TP', 12, AlignmentType.CENTER),
      createTableHeaderCell('Rumusan Tujuan Pembelajaran', 47, AlignmentType.CENTER),
      createTableHeaderCell('Lingkup Materi', 20, AlignmentType.CENTER),
      createTableHeaderCell('Dimensi Profil Lulusan', 16, AlignmentType.CENTER),
    ],
  });

  const tableDataRows: TableRow[] = [];

  if (isBlankMode) {
    for (let i = 1; i <= 12; i++) {
      tableDataRows.push(
        new TableRow({
          children: [
            createTableDataCell(String(i), 5, AlignmentType.CENTER),
            createTableDataCell(`TP ${i}`, 12, AlignmentType.CENTER),
            createTableDataCell('..........................................................................................', 47),
            createTableDataCell('..............................', 20),
            createTableDataCell('....................', 16),
          ],
        })
      );
    }
  } else {
    const tpItems = tp?.items || [];
    if (tpItems.length > 0) {
      tpItems.forEach((item, idx) => {
        const p3Text = (item.p3Dimensions || []).join(', ') || '-';
        tableDataRows.push(
          new TableRow({
            children: [
              createTableDataCell(String(idx + 1), 5, AlignmentType.CENTER),
              createTableDataCell(item.code || `TP ${idx + 1}`, 12, AlignmentType.CENTER, true),
              createTableDataCell(item.statement || '-', 47, AlignmentType.JUSTIFIED),
              createTableDataCell(item.contentScope || '-', 20, AlignmentType.LEFT),
              createTableDataCell(p3Text, 16, AlignmentType.LEFT),
            ],
          })
        );
      });
    } else {
      tableDataRows.push(
        new TableRow({
          children: [
            createTableDataCell('1', 5, AlignmentType.CENTER),
            createTableDataCell('-', 12, AlignmentType.CENTER),
            createTableDataCell('Belum ada Tujuan Pembelajaran yang dirumuskan.', 47, AlignmentType.LEFT),
            createTableDataCell('-', 20, AlignmentType.CENTER),
            createTableDataCell('-', 16, AlignmentType.CENTER),
          ],
        })
      );
    }
  }

  const tpTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows],
  });

  docChildren.push(tpTable);
  docChildren.push(new Paragraph({ spacing: { after: 240 } }));

  // 5. Signoff Block (Tanda Tangan)
  docChildren.push(...createSignoffBlock(school, profile, isBlankMode, context.documentDate));

  const doc = new Document({
    sections: [
      {
        properties: createDocxSectionProperties('portrait'),
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const cleanSubject = (academicSetting?.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
  const cleanGrade = (academicSetting?.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `02_Tujuan_Pembelajaran_${cleanSubject}_${cleanGrade}${isBlankMode ? '_Format_Kosong' : ''}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'TP',
    title: 'Tujuan Pembelajaran (TP)',
    fileName,
    blob,
    document: doc,
    record: {
      id: `doc-tp-${context.workspace?.id || 'ws'}-${Date.now()}`,
      type: 'TP',
      title: 'Tujuan Pembelajaran (TP)',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting?.id,
      workspaceId: context.workspace?.id,
    },
  };
}
