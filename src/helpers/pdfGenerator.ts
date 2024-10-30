// eslint-disable-next-line @typescript-eslint/no-require-imports
const PDFDocument = require('pdfkit');
import * as fs from 'node:fs';

export async function generateSpendingPDF(
  data: any[],
  title: string,
  columns: Array<{ label: string; id: string; width: number }>,
  filePath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, autoFirstPage: false });
    doc.registerFont('Montserrat', 'src/fonts/Montserrat-Regular.ttf');

    doc.addPage();
    doc.font('Montserrat');

    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(16).text(title, { align: 'center' });
    doc.moveDown();

    const startX = doc.page.margins.left;
    let currentY = doc.y + 10;
    const rowHeight = 20;

    columns.forEach((col, index) => {
      const x =
        startX +
        columns.slice(0, index).reduce((sum, col) => sum + col.width, 0);
      doc.fontSize(12).text(col.label, x, currentY + 5, {
        width: col.width,
        align: 'center',
      });
    });

    doc
      .moveTo(startX, currentY + rowHeight)
      .lineTo(
        startX + columns.reduce((sum, col) => sum + col.width, 0),
        currentY + rowHeight,
      )
      .stroke();

    currentY += rowHeight;

    data.forEach((item) => {
      if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        currentY = doc.page.margins.top;
      }

      columns.forEach((col, index) => {
        const text = item[col.id] || '-';
        const x =
          startX +
          columns.slice(0, index).reduce((sum, col) => sum + col.width, 0);
        doc
          .fontSize(10)
          .text(text, x, currentY + 5, { width: col.width, align: 'center' });
      });

      currentY += rowHeight;
    });

    doc.end();

    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });
}
