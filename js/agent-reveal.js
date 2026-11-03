

export function revealDuration(characterCount) {
  return Math.max(140, Math.min(1450, Math.round(characterCount * 3.2)));
}

function glyphs(value) {
  const text = String(value || '');
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    return Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text), (item) => item.segment);
  }
  return Array.from(text);
}

export function animateFormattedReply(root, options = {}) {
  const entries = [];
  const visit = (node) => {
    if (node.nodeType === 3) {
      if (node.nodeValue) entries.push({ node, glyphs: glyphs(node.nodeValue), shown: -1 });
      return;
    }
    for (const child of node.childNodes || []) visit(child);
  };
  visit(root);

  const count = entries.reduce((sum, item) => sum + item.glyphs.length, 0);
  const onProgress = options.onProgress || (() => {});
  const shouldReduce = options.reducedMotion ?? (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  if (!count || shouldReduce || typeof requestAnimationFrame !== 'function') {
    return () => {};
  }

  const render = (visible) => {
    let offset = 0;
    for (const entry of entries) {
      const next = Math.max(0, Math.min(entry.glyphs.length, visible - offset));
      if (next !== entry.shown) {
        entry.node.nodeValue = entry.glyphs.slice(0, next).join('');
        entry.shown = next;
      }
      offset += entry.glyphs.length;
    }
    onProgress();
  };

  render(0);
  const duration = revealDuration(count);
  let start = null;
  let frame = 0;
  let finished = false;

  const step = (timestamp) => {
    if (finished) return;
    if (start === null) start = timestamp;
    const progress = Math.min(1, (timestamp - start) / duration);
    render(Math.max(1, Math.floor(count * progress)));
    if (progress < 1) frame = requestAnimationFrame(step);
    else finished = true;
  };
  frame = requestAnimationFrame(step);

  
  
  return (finish = true) => {
    if (finished) return;
    finished = true;
    cancelAnimationFrame(frame);
    if (finish) render(count);
  };
}
