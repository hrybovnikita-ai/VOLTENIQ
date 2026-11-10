import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUp,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  ASSISTANT_SUGGESTIONS,
  ASSISTANT_WELCOME,
  localReply,
} from '../utils/assistantBrain'
import { guestChatStore, splitPinnedRecent } from '../utils/chatHistory'
import './Assistant.css'

const SIDEBAR_KEY = 'volteniq_ai_sidebar_collapsed'

function welcomeBubble() {
  return { id: crypto.randomUUID(), role: 'assistant', content: ASSISTANT_WELCOME }
}

export default function AssistantPage() {
  const { user } = useAuth()
  const authenticated = Boolean(user)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [conversations, setConversations] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [messages, setMessages] = useState([welcomeBubble()])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingChat, setLoadingChat] = useState(false)
  const [menuId, setMenuId] = useState(null)
  const [renameTarget, setRenameTarget] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [error, setError] = useState('')
  const endRef = useRef(null)
  const inputRef = useRef(null)
  const timerRef = useRef(null)
  const formId = useId()

  const { pinned, recent } = useMemo(() => splitPinnedRecent(conversations), [conversations])

  const persistSidebar = useCallback((next) => {
    setCollapsed(next)
    localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
  }, [])

  const refreshList = useCallback(async () => {
    setLoadingList(true)
    setError('')
    try {
      if (authenticated) {
        const { data } = await api.listChats()
        setConversations(data.conversations || [])
      } else {
        setConversations(guestChatStore.list())
      }
    } catch (err) {
      setError(err.message || 'Could not load chat history.')
    } finally {
      setLoadingList(false)
    }
  }, [authenticated])

  useEffect(() => {
    refreshList()
  }, [refreshList])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, typing])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  useEffect(() => {
    function onDocClick() {
      setMenuId(null)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  async function openConversation(id) {
    if (!id) return
    setMenuId(null)
    setDrawerOpen(false)
    setLoadingChat(true)
    setError('')
    try {
      if (authenticated) {
        const { data } = await api.getChat(id)
        setActiveId(data.conversation.id)
        const msgs = data.conversation.messages || []
        setMessages(
          msgs.length
            ? msgs.map((m) => ({ id: m.id, role: m.role, content: m.content }))
            : [welcomeBubble()]
        )
      } else {
        const conversation = guestChatStore.get(id)
        if (!conversation) return
        setActiveId(conversation.id)
        setMessages(
          conversation.messages?.length
            ? conversation.messages.map((m) => ({
                id: m.id,
                role: m.role,
                content: m.content,
              }))
            : [welcomeBubble()]
        )
      }
    } catch (err) {
      setError(err.message || 'Could not open conversation.')
    } finally {
      setLoadingChat(false)
    }
  }

  async function createNewChat() {
    if (timerRef.current) clearTimeout(timerRef.current)
    setTyping(false)
    setInput('')
    setMenuId(null)
    setError('')
    try {
      if (authenticated) {
        const { data } = await api.createChat({ title: 'New chat' })
        setConversations((prev) => [data.conversation, ...prev.filter((c) => c.id !== data.conversation.id)])
        setActiveId(data.conversation.id)
      } else {
        const conversation = guestChatStore.create('New chat')
        setConversations(guestChatStore.list())
        setActiveId(conversation.id)
      }
      setMessages([welcomeBubble()])
      setDrawerOpen(false)
      inputRef.current?.focus()
    } catch (err) {
      setError(err.message || 'Could not create chat.')
    }
  }

  async function ensureConversation() {
    if (activeId) return activeId
    if (authenticated) {
      const { data } = await api.createChat({ title: 'New chat' })
      setConversations((prev) => [data.conversation, ...prev])
      setActiveId(data.conversation.id)
      return data.conversation.id
    }
    const conversation = guestChatStore.create('New chat')
    setConversations(guestChatStore.list())
    setActiveId(conversation.id)
    return conversation.id
  }

  async function persistMessages(conversationId, batch) {
    if (authenticated) {
      const { data } = await api.appendChatMessages(conversationId, batch)
      setConversations((prev) => {
        const next = prev.map((c) => (c.id === data.conversation.id ? data.conversation : c))
        if (!next.some((c) => c.id === data.conversation.id)) next.unshift(data.conversation)
        return next
      })
      return data.messages
    }
    const result = guestChatStore.append(conversationId, batch)
    setConversations(guestChatStore.list())
    return result?.messages || []
  }

  async function send(text) {
    const content = (text ?? input).trim()
    if (!content || typing) return

    setInput('')
    setTyping(true)
    setError('')

    const userMsg = { id: crypto.randomUUID(), role: 'user', content }
    setMessages((prev) => {
      const base = prev.length === 1 && prev[0].role === 'assistant' && prev[0].content === ASSISTANT_WELCOME
        ? []
        : prev
      return [...base, userMsg]
    })

    try {
      const conversationId = await ensureConversation()
      const { data } = await api.askAssistant(content)
      const reply = data.reply || localReply(content)
      const assistantMsg = { id: crypto.randomUUID(), role: 'assistant', content: reply }

      timerRef.current = setTimeout(async () => {
        setMessages((prev) => [...prev, assistantMsg])
        setTyping(false)
        try {
          const saved = await persistMessages(conversationId, [
            { role: 'user', content },
            { role: 'assistant', content: reply },
          ])
          if (saved?.length) {
            setMessages((prev) => {
              const withoutTemp = prev.filter((m) => m.id !== userMsg.id && m.id !== assistantMsg.id)
              return [
                ...withoutTemp,
                ...saved.map((m) => ({ id: m.id, role: m.role, content: m.content })),
              ]
            })
          }
        } catch (err) {
          setError(err.message || 'Could not save messages.')
        }
        timerRef.current = null
      }, 650)
    } catch (err) {
      setTyping(false)
      setError(err.message || 'Could not send message.')
    }
  }

  async function togglePin(conversation) {
    setMenuId(null)
    try {
      if (authenticated) {
        const { data } = await api.updateChat(conversation.id, { pinned: !conversation.pinned })
        setConversations((prev) => prev.map((c) => (c.id === data.conversation.id ? data.conversation : c)))
      } else {
        guestChatStore.update(conversation.id, { pinned: !conversation.pinned })
        setConversations(guestChatStore.list())
      }
    } catch (err) {
      setError(err.message || 'Could not update pin.')
    }
  }

  async function submitRename() {
    if (!renameTarget) return
    const title = renameValue.trim()
    if (!title) return
    try {
      if (authenticated) {
        const { data } = await api.updateChat(renameTarget.id, { title })
        setConversations((prev) => prev.map((c) => (c.id === data.conversation.id ? data.conversation : c)))
      } else {
        guestChatStore.update(renameTarget.id, { title })
        setConversations(guestChatStore.list())
      }
      setRenameTarget(null)
    } catch (err) {
      setError(err.message || 'Could not rename chat.')
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      if (authenticated) {
        await api.deleteChat(deleteTarget.id)
      } else {
        guestChatStore.remove(deleteTarget.id)
      }
      setConversations((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      if (activeId === deleteTarget.id) {
        setActiveId(null)
        setMessages([welcomeBubble()])
      }
      setDeleteTarget(null)
    } catch (err) {
      setError(err.message || 'Could not delete chat.')
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  const showHero = messages.length <= 1 && messages[0]?.role === 'assistant' && !typing
  const shellClass = [
    'ai-assistant',
    collapsed ? 'ai-assistant--collapsed' : '',
    drawerOpen ? 'ai-assistant--drawer-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  function renderChatRow(conversation) {
    return (
      <div
        key={conversation.id}
        className={`ai-chat-item ${activeId === conversation.id ? 'is-active' : ''} ${
          menuId === conversation.id ? 'is-menu-open' : ''
        }`}
      >
        <button
          type="button"
          className="ai-chat-item__main"
          onClick={() => openConversation(conversation.id)}
        >
          <span className="ai-chat-item__title">{conversation.title}</span>
          {conversation.pinned ? <Pin size={13} className="ai-chat-item__pin" /> : null}
        </button>
        <button
          type="button"
          className="ai-icon-btn ai-chat-item__more"
          aria-label="Conversation options"
          onClick={(event) => {
            event.stopPropagation()
            setMenuId((id) => (id === conversation.id ? null : conversation.id))
          }}
        >
          <MoreHorizontal size={16} />
        </button>
        {menuId === conversation.id ? (
          <div className="ai-menu" role="menu" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              onClick={() => {
                setRenameTarget(conversation)
                setRenameValue(conversation.title)
                setMenuId(null)
              }}
            >
              <Pencil size={14} /> Rename
            </button>
            <button type="button" onClick={() => togglePin(conversation)}>
              {conversation.pinned ? <PinOff size={14} /> : <Pin size={14} />}
              {conversation.pinned ? 'Unpin' : 'Pin'}
            </button>
            <button
              type="button"
              className="is-danger"
              onClick={() => {
                setDeleteTarget(conversation)
                setMenuId(null)
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div className={shellClass} data-testid="assistant-page">
      <div className="ai-assistant__shell">
        <button
          type="button"
          className="ai-assistant__backdrop"
          aria-label="Close chat history"
          onClick={() => setDrawerOpen(false)}
        />

        <aside className="ai-sidebar" aria-label="Chat history">
          <div className="ai-sidebar__top">
            <h2>Chat History</h2>
            <button
              type="button"
              className="ai-icon-btn"
              aria-label="Collapse sidebar"
              onClick={() => {
                persistSidebar(true)
                setDrawerOpen(false)
              }}
            >
              <PanelLeft size={16} />
            </button>
          </div>

          <button type="button" className="ai-sidebar__new" onClick={createNewChat}>
            <Plus size={16} /> New Chat
          </button>

          <div className="ai-sidebar__scroll">
            {loadingList ? <p className="ai-sidebar__loading">Loading conversations…</p> : null}

            {!loadingList && !authenticated ? (
              <p className="ai-sidebar__auth">
                Guest chats stay on this device.{' '}
                <Link to="/login">Sign in</Link> to sync history across sessions.
              </p>
            ) : null}

            {!loadingList && !conversations.length ? (
              <p className="ai-sidebar__empty">No conversations yet. Start a new chat.</p>
            ) : null}

            {pinned.length ? (
              <>
                <p className="ai-sidebar__label">Pinned</p>
                {pinned.map(renderChatRow)}
              </>
            ) : null}

            {recent.length ? (
              <>
                <p className="ai-sidebar__label">Recent</p>
                {recent.map(renderChatRow)}
              </>
            ) : null}
          </div>
        </aside>

        <section className="ai-workspace" aria-label="VOLTENIQ AI chat">
          <header className="ai-workspace__header">
            <div className="ai-workspace__brand">
              <button
                type="button"
                className="ai-icon-btn"
                aria-label="Open chat history"
                onClick={() => {
                  if (window.matchMedia('(max-width: 900px)').matches) {
                    setDrawerOpen(true)
                    persistSidebar(false)
                  } else {
                    persistSidebar(!collapsed)
                  }
                }}
              >
                <PanelLeft size={17} />
              </button>
              <h1>VOLTENIQ AI</h1>
            </div>
            <Sparkles className="ai-workspace__spark" size={20} aria-hidden="true" />
          </header>

          <div className="ai-thread" role="log" aria-live="polite">
            {loadingChat ? <p className="ai-sidebar__loading">Loading messages…</p> : null}

            {showHero && !loadingChat ? (
              <div className="ai-empty">
                <h2>How can I help you choose?</h2>
                <p>
                  Ask about products, compare options, or gift ideas — then open the{' '}
                  <Link to="/catalog">catalog</Link>.
                </p>
              </div>
            ) : null}

            {!loadingChat
              ? messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`ai-msg ${msg.role === 'user' ? 'ai-msg--user' : 'ai-msg--assistant'}`}
                  >
                    <div className="ai-msg__bubble">{msg.content || msg.text}</div>
                  </div>
                ))
              : null}

            {typing ? (
              <div className="ai-msg ai-msg--assistant" aria-label="Assistant is thinking">
                <div className="ai-typing">
                  <div className="ai-typing__dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  Thinking…
                </div>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="ai-composer">
            <div className="ai-suggestions" role="group" aria-label="Suggested prompts">
              {ASSISTANT_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={typing}
                  onClick={() => send(suggestion)}
                >
                  {suggestion}
                </button>
              ))}
            </div>

            <form
              id={formId}
              className="ai-input-bar"
              onSubmit={(event) => {
                event.preventDefault()
                send()
              }}
            >
              <label className="sr-only" htmlFor={`${formId}-input`}>
                Message VOLTENIQ AI
              </label>
              <textarea
                id={`${formId}-input`}
                ref={inputRef}
                value={input}
                rows={1}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask anything..."
                disabled={typing}
              />
              <button
                type="submit"
                className="ai-send"
                aria-label="Send message"
                disabled={typing || !input.trim()}
              >
                <ArrowUp size={18} />
              </button>
            </form>
            <p className="ai-composer__note">
              Demo responses · {authenticated ? 'Synced to your account' : 'Local guest history'} ·{' '}
              <Link to="/catalog">Catalog</Link>
            </p>
          </div>
        </section>
      </div>

      {error ? (
        <div className="ai-toast" role="alert">
          {error}
        </div>
      ) : null}

      {renameTarget ? (
        <div className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="rename-title">
          <div className="ai-modal__card">
            <h3 id="rename-title">Rename chat</h3>
            <p>Choose a short title for this conversation.</p>
            <input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={80}
              autoFocus
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitRename()
              }}
            />
            <div className="ai-modal__actions">
              <button type="button" onClick={() => setRenameTarget(null)}>
                Cancel
              </button>
              <button type="button" className="is-primary" onClick={submitRename}>
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="ai-modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
          <div className="ai-modal__card">
            <h3 id="delete-title">Delete conversation?</h3>
            <p>
              “{deleteTarget.title}” will be removed permanently. This cannot be undone.
            </p>
            <div className="ai-modal__actions">
              <button type="button" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="is-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
