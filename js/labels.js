// Central user-facing wording.
//
// The stored role value stays `client` in the database and auth metadata (the
// manage-accounts function and js/auth.js keep reading/writing it), so nothing
// technical has to change — only the label people see. Map the value to a
// display name through roleLabel() instead of hard-coding strings.
export const ROLE_LABELS = {
  admin: 'Administrator',
  client: 'Student',
};

export function roleLabel(role) {
  return ROLE_LABELS[role] || ROLE_LABELS.client;
}

// "Incident Logging" is the administrator wording. Students file reports, so
// the same component renders with the wording below under the Student role.
export const INCIDENT_LABELS = {
  admin: {
    nav: 'Incident Logging',
    action: 'Log Incident',
    modalTitle: 'Log New Incident',
    submit: 'Save Incident',
    subtitle: 'Record medical, fire, security, and structural incidents. Incidents tied to a student can auto-notify their parents.',
    emptyTitle: 'No incidents logged yet',
    emptyText: 'Log the first incident — parent alerts can be sent straight from the form.',
    saved: (id) => `Incident ${id} logged.`,
    alertSent: (id, channel) => `Incident ${id} logged — parent alert sent via ${channel || 'email'}.`,
    alertFailed: (id, message) => `Incident ${id} logged ⚠ ${message || 'Parent alert could not be sent.'}`,
  },
  client: {
    nav: 'Report Incident',
    action: 'Report Incident',
    modalTitle: 'Report an Incident',
    submit: 'Save Report',
    subtitle: 'File a report for medical, fire, security, or structural incidents on campus.',
    emptyTitle: 'No reports filed yet',
    emptyText: 'File the first report — a guardian alert can be sent from the form when needed.',
    saved: (id) => `Report ${id} submitted.`,
    alertSent: (id, channel) => `Report ${id} submitted — guardian alert sent via ${channel || 'email'}.`,
    alertFailed: (id, message) => `Report ${id} submitted ⚠ ${message || 'Guardian alert could not be sent.'}`,
  },
};

export function incidentLabels(isAdminUser) {
  return isAdminUser ? INCIDENT_LABELS.admin : INCIDENT_LABELS.client;
}
