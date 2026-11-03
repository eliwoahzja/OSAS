import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/login.js', import.meta.url), 'utf8');

test('sign-in and password recovery display Student ID with the same placeholder', () => {
  assert.ok(src.includes("field({ label: 'Student ID', icon: 'id-card', input: email })"));
  assert.ok(src.includes("field({ label: 'Student ID', icon: 'envelope', input: email })"));
  assert.equal((src.match(/placeholder: 's26XXXXXXX'/g) || []).length, 2);
  assert.ok(!src.includes("label: 'Student ID or admin email'"));
  assert.ok(!src.includes("label: 'Student ID or email'"));
});

test('login and recovery preserve shared identifier validation and authentication', () => {
  assert.ok(src.includes('addr = auth.accountAddress(email.value)'));
  assert.ok(src.includes('await auth.signIn(addr, password.value)'));
  assert.ok(src.includes('contact = auth.accountAddress(email.value)'));
  assert.ok(src.includes('await auth.requestPasswordReset(contact)'));
});
