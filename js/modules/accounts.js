import {
  h, icon, moduleShell, pill, dataTable, emptyBanner, errorBanner, toast, openModal, inputCls, labelCls,
  formatDateTime, skeletonTable,
} from '../ui.js';
import * as auth from '../auth.js';
import { roleLabel } from '../labels.js';
import { passwordResetCall } from '../password-reset.js';

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
  if (!res.ok) {
    if (res.status === 400 && data?.error === 'Unknown action.') {
      throw new Error('The deployed manage-accounts function is outdated. An administrator must redeploy the current Supabase Edge Function to enable account editing.');
    }
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

function openEditModal(user, isSelf, onSaved) {
  const name = h('input', { type: 'text', class: inputCls, value: user.name || '', required: true, autocomplete: 'off' });
  const email = h('input', { type: 'email', class: inputCls, value: user.email || '', required: true, autocomplete: 'off' });
  const password = h('input', { type: 'password', class: inputCls, placeholder: 'Leave blank to keep the current password', autocomplete: 'new-password' });
  const role = h('select', { class: inputCls },
    h('option', { value: 'client' }, 'Student — standard tabs only'),
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
  const password = h('input', { type: 'password', class: inputCls, placeholder: 'At least 8 characters', required: true, autocomplete: 'new-password' });
  const role = h('select', { class: inputCls },
    h('option', { value: 'client' }, 'Student — standard tabs only'),
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

function resetRequestReview(request, reload) {
  const err = h('p', { class: 'text-sm text-red-600', role: 'alert' });
  const actions = h('div', { class: 'flex flex-wrap gap-3 pt-3' });
  const body = h('div', { class: 'p-6 sm:p-8 space-y-4' },
    h('h3', { class: 'text-lg font-bold text-gray-900' }, 'Review account request'),
    h('p', { class: 'text-sm text-gray-500' }, 'Check the saved account details. Approval emails a single-use link to the account email. The user chooses their own password.'),
    h('dl', { class: 'space-y-3' }, [
      ['Request type', request.request_kind === 'registration' ? 'Registration' : 'Password reset'], ['Submitted full name', request.submitted_name || request.name], ['Saved account name', request.request_kind === 'registration' ? 'New account' : request.name], ['Account email', request.email], ['Account type', roleLabel(request.role)],
      ['Account created', formatDateTime(request.account_created_at)],
      ['Last sign-in', request.last_sign_in_at ? formatDateTime(request.last_sign_in_at) : 'Never'],
      ['Requested', formatDateTime(request.requested_at)], ['Status', request.status],
    ].map(([label, value]) => h('div', {}, h('dt', { class: 'text-xs text-gray-500' }, label), h('dd', { class: 'text-sm font-semibold break-words' }, value)))), err, actions);
  const modal = openModal(body, { delay: 0 });
  const act = (label, action, cls = 'btn-primary') => h('button', { type: 'button', class: cls, onclick: async () => {
    const buttons = [...actions.querySelectorAll('button')];
    buttons.forEach((button) => { button.disabled = true; }); err.textContent = '';
    try {
      const data = await passwordResetCall({ action, id: request.id }, true);
      toast(data.message); modal.close(); await reload();
    } catch (error) { err.textContent = error.message; buttons.forEach((button) => { button.disabled = false; }); }
  } }, label);
  if (request.status === 'pending') actions.append(act('Approve and email password link', 'approve'));
  if (['pending', 'approved'].includes(request.status)) actions.append(act(request.status === 'approved' ? 'Revoke reset link' : 'Reject request', 'reject', 'btn-ghost'));
  if (['approved', 'rejected', 'completed'].includes(request.status)) actions.append(h('button', { type: 'button', class: 'btn-ghost', onclick: () => { modal.close(); deleteRequest(request, reload); } }, 'Delete request'));
  actions.append(h('button', { type: 'button', class: 'btn-ghost', onclick: () => modal.close() }, 'Close'));
}

function deleteRequest(request, reload) {
  const error = h('p', { class: 'text-sm text-red-600', role: 'alert' });
  const confirm = h('button', { type: 'button', class: 'btn-primary', onclick: async () => {
    confirm.disabled = true;
    try { const data = await passwordResetCall({ action: 'delete', id: request.id }, true); modal.close(); toast(data.message); await reload(); }
    catch (e) { error.textContent = e.message; confirm.disabled = false; }
  } }, 'Delete request');
  const modal = openModal(h('div', { class: 'p-6 space-y-4' },
    h('h3', { class: 'text-lg font-bold' }, 'Delete this request from the list?'),
    h('p', { class: 'text-sm text-gray-500' }, 'This removes the reviewed request from the queue. An approved password link will keep working until it is used or expires.'),
    error, h('div', { class: 'flex gap-3 justify-end' }, h('button', { type: 'button', class: 'btn-ghost', onclick: () => modal.close() }, 'Cancel'), confirm)), { delay: 0 });
}

function resetRequestQueue() {
  const rows = h('div', { class: 'mt-4' });
  const refresh = h('button', { type: 'button', class: 'btn-ghost', onclick: () => load() }, 'Refresh requests');
  const section = h('section', { class: 'account-requests bg-white border border-gray-200 rounded-2xl p-5 mb-6', 'aria-label': 'Requests' },
    h('div', { class: 'flex flex-wrap items-center justify-between gap-3' },
      h('div', {}, h('h2', { class: 'text-lg font-bold text-gray-900' }, 'Requests'),
        h('p', { class: 'text-sm text-gray-500 mt-1' }, 'Review account creation and password reset requests.')), refresh), rows);
  async function load() {
    refresh.disabled = true; rows.replaceChildren(skeletonTable(3, 5));
    try {
      const { requests } = await passwordResetCall({ action: 'list' }, true);
      rows.replaceChildren();
      if (!requests.length) rows.append(emptyBanner({ icon: 'lock', title: 'No requests', text: 'New requests from sign-in appear here.' }));
      else rows.append(dataTable([
        { label: 'Account', render: (r) => h('div', {}, h('strong', {}, r.name), h('small', { class: 'block text-gray-500 break-words' }, r.email)) },
        { label: 'Request type', render: (r) => r.request_kind === 'registration' ? 'Registration' : 'Password reset' },
        { label: 'Requested', render: (r) => formatDateTime(r.requested_at) },
        { label: 'Status', render: (r) => {
          const expired = r.status === 'approved' && new Date(r.expires_at).getTime() <= Date.now();
          return h('div', {}, pill(expired ? 'Expired' : r.status, r.status === 'completed' ? 'green' : r.status === 'pending' ? 'amber' : 'gray'),
            r.notification_error ? h('p', { class: 'text-xs text-red-600 mt-1' }, r.notification_error) : null);
        } },
        { label: 'Actions', cls: 'request-actions-column', cellCls: 'request-actions-column', render: (r) => h('div', { class: 'request-actions' }, h('button', { type: 'button', class: 'btn-ghost', onclick: () => resetRequestReview(r, load) }, 'Review request'), ['approved', 'rejected', 'completed'].includes(r.status) ? h('button', { type: 'button', class: 'btn-ghost', onclick: () => deleteRequest(r, load) }, 'Delete request') : null) },
      ], requests));
    } catch (error) { rows.replaceChildren(errorBanner(error.message, load)); }
    finally { refresh.disabled = false; }
  }
  return { section, load };
}

export async function accounts(el) {
  if (!auth.isAdmin()) { el.replaceChildren(errorBanner('Administrators only.')); return; }
  el.innerHTML = '';
  const resets = resetRequestQueue();
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
        { label: 'Type', render: (u) => pill(roleLabel(u.role), u.role === 'admin' ? 'pink' : 'blue') },
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
    subtitle: 'Administrators see every tab. Students only see the standard tabs (no Risk Assessment, Safety Reports, Emergency Roles or Accounts).',
    actionLabel: 'Create account', actionIcon: 'user-plus',
    onAction: () => openCreateModal(load),
    children: [resets.section, holder],
  });
  el.appendChild(wrap);
  await Promise.allSettled([load(), resets.load()]);
}
