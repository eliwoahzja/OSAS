// One duration for the preview's requested loading states.
export const DEFAULT_LOADING_MS = 3000;
export const waitForLoading = (duration = DEFAULT_LOADING_MS) => new Promise(resolve => setTimeout(resolve, duration));
export async function minimumLoading(task, duration = DEFAULT_LOADING_MS) {
  const result = Promise.resolve().then(() => typeof task === 'function' ? task() : task)
    .then(value => ({ value }), error => ({ error }));
  const [outcome] = await Promise.all([result, waitForLoading(duration)]);
  if ('error' in outcome) throw outcome.error;
  return outcome.value;
}

const pending = new WeakMap();
export async function runButtonLoading(button, task, { duration = DEFAULT_LOADING_MS } = {}) {
  if (!button) return task();
  if (pending.has(button)) return;
  const state = { disabled: button.disabled, inert: button.inert, width: button.style.width,
    height: button.style.height, children: [...button.childNodes].map(node => node.cloneNode(true)), wasLoading: button.classList.contains('is-loading'), spinner: button.style.getPropertyValue('--pending-color'), label: button.getAttribute('aria-label'), busy: button.getAttribute('aria-busy') };
  pending.set(button, state);
  let ran = false, failed = false;
  button.style.setProperty('--pending-color', getComputedStyle(button).color);
  const box = button.getBoundingClientRect();
  if (box.width) button.style.width = box.width + 'px';
  if (box.height) button.style.height = box.height + 'px';
  button.setAttribute('aria-label', button.getAttribute('aria-label') || button.textContent.trim() || 'Loading');
  button.setAttribute('aria-busy', 'true');
  button.classList.add('is-pending-action');
  button.disabled = true;
  button.inert = true;
  try {
    // Present the requested three-second loading state before committing an action.
    // A dismissed form cancels its queued action instead of saving invisibly later.
    await waitForLoading(duration);
    if (!button.isConnected || button.parentElement?.closest('[inert]')) return;
    button.disabled = state.disabled;
    ran = true;
    return await task();
  } catch (error) { failed = true; throw error; } finally {
    pending.delete(button);
    button.classList.remove('is-pending-action');
    if (!state.wasLoading) button.classList.remove('is-loading');
    if (/^(checking|verifying|saving|sending|uploading|loading)(?:\b|…)/i.test(button.textContent.trim())) button.replaceChildren(...state.children);
    button.inert = state.inert;
    button.style.width = state.width;
    button.style.height = state.height;
    for (const [key, value] of [['aria-label', state.label], ['aria-busy', state.busy]]) {
      if (value === null) button.removeAttribute(key); else button.setAttribute(key, value);
    }
    if (!ran || failed) button.disabled = state.disabled;
    if (state.spinner) button.style.setProperty('--pending-color', state.spinner); else button.style.removeProperty('--pending-color');
  }
}

export function loadingListener(element, type, handler) {
  return event => {
    const currentTarget = event.currentTarget || element;
    const button = type === 'submit' ? event.submitter || element.querySelector('button[type="submit"]')
      : currentTarget.matches?.('button') ? currentTarget : null;
    if (!button) return handler(event);
    event.preventDefault();
    // Native currentTarget is cleared once the event dispatch finishes.
    const savedEvent = new Proxy(event, { get(target, key) {
      if (key === 'currentTarget') return currentTarget;
      const value = Reflect.get(target, key, target);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
    return runButtonLoading(button, () => handler(savedEvent));
  };
}
export function listenLoading(element, type, handler) {
  element.addEventListener(type, loadingListener(element, type, handler));
}

export function loadingSkeleton(kind = 'form', { fields = 3, label = 'Loading content' } = {}) {
  const root = document.createElement('div');
  root.className = 'loading-skeleton loading-skeleton-' + kind;
  root.setAttribute('role', 'status'); root.setAttribute('aria-label', label);
  const line = (className = '') => { const element = document.createElement('span'); element.className = 'loading-bone ' + className; element.setAttribute('aria-hidden', 'true'); return element; };
  const mark=document.createElement('span');mark.className='loading-mark';mark.textContent='Loading…';root.append(mark, line('loading-title'), line('loading-subtitle'));
  if (kind === 'student-dashboard') {
    const profile = document.createElement('div'); profile.className = 'loading-panel loading-profile'; profile.append(line('loading-name'), line('loading-detail'), line('loading-detail')); root.append(profile);
    const feed = document.createElement('div'); feed.className = 'loading-panel loading-feed'; feed.append(line('loading-title'), line('loading-poster'), line('loading-date')); root.append(feed);
  } else if (kind === 'admin-dashboard') {
    root.append(line('loading-hero'));
    for (const [className, count] of [['loading-stats',6],['loading-charts',3]]) {
      const grid = document.createElement('div'); grid.className = className;
      for (let index=0;index<count;index++) { const panel=document.createElement('div');panel.className='loading-panel';panel.append(line('loading-detail'),line(className==='loading-stats'?'loading-number':'loading-chart'));grid.append(panel); }
      root.append(grid);
    }
  } else if (kind === 'student-table' || kind === 'admin-table') {
    const grid=document.createElement('div');grid.className='loading-table';grid.style.setProperty('--loading-columns',kind==='admin-table'?'6':'5');
    for(let index=0;index<(kind==='admin-table'?30:25);index++) grid.append(line());root.append(grid);
  } else {
    for(let index=0;index<Math.min(Math.max(fields,2),5);index++) root.append(line('loading-label'),line('loading-field'));
    root.append(line('loading-submit'));
  }
  return root;
}

export function coverLoading(container, { kind = 'form', fields = 3, label = 'Loading form', duration = DEFAULT_LOADING_MS, until = null } = {}) {
  const content = [...container.children];
  const skeleton = loadingSkeleton(kind, {fields,label});
  skeleton.classList.add('loading-cover');
  if (kind === 'popup') skeleton.classList.add('osas-modal-loader');
  const states = content.map(element=>({element,inert:element.inert,hidden:element.getAttribute('aria-hidden')}));
  states.forEach(({element})=>{element.inert=true;element.classList.add('loading-source');element.setAttribute('aria-hidden','true');});
  container.classList.add('has-loading-cover');container.setAttribute('aria-busy','true');container.append(skeleton);
  let timer, resolve, settled = false;
  const ready = new Promise(done=>{resolve=done;timer=setTimeout(async()=>{
    if (until) await Promise.resolve(until).catch(()=>{});
    if (settled) return;
    clear(false); done(true);
  },duration);});
  function clear(cancelled = true) {
    if (settled) return;
    settled = true;
    clearTimeout(timer);skeleton.remove();container.classList.remove('has-loading-cover');container.removeAttribute('aria-busy');
    states.forEach(({element,inert,hidden})=>{element.inert=inert;element.classList.remove('loading-source');if(hidden===null)element.removeAttribute('aria-hidden');else element.setAttribute('aria-hidden',hidden);});
    if (cancelled) resolve?.(false);
  }
  return {ready,clear};
}
