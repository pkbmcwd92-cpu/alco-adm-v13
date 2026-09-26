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
  BorderStyle,
  HeadingLevel,
  ShadingType,
} from 'docx';
import saveAs from 'file-saver';
import { SchoolData, TeacherProfile, AcademicSetting, ATPData, CPData } from '../types';

interface GenerateATPWordOptions {
  school: SchoolData;
  profile: TeacherProfile;
  academicSetting: AcademicSetting;
  atp: ATPData;
  cp?: CPData;
}

export async function generateAndDownloadATPWord(options: GenerateATPWordOptions): Promise<boolean> {
  const { school, profile, academicSetting, atp } = options;

  try {
    // 1. Title and KOP
    const docChildren: (Paragraph | Table)[] = [];

    // Header / KOP Title
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: `ALUR TUJUAN PEMBELAJARAN (ATP)`,
            bold: true,
            size: 28, // 14pt
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 180 },
        children: [
          new TextRun({
            text: `${academicSetting.curriculum.toUpperCase()}`,
            bold: true,
            size: 22, // 11pt
            font: 'Arial',
            color: '475569',
          }),
        ],
      })
    );

    // Meta Identity Box as Table or Key-Value Paragraphs
    const identityRows = [
      ['Satuan Pendidikan', `: ${school.name || '-'}`],
      ['Mata Pelajaran', `: ${academicSetting.subject || '-'}`],
      ['Fase / Kelas', `: ${academicSetting.phase || '-'} / ${academicSetting.grade || '-'}`],
      ['Tahun Ajaran / Semester', `: ${academicSetting.academicYear || '-'} / ${academicSetting.semester || '-'}`],
      ['Guru Mata Pelajaran / Kelas', `: ${profile.name || '-'}`],
      ['NIP Guru', `: ${profile.nip || '-'}`],
    ];

    const identityTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
      rows: identityRows.map(
        ([label, val]) =>
          new TableRow({
            children: [
              new TableCell({
                width: { size: 30, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: label, bold: true, size: 20, font: 'Arial' })],
                  }),
                ],
              }),
              new TableCell({
                width: { size: 70, type: WidthType.PERCENTAGE },
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: val, size: 20, font: 'Arial' })],
                  }),
                ],
              }),
            ],
          })
      ),
    });

    docChildren.push(identityTable);
    docChildren.push(new Paragraph({ spacing: { after: 180 } }));

    // Rasional / Keterangan Alur
    if (atp.rationale) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: 'A. Rasionalisasi Alur Pembelajaran',
              bold: true,
              size: 22,
              font: 'Arial',
              color: '1E3A8A',
            }),
          ],
        }),
        new Paragraph({
          spacing: { after: 140 },
          children: [
            new TextRun({
              text: atp.rationale,
              size: 20,
              font: 'Arial',
            }),
          ],
        })
      );
    }

    docChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 120, after: 100 },
        children: [
          new TextRun({
            text: 'B. Matriks Alur Tujuan Pembelajaran (ATP)',
            bold: true,
            size: 22,
            font: 'Arial',
            color: '1E3A8A',
          }),
        ],
      })
    );

    // ATP Table Header
    const tableHeaderCell = (text: string, widthPct: number) =>
      new TableCell({
        width: { size: widthPct, type: WidthType.PERCENTAGE },
        shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text,
                bold: true,
                color: 'FFFFFF',
                size: 19,
                font: 'Arial',
              }),
            ],
          }),
        ],
      });

    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        tableHeaderCell('No.', 5),
        tableHeaderCell('Kode', 8),
        tableHeaderCell('Tujuan Pembelajaran (TP)', 30),
        tableHeaderCell('Lingkup Materi', 20),
        tableHeaderCell('Profil Pelajar Pancasila', 15),
        tableHeaderCell('Rencana Asesmen', 14),
        tableHeaderCell('JP', 8),
      ],
    });

    const dataRows = atp.items.map((item, idx) => {
      const isEven = idx % 2 === 0;
      const cellBg = isEven ? 'F8FAFC' : 'FFFFFF';

      const createCell = (content: string, widthPct: number, center = false) =>
        new TableCell({
          width: { size: widthPct, type: WidthType.PERCENTAGE },
          shading: { fill: cellBg, type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              alignment: center ? AlignmentType.CENTER : AlignmentType.LEFT,
              children: [new TextRun({ text: content || '-', size: 19, font: 'Arial' })],
            }),
          ],
        });

      return new TableRow({
        children: [
          createCell(String(item.stepNumber || idx + 1), 5, true),
          createCell(item.tpCode || `TP.${idx + 1}`, 8, true),
          createCell(item.tpStatement, 30),
          createCell(item.materialScope, 20),
          createCell(item.p3Dimensions?.join(', ') || '-', 15),
          createCell(item.assessmentPlan || '-', 14),
          createCell(`${item.jp || 0} JP`, 8, true),
        ],
      });
    });

    // Total Row
    const totalJPSum = atp.items.reduce((acc, curr) => acc + (Number(curr.jp) || 0), 0);
    const totalRow = new TableRow({
      children: [
        new TableCell({
          columnSpan: 6,
          shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({
                  text: 'Total Alokasi Waktu (JP):',
                  bold: true,
                  size: 19,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          shading: { fill: 'E2E8F0', type: ShadingType.CLEAR },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${totalJPSum} JP`,
                  bold: true,
                  size: 19,
                  font: 'Arial',
                }),
              ],
            }),
          ],
        }),
      ],
    });

    const atpTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [headerRow, ...dataRows, totalRow],
    });

    docChildren.push(atpTable);
    docChildren.push(new Paragraph({ spacing: { after: 200 } }));

    // Glosarium section if available
    const glossaryItems = atp.items
      .filter((i) => i.glossary && i.glossary.trim().length > 0)
      .map((i) => `${i.tpCode}: ${i.glossary}`);

    if (glossaryItems.length > 0) {
      docChildren.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 100, after: 60 },
          children: [
            new TextRun({
              text: 'C. Glosarium / Kata Kunci Utama',
              bold: true,
              size: 22,
              font: 'Arial',
              color: '1E3A8A',
            }),
          ],
        }),
        ...glossaryItems.map(
          (gl) =>
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: gl, size: 20, font: 'Arial' })],
            })
        ),
        new Paragraph({ spacing: { after: 200 } })
      );
    }

    // Signatures Section (Indonesian Official Legal Format)
    const today = new Date();
    const indonesianMonths = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const formattedDate = `${school.district || school.regency || 'Tempat'}, ${today.getDate()} ${
      indonesianMonths[today.getMonth()]
    } ${today.getFullYear()}`;

    const signatureTable = new Table({
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
                  children: [new TextRun({ text: 'Mengetahui,', size: 20, font: 'Arial' })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'Kepala Sekolah', size: 20, font: 'Arial' })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: school.name || 'Satuan Pendidikan', size: 20, font: 'Arial' })],
                }),
                new Paragraph({ spacing: { before: 800 } }), // Space for signature
                new Paragraph({
                  children: [
                    new TextRun({
                      text: school.principalName || '________________________',
                      bold: true,
                      underline: {},
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `NIP. ${school.principalNip || '...........................................'}`,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 50, type: WidthType.PERCENTAGE },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: formattedDate, size: 20, font: 'Arial' })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: 'Guru Mata Pelajaran / Kelas', size: 20, font: 'Arial' })],
                }),
                new Paragraph({
                  children: [new TextRun({ text: ' ', size: 20, font: 'Arial' })],
                }),
                new Paragraph({ spacing: { before: 800 } }), // Space for signature
                new Paragraph({
                  children: [
                    new TextRun({
                      text: profile.name || '________________________',
                      bold: true,
                      underline: {},
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `NIP. ${profile.nip || '...........................................'}`,
                      size: 20,
                      font: 'Arial',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    docChildren.push(signatureTable);

    // Create document instance
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1440, // 1 inch (72pt * 20 = 1440 twips)
                right: 1440,
                bottom: 1440,
                left: 1440,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    // Generate blob and download
    const blob = await Packer.toBlob(doc);
    const sanitizedMapel = (academicSetting.subject || 'Mapel').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedGrade = (academicSetting.grade || 'Kelas').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedPhase = (academicSetting.phase || 'Fase').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedYear = (academicSetting.academicYear || '2026-2027').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `ATP_${sanitizedMapel}_${sanitizedGrade}_${sanitizedPhase}_${sanitizedYear}.docx`;

    saveAs(blob, fileName);
    return true;
  } catch (error) {
    console.error('Error generating Word document:', error);
    throw error;
  }
}
