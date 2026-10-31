// Administrator chat panel for the OSAS AI assistant.
// The browser never talks to n8n directly: agent-chat verifies the admin JWT,
// mints a short-lived tool token, and relays the conversation to n8n.

import { h, icon } from './ui.js';
import { currentAccessToken, currentUser, isAdmin, isSignedIn } from './auth.js';
import { availableCommands, parseCommand, commandHelp, assistantIdentity, studentNavigationAnswer, studentRouteAllowed } from './agent-commands.js';

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
let commandMenu = null;
let visibleCommands = [];
let selectedCommand = 0;
let userScope = '';

function newId() {
  try { return crypto.randomUUID(); } catch { return `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function storageKey(key) { return `${key}:${userScope}`; }

function loadState() {
  userScope = currentUser()?.id || 'unknown';
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(HISTORY_KEY)) || '[]');
    messages = Array.isArray(saved)
      ? saved.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content.slice(0, 6000), route: studentRouteAllowed(m.route) ? m.route : '' }))
      : [];
  } catch { messages = []; }
  try {
    sessionId = sessionStorage.getItem(storageKey(SESSION_KEY)) || '';
  } catch { sessionId = ''; }
  if (!sessionId) {
    sessionId = newId();
    try { sessionStorage.setItem(storageKey(SESSION_KEY), sessionId); } catch {}
  }
}

function saveState() {
  try {
    sessionStorage.setItem(storageKey(HISTORY_KEY), JSON.stringify(messages.slice(-MAX_HISTORY)));
    sessionStorage.setItem(storageKey(SESSION_KEY), sessionId);
  } catch {}
}

function scrollToEnd() {
  if (listEl) listEl.scrollTop = listEl.scrollHeight;
}

function bubble(role, content, options = {}) {
  const isUser = role === 'user';
  const body = h('div', { class: 'agent-bubble-text' }, content);
  if (!isUser) body.setAttribute('data-agent-reply', '');
  const children = [body];
  if (!isUser && studentRouteAllowed(options.route)) {
    children.push(h('a', {
      class: 'agent-page-link',
      href: `#/${options.route}`,
      onclick: closePanel,
    }, 'Open page ', icon('arrow_forward', 'text-xs')));
  }
  return h('div', { class: `agent-row ${isUser ? 'is-user' : 'is-assistant'}` },
    h('div', { class: `agent-bubble ${isUser ? 'is-user' : 'is-assistant'}${options.error ? ' is-error' : ''}` }, children));
}

function welcome() {
  const admin = isAdmin();
  const shortcuts = admin ? ['/student', '/newincident', '/incidents', '/help'] : ['/report', '/contacts', '/map', '/help'];
  return h('div', { class: 'agent-welcome' },
    h('p', { class: 'agent-welcome-kicker' }, admin ? 'OSAS · ADMIN TOOLS' : 'OSAS · STUDENT GUIDE'),
    h('h3', {}, admin ? 'What do you need to check?' : 'Where do you need to go?'),
    h('p', {}, admin
      ? 'Ask me to search records or make an update. Type / for commands.'
      : 'I guide you to student-accessible pages. Type / to see navigation commands.'),
    h('div', { class: 'agent-suggestions' },
      shortcuts.map((label) => h('button', {
        type: 'button', class: 'agent-chip',
        onclick: () => {
          inputEl.value = label;
          updateCommandMenu();
          inputEl.focus();
        },
      }, label))));
}

function renderMessages() {
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!messages.length) {
    listEl.appendChild(welcome());
    return;
  }
  for (const message of messages) listEl.appendChild(bubble(message.role, message.content, { route: message.route }));
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
  if (value) hideCommandMenu();
}

function errorText(status, payload) {
  if (status === 401) return 'Your session expired. Sign out and sign in again.';
  if (status === 403) return 'Only administrators can use the assistant.';
  if (status === 429) return payload?.error || 'Too many messages. Wait a moment and try again.';
  if (status === 503) return payload?.error || 'The assistant is not connected yet.';
  return payload?.error || 'The assistant could not answer right now. Try again.';
}

function addAssistantReply(content, options = {}) {
  const route = studentRouteAllowed(options.route) ? options.route : '';
  messages.push({ role: 'assistant', content, route });
  saveState();
  listEl.appendChild(bubble('assistant', content, { route, error: options.error }));
  scrollToEnd();
}

function hideCommandMenu() {
  if (commandMenu) {
    commandMenu.classList.remove('is-visible');
    commandMenu.replaceChildren();
  }
  visibleCommands = [];
  inputEl?.setAttribute('aria-expanded', 'false');
}

function updateCommandMenu() {
  if (!commandMenu || !inputEl || busy) return hideCommandMenu();
  const match = inputEl.value.match(/^\/([a-z0-9-]*)$/i);
  if (!match) return hideCommandMenu();
  const query = match[1].toLowerCase();
  visibleCommands = availableCommands(isAdmin()).filter((entry) =>
    entry.name.includes(query) || entry.label.toLowerCase().includes(query));
  if (!visibleCommands.length) return hideCommandMenu();
  selectedCommand = Math.min(selectedCommand, visibleCommands.length - 1);
  commandMenu.replaceChildren(...visibleCommands.map((entry, index) =>
    h('button', {
      type: 'button',
      role: 'option',
      'aria-selected': String(index === selectedCommand),
      class: `agent-command-item${index === selectedCommand ? ' is-selected' : ''}`,
      onclick: () => selectSlashCommand(entry),
    }, h('span', { class: 'agent-command-name' }, `/${entry.name}`),
      h('span', { class: 'agent-command-description' }, entry.description))));
  commandMenu.classList.add('is-visible');
  inputEl.setAttribute('aria-expanded', 'true');
}

