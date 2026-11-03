// Administrator chat panel for the OSAS AI assistant.
// The browser never talks to n8n directly: agent-chat verifies the admin JWT,
// mints a short-lived tool token, and relays the conversation to n8n.

import { h, icon } from './ui.js';
import { renderMarkdownMessage } from './agent-markdown.js';
import { animateFormattedReply } from './agent-reveal.js';
import { createSessionStore, createConversation } from './agent-sessions.js';
import { currentAccessToken, currentUser, isAdmin, isSignedIn } from './auth.js';
import { availableCommands, parseCommand, commandHelp, assistantIdentity, studentNavigationAnswer, studentRouteAllowed } from './agent-commands.js';

const { SUPABASE_URL } = window.OSAS;
const HISTORY_KEY = 'osas.agent.history.v1';
const SESSION_KEY = 'osas.agent.session.v1';
const MAX_HISTORY = 14;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

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
let stopReplyReveal = null;
let chatStore = null;
let screen = 'startup';
let firstOpen = true;
let screenGeneration = 0;
let imagePicker = null;
let attachment = null;
let attachmentPreview = null;
let imagePreviewUrls = [];
let statusEl = null;
let headerHistoryBtn = null;

function newId() {
  try { return crypto.randomUUID(); } catch { return `agent-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
}

function loadState() {
  userScope = `${isAdmin() ? 'admin' : 'student'}:${currentUser()?.id || currentUser()?.email || 'demo'}`;
  const fallback = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  let storage = fallback;
  let legacy = null;
  try { storage = localStorage; } catch {}
  try { legacy = sessionStorage; } catch {}
  chatStore = createSessionStore(storage, userScope, legacy);
  chatStore.migrate();
  messages = [];
  sessionId = '';
  setScreen('startup');
  firstOpen = true;
}

function saveState() {
  if (!sessionId || !chatStore) return;
  chatStore.save({ id: sessionId, messages });
}

function clearAttachment() {
  if (attachmentPreview?.url) {
    URL.revokeObjectURL(attachmentPreview.url);
  }
  attachment = null;
  attachmentPreview = null;
  if (imagePicker) imagePicker.value = '';
  renderAttachment();
}

function renderAttachment() {
  if (!statusEl) return;
  statusEl.replaceChildren();
  if (!attachmentPreview) { statusEl.hidden = true; return; }
  statusEl.hidden = false;
  statusEl.appendChild(
    h('img', { class: 'agent-attachment-thumb', src: attachmentPreview.url, alt: 'Image to attach' }),
    h('span', { class: 'agent-attachment-name' }, attachmentPreview.name),
    h('button', { type: 'button', class: 'agent-icon-btn agent-remove-attachment',
      'aria-label': 'Remove attachment', onclick: clearAttachment }, icon('close', 'text-sm')));
}

async function attachImage(file) {
  if (!file) return;
  if (!isAdmin()) return addAssistantReply('Image analysis is only available to administrators.');
  if (!IMAGE_TYPES.has(file.type)) return addAssistantReply('Select a JPG, PNG, or WebP image.');
  if (file.size > MAX_IMAGE_BYTES) return addAssistantReply('Choose an image smaller than 2 MB.');
  clearAttachment();
  const url = URL.createObjectURL(file);
  attachment = file;
  attachmentPreview = { url, name: file.name || 'image' };
  renderAttachment();
}

function fileData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read your image.'));
    reader.onload = () => {
      const value = String(reader.result || '');
      const data = value.split(',')[1] || '';
      if (!data) reject(new Error('The selected image could not be read.'));
      else resolve({ mimeType: file.type, fileName: file.name.slice(0, 100), data });
    };
    reader.readAsDataURL(file);
  });
}

function scrollToEnd() {
  if (listEl) listEl.scrollTop = listEl.scrollHeight;
}

function bubble(role, content, options = {}) {
  const isUser = role === 'user';
  const body = h('div', { class: 'agent-bubble-text' }, isUser || options.error ? content : renderMarkdownMessage(content));
  if (isUser && options.imageUrl) body.appendChild(h('img', { class: 'agent-sent-image', src: options.imageUrl, alt: 'Attached image' }));
  else if (isUser && options.imageName) body.appendChild(h('span', { class: 'agent-saved-image-note' }, icon('image', 'text-sm'), ' Image attached: ' + options.imageName));
  if (!isUser) body.setAttribute('data-agent-reply', '');
  const children = isUser
    ? [body]
    : [h('div', { class: 'agent-reply-heading', 'aria-hidden': 'true' },
        icon('auto_awesome', 'text-[13px]'),
        h('span', {}, isAdmin() ? 'OSAS AI Assistant' : 'OSAS Chatbot')),
      body];
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
  stopReplyReveal?.(false);
  stopReplyReveal = null;
  if (!listEl) return;
  listEl.innerHTML = '';
  if (screen !== 'chat') return;
  if (!messages.length) {
    listEl.appendChild(welcome());
    return;
  }
  for (const message of messages) listEl.appendChild(bubble(message.role, message.content, { route: message.route, imageName: message.imageName }));
  scrollToEnd();
}

function setScreen(next) {
  screen = next;
  if (panel) panel.setAttribute('data-chat-screen', next);
}

function showStartup() {
  setScreen('startup');
  listEl.replaceChildren(h('div', { class: 'agent-startup' },
    h('span', { class: 'agent-loader', role: 'status', 'aria-label': 'Loading chat' }),
    h('p', {}, 'Opening conversation…')));
}

function showResumeChoice() {
  setScreen('resume');
  const last = chatStore.list()[0];
  if (!last) return startNewConversation();
  listEl.replaceChildren(h('div', { class: 'agent-resume' },
    h('div', { class: 'agent-resume-mark' }, icon('history', 'text-xl')),
    h('h3', {}, 'Continue your last conversation?'),
    h('p', {}, 'Your recent chats are saved on this device for this account.'),
    h('div', { class: 'agent-last-conversation' },
      h('strong', {}, last.title),
      h('span', {}, new Date(last.updatedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }))),
    h('div', { class: 'agent-session-actions' },
      h('button', { type: 'button', class: 'agent-primary-action', onclick: () => openSavedConversation(last.id) }, 'Continue conversation'),
      h('button', { type: 'button', class: 'agent-secondary-action', onclick: startNewConversation }, 'New conversation'),
      h('button', { type: 'button', class: 'agent-secondary-action', onclick: showHistory }, 'View history'))));
}

function showHistory() {
  if (busy) return;
  setScreen('history');
  const saved = chatStore.list();
  listEl.replaceChildren(h('div', { class: 'agent-history' },
    h('div', { class: 'agent-history-heading' },
      h('h3', {}, 'Chat history'),
      h('button', { type: 'button', class: 'agent-secondary-action', onclick: startNewConversation }, icon('plus', 'text-sm'), ' New chat')),
    saved.length
      ? h('div', { class: 'agent-history-list' }, saved.map((conversation) =>
          h('div', { class: 'agent-history-item' },
            h('button', { type: 'button', class: 'agent-history-open', onclick: () => openSavedConversation(conversation.id) },
              h('strong', {}, conversation.title),
              h('small', {}, new Date(conversation.updatedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })),
              h('span', {}, conversation.messages.length + ' messages')),
            h('button', { type: 'button', class: 'agent-history-delete', 'aria-label': 'Delete conversation: ' + conversation.title,
              onclick: () => { chatStore.remove(conversation.id); if (sessionId === conversation.id) { sessionId = ''; messages = []; } showHistory(); } },
              icon('trash', 'text-sm')))))
      : h('p', { class: 'agent-empty-history' }, 'No saved conversations yet. Start a new chat to see it here.')));
}

function showSkeletons() {
  setScreen('loading');
  listEl.replaceChildren(h('div', { class: 'agent-history-skeletons', role: 'status', 'aria-label': 'Loading saved conversation' },
    h('div', { class: 'agent-skeleton-line short' }),
    h('div', { class: 'agent-skeleton-bubble' },
      h('div', { class: 'agent-skeleton-line' }), h('div', { class: 'agent-skeleton-line wide' }),
      h('div', { class: 'agent-skeleton-line short' })),
    h('div', { class: 'agent-skeleton-bubble right' },
      h('div', { class: 'agent-skeleton-line' }), h('div', { class: 'agent-skeleton-line short' })),
    h('div', { class: 'agent-skeleton-bubble' }, h('div', { class: 'agent-skeleton-line wide' }),
      h('div', { class: 'agent-skeleton-line' }))));
}

function openSavedConversation(id) {
  if (busy) return;
  const generation = ++screenGeneration;
  showSkeletons();
  setTimeout(() => {
    if (generation !== screenGeneration || !wrapper) return;
    const saved = chatStore.get(id);
    if (!saved) { showHistory(); return; }
    sessionId = saved.id;
    messages = saved.messages;
    setScreen('chat');
    renderMessages();
    inputEl?.focus();
  }, 230);
}

function startNewConversation() {
  if (busy) return;
  ++screenGeneration;
  setScreen('chat');
  const next = createConversation();
  sessionId = next.id;
  messages = [];
  clearAttachment();
  renderMessages();
  if (inputEl) inputEl.value = '';
  inputEl?.focus();
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
  stopReplyReveal?.();
  stopReplyReveal = null;
  const reply = bubble('assistant', content, { route, error: options.error });
  const richText = reply.querySelector('.agent-rich-text');
  if (richText && !options.error) {
    stopReplyReveal = animateFormattedReply(richText, { onProgress: scrollToEnd });
  }
  listEl.appendChild(reply);
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
  if (isAdmin() && /^(who are you|what(?:'s| is) your name|what are you)[?!. ]*$/i.test(rawMessage)) {
    addAssistantReply(assistantIdentity(true));
    return true;
  }
  if (parsed?.kind === 'clear') {
    startNewConversation();
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
  if ((!message && !attachment) || busy || screen !== 'chat') return;
  const chosenFile = attachment;
  if (chosenFile && !isAdmin()) return;

  const actualMessage = message || 'Please describe this image and extract any relevant readable text.';
  const parsed = chosenFile ? null : parseCommand(actualMessage, isAdmin());
  const history = messages.slice(-MAX_HISTORY).map(m => ({ role: m.role, content: m.content }));
  messages.push({ role: 'user', content: actualMessage, ...(chosenFile ? { imageName: chosenFile.name } : {}) });
  saveState();
  inputEl.value = '';
  inputEl.style.height = 'auto';
  hideCommandMenu();
  if (listEl.querySelector('.agent-welcome')) listEl.replaceChildren();
  const imageUrl = attachmentPreview?.url || '';
  if (imageUrl) {
    imagePreviewUrls.push(imageUrl);
    attachment = null;
    attachmentPreview = null;
    renderAttachment();
  }
  listEl.appendChild(bubble('user', actualMessage, { imageUrl }));
  scrollToEnd();

  if (!chosenFile && localAction(parsed, actualMessage)) return;
  const outgoing = parsed?.kind === 'agent' ? parsed.message : actualMessage;
  setBusy(true);
  showTyping();
  try {
    const image = chosenFile ? await fileData(chosenFile) : undefined;
    const token = await currentAccessToken();
    if (!token) throw Object.assign(new Error('Sign-in required.'), { status: 401 });
    const response = await fetch(`${SUPABASE_URL}/functions/v1/agent-chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: window.OSAS.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message: outgoing, history, sessionId, ...(image ? { image } : {}) }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(errorText(response.status, payload));
      error.status = response.status;
      throw error;
    }
    hideTyping();
    if (image && payload?.imageProcessed !== true) {
      throw new Error('Image reading is not enabled in the n8n AI workflow yet. Configure its vision input before using attachments.');
    }
    const reply = String(payload?.reply || '').trim();
    if (!reply) throw new Error('The assistant returned an empty response.');
    addAssistantReply(reply);
  } catch (error) {
    hideTyping();
    addAssistantReply(error?.message || 'The assistant could not answer right now.', { error: true });
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
  if (firstOpen) {
    firstOpen = false;
    showStartup();
    const generation = ++screenGeneration;
    setTimeout(() => {
      if (generation === screenGeneration && wrapper) {
        if (chatStore.list().length) showResumeChoice();
        else startNewConversation();
      }
    }, 190);
  }
  setTimeout(() => inputEl?.focus(), 240);
  scrollToEnd();
}

