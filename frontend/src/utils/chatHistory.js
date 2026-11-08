const GUEST_KEY = 'volteniq_guest_chats'

function nowIso() {
  return new Date().toISOString()
}

function id() {
  return crypto.randomUUID()
}

function readGuest() {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    const parsed = raw ? JSON.parse(raw) : { conversations: [] }
    return Array.isArray(parsed.conversations) ? parsed : { conversations: [] }
  } catch {
    return { conversations: [] }
  }
}

function writeGuest(store) {
  localStorage.setItem(GUEST_KEY, JSON.stringify(store))
}

function sortConversations(list) {
  return [...list].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

export function titleFromContent(content) {
  const clean = String(content || '').replace(/\s+/g, ' ').trim()
  if (!clean) return 'New chat'
  return clean.length > 48 ? `${clean.slice(0, 45)}…` : clean
}

export function splitPinnedRecent(conversations = []) {
  const sorted = sortConversations(conversations)
  return {
    pinned: sorted.filter((c) => c.pinned),
    recent: sorted.filter((c) => !c.pinned),
  }
}

/** Guest-mode persistence when the user is not authenticated. */
export const guestChatStore = {
  list() {
    return sortConversations(readGuest().conversations.map(({ messages, ...rest }) => ({
      ...rest,
      messageCount: messages?.length || 0,
    })))
  },
  create(title = 'New chat') {
    const store = readGuest()
    const conversation = {
      id: id(),
      title: titleFromContent(title) || 'New chat',
      pinned: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      messages: [],
    }
    store.conversations.unshift(conversation)
    writeGuest(store)
    return { ...conversation, messageCount: 0, messages: [] }
  },
  get(conversationId) {
    const conversation = readGuest().conversations.find((c) => c.id === conversationId)
    if (!conversation) return null
    return {
      ...conversation,
      messageCount: conversation.messages.length,
      messages: conversation.messages,
    }
  },
  update(conversationId, patch) {
    const store = readGuest()
    const conversation = store.conversations.find((c) => c.id === conversationId)
    if (!conversation) return null
    if (typeof patch.title === 'string') conversation.title = patch.title.trim().slice(0, 80) || conversation.title
    if (typeof patch.pinned === 'boolean') conversation.pinned = patch.pinned
    conversation.updatedAt = nowIso()
    writeGuest(store)
    return {
      id: conversation.id,
      title: conversation.title,
      pinned: conversation.pinned,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messageCount: conversation.messages.length,
    }
  },
  remove(conversationId) {
    const store = readGuest()
    store.conversations = store.conversations.filter((c) => c.id !== conversationId)
    writeGuest(store)
    return { id: conversationId, deleted: true }
  },
  append(conversationId, messages) {
    const store = readGuest()
    const conversation = store.conversations.find((c) => c.id === conversationId)
    if (!conversation) return null
    const created = messages.map((m) => ({
      id: id(),
      role: m.role,
      content: m.content,
      createdAt: nowIso(),
    }))
    conversation.messages.push(...created)
    if (conversation.title === 'New chat') {
      const firstUser = messages.find((m) => m.role === 'user')
      if (firstUser) conversation.title = titleFromContent(firstUser.content)
    }
    conversation.updatedAt = nowIso()
    writeGuest(store)
    return {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        pinned: conversation.pinned,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        messageCount: conversation.messages.length,
      },
      messages: created,
    }
  },
}
