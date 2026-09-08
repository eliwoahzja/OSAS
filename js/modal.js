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

  card.appendChild(content);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Trigger enter transition smoothly
  requestAnimationFrame(() => {
    overlay.classList.add('active');
  });

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);

  let isClosing = false;
  function close() {
    if (isClosing) return;
    isClosing = true;
    document.removeEventListener('keydown', onKey);
    
    overlay.classList.remove('active');
    
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 220);
  }

  return { close };
}