function closePanel() {
  if (!panel) return;
  stopReplyReveal?.();
  stopReplyReveal = null;
  hideCommandMenu();
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
  startNewConversation();
}

function build() {
  loadState();

  const admin = isAdmin();
  const title = admin ? 'OSAS desk' : 'Chatbot';
  fab = h('button', {
    type: 'button', class: 'agent-fab', 'aria-label': `Open ${title}`, title: `Open ${title}`, 'aria-expanded': 'false',
    onclick: togglePanel,
  }, icon('comment-dots', 'text-xl'));

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

  imagePicker = h('input', {
    type: 'file',
    accept: 'image/png,image/jpeg,image/webp',
    hidden: true,
    'aria-label': 'Choose image to analyze',
    onchange: (event) => attachImage(event.target.files?.[0]),
  });
  const imageBtn = isAdmin()
    ? h('button', { type: 'button', class: 'agent-image-btn', title: 'Attach image', 'aria-label': 'Attach image',
        onclick: () => imagePicker.click() }, icon('image', 'text-base'))
    : null;

  sendBtn = h('button', {
    type: 'button', class: 'agent-send', 'aria-label': 'Send message', onclick: sendMessage,
  }, icon('send', 'text-sm'));

  listEl = h('div', { class: 'agent-messages', role: 'log', 'aria-live': 'polite', 'aria-label': 'Assistant conversation' });
  commandMenu = h('div', { class: 'agent-command-menu', role: 'listbox', 'aria-label': 'Available slash commands' });

  statusEl = h('div', { class: 'agent-attachment-status', hidden: true });
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
        type: 'button', class: 'agent-icon-btn', 'aria-label': 'Chat history', title: 'Chat history',
        onclick: showHistory,
      }, icon('history', 'text-sm')),
      h('button', {
        type: 'button', class: 'agent-icon-btn', 'aria-label': 'New conversation', title: 'New conversation',
        onclick: startNewConversation,
      }, icon('plus', 'text-sm')),
      h('button', {
        type: 'button', class: 'agent-icon-btn', 'aria-label': 'Close assistant', title: 'Close',
        onclick: closePanel,
      }, icon('close', 'text-base'))),
    listEl,
    statusEl,
    h('div', { class: 'agent-composer' },
      commandMenu,
      imagePicker,
      imageBtn,
      inputEl,
      sendBtn),
    h('p', { class: 'agent-footnote' }, admin
      ? 'Type / for shortcuts. Emails, account changes, and deletions need approval.'
      : 'Navigation help only. Administrative tools are not available to students.'));

  wrapper = h('div', { class: 'agent-root', 'data-chat-role': admin ? 'admin' : 'student', 'data-chat-user': userScope }, panel, fab);
  document.body.appendChild(wrapper);
  showStartup();

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
  const role = isAdmin() ? 'admin' : 'student';
  const scope = `${role}:${currentUser()?.id || currentUser()?.email || 'demo'}`;
  if (wrapper && wrapper.getAttribute('data-chat-role') === role && wrapper.getAttribute('data-chat-user') === scope) return;
  if (wrapper) unmountAgentChat();
  build();
}

export function unmountAgentChat() {
  stopReplyReveal?.(false);
  stopReplyReveal = null;
  if (!wrapper) return;
  if (wrapper.__agentKeyHandler) document.removeEventListener('keydown', wrapper.__agentKeyHandler);
  ++screenGeneration;
  clearAttachment();
  for (const url of imagePreviewUrls) URL.revokeObjectURL(url);
  imagePreviewUrls = [];
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
  chatStore = null;
  imagePicker = null;
  statusEl = null;
  screen = 'startup';
  firstOpen = true;
  busy = false;
  messages = [];
}
