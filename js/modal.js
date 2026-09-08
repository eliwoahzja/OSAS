import { h } from './ui.js';

export function openModal(content) {
  const overlay = h('div', {
    class: 'osas-modal-overlay',
    onclick: (e) => {
      if (e.target === overlay) close();
    },
  });

  const card = h('div', {
    class: 'osas-modal-card',
  });

  // Blur content during loading period with deep iOS frosted blur
  content.style.filter = 'blur(10px)';
  content.style.transition = 'filter 0.4s cubic-bezier(0.32, 0.72, 0, 1)';
  card.appendChild(content);

  // Transparent blur loader with white spinner and white text
  const loader = h('div', { class: 'osas-modal-loader' },
    h('div', { class: 'osas-spinner-white' }),
    h('span', { class: 'text-[11px] font-bold tracking-[0.2em] text-white uppercase mb-1.5 drop-shadow' }, 'Please Wait'),
    h('p', { class: 'text-sm text-white/90 font-medium drop-shadow' }, 'Content is loading…')
  );
  card.appendChild(loader);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Trigger enter transition smoothly
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  // Rate-limiting / grace period delay: 3s before revealing content
  let isClosing = false;
  let fadeTimer = null;
  const loadTimer = setTimeout(() => {
    if (isClosing) return;
    loader.classList.add('fade-out');
    content.style.filter = 'none';
    fadeTimer = setTimeout(() => {
      if (isClosing) return;
      if (loader.parentNode === card) card.removeChild(loader);
    }, 320);
  }, 3000);

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  function close() {
    if (isClosing) return;
    isClosing = true;
    clearTimeout(loadTimer);
    clearTimeout(fadeTimer);
    document.removeEventListener('keydown', onKey);
    
    overlay.classList.remove('active');
    
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 250);
  }

  return { close };
}
