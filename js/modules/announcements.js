import { h, icon } from '../ui.js';
import * as api from '../api.js';
import { isAdmin } from '../auth.js';
import { recordForm, confirmDelete } from './record-actions.js';

const PAGE_SIZE = 2;
const POSTER_SIZE = { 'long-spookend.jpg': [1024,1280], 'teachers-day.jpg': [1280,1073], 'dance-troupe-auditions.jpg': [983,1280] };
const fields = [
  { key: 'title', label: 'Title', required: true, maxLength: 120, wide: true, placeholder: 'What should students know?' },
  { key: 'body', label: 'Message', type: 'textarea', required: true, maxLength: 5000, wide: true, placeholder: 'Write your announcement…' },
];

export function createAnnouncementBoard() {
  const admin = isAdmin();
  let page = 0;
  let request = 0;
  let loading = false;
  let signature = '';
  const list = h('div', { class: 'announcement-list' }, h('p', { class: 'announcement-state', role: 'status' }, 'Loading announcements…'));
  const error = h('div', { class: 'announcement-error', hidden: true, role: 'alert' });
  const navigation = h('nav', { class: 'announcement-pagination', 'aria-label': 'Announcement pages', hidden: true });
  const element = h('section', { class: 'announcement-board', 'aria-labelledby': 'announcement-board-title' },
    h('header', { class: 'announcement-heading' },
      h('h3', { id: 'announcement-board-title' }, icon('bullhorn'), 'Announcements'),
      admin && h('button', { type: 'button', class: 'btn-primary', onclick: () => edit() }, icon('add'), 'Post announcement'),
    ),
    error, list, navigation,
  );

  function edit(record = null) {
    recordForm({
      title: record ? 'Edit announcement' : 'Post announcement',
      table: 'announcements', record, fields,
      submitLabel: record ? 'Save changes' : 'Publish announcement',
      successMessage: record ? 'Announcement updated.' : 'Announcement published.',
      validate: ({ title, body }) => title.length > 120 || body.length > 5000 ? 'Use a title up to 120 characters and a message up to 5000 characters.' : null,
      onSaved: async () => { page = 0; await refresh(); },
    });
  }

  function card(row) {
    const imagePath = /^assets\/announcements\/[a-z0-9-]+\.jpg$/.test(row.image_path || '') ? '/' + row.image_path : null;
    const size = POSTER_SIZE[String(row.image_path || '').split('/').pop()] || [];
    const date = new Date(row.created_at);
    const dateLabel = Number.isNaN(date.getTime()) ? 'Recently posted'
      : new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'long', day: '2-digit', year: 'numeric' }).format(date)
        + ' ' + new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit' }).format(date);
    return h('article', { class: 'announcement-card', 'aria-label': row.title },
      imagePath ? h('a', { class: 'announcement-poster', href: imagePath, target: '_blank', rel: 'noopener noreferrer', 'aria-label': 'Open full poster: ' + row.title },
        h('img', { src: imagePath, alt: row.title + '. ' + row.body, width: size[0], height: size[1], loading: 'lazy', decoding: 'async' }),
      ) : h('div', { class: 'announcement-text' },
        h('h4', { class: 'announcement-title' }, row.title),
        h('p', { class: 'announcement-body' }, row.body),
      ),
      h('div', { class: 'announcement-footer' },
        h('p', { class: 'announcement-date' },
          h('time', { datetime: row.created_at }, dateLabel), row.updated_at !== row.created_at ? ' · Edited' : '',
        ),
        admin && h('div', { class: 'announcement-actions' },
          h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Edit announcement: ' + row.title, onclick: () => edit(row) }, icon('pen'), 'Edit'),
          h('button', { type: 'button', class: 'btn-ghost', 'aria-label': 'Delete announcement: ' + row.title, onclick: () => confirmDelete({
            title: 'announcement “' + row.title + '”', table: 'announcements', record: row, onSaved: refresh,
            description: 'This removes the announcement from every student’s board. This cannot be undone.',
            actionLabel: 'Delete announcement', successMessage: 'Announcement deleted.',
          }) }, icon('trash-can'), 'Delete'),
        ),
      ),
    );
  }

  async function refresh() {
    const current = ++request;
    loading = true;
    list.setAttribute('aria-busy', 'true');
    navigation.setAttribute('aria-busy', 'true');
    try {
      const rows = await api.listAnnouncements({ offset: page * PAGE_SIZE, limit: PAGE_SIZE + 1 });
      if (current !== request) return;
      if (!rows.length && page > 0) { page -= 1; return refresh(); }
      error.hidden = true;
      const nextSignature = JSON.stringify([page, rows]);
      if (signature === nextSignature) return;
      signature = nextSignature;
      list.replaceChildren(...(rows.length ? rows.slice(0, PAGE_SIZE).map(card) : [
        h('div', { class: 'announcement-state' },
          icon('bullhorn', 'text-xl'),
          h('h4', {}, 'No announcements yet'),
          h('p', {}, admin ? 'Post the first update for your students.' : 'School updates will appear here when an admin posts them.'),
        ),
      ]));
      navigation.hidden = page === 0 && rows.length <= PAGE_SIZE;
      navigation.replaceChildren(
        h('button', { type: 'button', class: 'btn-ghost', disabled: page === 0, onclick: async () => { if (!loading) { page -= 1; await refresh(); } } }, 'Previous'),
        h('span', { role: 'status' }, 'Page ' + (page + 1)),
        h('button', { type: 'button', class: 'btn-ghost', disabled: rows.length <= PAGE_SIZE, onclick: async () => { if (!loading) { page += 1; await refresh(); } } }, 'Next'),
      );
    } catch (e) {
      if (current !== request) return;
      error.hidden = false;
      error.replaceChildren(h('p', {}, e.message || 'Could not load announcements.'), h('button', { type: 'button', class: 'btn-ghost', onclick: refresh }, 'Retry announcements'));
      if (!signature) list.replaceChildren();
    } finally {
      if (current === request) { loading = false; list.setAttribute('aria-busy', 'false'); navigation.setAttribute('aria-busy', 'false'); }
    }
  }

  return { element, refresh };
}
