import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../auth.js';
import { asyncHandler, audit, HttpError, parse } from '../utils.js';
import { buildReport, reportKinds } from '../services/reports.js';
import { renderReportPdf } from '../services/pdf.js';
import { renderReportExcel } from '../services/excel.js';

const router = Router();
router.use(requireAuth);

const reportQuery = z.object({
  kind: z.enum(['reparaciones', 'pendientes', 'entregados', 'finanzas', 'repuestos', 'stock', 'ganancias']),
  format: z.enum(['json', 'pdf', 'xlsx']).optional().default('json'),
  from: z.string().optional(),
  to: z.string().optional(),
  status: z.string().optional(),
  equipment_type_id: z.coerce.number().int().positive().optional(),
  technician_id: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
});

router.get('/kinds', (req, res) => {
  res.json({ kinds: reportKinds() });
});

router.get(
  '/data',
  asyncHandler((req, res) => {
    const query = parse(reportQuery, req.query);
    const report = buildReport(query.kind, { ...req.query, ...query });
    res.json({ report });
  }),
);

router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const query = parse(reportQuery, req.query);
    const report = buildReport(query.kind, { ...req.query, ...query });
    audit(req, 'REPORT_EXPORT', 'report', null, `Se exportó “${report.title}” en formato ${String(query.format).toUpperCase()}.`);
    if (query.format === 'pdf') {
      return renderReportPdf(res, report);
    }
    if (query.format === 'xlsx') {
      return renderReportExcel(report, res);
    }
    throw new HttpError(400, 'Indicá el formato de exportación: pdf o xlsx.');
  }),
);

export default router;
