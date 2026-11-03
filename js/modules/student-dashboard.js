import { listenLoading } from '../loading.js';
import { h, icon, openModal, inputCls, labelCls, toast } from '../ui.js';
import { isAdmin } from '../auth.js';
import * as api from '../api.js';

export function studentOverview(user, gradeLevel) {
  const detail = (label, value, attrs = {}) => h('div', {},
    h('dt', {}, label), h('dd', attrs, value || 'Not available'),
  );
  return h('section', { class: 'student-info-grid', 'aria-label': 'Student information' },
    h('article', { class: 'student-info-card', 'aria-label': 'Your student details' },
      h('h2', {}, icon('user'), user?.name || 'Student'),
      h('dl', {},
        detail('Student ID', user?.student_id, { 'data-current-student-id': '' }),
        detail('Grade', gradeLevel ? String(gradeLevel) : 'Not assigned'),
      ),
    ),
  );
}

export function editStudentGrade(user) {
  if (!isAdmin()) return;
  const select = h('select', { id: 'student-grade-level', class: inputCls, disabled: true },
    h('option', { value: '' }, 'Not assigned'),
    [7, 8, 9, 10, 11, 12].map(grade => h('option', { value: String(grade) }, 'Grade ' + grade)),
  );
  const error = h('p', { role: 'alert', class: 'text-sm text-red-600', hidden: true });
  const save = h('button', { type: 'submit', class: 'btn-primary', disabled: true }, 'Save grade');
  const retry = h('button', { type: 'button', class: 'btn-ghost', hidden: true, onclick: load }, 'Retry loading grade');
  const form = h('form', { class: 'p-6 sm:p-8 space-y-4' },
    h('h3', { class: 'text-lg font-bold text-gray-900' }, 'Set student grade'),
    h('p', { class: 'text-sm text-gray-500' }, user.name + ' · ' + (user.student_id || user.email)),
    h('div', {}, h('label', { for: 'student-grade-level', class: labelCls }, 'Grade level'), select),
    error, retry,
    h('div', { class: 'flex justify-end gap-2' },
      h('button', { type: 'button', class: 'btn-ghost', onclick: () => modal.close() }, 'Cancel'), save),
  );
  const modal = openModal(form, { delay: 0 });
  async function load() {
    retry.hidden = true; error.hidden = true;
    try {
      const grade = await api.getStudentGrade(user.id);
      select.value = grade === null ? '' : String(grade);
      select.disabled = false; save.disabled = false;
    } catch (e) { error.textContent = e.message; error.hidden = false; retry.hidden = false; }
  }
  listenLoading(form, 'submit', async event => {
    event.preventDefault();
    save.disabled = true; error.hidden = true;
    try {
      await api.saveStudentGrade(user.id, select.value ? Number(select.value) : null);
      toast('Student grade saved.'); modal.close();
    } catch (e) { error.textContent = e.message; error.hidden = false; }
    finally { save.disabled = false; }
  });
  void load();
}
