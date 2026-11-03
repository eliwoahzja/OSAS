const LIMIT = 16;
const MESSAGE_LIMIT = 48;
const CHAT_PREFIX = 'osas.chat.sessions.v2';
const LEGACY_HISTORY = 'osas.agent.history.v1';
const LEGACY_SESSION = 'osas.agent.session.v1';
const uuid = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function safeMessage(message) {
  if (!message || !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string') return null;
  return {
    role: message.role,
    content: message.content.slice(0, 9000),
    ...(message.route ? { route: String(message.route).slice(0, 60) } : {}),
    ...(message.imageName ? { imageName: String(message.imageName).slice(0, 100) } : {}),
  };
}

function cleanSession(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id || entry.id.length > 110) return null;
  const messages = Array.isArray(entry.messages) ? entry.messages.map(safeMessage).filter(Boolean).slice(-MESSAGE_LIMIT) : [];
  return {
    id: entry.id,
    title: typeof entry.title === 'string' ? entry.title.slice(0, 80) : 'New conversation',
    updatedAt: Number.isFinite(entry.updatedAt) ? entry.updatedAt : Date.now(),
    messages,
  };
}

export function sessionTitle(messages) {
  const first = messages.find(m => m.role === 'user');
  return first ? first.content.replace(/^\s*\/\w+\s*/, '').replace(/\s+/g, ' ').slice(0, 58) || 'New conversation' : 'New conversation';
}

export function createConversation() {
  return { id: uuid(), title: 'New conversation', updatedAt: Date.now(), messages: [] };
}

export function createSessionStore(storage, scope, legacyStorage = null) {
  if (!scope || !/^(admin|student):/.test(scope)) throw new Error('A user-scoped chat key is required.');
  const key = `${CHAT_PREFIX}:${scope}`;
  const read = () => {
    try {
      const parsed = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed.map(cleanSession).filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LIMIT) : [];
    } catch { return []; }
  };
  const write = (sessions) => {
    const cleaned = sessions.map(cleanSession).filter(Boolean).sort((a,b) => b.updatedAt - a.updatedAt).slice(0, LIMIT);
    try { storage.setItem(key, JSON.stringify(cleaned)); } catch {   }
    return cleaned;
  };
  const migrate = () => {
    if (read().length || !legacyStorage) return read();
    try {
      const raw = JSON.parse(legacyStorage.getItem(`${LEGACY_HISTORY}:${scope}`) || '[]');
      if (!Array.isArray(raw) || !raw.length) return [];
      const messages = raw.map(safeMessage).filter(Boolean).slice(-MESSAGE_LIMIT);
      if (!messages.length) return [];
      const id = legacyStorage.getItem(`${LEGACY_SESSION}:${scope}`) || uuid();
      const migrated = { id, title: sessionTitle(messages), updatedAt: Date.now(), messages };
      const result = write([migrated]);
      legacyStorage.removeItem(`${LEGACY_HISTORY}:${scope}`);
      legacyStorage.removeItem(`${LEGACY_SESSION}:${scope}`);
      return result;
    } catch { return []; }
  };
  return {
    list: read,
    migrate,
    save(session) {
      const next = cleanSession({
        ...session,
        title: sessionTitle(session.messages || []),
        updatedAt: Date.now(),
      });
      if (!next) return read();
      return write([next, ...read().filter(s => s.id !== next.id)]);
    },
    remove(id) { return write(read().filter(s => s.id !== id)); },
    get(id) { return read().find(s => s.id === id) || null; },
    clear() { try { storage.removeItem(key); } catch {} },
  };
}
