// Calendar dates use the school's timezone, including expiry-day boundaries.
export function schoolToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
}

const dayNumber = (date) => /^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))
  ? Date.parse(date + 'T00:00:00Z') / 86400000 : NaN;
export function daysUntil(date, today = schoolToday()) {
  return dayNumber(date) - dayNumber(today);
}

export function supplyStatus(record, today = schoolToday()) {
  const days = daysUntil(record.expiry, today);
  if (days < 0) return 'Expired';
  if (days <= 30) return 'Expiring Soon';
  if (Number(record.quantity) <= Number(record.reorder_threshold)) return 'Low Stock';
  return 'In Stock';
}

const INTERVALS = {
  daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 91,
  'semi-annual': 182, semiannual: 182, annual: 365, yearly: 365,
};
export function inspectionDue(record) {
  const interval = INTERVALS[String(record.frequency || '').toLowerCase().trim()];
  const last = dayNumber(String(record.last_inspected || '').slice(0, 10));
  if (!interval || !Number.isFinite(last)) return null;
  return new Date((last + interval) * 86400000).toISOString().slice(0, 10);
}

export function inspectionStatus(record, today = schoolToday()) {
  const status = String(record.status || 'pending').toLowerCase();
  if (status === 'fail' || status === 'failed') return 'fail';
  const days = daysUntil(inspectionDue(record), today);
  if (days < 0 || status === 'overdue') return 'overdue';
  if (days <= 7) return 'due soon';
  return status === 'due soon' ? 'pending' : status;
}

export const supplyCategoryTone = (category) => ({
  'wound care': 'pink', emergency: 'purple', cleaning: 'blue', ppe: 'purple', equipment: 'green',
})[String(category || '').toLowerCase()] || 'gray';
