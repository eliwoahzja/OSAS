import {
  h, icon, moduleShell, pill, dataTable, emptyBanner, errorBanner, toast, openModal, inputCls, labelCls,
  formatDateTime, skeletonTable,
} from '../ui.js';
import * as auth from '../auth.js';

function fnUrl() {
  const base = window.OSAS.NOTIFY_FN_URL || '';
  return base.replace(/[^/]+\/?$/, 'manage-accounts');
}

async function call(payload) {
  const token = await auth.currentAccessToken();
  if (!token) throw new Error('Sign-in required.');
  let res;
  try {
    res = await fetch(fnUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: window.OSAS.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Could not reach the account service. Is the manage-accounts function deployed?');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error((data && data.error) || `Request failed (${res.status})`);
  return data;
}

function openEditModal(user, isSelf, onSaved) {
  const name = h('input', { type: 'text', class: inputCls, value: user.name || '', required: true, autocomplete: 'off' });
  const email = h('input', { type: 'email', class: inputCls, value: user.email || '', required: true, autocomplete: 'off' });
  const password = h('input', { type: 'text', class: inputCls, placeholder: 'Leave blank to keep the current password', autocomplete: 'new-password' });
  const role = h('select', { class: inputCls },
    h('option', { value: 'client' }, 'Client — standard tabs only'),
    h('option', { value: 'admin' }, 'Administrator — all tabs + account management'),
  );
  role.value = user.role === 'admin' ? 'admin' : 'client';
  if (isSelf) role.disabled = true;
  const err = h('p', { class: 'hidden text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  const save = h('button', { type: 'submit', class: 'btn-primary' }, icon('check_circle', 'text-sm'), 'Save changes');

  const form = h('form', {
    class: 'p-6 sm:p-8 space-y-4',
    onsubmit: async (e) => {
      e.preventDefault();
      err.classList.add('hidden');
      save.disabled = true;
      try {
        const payload = { action: 'update', id: user.id, name: name.value, email: email.value, role: role.value };
        if (password.value) payload.password = password.value;
        await call(payload);
        toast('Account updated.');
        modal.close();
        onSaved();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
        save.disabled = false;
      }
    },
  },
    h('div', { class: 'border-b border-gray-100 pb-4' },
      h('h3', { class: 'text-lg font-bold text-gray-900' }, 'Edit account'),
      h('p', { class: 'text-xs text-gray-500 mt-0.5' }, isSelf ? 'You can’t change your own account type.' : 'Changes apply the next time they sign in.'),
    ),
    h('div', {}, h('label', { class: labelCls }, 'Full name'), name),
    h('div', {}, h('label', { class: labelCls }, 'Email'), email),
    h('div', {}, h('label', { class: labelCls }, 'New password'), password),
    h('div', {}, h('label', { class: labelCls }, 'Account type'), role),
    err,
    h('div', { class: 'flex justify-end gap-3 pt-2' },
      h('button', { type: 'button', class: 'px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50', onclick: () => modal.close() }, 'Cancel'),
      save,
    ),
  );
  const modal = openModal(form, { delay: 0 });
  name.focus();
}

function openDeleteModal(user, onDeleted) {
  const err = h('p', { class: 'hidden text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  const confirmBtn = h('button', {
    type: 'button',
    class: 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors',
    onclick: async () => {
      err.classList.add('hidden');
      confirmBtn.disabled = true;
      try {
        await call({ action: 'delete', id: user.id });
        toast(`Removed ${user.email}.`);
        modal.close();
        onDeleted();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
        confirmBtn.disabled = false;
      }
    },
  }, icon('trash', 'text-sm'), 'Remove account');
  const content = h('div', { class: 'p-6 sm:p-8 space-y-4' },
    h('div', { class: 'w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center' }, icon('warning', 'text-lg')),
    h('div', {},
      h('h3', { class: 'text-lg font-bold text-gray-900' }, 'Remove this account?'),
      h('p', { class: 'text-sm text-gray-500 mt-1' }, h('strong', { class: 'text-gray-800' }, user.name || user.email), ` (${user.email}) will lose access immediately. This can’t be undone.`),
    ),
    err,
    h('div', { class: 'flex justify-end gap-3 pt-2' },
      h('button', { type: 'button', class: 'px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50', onclick: () => modal.close() }, 'Cancel'),
      confirmBtn,
    ),
  );
  const modal = openModal(content, { delay: 0 });
}

function openCreateModal(onCreated) {
  const name = h('input', { type: 'text', class: inputCls, placeholder: 'Full name', required: true, autocomplete: 'off' });
  const email = h('input', { type: 'email', class: inputCls, placeholder: 'name@saac.edu.ph', required: true, autocomplete: 'off' });
  const password = h('input', { type: 'text', class: inputCls, placeholder: 'At least 8 characters', required: true, autocomplete: 'new-password' });
  const role = h('select', { class: inputCls },
    h('option', { value: 'client' }, 'Client — standard tabs only'),
    h('option', { value: 'admin' }, 'Administrator — all tabs + account management'),
  );
  const err = h('p', { class: 'hidden text-[13px] text-red-600 bg-red-50 border border-red-200/70 rounded-xl px-3.5 py-2.5' });
  const gen = h('button', {
    type: 'button', class: 'text-xs font-semibold text-pink-600 hover:underline mt-1.5',
    onclick: () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
      const buf = crypto.getRandomValues(new Uint32Array(12));
      password.value = Array.from(buf, (n) => chars[n % chars.length]).join('');
    },
  }, 'Generate a password');
  const save = h('button', { type: 'submit', class: 'btn-primary' }, icon('user-plus', 'text-sm'), 'Create account');

  const form = h('form', {
    class: 'p-6 sm:p-8 space-y-4',
    onsubmit: async (e) => {
      e.preventDefault();
      err.classList.add('hidden');
      save.disabled = true;
      try {
        await call({ action: 'create', name: name.value, email: email.value, password: password.value, role: role.value });
        toast(`Account created for ${email.value.trim()}. Share the password with them securely.`);
        modal.close();
        onCreated();
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.remove('hidden');
        save.disabled = false;
      }
    },
  },
    h('div', { class: 'border-b border-gray-100 pb-4' },
      h('h3', { class: 'text-lg font-bold text-gray-900' }, 'Create account'),
      h('p', { class: 'text-xs text-gray-500 mt-0.5' }, 'They sign in with this email and password, then enter a code emailed to them.'),
    ),
    h('div', {}, h('label', { class: labelCls }, 'Full name'), name),
    h('div', {}, h('label', { class: labelCls }, 'Email'), email),
    h('div', {}, h('label', { class: labelCls }, 'Temporary password'), password, gen),
    h('div', {}, h('label', { class: labelCls }, 'Account type'), role),
    err,
    h('div', { class: 'flex justify-end gap-3 pt-2' },
      h('button', { type: 'button', class: 'px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50', onclick: () => modal.close() }, 'Cancel'),
      save,
    ),
  );
  const modal = openModal(form, { delay: 0 });
  name.focus();
}

export async function accounts(el) {
  el.innerHTML = '';
  const holder = h('div');
  let wrap;

  const load = async () => {
    holder.innerHTML = '';
    holder.appendChild(skeletonTable(5, 5));
    try {
      const { users, me } = await call({ action: 'list' });
      holder.innerHTML = '';
      if (!users.length) {
        holder.appendChild(emptyBanner({ icon: 'user-plus', title: 'No accounts yet', text: 'Create the first one.' }));
        return;
      }
      users.sort((a, b) => (a.role === b.role ? a.email.localeCompare(b.email) : a.role === 'admin' ? -1 : 1));
      holder.appendChild(dataTable([
        { label: 'Name', render: (u) => h('span', { class: 'font-semibold text-gray-900' }, u.name) },
        { label: 'Email', key: 'email' },
        { label: 'Type', render: (u) => pill(u.role === 'admin' ? 'Administrator' : 'Client', u.role === 'admin' ? 'pink' : 'blue') },
        { label: 'Last sign-in', render: (u) => (u.last_sign_in_at ? formatDateTime(u.last_sign_in_at) : 'Never') },
        { label: 'Actions', cls: 'sticky right-0 bg-white', render: (u) => h('div', { class: 'flex items-center gap-2' },
          h('button', {
            class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 clickable',
            onclick: () => openEditModal(u, u.id === me, load),
          }, icon('pen-to-square', 'text-[11px]'), 'Edit'),
          u.id === me
            ? h('span', { class: 'text-xs text-gray-400 px-1' }, 'You')
            : h('button', {
              class: 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50 clickable',
              onclick: () => openDeleteModal(u, load),
            }, icon('trash', 'text-[11px]'), 'Remove'),
        ) },
      ], users));
    } catch (ex) {
      holder.innerHTML = '';
      holder.appendChild(errorBanner(ex.message, load));
    }
  };

  wrap = moduleShell({
    icon: 'user-plus', title: 'Accounts',
    subtitle: 'Administrators see every tab. Clients only see the standard tabs (no Risk Assessment, Safety Reports, Emergency Roles or Accounts).',
    actionLabel: 'Create account', actionIcon: 'user-plus',
    onAction: () => openCreateModal(load),
    children: [holder],
  });
  el.appendChild(wrap);
  await load();
}
