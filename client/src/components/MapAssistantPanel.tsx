/**
 * Map Assistant chat panel (drawer from the right).
 * Message list, user input, send button, loading state.
 */

import { useState, useRef, useEffect } from 'react'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { X, Send, Loader2 } from 'lucide-react'
import { cn } from '../lib/utils'

export interface AssistantMessage {
  role: 'user' | 'assistant'
  /** User message text */
  userText?: string
  /** Assistant structured response */
  summary?: string
  issues?: string[]
  suggestions?: string[]
  ask_vehicle?: string | null
}

/** Minimal map info for showing "maps in context" cards in chat */
export interface MapCardItem {
  map_id: string
  type: string
  dimensions: Record<string, number>
  offset_hex: string
  confidence: number
  name?: string | null
}

export interface MapAssistantPanelProps {
  open: boolean
  onClose: () => void
  onSendMessage: (message: string) => Promise<{
    summary: string
    issues: string[]
    suggestions: string[]
    ask_vehicle?: string | null
  }>
  /** Optional: when ask_vehicle is set, call this when user clicks "Set vehicle model" (e.g. open project settings) */
  onAskVehicle?: () => void
  /** Maps currently in context (shown as cards so user sees what the AI sees) */
  mapsInContext?: MapCardItem[]
  /** When user clicks "Open in viewer" on a map card */
  onOpenMap?: (mapId: string) => void
}

export function MapAssistantPanel({
  open,
  onClose,
  onSendMessage,
  onAskVehicle,
  mapsInContext = [],
  onOpenMap,
}: MapAssistantPanelProps) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [open, messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', userText: text }])
    setLoading(true)
    try {
      const res = await onSendMessage(text)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          summary: res.summary,
          issues: res.issues,
          suggestions: res.suggestions,
          ask_vehicle: res.ask_vehicle,
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          summary: 'Failed to get a response. Please check your connection and try again.',
          issues: [],
          suggestions: [],
          ask_vehicle: null,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop when open (optional, for mobile) */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 md:bg-transparent"
          aria-hidden
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed top-0 right-0 z-50 h-full w-full max-w-md border-l border-border bg-card shadow-lg transition-transform duration-200 ease-out md:max-w-lg',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-lg font-semibold">Map Assistant</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Maps in context (so user sees maps correctly) */}
          {mapsInContext.length > 0 && (
            <div className="shrink-0 border-b border-border px-4 py-2">
              <p className="text-xs font-medium text-muted-foreground mb-2">Maps in context</p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {mapsInContext.slice(0, 10).map((m) => (
                  <div
                    key={m.map_id}
                    className="shrink-0 rounded border border-border bg-muted/50 px-3 py-2 text-xs"
                  >
                    <div className="font-medium">{m.name || m.map_id.slice(0, 8)}</div>
                    <div className="text-muted-foreground">
                      {m.type} · {m.offset_hex} · {Object.values(m.dimensions).join('×')} · {(m.confidence * 100).toFixed(0)}%
                    </div>
                    {onOpenMap && (
                      <button
                        type="button"
                        className="mt-1 text-primary hover:underline text-xs"
                        onClick={() => onOpenMap(m.map_id)}
                      >
                        Open in viewer
                      </button>
                    )}
                  </div>
                ))}
                {mapsInContext.length > 10 && (
                  <span className="shrink-0 self-center text-xs text-muted-foreground">
                    +{mapsInContext.length - 10} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4"
          >
            {messages.length === 0 && (
              <p className="text-muted-foreground text-sm">
                Ask about your calibration maps, get improvement suggestions, or request tuning help. Set the vehicle model in project settings before asking for tune advice.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg p-3 text-sm',
                  msg.role === 'user'
                    ? 'ml-8 bg-primary text-primary-foreground'
                    : 'mr-8 bg-muted'
                )}
              >
                {msg.role === 'user' && msg.userText && <p className="whitespace-pre-wrap">{msg.userText}</p>}
                {msg.role === 'assistant' && (
                  <div className="space-y-2">
                    {msg.summary && <p className="whitespace-pre-wrap">{msg.summary}</p>}
                    {msg.issues && msg.issues.length > 0 && (
                      <ul className="list-disc pl-4 space-y-1">
                        {msg.issues.map((issue, j) => (
                          <li key={j}>{issue}</li>
                        ))}
                      </ul>
                    )}
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <ul className="list-disc pl-4 space-y-1">
                        {msg.suggestions.map((s, j) => (
                          <li key={j}>{s}</li>
                        ))}
                      </ul>
                    )}
                    {msg.ask_vehicle && (
                      <div className="rounded border border-amber-500/50 bg-amber-500/10 p-2">
                        <p className="mb-2 text-amber-700 dark:text-amber-400">{msg.ask_vehicle}</p>
                        {onAskVehicle && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={onAskVehicle}
                          >
                            Set vehicle model
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="mr-8 flex items-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Thinking…</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Ask about maps or request tuning help…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                rows={2}
                className="min-h-0 resize-none"
                disabled={loading}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="shrink-0"
                aria-label="Send"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
