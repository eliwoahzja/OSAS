// Fetch every page so charts do not stop at the Data API's row limit.
export async function fetchEveryPage(fetchPage, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const page = await fetchPage(offset, pageSize);
    rows.push(...(page || []));
    if (!page || page.length < pageSize) return rows;
  }
}

// Realtime is an enhancement. Polling and focus refresh keep working without it.
export function startDashboardUpdates(refresh, subscribe, {
  win = window, doc = document, interval = 15000,
} = {}) {
  let closed = false;
  let running = false;
  let queued = false;
  let unsubscribe = () => {};
  const update = async () => {
    if (closed) return;
    if (running) { queued = true; return; }
    running = true;
    try { await refresh(); } finally {
      running = false;
      if (queued) { queued = false; if (!closed) void update(); }
    }
  };
  const onVisible = () => { if (doc.visibilityState === 'visible') void update(); };
  const timer = win.setInterval(update, interval);
  win.addEventListener('focus', update);
  win.addEventListener('osas:data-changed', update);
  doc.addEventListener('visibilitychange', onVisible);
  Promise.resolve().then(() => subscribe(update)).then((stop) => {
    if (closed) stop?.(); else unsubscribe = stop || unsubscribe;
  }).catch(() => {});
  return () => {
    closed = true;
    win.clearInterval(timer);
    win.removeEventListener('focus', update);
    win.removeEventListener('osas:data-changed', update);
    doc.removeEventListener('visibilitychange', onVisible);
    unsubscribe();
  };
}
