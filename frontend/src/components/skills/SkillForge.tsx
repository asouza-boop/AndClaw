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
    <div className="flex flex-col lg:flex-row gap-8 h-[75vh] animate-in slide-in-from-right-8 duration-700">
      {/* Architect Panel */}
      <div className="flex-[6] flex flex-col glass-panel overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-black/20">
          <div className="flex items-center gap-4">
            <div className="w-3 h-3 rounded-full bg-primary shadow-[0_0_12px_rgba(168,85,247,0.6)] animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-[0.3em] text-white/50 font-mono">Cognitive Architect</span>
          </div>
          <button onClick={onReset} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-premium interactive-scale">
            <RotateCcw className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-10 space-y-8 scrollbar-hide bg-gradient-to-b from-primary/[0.02] to-transparent">
          {chatMessages.map((m, i) => (
            <div key={i} className={`flex gap-5 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && (
                <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white/20 font-mono shadow-lg">ARCH</div>
              )}
              <div className={`max-w-[85%] text-[14px] leading-relaxed transition-premium ${m.role === 'user' ? 'bg-primary px-6 py-4 rounded-3xl rounded-tr-sm text-white font-bold shadow-2xl shadow-primary/20' : 'text-white/80 p-1'}`}>
                {m.role === 'assistant' ? (
                  <div className="prose prose-sm prose-invert max-w-none [&_p]:mb-4 [&_p:last-child]:mb-0 [&_strong]:text-primary [&_strong]:font-black [&_ul]:border-l-2 [&_ul]:border-primary/20 [&_ul]:pl-6 [&_ul]:space-y-2 [&_li]:text-white/70">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : m.content}
              </div>
            </div>
          ))}

          {chatMessages.length === 1 && (
            <div className="flex flex-wrap gap-3 pl-16">
              {suggestionChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => onSend(chip)}
                  className="text-[10px] uppercase font-black tracking-widest px-6 py-3 rounded-full border border-white/10 text-white/30 bg-white/5 hover:bg-primary/20 hover:text-white hover:border-primary/40 transition-premium interactive-scale"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {chatLoading && (
            <div className="flex gap-5">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white/20 font-mono animate-pulse">ARCH</div>
              <div className="flex items-center gap-3 px-4">
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-2 h-2 rounded-full bg-primary/40 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div className="p-8 bg-black/40 border-t border-white/5">
          <div className="flex gap-4 p-3 bg-white/[0.03] rounded-3xl border border-white/10 focus-within:border-primary/40 focus-within:bg-white/[0.05] transition-premium shadow-inner">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSend(); } }}
              placeholder="Inject capability requirements into the Architect node..."
              rows={2}
              className="flex-1 px-5 py-3 bg-transparent text-[14px] text-white placeholder:text-white/10 focus:outline-none resize-none scrollbar-hide font-medium"
            />
            <button
              onClick={() => onSend()}
              disabled={chatLoading || !chatInput.trim()}
              className="self-end w-14 h-14 flex items-center justify-center rounded-2xl bg-white text-black hover:bg-primary hover:text-white disabled:opacity-20 transition-premium shadow-2xl interactive-scale"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Manifest Panel */}
      <div className="flex-[4] glass-card p-10 bg-black/80 flex flex-col shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white/30 font-mono">Blueprint Output</h3>
        </div>
        
        {preview ? (
          <div className="flex-1 flex flex-col space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <textarea
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                className="flex-1 w-full p-6 rounded-2xl bg-black/40 border border-white/10 text-[12px] font-mono text-white/60 focus:outline-none focus:border-primary/40 focus:text-white/90 transition-premium scrollbar-hide resize-none leading-relaxed shadow-inner"
              />
              <button
                onClick={onSave}
                disabled={saving}
                className="w-full py-5 rounded-2xl bg-white text-black text-[12px] font-black uppercase tracking-[0.2em] hover:bg-primary hover:text-white disabled:opacity-30 transition-premium shadow-2xl interactive-scale"
              >
                {saving ? 'Transmuting Capability...' : 'Seal Skill Blueprint'}
              </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-10 px-10 border border-dashed border-white/10 rounded-3xl">
             <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mb-8 animate-pulse">
               <Zap className="w-10 h-10" />
             </div>
             <p className="text-[11px] font-black uppercase tracking-[0.3em]">Manifest Pending Architect Validation</p>
          </div>
        )}
      </div>
    </div>
  );
};
