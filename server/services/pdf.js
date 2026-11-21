import PDFDocument from 'pdfkit';
import { getSettings } from '../db.js';
import { STATUS_META } from '../utils.js';

const COLORS = {
  ink: '#0f172a',
  slate: '#475569',
  muted: '#64748b',
  line: '#dbe3ef',
  soft: '#f1f5f9',
  blue: '#2563eb',
  cyan: '#0891b2',
  white: '#ffffff',
  green: '#059669',
  red: '#dc2626',
};

const money = (value) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );

const dateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(date);
};

const shortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'medium' }).format(date);
};

function textOrDash(value) {
  return value === null || value === undefined || value === '' ? '—' : String(value);
}

function header(doc, settings, { title, subtitle, orderNumber = null, landscape = false }) {
  const width = doc.page.width;
  const margin = 40;
  doc.rect(0, 0, width, 104).fill(COLORS.ink);
  doc.rect(0, 100, width, 4).fill(COLORS.blue);

  doc.roundedRect(margin, 30, 44, 44, 10).fill(COLORS.blue);
  doc.font('Helvetica-Bold').fontSize(19).fillColor(COLORS.white).text('TT', margin, 43, {
    width: 44,
    align: 'center',
  });
  doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.white).text(settings.workshop_name || 'TallerTech', margin + 58, 30);
  doc
    .font('Helvetica')
    .fontSize(7.4)
    .fillColor('#94a3b8')
    .text(`${settings.workshop_address || ''} · ${settings.workshop_phone || ''}`, margin + 58, 51, {
      width: 212,
      lineGap: 1,
    });
  doc.text(settings.workshop_email || '', margin + 58, 72, { width: 212, lineBreak: false });
  if (settings.workshop_cuit) {
    doc.text(`CUIT: ${settings.workshop_cuit}`, margin + 58, 83, { width: 212, lineBreak: false });
  }

  doc.font('Helvetica-Bold').fontSize(17).fillColor(COLORS.white).text(title, width - margin - 240, 30, {
    width: 240,
    align: 'right',
  });
  doc.font('Helvetica').fontSize(8).fillColor('#cbd5e1').text(subtitle, width - margin - 250, 54, {
    width: 250,
    align: 'right',
    lineGap: 1,
  });
  if (orderNumber) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#60a5fa').text(orderNumber, width - margin - 250, 78, {
      width: 250,
      align: 'right',
    });
  }
  doc.y = 124;
}

function sectionTitle(doc, title, x = 40, width = null) {
  const usable = width || doc.page.width - 80;
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.blue).text(title.toUpperCase(), x, doc.y, {
    width: usable,
    characterSpacing: 0.8,
  });
  doc.moveDown(0.35);
  doc.moveTo(x, doc.y).lineTo(x + usable, doc.y).lineWidth(0.7).strokeColor(COLORS.line).stroke();
  doc.moveDown(0.55);
}

function fieldGrid(doc, fields, { columns = 2, x = 40, width = null, gap = 16 } = {}) {
  const usable = width || doc.page.width - 80;
  const colWidth = (usable - gap * (columns - 1)) / columns;
  let index = 0;
  while (index < fields.length) {
    const row = fields.slice(index, index + columns);
    const rowY = doc.y;
    let maxHeight = 0;
    row.forEach((field, column) => {
      const fx = x + column * (colWidth + gap);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(field.label.toUpperCase(), fx, rowY, {
        width: colWidth,
      });
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.ink).text(textOrDash(field.value), fx, rowY + 11, {
        width: colWidth,
        lineGap: 1,
      });
      maxHeight = Math.max(maxHeight, doc.heightOfString(textOrDash(field.value), { width: colWidth }) + 17);
    });
    doc.y = rowY + Math.max(maxHeight, 24) + 4;
    index += columns;
  }
}

function paragraph(doc, label, value, x = 40, width = null) {
  const usable = width || doc.page.width - 80;
  if (doc.y > doc.page.height - 120) doc.addPage();
  doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(label.toUpperCase(), x, doc.y, { width: usable });
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.ink).text(textOrDash(value), x, doc.y, {
    width: usable,
    lineGap: 2,
  });
  doc.moveDown(0.75);
}

function totalsBox(doc, rows) {
  const width = doc.page.width - 80;
  const boxWidth = 260;
  const x = doc.page.width - 40 - boxWidth;
  const height = rows.length * 20 + 16;
  if (doc.y + height > doc.page.height - 70) doc.addPage();
  const y = doc.y;
  doc.roundedRect(x, y, boxWidth, height, 6).fill(COLORS.soft);
  rows.forEach((row, index) => {
    doc.font(row.strong ? 'Helvetica-Bold' : 'Helvetica').fontSize(row.strong ? 10 : 8.5).fillColor(row.color || COLORS.ink);
    doc.text(row.label, x + 12, y + 10 + index * 20, { width: 130 });
    doc.text(row.value, x + 142, y + 10 + index * 20, { width: 106, align: 'right' });
  });
  doc.y = y + height + 12;
}