function selectSlashCommand(command) {
  inputEl.value = `/${command.name}${command.takesArgs ? ' ' : ''}`;
  hideCommandMenu();
  inputEl.focus();
  if (!command.takesArgs) sendMessage();
}

function localAction(parsed, rawMessage) {
  if (parsed?.kind === 'clear') {
    clearConversation();
    return true;
  }
  if (parsed?.kind === 'help') {
    addAssistantReply(commandHelp(isAdmin()));
    return true;
  }
  if (parsed?.kind === 'identity') {
    addAssistantReply(assistantIdentity(isAdmin()));
    return true;
  }
  if (parsed?.kind === 'navigate') {
    addAssistantReply('You can open this OSAS page using the link below.', { route: parsed.route });
    return true;
  }
  if (parsed?.kind === 'unknown') {
    addAssistantReply(`Unknown command: /${parsed.command}. Type /help for available commands.`);
    return true;
  }
  if (!isAdmin()) {
    const answer = studentNavigationAnswer(rawMessage);
    addAssistantReply(answer.reply, { route: answer.route });
    return true;
  }
  return false;
}

async function sendMessage() {
  const message = (inputEl?.value || '').trim();
  if (!message || busy) return;

  const parsed = parseCommand(message, isAdmin());
  const history = messages.slice(-MAX_HISTORY).map((m) => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: message });
  saveState();
  inputEl.value = '';
  inputEl.style.height = 'auto';
  hideCommandMenu();
  if (listEl.querySelector('.agent-welcome')) listEl.innerHTML = '';
  listEl.appendChild(bubble('user', message));
  scrollToEnd();

  if (localAction(parsed, message)) return;
  const outgoing = parsed?.kind === 'agent' ? parsed.message : message;
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
      body: JSON.stringify({ message: outgoing, history, sessionId }),
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
    addAssistantReply(reply);
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
  if (busy) return;
  messages = [];
  sessionId = newId();
  saveState();
  hideTyping();
  if (inputEl) inputEl.value = '';
  hideCommandMenu();
  renderMessages();
  inputEl?.focus();
}

function build() {
  loadState();

  const admin = isAdmin();
  const title = admin ? 'OSAS desk' : 'Chatbot';
  fab = h('button', {
    type: 'button', class: 'agent-fab', 'aria-label': `Open ${title}`, 'aria-expanded': 'false',
    onclick: togglePanel,
  }, icon('comment-dots', 'text-sm'), h('span', { class: 'agent-fab-label' }, title));

  inputEl = h('textarea', {
    class: 'agent-input', rows: '1', maxlength: '4000',
    placeholder: admin ? 'Ask a task or type / for commands…' : 'Ask where to find a page, or type /…',
    'aria-label': admin ? 'Message the OSAS assistant' : 'Ask the OSAS Chatbot for navigation help',
    'aria-expanded': 'false',
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = `${Math.min(inputEl.scrollHeight, 120)}px`;
    selectedCommand = 0;
    updateCommandMenu();
  });
  inputEl.addEventListener('keydown', (event) => {
    if (visibleCommands.length && commandMenu.classList.contains('is-visible')) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        selectedCommand = (selectedCommand + (event.key === 'ArrowDown' ? 1 : -1) + visibleCommands.length) % visibleCommands.length;
        updateCommandMenu();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        selectSlashCommand(visibleCommands[selectedCommand]);
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        hideCommandMenu();
        return;
      }
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  sendBtn = h('button', {
    type: 'button', class: 'agent-send', 'aria-label': 'Send message', onclick: sendMessage,
  }, icon('send', 'text-sm'));

  listEl = h('div', { class: 'agent-messages', role: 'log', 'aria-live': 'polite', 'aria-label': 'Assistant conversation' });
  commandMenu = h('div', { class: 'agent-command-menu', role: 'listbox', 'aria-label': 'Available slash commands' });

  panel = h('section', {
    class: 'agent-panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': title,
    'aria-hidden': 'true',
  },
    h('header', { class: 'agent-header' },
      h('img', { class: 'agent-header-logo', src: '/assets/logo.png', alt: '' }),
      h('div', { class: 'agent-header-text' },
        h('strong', {}, title),
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
      commandMenu,
      inputEl,
      sendBtn),
    h('p', { class: 'agent-footnote' }, admin
      ? 'Type / for shortcuts. Emails, account changes, and deletions need approval.'
      : 'Navigation help only. Administrative tools are not available to students.'));

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
  if (!isSignedIn()) {
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
  commandMenu = null;
  visibleCommands = [];
  selectedCommand = 0;
  userScope = '';
  busy = false;
  messages = [];
}
