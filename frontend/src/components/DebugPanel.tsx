import React, { useEffect, useState } from 'react';
import { useAgentStore } from '@/stores/agentStore';
import { Settings2, X, Activity, HardDrive, BrainCircuit } from 'lucide-react';

export function DebugPanel() {
    const [open, setOpen] = useState(false);
    const { featureFlags, toggleFeatureFlag } = useAgentStore();

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'd' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape' && open) setOpen(false);
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, [open]);

    if (!open) return null;

    return (
        <div className="fixed bottom-6 left-6 z-[100] w-80 glass-card p-5 border border-primary/30 shadow-[0_20px_50px_-20px_rgba(168,85,247,0.4)] animate-in slide-in-from-bottom-5 font-outfit backdrop-blur-xl bg-[#09090b]/90">
            <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 text-primary">
                    <Settings2 className="w-4 h-4" />
                    <span className="text-[11px] font-black uppercase tracking-widest">Debug Flags</span>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="space-y-4">
                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                        <span className="text-[11px] font-semibold text-white/80">UI_TRACE_ENHANCED</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={featureFlags.UI_TRACE_ENHANCED} onChange={() => toggleFeatureFlag('UI_TRACE_ENHANCED')} className="sr-only peer" />
                        <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-transparent after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary shadow-inner shadow-black/50"></div>
                    </label>
                </div>
                
                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                        <HardDrive className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                        <span className="text-[11px] font-semibold text-white/80">UI_MEMORY_INSPECTOR_V2</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={featureFlags.UI_MEMORY_INSPECTOR_V2} onChange={() => toggleFeatureFlag('UI_MEMORY_INSPECTOR_V2')} className="sr-only peer" />
                        <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-transparent after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary shadow-inner shadow-black/50"></div>
                    </label>
                </div>

                <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-2">
                        <BrainCircuit className="w-3.5 h-3.5 text-white/40 group-hover:text-white transition-colors" />
                        <span className="text-[11px] font-semibold text-white/80">UI_LEARNING_INSIGHTS</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" checked={featureFlags.UI_LEARNING_INSIGHTS} onChange={() => toggleFeatureFlag('UI_LEARNING_INSIGHTS')} className="sr-only peer" />
                        <div className="w-8 h-4 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-transparent after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary shadow-inner shadow-black/50"></div>
                    </label>
                </div>
            </div>
        </div>
    );
}
