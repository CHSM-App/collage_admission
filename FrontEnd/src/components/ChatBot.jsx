import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IoChatbubbleEllipsesOutline, IoClose, IoSend } from 'react-icons/io5'
import { useAuthContext } from '../context/AuthContext.jsx'
import { sendChatMessage, getChatSuggestions } from '../services/chatService.js'

const BOT_NAME = 'Admission Assistant'

const WELCOME = {
  student: "Hi! I'm your Admission Assistant. Ask me anything about applying to college, documents, fees, or your application status.",
  college: "Hi! I'm your Admission Assistant. Ask me about reviewing applications, managing admission periods, fees, or roll numbers.",
  admin:   "Hi! I'm your Admission Assistant. Ask me about managing colleges or admission operations.",
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
        <IoChatbubbleEllipsesOutline className="w-4 h-4 text-emerald-600" />
      </div>
      <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}

function Message({ msg }) {
  const isBot = msg.role === 'bot'
  return (
    <div className={`flex items-end gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      {isBot && (
        <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <IoChatbubbleEllipsesOutline className="w-4 h-4 text-emerald-600" />
        </div>
      )}
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words
          ${isBot
            ? 'bg-slate-100 text-slate-800 rounded-bl-sm'
            : 'bg-emerald-600 text-white rounded-br-sm'
          }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

export default function ChatBot() {
  const { role } = useAuthContext()
  const effectiveRole = role || 'student'

  const [open, setOpen]           = useState(false)
  const [messages, setMessages]   = useState([])
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [suggestions, setSuggestions] = useState([])
  const [error, setError]         = useState('')
  const bottomRef  = useRef(null)
  const inputRef   = useRef(null)
  const initialised = useRef(false)

  // Load suggestions + show welcome message on first open
  useEffect(() => {
    if (!open || initialised.current) return
    initialised.current = true

    setMessages([{ role: 'bot', content: WELCOME[effectiveRole] || WELCOME.student }])

    getChatSuggestions(effectiveRole)
      .then(r => setSuggestions(r.data.data || []))
      .catch(() => {})
  }, [open, effectiveRole])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  async function send(text) {
    const message = (text || input).trim()
    if (!message || loading) return

    setInput('')
    setError('')
    setSuggestions([])
    setMessages(prev => [...prev, { role: 'user', content: message }])
    setLoading(true)

    try {
      const res = await sendChatMessage(message, effectiveRole)
      const { answer, suggested } = res.data
      setMessages(prev => [...prev, { role: 'bot', content: answer }])
      if (suggested?.length) setSuggestions(suggested)
    } catch (err) {
      const msg = err.isNetworkError
        ? 'No internet connection. Please check your network.'
        : (err.response?.data?.message || 'Something went wrong. Please try again.')
      setError(msg)
      setMessages(prev => [...prev, { role: 'bot', content: msg }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  function handleReset() {
    initialised.current = false
    setMessages([])
    setSuggestions([])
    setInput('')
    setError('')
  }

  const chatWidget = (
    <>
      {/* ── Floating button ── */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-[1000] flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all duration-200 hover:scale-105"
        aria-label="Open admission assistant"
      >
        {open
          ? <IoClose className="w-6 h-6" />
          : <IoChatbubbleEllipsesOutline className="w-6 h-6" />
        }
        {!open && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-slate-900">
            AI
          </span>
        )}
      </button>

      {/* ── Chat window ── */}
      {open && (
        <div className="fixed bottom-24 right-6 z-[1000] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 bg-emerald-600 px-4 py-3 shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <IoChatbubbleEllipsesOutline className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white">{BOT_NAME}</p>
              <p className="text-xs text-emerald-100">Admission help · Powered by AI</p>
            </div>
            <button
              onClick={handleReset}
              title="Clear chat"
              className="text-white/60 hover:text-white text-xs font-semibold px-2 py-1 rounded hover:bg-white/10 transition"
            >
              Clear
            </button>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white transition"
              aria-label="Close"
            >
              <IoClose className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scroll-smooth">
            {messages.map((msg, i) => (
              <Message key={i} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {/* Suggested questions */}
          {suggestions.length > 0 && !loading && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5 shrink-0">
              {suggestions.slice(0, 4).map((s, i) => (
                <button
                  key={i}
                  onClick={() => send(s)}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700 hover:bg-emerald-100 transition truncate max-w-full"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 border-t border-slate-100 px-3 py-3 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask a question…"
              maxLength={500}
              disabled={loading}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 transition"
              aria-label="Send"
            >
              <IoSend className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )

  return createPortal(chatWidget, document.body)
}
