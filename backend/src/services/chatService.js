import { config } from '../config.js';
import { prisma } from '../db/prisma.js';
import { createId, getDemoStore } from '../db/demoStore.js';

function notFound(message = 'Conversation not found') {
  const err = new Error(message);
  err.status = 404;
  return err;
}

function forbidden(message = 'You do not own this conversation') {
  const err = new Error(message);
  err.status = 403;
  return err;
}

function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

function summarize(conversation, messages = []) {
  return {
    id: conversation.id,
    title: conversation.title,
    pinned: Boolean(conversation.pinned),
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    messageCount: messages.length || conversation._count?.messages || 0,
  };
}

function titleFromContent(content) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New chat';
  return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean;
}

async function assertOwned(userId, conversationId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const conversation = store.chatConversations.find((c) => c.id === conversationId);
    if (!conversation) throw notFound();
    if (conversation.userId !== userId) throw forbidden();
    return conversation;
  }

  const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
  if (!conversation) throw notFound();
  if (conversation.userId !== userId) throw forbidden();
  return conversation;
}

export async function listConversations(userId) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const mine = store.chatConversations.filter((c) => c.userId === userId);
    return sortConversations(mine).map((c) =>
      summarize(
        c,
        store.chatMessages.filter((m) => m.conversationId === c.id)
      )
    );
  }

  const rows = await prisma.chatConversation.findMany({
    where: { userId },
    include: { _count: { select: { messages: true } } },
    orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
  });
  return rows.map((row) => summarize(row));
}

export async function createConversation(userId, { title = 'New chat' } = {}) {
  if (config.demoMode) {
    const store = await getDemoStore();
    const now = new Date().toISOString();
    const conversation = {
      id: createId(),
      userId,
      title: titleFromContent(title) || 'New chat',
      pinned: false,
      createdAt: now,
      updatedAt: now,
    };
    store.chatConversations.unshift(conversation);
    return summarize(conversation, []);
  }

  const conversation = await prisma.chatConversation.create({
    data: {
      userId,
      title: titleFromContent(title) || 'New chat',
    },
    include: { _count: { select: { messages: true } } },
  });
  return summarize(conversation);
}

export async function getConversation(userId, conversationId) {
  await assertOwned(userId, conversationId);

  if (config.demoMode) {
    const store = await getDemoStore();
    const conversation = store.chatConversations.find((c) => c.id === conversationId);
    const messages = store.chatMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return { ...summarize(conversation, messages), messages };
  }

  const conversation = await prisma.chatConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      _count: { select: { messages: true } },
    },
  });
  return {
    ...summarize(conversation),
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  };
}

export async function updateConversation(userId, conversationId, patch = {}) {
  await assertOwned(userId, conversationId);
  const data = {};
  if (typeof patch.title === 'string') {
    const next = patch.title.trim();
    if (!next) {
      const err = new Error('Title is required');
      err.status = 400;
      throw err;
    }
    data.title = next.slice(0, 80);
  }
  if (typeof patch.pinned === 'boolean') data.pinned = patch.pinned;

  if (config.demoMode) {
    const store = await getDemoStore();
    const conversation = store.chatConversations.find((c) => c.id === conversationId);
    Object.assign(conversation, data, { updatedAt: new Date().toISOString() });
    return summarize(
      conversation,
      store.chatMessages.filter((m) => m.conversationId === conversationId)
    );
  }

  const conversation = await prisma.chatConversation.update({
    where: { id: conversationId },
    data,
    include: { _count: { select: { messages: true } } },
  });
  return summarize(conversation);
}

export async function deleteConversation(userId, conversationId) {
  await assertOwned(userId, conversationId);

  if (config.demoMode) {
    const store = await getDemoStore();
    store.chatConversations = store.chatConversations.filter((c) => c.id !== conversationId);
    store.chatMessages = store.chatMessages.filter((m) => m.conversationId !== conversationId);
    return { id: conversationId, deleted: true };
  }

  await prisma.chatConversation.delete({ where: { id: conversationId } });
  return { id: conversationId, deleted: true };
}

export async function appendMessages(userId, conversationId, messages) {
  const conversation = await assertOwned(userId, conversationId);
  if (!Array.isArray(messages) || !messages.length) {
    const err = new Error('At least one message is required');
    err.status = 400;
    throw err;
  }

  const normalized = messages.map((m) => {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m.content || '').trim();
    if (!content) {
      const err = new Error('Message content is required');
      err.status = 400;
      throw err;
    }
    return { role, content: content.slice(0, 8000) };
  });

  if (config.demoMode) {
    const store = await getDemoStore();
    const now = new Date().toISOString();
    const created = normalized.map((m) => ({
      id: createId(),
      conversationId,
      role: m.role,
      content: m.content,
      createdAt: now,
    }));
    store.chatMessages.push(...created);

    const shouldRename = conversation.title === 'New chat';
    const firstUser = normalized.find((m) => m.role === 'user');
    if (shouldRename && firstUser) conversation.title = titleFromContent(firstUser.content);
    conversation.updatedAt = now;

    return {
      conversation: summarize(
        conversation,
        store.chatMessages.filter((m) => m.conversationId === conversationId)
      ),
      messages: created,
    };
  }

  const result = await prisma.$transaction(async (tx) => {
    const created = [];
    for (const message of normalized) {
      created.push(
        await tx.chatMessage.create({
          data: {
            conversationId,
            role: message.role,
            content: message.content,
          },
        })
      );
    }

    const shouldRename = conversation.title === 'New chat';
    const firstUser = normalized.find((m) => m.role === 'user');
    const updated = await tx.chatConversation.update({
      where: { id: conversationId },
      data: {
        ...(shouldRename && firstUser ? { title: titleFromContent(firstUser.content) } : {}),
        updatedAt: new Date(),
      },
      include: { _count: { select: { messages: true } } },
    });

    return { conversation: summarize(updated), messages: created };
  });

  return {
    conversation: result.conversation,
    messages: result.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  };
}

/** Test helper: verify a user cannot read another user's conversation */
export async function conversationBelongsTo(userId, conversationId) {
  try {
    await assertOwned(userId, conversationId);
    return true;
  } catch (error) {
    if (error.status === 403 || error.status === 404) return false;
    throw error;
  }
}
