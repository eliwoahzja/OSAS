export function computeStats(incidents, inspections, drills, supplies, contacts) {
  const typeCount = {};
  incidents.forEach((i) => { const type = i.type || 'Unclassified'; typeCount[type] = (typeCount[type] || 0) + 1; });
  const statusCount = {};
  inspections.forEach((i) => { statusCount[i.status] = (statusCount[i.status] || 0) + 1; });
  const total = inspections.length || 1;

  const yearMap = {};
  incidents.forEach((i) => {
    const d = String(i.date || '');
    const year = parseInt(d.slice(0, 4), 10);
    if (!year) return;
    if (!yearMap[year]) yearMap[year] = { year, incidents: 0, byType: {} };
    yearMap[year].incidents++;
    const type = i.type || 'Unclassified';
    yearMap[year].byType[type] = (yearMap[year].byType[type] || 0) + 1;
  });
  const years_by_year = Object.values(yearMap).sort((a, b) => a.year - b.year);

  const supplies_low_items = supplies
    .filter((s) => Number(s.quantity) <= Number(s.reorder_threshold))
    .map((s) => ({
      item: s.item,
      quantity: Number(s.quantity),
      reorder_threshold: Number(s.reorder_threshold),
      location: s.location || '',
    }))
    .sort((a, b) => (b.reorder_threshold - b.quantity) - (a.reorder_threshold - a.quantity));

  let inspections_pending = 0, inspections_passed = 0, inspections_overdue = 0;
  for (const ins of inspections) {
    if (ins.status === 'passed') inspections_passed++;
    else if (ins.status === 'pending') inspections_pending++;
    else if (ins.status === 'overdue') inspections_overdue++;
  }

  let drills_active = 0, drills_completed = 0;
  for (const d of drills) {
    if (d.status === 'upcoming') drills_active++;
    else if (d.status === 'completed') drills_completed++;
  }

  const openIncidents = incidents.filter((i) => i.status === 'open').length;

  return {
    incidents_total: incidents.length,
    incidents_open: openIncidents,
    inspections_pending,
    inspections_passed,
    inspections_overdue,
    drills_active,
    drills_completed,
    supplies_low: supplies_low_items.length,
    supplies_low_items,
    supplies_total: supplies.reduce((s, x) => s + Number(x.quantity || 0), 0),
    supplies_breakdown: supplies.map((s) => ({ label: s.item, value: Number(s.quantity || 0) })),
    supplies_status: [
      { label: 'OK', value: supplies.length - supplies_low_items.length },
      { label: 'Low stock', value: supplies_low_items.length },
    ],
    emergency_contacts_total: contacts.filter((r) => r.category === undefined || r.category === 'school').length,
    compliance_score: Math.round((inspections_passed / total) * 100),
    incident_breakdown: Object.entries(typeCount).map(([label, value]) => ({ label, value })),
    inspection_status: Object.entries(statusCount).map(([label, value]) => ({ label, value })),
    years_by_year,
  };
}

