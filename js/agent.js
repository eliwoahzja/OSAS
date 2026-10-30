// Administrator chat panel for the OSAS AI assistant.
// The browser never talks to n8n directly: agent-chat verifies the admin JWT,
// mints a short-lived tool token, and relays the conversation to n8n.

import { h, icon } from './ui.js';
import { currentAccessToken, isAdmin } from './auth.js';

const { SUPABASE_URL } = window.OSAS;
const HISTORY_KEY = 'osas.agent.history.v1';
const SESSION_KEY = 'osas.agent.session.v1';
const MAX_HISTORY = 14;

let wrapper = null;
let panel = null;
let listEl = null;
let inputEl = null;
let sendBtn = null;
let fab = null;
let busy = false;
let messages = [];
let sessionId = '';
let typingEl = null;

function newId() {
  try { return crypto.randomUUID(); } catch { return `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function loadState() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    messages = Array.isArray(saved)
      ? saved.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, 6000) }))
      : [];
  } catch { messages = []; }
  try {
    sessionId = sessionStorage.getItem(SESSION_KEY) || '';
  } catch { sessionId = ''; }
  if (!sessionId) {
    sessionId = newId();
    try { sessionStorage.setItem(SESSION_KEY, sessionId); } catch {}
  }
}

function saveState() {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-MAX_HISTORY)));
    sessionStorage.setItem(SESSION_KEY, sessionId);
  } catch {}
}

function scrollToEnd() {
  if (listEl) listEl.scrollTop = listEl.scrollHeight;
}

function bubble(role, content, options = {}) {
  const isUser = role === 'user';
  const body = h('div', { class: 'agent-bubble-text' }, content);
  if (!isUser) body.setAttribute('data-agent-reply', '');
  return h('div', { class: `agent-row ${isUser ? 'is-user' : 'is-assistant'}` },
    h('div', { class: `agent-bubble ${isUser ? 'is-user' : 'is-assistant'}${options.error ? ' is-error' : ''}` }, body));
}

function welcome() {
  return h('div', { class: 'agent-welcome' },
    h('p', { class: 'agent-welcome-kicker' }, 'OSAS · ADMIN TOOLS'),
    h('h3', {}, 'What do you need to check?'),
    h('p', {}, 'Search records or make an update. I’ll ask before sending an email, changing an account, or deleting a record.'),
    h('div', { class: 'agent-suggestions' },
      ['Show open incidents', 'Find a student', 'Check low supplies']
        .map((label) => h('button', {
          type: 'button', class: 'agent-chip',
          onclick: () => { inputEl.value = label; inputEl.focus(); },
        }, label))));
}

function renderMessages() {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!messages.length) {
    listEl.appendChild(welcome());
    return;
  }
  for (const message of messages) listEl.appendChild(bubble(message.role, message.content));
  scrollToEnd();
}

function showTyping() {
  if (!listEl || typingEl) return;
  typingEl = h('div', { class: 'agent-row is-assistant agent-typing-row' },
    h('div', { class: 'agent-bubble is-assistant agent-typing', role: 'status', 'aria-label': 'Assistant is thinking' },
      h('span', {}), h('span', {}), h('span', {})));
  listEl.appendChild(typingEl);
  scrollToEnd();
}

function hideTyping() {
  typingEl?.remove();
  typingEl = null;
}

function setBusy(value) {
  busy = value;
  if (sendBtn) sendBtn.disabled = value;
  if (inputEl) inputEl.disabled = value;
}

function errorText(status, payload) {
  if (status === 401) return 'Your session expired. Sign out and sign in again.';
  if (status === 403) return 'Only administrators can use the assistant.';
  if (status === 429) return payload?.error || 'Too many messages. Wait a moment and try again.';
  if (status === 503) return payload?.error || 'The assistant is not connected yet.';
  return payload?.error || 'The assistant could not answer right now. Try again.';
}

async function sendMessage() {
  const message = (inputEl?.value || '').trim();
  if (!message || busy) return;

  const history = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: message });
  saveState();
  inputEl.value = '';
  inputEl.style.height = 'auto';
  if (listEl.querySelector('.agent-welcome')) listEl.innerHTML = '';
  listEl.appendChild(bubble('user', message));
  scrollToEnd();

  setBusy(true);
  showTyping();
  try {
    const token = await currentAccessToken();
    if (!token) throw Object.assign(new Error('Sign-in required.'), { status: 401 });
    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: window.OSAS.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, history, sessionId }),
    });
    let payload = null;
    try { payload = await response.json(); } catch {}
    if (!response.ok) {
      const error = new Error(errorText(response.status, payload));
      error.status = response.status;
      throw error;
    }
    const reply = String(payload?.reply || '').trim();
    hideTyping();
    if (!reply) throw new Error('The assistant returned an empty response.');
    messages.push({ role: 'assistant', content: reply });
    saveState();
    listEl.appendChild(bubble('assistant', reply));
    scrollToEnd();
  } catch (error) {
    hideTyping();
    const text = error?.message || 'The assistant could not answer right now. Try again.';
    listEl.appendChild(bubble('assistant', text, { error: true }));
    scrollToEnd();
  } finally {
    setBusy(false);
    inputEl?.focus();
  }
}

function openPanel() {
  if (!panel) return;
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  fab?.setAttribute('aria-expanded', 'true');
  setTimeout(() => inputEl?.focus(), 180);
  scrollToEnd();
}

function closePanel() {
  if (!panel) return;
  panel.classList.remove('is-open');
  panel.setAttribute('aria-hidden', 'true');
  fab?.setAttribute('aria-expanded', 'false');
  fab?.focus();
}

function togglePanel() {
  if (panel?.classList.contains('is-open')) closePanel();
  else openPanel();
}

function clearConversation() {
  messages = [];
  sessionId = newId();
  saveState();
  hideTyping();
  renderMessages();
  inputEl?.focus();
}

function build() {
  loadState();

  fab = h('button', {
    type: 'button', class: 'agent-fab', 'aria-label': 'Open OSAS Assistant', 'aria-expanded': 'false',
    onclick: togglePanel,
  }, icon('comment-dots', 'text-sm'), h('span', { class: 'agent-fab-label' }, 'OSAS desk'));

  inputEl = h('textarea', {
    class: 'agent-input', rows: '1', maxlength: '4000',
    placeholder: 'Search or update OSAS records…',
    'aria-label': 'Message the OSAS assistant',
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
  });
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  sendBtn = h('button', {
    type: 'button', class: 'agent-send', 'aria-label': 'Send message', onclick: sendMessage,
  }, icon('send', 'text-sm'));

  listEl = h('div', { class: 'agent-messages', role: 'log', 'aria-live': 'polite', 'aria-label': 'Assistant conversation' });

  panel = h('section', {
    class: 'agent-panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'OSAS Assistant',
    'aria-hidden': 'true',
  },
    h('header', { class: 'agent-header' },
      h('img', { class: 'agent-header-logo', src: '/assets/logo.png', alt: '' }),
      h('div', { class: 'agent-header-text' },
        h('strong', {}, 'OSAS desk'),
      ),
      h('button', {
        type: 'button', class: 'agent-icon-btn', 'aria-label': 'Clear conversation', title: 'New conversation',
        onclick: clearConversation,
      }, icon('trash', 'text-sm')),
      h('button', {
        type: 'button', class: 'agent-icon-btn', 'aria-label': 'Close assistant', title: 'Close',
        onclick: closePanel,
      }, icon('close', 'text-base'))),
    listEl,
    h('div', { class: 'agent-composer' },
      inputEl,
      sendBtn),
    h('p', { class: 'agent-footnote' }, 'Emails, account changes, and deletions need your approval.'));

  wrapper = h('div', { class: 'agent-root' }, panel, fab);
  document.body.appendChild(wrapper);
  renderMessages();

  const onKey = (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) {
      event.preventDefault();
      closePanel();
    }
  };
  document.addEventListener('keydown', onKey);
  wrapper.__agentKeyHandler = onKey;
}

export function mountAgentChat() {
  if (!isAdmin()) {
    unmountAgentChat();
    return;
  }
  if (wrapper) {
    return;
  }
  build();
}

export function unmountAgentChat() {
  if (!wrapper) return;
  if (wrapper.__agentKeyHandler) document.removeEventListener('keydown', wrapper.__agentKeyHandler);
  wrapper.remove();
  wrapper = null;
  panel = null;
  listEl = null;
  inputEl = null;
  sendBtn = null;
  fab = null;
  typingEl = null;
  busy = false;
  messages = [];
}
