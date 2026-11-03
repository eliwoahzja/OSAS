export const STUDENT_ROUTES = Object.freeze({
  dashboard: { label: 'Dashboard', route: 'dashboard', description: 'Your dashboard and safety overview' },
  contacts: { label: 'Emergency Contacts', route: 'emergency-contacts', description: 'Emergency contacts available to you' },
  map: { label: 'Evacuation Map & Plans', route: 'evacuation-plans', description: 'Evacuation maps and safety plans' },
  report: { label: 'Incident Reporting', route: 'incident-logging', description: 'Submit and review your incident reports' },
});

const COMMON = [
  { name: 'help', label: 'Show commands', description: 'List available commands', kind: 'help' },
  { name: 'dashboard', label: 'Open Dashboard', description: 'Go to your dashboard', kind: 'navigate', route: 'dashboard' },
  { name: 'contacts', label: 'Emergency Contacts', description: 'Open the contacts page', kind: 'navigate', route: 'emergency-contacts' },
  { name: 'map', label: 'Evacuation Map', description: 'Open evacuation maps and plans', kind: 'navigate', route: 'evacuation-plans' },
  { name: 'report', label: 'Incident Reporting', description: 'Open the incident reporting page', kind: 'navigate', route: 'incident-logging' },
  { name: 'whoami', label: 'About this assistant', description: 'Learn what this assistant does', kind: 'identity' },
  { name: 'clear', label: 'New conversation', description: 'Clear this conversation', kind: 'clear' },
];

const ADMIN = [
  { name: 'student', label: 'Find a student', description: 'Look up a student by name', kind: 'agent', prompt: 'Find the student', takesArgs: true },
  { name: 'guardian', label: 'Find an emergency contact', description: 'Verify a student and their guardian', kind: 'agent', prompt: 'Find the emergency contact for', takesArgs: true },
  { name: 'incidents', label: 'Search incidents', description: 'Retrieve incident records', kind: 'agent', prompt: 'List incidents', takesArgs: true },
  { name: 'newincident', label: 'Create an incident', description: 'Log an incident after validation', kind: 'agent', prompt: 'Help me create an incident', takesArgs: true },
  { name: 'drills', label: 'Drill schedules', description: 'Look up or schedule drills', kind: 'agent', prompt: 'Help me with drill schedules', takesArgs: true },
  { name: 'inspections', label: 'Safety inspections', description: 'Review inspection records', kind: 'agent', prompt: 'Review safety inspections', takesArgs: true },
  { name: 'supplies', label: 'First aid supplies', description: 'Check or update inventory', kind: 'agent', prompt: 'Check first aid supplies', takesArgs: true },
  { name: 'risks', label: 'Risk assessments', description: 'Find existing risk assessments', kind: 'agent', prompt: 'Review risk assessments', takesArgs: true },
  { name: 'notify', label: 'Notify a guardian', description: 'Draft a verified notification for approval', kind: 'agent', prompt: 'Help me notify a guardian', takesArgs: true },
  { name: 'addadmin', label: 'Create an admin', description: 'Prepare an admin invitation for approval', kind: 'agent', prompt: 'Help me create a new administrator account', takesArgs: true },
];

export function availableCommands(admin = false) {
  return admin ? [...COMMON, ...ADMIN] : [...COMMON];
}

export function parseCommand(value, admin = false) {
  const text = String(value || '').trim();
  if (!text.startsWith('/')) return null;
  const match = text.match(/^\/([^\s]+)(?:\s+([\s\S]*))?$/);
  if (!match) return { kind: 'unknown', command: '' };
  const command = match[1].toLowerCase();
  const args = (match[2] || '').trim();
  const definition = availableCommands(admin).find((item) => item.name === command);
  if (!definition) return { kind: 'unknown', command };
  if (definition.kind === 'agent') {
    return { kind: 'agent', command, message: args ? `${definition.prompt}: ${args}` : `${definition.prompt}. Ask me for required information, verify records, and follow the OSAS approval rules.` };
  }
  return { kind: definition.kind, command, route: definition.route || '' };
}

export function commandHelp(admin = false) {
  const commands = availableCommands(admin).map((item) => `/${item.name} — ${item.label}`);
  return `Available commands:\n${commands.join('\n')}\n\nType / to see suggestions, or ask a question normally.`;
}

export function assistantIdentity(admin = false) {
  return admin
    ? "I'm Opus 5.5, made by eliwoah, serving as your personal assistant."
    : "I'm the OSAS Chatbot. I guide students through the pages available in OSAS. I don't search private records or change school data.";
}

export function studentNavigationAnswer(message) {
  const input = String(message || '').trim();
  if (!input) return { reply: 'Tell me which page you need, or type /help to see the navigation commands.' };
  if (/\b(who are you|your name|what are you)\b/i.test(input)) return { reply: assistantIdentity(false) };
  if (/\b(report|incident|accident|injur\w*|complaint|file a report|submit a report)\b/i.test(input)) {
    return { reply: 'Open Incident Reporting to submit an incident report or review reports available to your account.', route: 'incident-logging' };
  }
  if (/\b(evacuat\w*|map|exit|escape route|safety plan)\b/i.test(input)) {
    return { reply: 'Open Evacuation Map & Plans for school evacuation information.', route: 'evacuation-plans' };
  }
  if (/\b(emergency|guardian|contact|phone number|telephone)\b/i.test(input)) {
    return { reply: 'Open Emergency Contacts to find the contact information available to students. I do not look up private guardian records.', route: 'emergency-contacts' };
  }
  if (/\b(dashboard|home|overview)\b/i.test(input)) {
    return { reply: 'Open Dashboard to see your available OSAS overview.', route: 'dashboard' };
  }
  if (/\b(admin|accounts?|suppl\w*|inventor\w*|inspection\w*|drill\w*|risk assessments?|notification\w*|safety reports?)\b/i.test(input)) {
    return { reply: 'Those management pages are restricted to administrators. I can guide you to Dashboard, Emergency Contacts, Evacuation Map & Plans, or Incident Reporting. Type /help to see navigation commands.' };
  }
  return { reply: 'I help students navigate OSAS, not access or edit records. Ask where to find a page, such as incident reporting or evacuation maps, or type /help.' };
}

export function studentRouteAllowed(route) {
  return Object.values(STUDENT_ROUTES).some((item) => item.route === route);
}
