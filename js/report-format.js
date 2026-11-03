export const REPORT_DATASETS = {
  incidents: { label: 'Incidents', cols: ['reported_at', 'reporter', 'description', 'status'] },
  inspections: { label: 'Inspections', cols: ['item', 'area', 'frequency', 'last_inspected', 'next_due', 'status', 'risk_level', 'inspector', 'notes', 'corrective_actions'] },
  drills: { label: 'Drills', cols: ['type', 'date', 'time', 'building', 'person_in_charge', 'status', 'notes'] },
  supplies: { label: 'First aid supplies', cols: ['item', 'description', 'category', 'quantity', 'unit', 'location', 'expiry', 'reorder_threshold', 'last_restocked'] },
};
export const reportColumnLabel = key => key === 'reported_at' ? 'Date / Time (Asia/Manila)' : key.replaceAll('_', ' ');
export function csvCell(value) {
  let text = value == null ? '' : String(value);
  // Spreadsheet engines may ignore leading whitespace before a formula.
  if (typeof value !== 'number' && (/^[\s\uFEFF]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text))) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function incidentReportRows(records) {
  return records.map(row => {
    const timestamp = row.created_at ? new Date(row.created_at) : null;
    const reported_at = timestamp && !Number.isNaN(timestamp.getTime())
      ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
      : [row.date, row.time].filter(Boolean).join(' ') || 'Not recorded';
    return { reported_at, reporter: row.reporter, description: row.description, status: row.status };
  });
}
