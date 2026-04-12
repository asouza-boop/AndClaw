import React, { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface SkillMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SkillForgeProps {
  chatMessages: SkillMessage[];
  chatInput: string;
  chatLoading: boolean;
  preview: string;
  saving: boolean;
  suggestionChips: string[];
  setChatInput: (v: string) => void;
  setPreview: (v: string) => void;
  onSend: (msg?: string) => void;
  onReset: () => void;
  onSave: () => void;
}

export const SkillForge: React.FC<SkillForgeProps> = ({
  chatMessages,
  chatInput,
  chatLoading,
  preview,
  saving,
  suggestionChips,
  setChatInput,
  setPreview,
  onSend,
  onReset,
  onSave
}) => {
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, chatLoading]);

  return (
    <div className="flex gap-6 h-[72vh] animate-in slide-in-from-right-4 duration-500">
      {/* Architect Panel */}
      <div className="flex-[6] flex flex-col glass-card bg-gradient-to-br from-white/5 to-transparent overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 glass-glow-accent shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Skill Architect</span>
          </div>
          <button onClick={onReset} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 scrollbar-hide">
          {chatMessages.map((m, i) => (
            <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white/30">SA</div>
              )}
              <div className={`max-w-[85%] text-xs leading-relaxed ${m.role === 'user' ? 'bg-primary p-4 rounded-3xl rounded-tr-sm text-white font-medium shadow-xl' : 'text-white/80 p-1'}`}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:text-white [&_strong]:font-black [&_ul]:border-l [&_ul]:border-white/10 [&_ul]:pl-4">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : m.content}
              </div>
            </div>
          ))}

          {chatMessages.length === 1 && (
            <div className="flex flex-wrap gap-2 pl-14">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onSend(chip)}
                  className="text-[10px] uppercase font-black tracking-tight px-4 py-2 rounded-full border border-white/10 text-white/40 bg-white/5 hover:bg-white/10 hover:text-white transition-all"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {chatLoading && (
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white/30 animate-pulse">SA</div>
              <div className="flex items-center gap-2 group">
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/20 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-6 bg-black/40 border-t border-white/5">
          <div className="flex gap-4 p-2 bg-white/5 rounded-3xl border border-white/5 focus-within:border-primary/40 transition-all">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="Instrua o Architect para forjar uma nova skill autônoma..."
              rows={2}
              className="flex-1 px-4 py-2 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none resize-none"
            />
            <button
              onClick={() => onSend()}
              disabled={chatLoading || !chatInput.trim()}
              className="self-end p-4 rounded-2xl bg-white text-black hover:bg-white/90 disabled:opacity-20 transition-all shadow-lg"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manifest Panel */}
      <div className="flex-[4] glass-card p-8 bg-black/60 overflow-y-auto scrollbar-hide">
        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6">Forge Manifest</h3>
        {preview ? (
          <>
             <textarea
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                className="flex-1 w-full h-[400px] p-4 rounded-xl bg-black/40 border border-white/5 text-[10px] font-mono text-white/80 focus:outline-none focus:border-primary/40 scrollbar-hide resize-none leading-relaxed"
              />
              <button
                onClick={onSave}
                disabled={saving}
                className="mt-6 w-full py-4 rounded-xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-white/90 disabled:opacity-30 transition-all shadow-[0_0_30px_-5px_hsla(0,0%,100%,0.2)]"
              >
                {saving ? 'Transmuting...' : 'Seal Skill Forge'}
              </button>
          </>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-20 px-8">
             <Zap className="w-12 h-12 mb-4" />
             <p className="text-xs font-medium italic">O blueprint estruturado será forjado aqui após o refinamento...</p>
          </div>
        )}
      </div>
    </div>
  );
};
