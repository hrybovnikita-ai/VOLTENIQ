import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DEMO_MODE = 'true';

const {
  appendMessages,
  conversationBelongsTo,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
  updateConversation,
} = await import('../src/services/chatService.js');

test('chat create, rename, pin, message persistence and isolation', async () => {
  const userA = 'user-a-chat-test';
  const userB = 'user-b-chat-test';

  const created = await createConversation(userA, { title: 'New chat' });
  assert.equal(created.title, 'New chat');
  assert.equal(created.pinned, false);

  const listed = await listConversations(userA);
  assert.ok(listed.some((c) => c.id === created.id));

  const renamed = await updateConversation(userA, created.id, { title: 'Best MacBook' });
  assert.equal(renamed.title, 'Best MacBook');

  const pinned = await updateConversation(userA, created.id, { pinned: true });
  assert.equal(pinned.pinned, true);

  const saved = await appendMessages(userA, created.id, [
    { role: 'user', content: 'Compare MacBook Air and Pro' },
    { role: 'assistant', content: 'Air for travel, Pro for heavy workloads.' },
  ]);
  assert.equal(saved.messages.length, 2);

  const loaded = await getConversation(userA, created.id);
  assert.equal(loaded.messages.length, 2);
  assert.equal(loaded.messages[0].content, 'Compare MacBook Air and Pro');
  assert.equal(loaded.pinned, true);

  const afterActivity = await listConversations(userA);
  assert.equal(afterActivity[0].id, created.id);
  assert.equal(afterActivity[0].pinned, true);

  assert.equal(await conversationBelongsTo(userB, created.id), false);
  await assert.rejects(() => getConversation(userB, created.id), /own|not found/i);
  await assert.rejects(() => updateConversation(userB, created.id, { title: 'Hijack' }), /own|not found/i);
  await assert.rejects(() => deleteConversation(userB, created.id), /own|not found/i);

  const deleted = await deleteConversation(userA, created.id);
  assert.equal(deleted.deleted, true);
  assert.equal(await conversationBelongsTo(userA, created.id), false);
});

test('new chat does not wipe existing history', async () => {
  const userId = 'user-multi-chat';
  const first = await createConversation(userId, { title: 'iPhone comparison' });
  await appendMessages(userId, first.id, [{ role: 'user', content: 'iPhone 16 vs 15' }]);
  const second = await createConversation(userId, { title: 'AirPods recommendations' });

  const list = await listConversations(userId);
  assert.ok(list.some((c) => c.id === first.id));
  assert.ok(list.some((c) => c.id === second.id));

  const stillThere = await getConversation(userId, first.id);
  assert.ok(stillThere.messages.length >= 1);
});
