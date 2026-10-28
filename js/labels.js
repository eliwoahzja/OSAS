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
    subtitle: 'Review student incident reports and update whether each incident is open or resolved.',
    emptyTitle: 'No incidents logged yet',
    emptyText: 'Student reports will appear here for review and status updates.',
    saved: () => 'Incident logged.',
    alertSent: (channel) => `Incident logged — parent alert sent via ${channel || 'email'}.`,
    alertFailed: (message) => `Incident logged. Parent alert failed: ${message || 'The email could not be sent.'}`,
  },
  client: {
    nav: 'Report Incident',
    action: 'Report Incident',
    modalTitle: 'Report an Incident',
    submit: 'Save Report',
    subtitle: 'File a report for medical, fire, security, or structural incidents on campus.',
    emptyTitle: 'No reports filed yet',
    emptyText: 'File the first report and follow its status here.',
    saved: () => 'Report submitted.',
    alertSent: (channel) => `Report submitted — guardian alert sent via ${channel || 'email'}.`,
    alertFailed: (message) => `Report submitted. Guardian alert failed: ${message || 'The email could not be sent.'}`,
  },
};

export function incidentLabels(isAdminUser) {
  return isAdminUser ? INCIDENT_LABELS.admin : INCIDENT_LABELS.client;
}
