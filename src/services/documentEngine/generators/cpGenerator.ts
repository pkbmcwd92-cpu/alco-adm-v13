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

export async function generateCP(
  context: DocumentGenerationContext
): Promise<GeneratedDocumentResult> {
  const { school, profile, academicSetting, cp } = context;
  const isBlankMode = context.documentMode === 'blank';

  const docChildren: (Paragraph | Table)[] = [];

  // 1. Header Judul Resmi
  docChildren.push(
    ...createDocumentHeader(
      'CAPAIAN PEMBELAJARAN (CP)',
      academicSetting?.curriculum || 'Kurikulum Merdeka'
    )
  );

  // 2. Metadata Tabel Identitas
  docChildren.push(createIdentityMetadataTable(school, profile, academicSetting, [], { scope: 'YEAR' }));
  docChildren.push(new Paragraph({ spacing: { after: 180 } }));

  // 3. Sumber Rujukan Resmi (bila ada)
  if (cp?.source && !isBlankMode) {
    const sourceText = `${cp.source.title || 'Salinan Keputusan BSKAP'} (${cp.source.institution || 'Kemendikdasmen RI'}, ${cp.source.documentYear || '2024'})${cp.source.url ? ` — ${cp.source.url}` : ''}`;
    docChildren.push(
      createSectionHeading('Sumber Rujukan Regulasi:', 2),
      createProseParagraph(sourceText, { italics: true }),
      new Paragraph({ spacing: { after: 120 } })
    );
  }

  // 4. Deskripsi Capaian Pembelajaran Fase
  docChildren.push(
    createSectionHeading('A. Deskripsi Capaian Pembelajaran Fase', 1),
    createProseParagraph(
      isBlankMode
        ? '........................................................................................................................................................................................................................................................................................'
        : cp?.generalDescription || 'Capaian Pembelajaran umum belum diisi.'
    ),
    new Paragraph({ spacing: { after: 140 } })
  );

  // 5. Capaian Pembelajaran per Elemen
  docChildren.push(
    createSectionHeading('B. Capaian Pembelajaran per Elemen', 1)
  );

  const tableHeaderRow = new TableRow({
    tableHeader: true,
    children: [
      createTableHeaderCell('No', 6, AlignmentType.CENTER),
      createTableHeaderCell('Elemen', 26, AlignmentType.CENTER),
      createTableHeaderCell('Capaian Pembelajaran Elemen', 68, AlignmentType.CENTER),
    ],
  });

  const tableDataRows: TableRow[] = [];

  if (isBlankMode) {
    for (let i = 1; i <= 10; i++) {
      tableDataRows.push(
        new TableRow({
          children: [
            createTableDataCell(String(i), 6, AlignmentType.CENTER),
            createTableDataCell('..............................', 26),
            createTableDataCell('..........................................................................................', 68),
          ],
        })
      );
    }
  } else {
    const elements = cp?.elements || [];
    if (elements.length > 0) {
      elements.forEach((elem, idx) => {
        tableDataRows.push(
          new TableRow({
            children: [
              createTableDataCell(String(idx + 1), 6, AlignmentType.CENTER),
              createTableDataCell(elem.name || '-', 26, AlignmentType.LEFT, true),
              createTableDataCell(elem.content || '-', 68, AlignmentType.JUSTIFIED),
            ],
          })
        );
      });
    } else {
      tableDataRows.push(
        new TableRow({
          children: [
            createTableDataCell('1', 6, AlignmentType.CENTER),
            createTableDataCell('Semua Elemen', 26, AlignmentType.LEFT, true),
            createTableDataCell(cp?.generalDescription || '-', 68, AlignmentType.JUSTIFIED),
          ],
        })
      );
    }
  }

  const elementsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [tableHeaderRow, ...tableDataRows],
  });

  docChildren.push(elementsTable);
  docChildren.push(new Paragraph({ spacing: { after: 240 } }));

  // 6. Signoff Block (Tanda Tangan)
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
  const fileName = `01_Capaian_Pembelajaran_${cleanSubject}_${cleanGrade}${isBlankMode ? '_Format_Kosong' : ''}.docx`;

  if (!context.skipDownload) {
    saveAs(blob, fileName);
  }

  return {
    success: true,
    type: 'CP',
    title: 'Capaian Pembelajaran (CP)',
    fileName,
    blob,
    document: doc,
    record: {
      id: `doc-cp-${context.workspace?.id || 'ws'}-${Date.now()}`,
      type: 'CP',
      title: 'Capaian Pembelajaran (CP)',
      status: 'completed',
      lastGenerated: new Date().toISOString(),
      fileName,
      academicSettingId: academicSetting?.id,
      workspaceId: context.workspace?.id,
    },
  };
}
