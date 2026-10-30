"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Bot, X, Send, Loader2, Minimize2, Maximize2,
  Sparkles, RefreshCw, TrendingUp, AlertTriangle,
  ShoppingCart, BarChart3, ChevronRight, ThumbsUp, ThumbsDown
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { canUseLocalFallback, getLocalDashboardSnapshot } from '@/lib/kiosk-local-store';
import { plantLabel } from '@/lib/plants';
import { usePlantStore } from '@/store/usePlantStore';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  queryId?: string;
  feedback?: 'up' | 'down';
}

function buildRequestHistory(messages: Message[]) {
  const selected: Array<{ role: Message['role']; content: string }> = [];
  let totalLength = 0;

  for (const message of [...messages].reverse()) {
    if (message.id === '0' || selected.length >= 8) continue;
    const content = message.content.slice(0, 1000);
    if (totalLength + content.length > 5000) continue;
    selected.push({ role: message.role, content });
    totalLength += content.length;
  }

  return selected.reverse();
}

const QUICK_PROMPTS = [
  { icon: <AlertTriangle className="h-3.5 w-3.5" />, text: '¿Qué EPP tiene menor cobertura y por qué?' },
  { icon: <TrendingUp className="h-3.5 w-3.5" />, text: '¿Qué áreas presentan consumo inusual en los últimos 30 días?' },
  { icon: <ShoppingCart className="h-3.5 w-3.5" />, text: 'Sugiere una compra para cubrir los próximos 60 días' },
  { icon: <BarChart3 className="h-3.5 w-3.5" />, text: 'Dame un resumen ejecutivo de inventario y presupuesto' },
];

function buildOfflineReply() {
  const snapshot = getLocalDashboardSnapshot();
  const lowStock = snapshot.insights.lowStockItem
    ? `${snapshot.insights.lowStockItem.name} (${snapshot.insights.lowStockItem.stock} unidades)`
    : 'sin artículos críticos registrados';
  const topArea = snapshot.insights.topArea
    ? `${snapshot.insights.topArea.area} (${snapshot.insights.topArea.count} dotaciones)`
    : 'sin datos suficientes';

  return [
    '**Modo offline local**',
    '',
    `Inventario: **${snapshot.stats.totalInventoryItems}** artículos, **${snapshot.stats.totalStock}** unidades totales.`,
    `Stock bajo: **${snapshot.stats.lowStockItems}** artículo(s). Punto más crítico: **${lowStock}**.`,
    `Plantilla activa local: **${snapshot.stats.activeEmployees}** colaborador(es).`,
    `Área con más consumo registrado: **${topArea}**.`,
    `Cumplimiento EPP local: **${snapshot.insights.complianceRate}%**.`,
  ].join('\n');
}

