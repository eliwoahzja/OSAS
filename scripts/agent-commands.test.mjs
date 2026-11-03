import test from 'node:test';
import assert from 'node:assert/strict';

import {
  availableCommands, parseCommand, commandHelp, assistantIdentity,
  studentNavigationAnswer, studentRouteAllowed,
} from '../js/agent-commands.js';

test('student command list does not expose administrative operations', () => {
  const names = availableCommands(false).map(({ name }) => name);
  assert.ok(names.includes('report'));
  assert.ok(names.includes('map'));
  assert.ok(names.includes('help'));
  assert.ok(!names.includes('addadmin'));
  assert.ok(!names.includes('notify'));
  assert.equal(parseCommand('/addadmin', false).kind, 'unknown');
  assert.equal(parseCommand('/student Cruz', false).kind, 'unknown');
  assert.ok(!commandHelp(false).includes('/addadmin'));
});

test('administrator commands create safe natural-language agent requests', () => {
  const student = parseCommand('/student John Cruz', true);
  assert.equal(student.kind, 'agent');
  assert.match(student.message, /Find the student: John Cruz/);
  const account = parseCommand('/addadmin maria@example.com', true);
  assert.equal(account.kind, 'agent');
  assert.match(account.message, /create a new administrator account/i);
  assert.match(account.message, /maria@example.com/);
  assert.equal(parseCommand('/newincident', true).kind, 'agent');
  assert.equal(parseCommand('Who are you?', true), null);
  assert.equal(parseCommand('/invalid', true).kind, 'unknown');
});

test('navigation commands only link to student-accessible routes', () => {
  for (const cmd of ['dashboard', 'contacts', 'map', 'report']) {
    const item = parseCommand('/' + cmd, false);
    assert.equal(item.kind, 'navigate');
    assert.equal(studentRouteAllowed(item.route), true);
  }
  assert.equal(studentRouteAllowed('accounts'), false);
  assert.equal(studentRouteAllowed('parent-notifications'), false);
  assert.equal(studentRouteAllowed('__proto__'), false);
});

test('student chatbot guides navigation without private lookups', () => {
  assert.equal(studentNavigationAnswer('How do I report an incident?').route, 'incident-logging');
  assert.equal(studentNavigationAnswer('Where is the evacuation map?').route, 'evacuation-plans');
  assert.equal(studentNavigationAnswer('Where are emergency contacts?').route, 'emergency-contacts');
  assert.equal(studentNavigationAnswer('Take me to dashboard').route, 'dashboard');
  const privateRequest = studentNavigationAnswer('Give me the private record of student X');
  assert.ok(!privateRequest.route);
  assert.match(privateRequest.reply, /navigate OSAS/i);
  const restricted = studentNavigationAnswer('Where do I manage accounts?');
  assert.ok(!restricted.route);
  assert.match(restricted.reply, /restricted/i);
});

test('role-specific assistant identity is explicit', () => {
  assert.match(assistantIdentity(false), /OSAS Chatbot/);
  assert.match(assistantIdentity(true), /Opus 5\.5/);
  assert.equal(parseCommand('/whoami').kind, 'identity');
  assert.equal(parseCommand('/clear').kind, 'clear');
});
