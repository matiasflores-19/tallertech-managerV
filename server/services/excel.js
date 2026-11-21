import ExcelJS from 'exceljs';

const COLORS = {
  ink: '0F172A',
  blue: '2563EB',
  soft: 'EFF6FF',
  line: 'DBE3EF',
  white: 'FFFFFF',
  muted: '64748B',
};

export async function renderReportExcel(report, res) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'TallerTech Manager';
  workbook.created = new Date();
  workbook.subject = report.title;
  const sheet = workbook.addWorksheet('Reporte', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  const totalColumns = Math.max(1, report.columns.length);
  sheet.mergeCells(1, 1, 1, totalColumns);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `TallerTech Manager · ${report.title}`;
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: COLORS.ink } };
  titleCell.alignment = { vertical: 'middle' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells(2, 1, 2, totalColumns);
  const subtitle = sheet.getCell(2, 1);
  subtitle.value = `Período: ${report.from} al ${report.to} · Generado: ${new Date().toLocaleString('es-AR')}`;
  subtitle.font = { size: 9, color: { argb: COLORS.muted } };

  let currentRow = 4;
  if (report.summary?.length) {
    report.summary.forEach((item, index) => {
      const column = index + 1;
      if (column > totalColumns) return;
      const labelCell = sheet.getCell(currentRow, column);
      labelCell.value = item.label;
      labelCell.font = { size: 8, color: { argb: COLORS.muted } };
      const valueCell = sheet.getCell(currentRow + 1, column);
      valueCell.value = item.value;
      valueCell.font = { size: 13, bold: true, color: { argb: COLORS.ink } };
      valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.soft } };
    });
    currentRow += 3;
  }

  const headerRow = sheet.getRow(currentRow);
  report.columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { size: 9, bold: true, color: { argb: COLORS.white } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.ink } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'thin', color: { argb: COLORS.blue } } };
  });
  headerRow.height = 22;

  report.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(currentRow + 1 + rowIndex);
    report.columns.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      cell.value = row[column.key] ?? '—';
      cell.font = { size: 9, color: { argb: COLORS.ink } };
      cell.alignment = { vertical: 'middle', horizontal: column.align === 'right' ? 'right' : 'left', wrapText: true };
      if (rowIndex % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
      }
    });
    excelRow.height = 18;
  });

  const lastRow = currentRow + report.rows.length;
  sheet.autoFilter = {
    from: { row: currentRow, column: 1 },
    to: { row: lastRow, column: totalColumns },
  };
  sheet.columns = report.columns.map((column) => ({
    width: Math.min(48, Math.max(11, Math.round((column.width || 1) * 13))),
  }));

  if (report.note) {
    const noteRow = lastRow + 2;
    sheet.mergeCells(noteRow, 1, noteRow, totalColumns);
    const cell = sheet.getCell(noteRow, 1);
    cell.value = report.note;
    cell.font = { size: 8, italic: true, color: { argb: COLORS.muted } };
    cell.alignment = { wrapText: true };
  }

  sheet.pageSetup.printTitlesRow = `${currentRow}:${currentRow}`;
  sheet.headerFooter.oddFooter = `&LTallerTech Manager&RPágina &P de &N`;

  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${report.kind}-${report.from}-${report.to}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(Buffer.from(buffer));
}