export function AiChatPanel() {
  const activePlantId = usePlantStore((state) => state.activePlantId);
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // La barra superior abre el asistente; ya no hay boton flotante que tape contenido.
  useEffect(() => {
    const openAria = () => {
      setOpen(true);
      setMinimized(false);
    };
    window.addEventListener('assetguard:open-aria', openAria);
    return () => window.removeEventListener('assetguard:open-aria', openAria);
  }, []);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hola. Soy **ARIA**, tu asistente de Seguridad Industrial.\n\nPuedo analizar inventario, detectar anomalías de consumo y preparar resúmenes ejecutivos del estado operativo.\n\n¿En qué puedo ayudarte hoy?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  useEffect(() => () => requestControllerRef.current?.abort(), []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const controller = new AbortController();
    requestControllerRef.current = controller;
    const requestTimeout = window.setTimeout(() => controller.abort(), 45_000);

    try {
      const offlineMode =
        typeof navigator !== 'undefined' &&
        canUseLocalFallback() &&
        (navigator.onLine === false || window.localStorage.getItem('assetguard.offline.adminSession') === 'true');

      if (offlineMode) {
        const botMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: buildOfflineReply(),
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, botMsg]);
        return;
      }

      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('missing_auth');
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: text,
          plantaId: activePlantId,
          history: buildRequestHistory(messages),
        }),
      });
      const data = await res.json() as { text?: string; error?: string; meta?: { queryId?: string } };
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.ok
          ? data.text || 'ARIA no generó una respuesta útil.'
          : data.error || 'No se pudo procesar la consulta.',
        timestamp: new Date(),
        queryId: res.ok ? data.meta?.queryId : undefined,
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: error instanceof DOMException && error.name === 'AbortError'
          ? 'La consulta tardó demasiado. Intenta una pregunta más específica.'
          : error instanceof Error && error.message === 'missing_auth'
          ? 'Necesito una sesión administrativa online para responder.'
          : canUseLocalFallback()
            ? `No pude conectar con el servidor de IA. Te dejo el resumen local disponible:\n\n${buildOfflineReply()}`
            : 'No pude conectar con el servidor de IA. Intenta de nuevo en unos momentos.',
        timestamp: new Date(),
      }]);
    } finally {
      window.clearTimeout(requestTimeout);
      requestControllerRef.current = null;
      setLoading(false);
    }
  }, [activePlantId, loading, messages]);

  const sendFeedback = useCallback(async (messageId: string, queryId: string, accepted: boolean) => {
    setMessages(prev => prev.map(m => m.id === messageId ? { ...m, feedback: accepted ? 'up' : 'down' } : m));
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;
      await fetch('/api/chat/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ queryId, accepted }),
      });
    } catch {
      // El feedback es opcional; no interrumpe la conversacion.
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([{
      id: Date.now().toString(),
      role: 'assistant',
      content: 'Chat reiniciado. ¿En qué puedo ayudarte?',
      timestamp: new Date(),
    }]);
  };

  return (
    <>
      {/* Right-docked chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 48 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 48 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            className={`theme-keep fixed z-50 bg-[#f8fafc] border border-white/20 flex flex-col overflow-hidden ${
              minimized
                ? 'right-0 top-1/2 -translate-y-1/2 h-14 w-72 rounded-l-xl border-r-0'
                : 'inset-y-0 right-0 h-full w-full sm:w-[400px] sm:max-w-[min(400px,100vw)] rounded-none sm:rounded-l-xl sm:border-r-0'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 bg-[#0d1117] flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-9 w-9 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 bg-[#6FE3BE] rounded-full border-2 border-slate-950" />
                </div>
                <div>
                  <p className="font-black text-white text-sm leading-none tracking-tight">ARIA IA</p>
                  <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-0.5">
                    {plantLabel(activePlantId)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={clearChat}
                  disabled={loading}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                  title="Limpiar chat"
                  aria-label="Limpiar chat"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setMinimized(!minimized)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white"
                  aria-label={minimized ? 'Maximizar ARIA' : 'Minimizar ARIA'}
                >
                  {minimized ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-[#F3F5F7]/20 transition-colors text-slate-400 hover:text-red-400"
                  aria-label="Cerrar ARIA"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" aria-live="polite">
                  {messages.map(msg => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'assistant' && (
                        <div className="h-7 w-7 rounded-xl bg-[var(--primary)] flex items-center justify-center flex-shrink-0 mr-2 mt-0.5 shadow-sm">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      <div
                        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-[#0d1117] text-white rounded-tr-sm'
                            : 'bg-white border border-slate-200 text-gray-800 rounded-tl-sm shadow-sm'
                        }`}
                      >
                        {msg.role === 'assistant' ? (
                          <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-li:marker:text-red-500">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                            {msg.queryId && (
                              <div className="not-prose mt-2 flex items-center gap-1 text-[10px] text-slate-400">
                                <span className="mr-1">¿Te sirvió?</span>
                                <button
                                  type="button"
                                  aria-label="Respuesta útil"
                                  disabled={Boolean(msg.feedback)}
                                  onClick={() => sendFeedback(msg.id, msg.queryId!, true)}
                                  className={`rounded p-1 hover:bg-slate-100 ${msg.feedback === 'up' ? 'text-emerald-600' : ''}`}
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Respuesta no útil"
                                  disabled={Boolean(msg.feedback)}
                                  onClick={() => sendFeedback(msg.id, msg.queryId!, false)}
                                  className={`rounded p-1 hover:bg-slate-100 ${msg.feedback === 'down' ? 'text-red-600' : ''}`}
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <p>{msg.content}</p>
                        )}
                      </div>
                    </motion.div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="h-7 w-7 rounded-xl bg-[var(--primary)] flex items-center justify-center flex-shrink-0 mr-2 shadow-sm">
                        <Bot className="h-4 w-4 text-white" />
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                        <div className="flex items-center gap-1.5">
                          <div className="h-2 w-2 bg-[#6FE3BE] rounded-full  [animation-delay:0ms]" />
                          <div className="h-2 w-2 bg-[#6FE3BE] rounded-full  [animation-delay:150ms]" />
                          <div className="h-2 w-2 bg-[#6FE3BE] rounded-full  [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Quick Prompts */}
                {messages.length <= 1 && (
                  <div className="px-5 pb-3">
                    <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Consultas Rápidas</p>
                    <div className="space-y-1.5">
                      {QUICK_PROMPTS.map((p, i) => (
                        <button
                          key={i}
                          onClick={() => sendMessage(p.text)}
                          disabled={loading}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-white hover:bg-[#F3F5F7] text-left transition-all group border border-slate-200 hover:border-[#6FE3BE]"
                        >
                          <span className="text-[var(--primary)] flex-shrink-0">{p.icon}</span>
                          <span className="text-xs text-slate-700 font-bold flex-1">{p.text}</span>
                          <ChevronRight className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:text-red-400 transition-all" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="p-4 border-t border-slate-200 flex gap-2 flex-shrink-0 bg-slate-50/80">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Pregunta sobre inventario o EPP..."
                    disabled={loading}
                    maxLength={2000}
                    className="flex-1 text-sm h-11 rounded-lg border-slate-200 bg-white focus:border-red-300 focus:ring-red-100 font-medium"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={loading || !input.trim()}
                    className="h-11 w-11 p-0 rounded-lg bg-[#0d1117] hover:bg-[var(--primary)] transition-all duration-300"
                    aria-label="Enviar mensaje a ARIA"
                  >
                    {loading
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Send className="h-4 w-4" />
                    }
                  </Button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
