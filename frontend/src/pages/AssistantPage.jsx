import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, Send, Sparkles, User } from 'lucide-react'
import Button from '../components/ui/Button'

const SUGGESTIONS = [
  'Best iPhone under $900?',
  'Compare MacBook Air and Pro',
  'What AirPods should I get?',
  'Gift ideas for a student',
]

function localReply(input) {
  const q = input.toLowerCase()
  if (q.includes('iphone')) {
    return 'For most people, the demo iPhone 16 is the sweet spot. If you want pro cameras and titanium, look at iPhone 16 Pro. All prices shown are demo prices.'
  }
  if (q.includes('macbook')) {
    return 'MacBook Air 13" is great for everyday work and travel. Choose MacBook Pro if you edit video or need sustained performance. Browse the MacBook category to compare.'
  }
  if (q.includes('airpods') || q.includes('headphone')) {
    return 'AirPods Pro 2 are ideal if you want ANC. AirPods 4 are lighter for casual listening. AirPods Max deliver over-ear immersion.'
  }
  if (q.includes('compare')) {
    return 'Open the Compare page and add up to 4 products from catalog cards. I can help you decide which specs matter most.'
  }
  if (q.includes('gift') || q.includes('student')) {
    return 'Popular demo gift picks: AirPods 4, Apple Watch SE, or iPad 10.9". Filter the catalog by category to explore.'
  }
  return 'I am the VOLTENIQ shopping assistant UI — currently running a local demo brain. Ask about iPhone, MacBook, iPad, Watch, AirPods, or gifts. A real AI backend can be plugged in later.'
}

export default function AssistantPage() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      text: 'Hi — I am the VOLTENIQ AI shopping assistant. This UI is ready for a future backend. For now I answer with a lightweight demo helper. What are you looking for?',
    },
  ])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typing])

  const send = (text) => {
    const content = (text ?? input).trim()
    if (!content || typing) return
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: content }])
    setTyping(true)
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'assistant', text: localReply(content) }])
      setTyping(false)
    }, 700)
  }

  return (
    <div className="container-shell--chat page-section">
      <div className="mb-5 sm:mb-6">
        <p className="text-volt text-xs font-semibold uppercase tracking-[0.2em] mb-2">
          Prepared for future AI integration
        </p>
        <h1 className="page-title mb-2">AI Shopping Assistant</h1>
        <p className="text-muted">
          Ask product questions, get demo recommendations, then jump into the{' '}
          <Link to="/catalog" className="text-volt font-semibold">
            catalog
          </Link>
          .
        </p>
      </div>

      <div className="glass rounded-[20px] overflow-hidden flex flex-col min-h-[60vh]">
        <div className="px-5 py-4 border-b border-silver/20 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-volt/20 text-volt">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <p className="font-semibold text-sm">VOLTENIQ AI</p>
            <p className="text-xs text-muted">Local demo responses · backend-ready UI</p>
          </div>
        </div>

        <div className="flex-1 p-5 space-y-4 overflow-y-auto scrollbar-thin">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-graphite text-volt">
                  <Bot className="w-4 h-4" />
                </span>
              )}
              <div
                className={`max-w-[80%] rounded-[16px] px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-volt text-ink'
                    : 'bg-white/70 dark:bg-ink/50 border border-silver/20'
                }`}
              >
                {msg.text}
              </div>
              {msg.role === 'user' && (
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-silver/30">
                  <User className="w-4 h-4" />
                </span>
              )}
            </div>
          ))}
          {typing && (
            <div className="text-sm text-muted pl-11">Assistant is thinking…</div>
          )}
          <div ref={endRef} />
        </div>

        <div className="p-4 border-t border-silver/20 space-y-3">
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-silver/30 px-3 py-1.5 text-xs hover:border-volt"
              >
                {s}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products..."
              className="flex-1 rounded-[14px] border border-silver/30 bg-white/50 dark:bg-graphite/50 px-4 py-3 outline-none focus:border-volt"
            />
            <Button type="submit" aria-label="Send">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
