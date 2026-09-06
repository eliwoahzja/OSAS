/**
 * OSAS Functional Modules Barrel
 * 
 * WHY:
 * Modularized domain separation dividing OSAS operations into focused modules:
 * - drills: Disaster preparedness & evacuation floor plan registry
 * - incidents: Incident logging, guardian alerts & emergency contacts
 * - inspections: Facility checklist, emergency roles & medical supply monitors
 * - risk: Quantitative multi-factor hazard scoring & simple recall explanations
 * - notifications: Parent notification dispatch & delivery tracking
 * - reports: Safety compliance scoring & audit CSV/PDF export
 * - table-loader: Generic reactive table view engine with live filtering
 */

export * from './modules/table-loader.js';
export * from './modules/drills.js';
export * from './modules/incidents.js';
export * from './modules/inspections.js';
export * from './modules/risk.js';
export * from './modules/notifications.js';
export * from './modules/reports.js';