function footer(doc, settings, { generated = true } = {}) {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i += 1) {
    doc.switchToPage(i);
    const y = doc.page.height - 62;
    doc.moveTo(40, y - 6).lineTo(doc.page.width - 40, y - 6).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted);
    doc.text(settings.receipt_footer || 'Documento generado por TallerTech Manager', 40, y, {
      width: doc.page.width - 150,
      lineBreak: false,
    });
    doc.text(`Página ${i - pages.start + 1} de ${pages.count}`, doc.page.width - 150, y, {
      width: 110,
      align: 'right',
      lineBreak: false,
    });
    if (generated) {
      doc.text(
        `Generado: ${dateTime(new Date().toISOString())}`,
        doc.page.width - 290,
        y - 12,
        { width: 250, align: 'right', lineBreak: false },
      );
    }
  }
}

export function renderOrderReceipt(res, { order, client }) {
  const settings = getSettings();
  const doc = new PDFDocument({ size: 'A4', margin: 40, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="comprobante-${order.order_number.replace(/[^A-Za-z0-9-]/g, '')}.pdf"`,
  );
  doc.pipe(res);

  header(doc, settings, {
    title: 'Comprobante de recepción',
    subtitle: `Emitido el ${shortDate(new Date().toISOString())} · Condiciones de ingreso`,
    orderNumber: order.order_number,
  });

  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink).text('DATOS DEL CLIENTE', 40, doc.y);
  doc.moveDown(0.5);
  fieldGrid(doc, [
    { label: 'Nombre y apellido', value: `${client.first_name} ${client.last_name}` },
    { label: 'Teléfono', value: client.phone },
    { label: 'Correo electrónico', value: client.email },
    { label: 'DNI', value: client.dni },
    { label: 'Dirección', value: client.address },
  ]);
  doc.moveDown(0.4);

  sectionTitle(doc, 'Equipo recibido');
  fieldGrid(doc, [
    { label: 'Tipo de dispositivo', value: order.equipment_type_name },
    { label: 'Marca / Modelo', value: `${order.brand} ${order.model}` },
    { label: 'Número de serie', value: order.serial_number },
    { label: 'IMEI', value: order.imei },
    { label: 'Color', value: order.color },
    { label: 'Accesorios entregados', value: order.accessories },
  ]);

  sectionTitle(doc, 'Información del ingreso');
  fieldGrid(doc, [
    { label: 'Fecha y hora de recepción', value: dateTime(order.intake_at) },
    { label: 'Técnico responsable', value: order.technician_name || 'Sin asignar' },
    { label: 'Estado del equipo', value: statusLabel(order.status) },
    { label: 'Entrega estimada', value: shortDate(order.estimated_delivery) },
    { label: 'Dato de desbloqueo', value: order.has_unlock ? 'Registrado (protegido)' : 'No informado' },
  ]);
  paragraph(doc, 'Falla declarada por el cliente', order.declared_issue);
  paragraph(doc, 'Descripción detallada del problema', order.detailed_problem);
  paragraph(doc, 'Estado físico / daños visibles', [order.physical_condition, order.visible_damage].filter(Boolean).join(' · '));
  paragraph(doc, 'Diagnóstico inicial', order.initial_diagnosis || 'Pendiente de diagnóstico.');
  paragraph(doc, 'Observaciones adicionales', order.internal_notes);

  if (doc.y + 300 > doc.page.height - 60) {
    doc.addPage();
    doc.y = 48;
  }
  sectionTitle(doc, 'Condiciones de recepción');
  totalsBox(doc, [
    { label: 'Presupuesto estimado', value: money(order.estimated_budget) },
    { label: 'Seña recibida', value: money(order.paid_total) },
    { label: 'Saldo pendiente', value: money(order.balance) },
    { label: 'Precio final', value: money(order.final_price), strong: true },
  ]);

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.slate).text(
    'El cliente autoriza la revisión del equipo y acepta las condiciones de ingreso. El taller no se responsabiliza por fallas ocultas no declaradas. Los equipos no retirados luego de 90 días podrán generar cargos de almacenamiento. La garantía cubre únicamente la reparación realizada y no daños por humedad, golpes o intervenciones de terceros.',
    40,
    doc.y,
    { width: doc.page.width - 80, lineGap: 2 },
  );

  const signatureWidth = 170;
  let signatureY = doc.page.height - 132;
  if (doc.y > signatureY - 46) {
    doc.addPage();
    doc.y = 52;
    signatureY = 112;
  }
  const signatureLeft = 60;
  const signatureRight = doc.page.width - 230;
  doc.moveTo(signatureLeft, signatureY).lineTo(signatureLeft + signatureWidth, signatureY).strokeColor(COLORS.slate).lineWidth(0.8).stroke();
  doc.moveTo(signatureRight, signatureY).lineTo(signatureRight + signatureWidth, signatureY).stroke();
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
  doc.text('Firma del cliente', signatureLeft, signatureY + 6, { width: signatureWidth, align: 'center' });
  doc.text('Firma y sello del taller', signatureRight, signatureY + 6, { width: signatureWidth, align: 'center' });
  doc.text(`${client.first_name} ${client.last_name} · DNI ${client.dni || '—'}`, signatureLeft, signatureY + 20, {
    width: signatureWidth,
    align: 'center',
    lineBreak: false,
  });
  doc.text(`${settings.workshop_name} · ${settings.workshop_cuit || ''}`, signatureRight, signatureY + 20, {
    width: signatureWidth,
    align: 'center',
    lineBreak: false,
  });

  footer(doc, settings);
  doc.end();
}

function statusLabel(status) {
  return STATUS_META[status]?.label || status;
}

function drawTable(doc, columns, rows, options = {}) {
  const x = options.x || 40;
  const marginBottom = 55;
  const headerHeight = 22;
  const fontSize = options.fontSize || 7.2;

  const drawHeader = () => {
    const y = doc.y;
    doc.rect(x, y, columns.reduce((sum, column) => sum + column.width, 0), headerHeight).fill(COLORS.ink);
    let currentX = x;
    for (const column of columns) {
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.white).text(column.label, currentX + 4, y + 7, {
        width: column.width - 8,
        align: column.align || 'left',
        lineBreak: false,
      });
      currentX += column.width;
    }
    doc.y = y + headerHeight;
  };

  drawHeader();
  if (!rows.length) {
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.muted).text('Sin registros para el período seleccionado.', x, doc.y + 14, {
      width: columns.reduce((sum, column) => sum + column.width, 0),
      align: 'center',
    });
    doc.y += 38;
    return;
  }

  rows.forEach((row, rowIndex) => {
    const values = columns.map((column) => textOrDash(row[column.key]));
    const heights = columns.map((column, index) =>
      doc.heightOfString(values[index], { width: column.width - 8, lineGap: 1 }),
    );
    const rowHeight = Math.max(20, ...heights) + 8;
    if (doc.y + rowHeight > doc.page.height - marginBottom) {
      doc.addPage();
      drawHeader();
    }
    const rowY = doc.y;
    if (rowIndex % 2 === 1) {
      doc.rect(x, rowY, columns.reduce((sum, column) => sum + column.width, 0), rowHeight).fill(COLORS.soft);
    }
    let currentX = x;
    columns.forEach((column, index) => {
      doc.font('Helvetica').fontSize(fontSize).fillColor(COLORS.ink).text(values[index], currentX + 4, rowY + 5, {
        width: column.width - 8,
        lineGap: 1,
        align: column.align || 'left',
      });
      currentX += column.width;
    });
    doc.y = rowY + rowHeight;
    doc.moveTo(x, doc.y).lineTo(x + columns.reduce((sum, column) => sum + column.width, 0), doc.y).lineWidth(0.4).strokeColor(COLORS.line).stroke();
  });
}

export function renderReportPdf(res, report) {
  const settings = getSettings();
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40, bufferPages: true });
  const fileName = `${report.kind}-${report.from || 'inicio'}-${report.to || 'hoy'}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  doc.pipe(res);

  header(doc, settings, {
    title: report.title,
    subtitle: `Período: ${shortDate(report.from)} al ${shortDate(report.to)}`,
    landscape: true,
  });

  if (report.summary?.length) {
    const width = doc.page.width - 80;
    const boxWidth = (width - 12 * (report.summary.length - 1)) / report.summary.length;
    const startY = doc.y;
    report.summary.forEach((item, index) => {
      const x = 40 + index * (boxWidth + 12);
      doc.roundedRect(x, startY, boxWidth, 50, 5).fill(COLORS.soft);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.muted).text(item.label.toUpperCase(), x + 9, startY + 9, {
        width: boxWidth - 18,
      });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.ink).text(item.value, x + 9, startY + 24, {
        width: boxWidth - 18,
      });
    });
    doc.y = startY + 62;
  }

  const usableWidth = doc.page.width - 80;
  const signature = report.columns.map((column) => column.width || 1);
  const totalWeight = signature.reduce((sum, value) => sum + value, 0);
  const columns = report.columns.map((column) => ({
    ...column,
    width: Math.max(42, Math.round((column.width || 1) / totalWeight * usableWidth)),
  }));
  const diff = usableWidth - columns.reduce((sum, column) => sum + column.width, 0);
  if (columns.length) columns[columns.length - 1].width += diff;

  drawTable(doc, columns, report.rows, { fontSize: 7 });

  doc.y += 14;
  if (report.note) {
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.muted).text(report.note, 40, doc.y, {
      width: usableWidth,
    });
  }

  footer(doc, settings);
  doc.end();
}

export { money, shortDate, dateTime, COLORS };
