import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSessionStore, createConversation, sessionTitle } from '../js/agent-sessions.js';

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: key => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: key => entries.delete(key),
  };
}

test('sessions are isolated by user and role with persistent storage', () => {
  const disk = memoryStorage();
  const admin = createSessionStore(disk, 'admin:42');
  const user = createSessionStore(disk, 'student:42');
  const one = createConversation();
  one.messages.push({ role: 'user', content: 'Find students' }, { role: 'assistant', content: 'Found 2 students' });
  admin.save(one);
  assert.equal(admin.list().length, 1);
  assert.equal(user.list().length, 0);
  assert.equal(createSessionStore(disk, 'admin:42').list()[0].messages[1].content, 'Found 2 students');
  assert.match(admin.list()[0].title, /Find students/);
  admin.remove(one.id);
  assert.equal(admin.list().length, 0);
});

test('message validation strips image bytes and retains safe image filename', () => {
  const disk = memoryStorage();
  const admin = createSessionStore(disk, 'admin:81');
  admin.save({
    id: 'session-test', updatedAt: Date.now(), title: 'Image',
    messages: [
      { role: 'user', content: 'Read screenshot', imageName: 'screenshot.png', image: { data: 'secret-base64' } },
      { role: 'assistant', content: 'This image reads OSAS.' },
    ],
  });
  const saved = admin.get('session-test');
  assert.equal(saved.messages[0].imageName, 'screenshot.png');
  assert.ok(!('image' in saved.messages[0]));
  assert.equal(saved.messages[1].content, 'This image reads OSAS.');
});

test('store migrates former per-account session history once', () => {
  const disk = memoryStorage(), legacy = memoryStorage();
  const scope = 'student:abc';
  legacy.setItem('osas.agent.history.v1:' + scope, JSON.stringify([
    { role: 'user', content: 'Where is the map?' }, { role: 'assistant', content: 'Open Evacuation Map.' },
  ]));
  legacy.setItem('osas.agent.session.v1:' + scope, 'my-old-session');
  const store = createSessionStore(disk, scope, legacy);
  assert.equal(store.migrate()[0].id, 'my-old-session');
  assert.equal(store.migrate().length, 1);
  assert.equal(legacy.getItem('osas.agent.history.v1:' + scope), null);
});

test('trims saved data and protects against malformed history', () => {
  const disk = memoryStorage(), store = createSessionStore(disk, 'admin:x');
  for (let i = 0; i < 30; i++) store.save({
    id: 'id-' + i,
    messages: [{ role: 'user', content: 'Message ' + i }, { role: 'nobody', content: 'invalid' }],
  });
  assert.equal(store.list().length, 16);
  assert.equal(store.list()[0].messages.length, 1);
  assert.equal(sessionTitle([{ role: 'assistant', content: 'Hi' }]), 'New conversation');
});

test('frontend implements resume picker, history, skeleton and image upload safely', () => {
  const src = readFileSync(new URL('../js/agent.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../css/agent.css', import.meta.url), 'utf8');
  assert.ok(src.includes('showResumeChoice'));
  assert.ok(src.includes('openSavedConversation'));
  assert.ok(src.includes('showSkeletons'));
  assert.ok(src.includes('showStartup'));
  assert.ok(src.includes('createSessionStore'));
  assert.ok(src.includes('MAX_IMAGE_BYTES'));
  assert.ok(src.includes('imageProcessed'));
  assert.ok(src.includes('if (chosenFile && !isAdmin()) return'));
  assert.ok(css.includes('agent-history-skeletons'));
  assert.ok(css.includes('agent-startup'));
  assert.ok(css.includes('@keyframes agent-enter'));
});

test('n8n workflow template explicitly passes images into the AI Agent', () => {
  const workflow = JSON.parse(readFileSync(new URL('../docs/n8n/osas-admin-agent.workflow.json', import.meta.url), 'utf8'));
  const code = workflow.nodes.find(n => n.name === 'Prepare Vision Input');
  const agent = workflow.nodes.find(n => n.name === 'AI Agent');
  const reply = workflow.nodes.find(n => n.name === 'Respond to Administrator');
  assert.ok(code.parameters.jsCode.includes('binary:'));
  assert.ok(agent.parameters.options.passthroughBinaryImages);
  assert.ok(reply.parameters.responseBody.includes('imageProcessed'));
  assert.equal(workflow.connections['Check Secret'].main[0][0].node, 'Prepare Vision Input');
});
