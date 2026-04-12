import React from 'react';

interface Props {
    insights: string[];
}

export const IntelligenceInsights: React.FC<Props> = ({ insights }) => {
    return (
        <div className="glass-card p-8 bg-gradient-to-br from-primary/5 to-transparent">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Intelligence Insights
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, b) => (
                    <div key={b} className="flex gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/5 items-start hover:bg-white/5 transition-all group">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0 glass-glow-accent shadow-[0_0_8px_rgba(52,211,153,0.5)] opacity-40 group-hover:opacity-100 transition-opacity"></div>
                        <p className="text-xs text-white/60 leading-relaxed font-medium group-hover:text-white transition-colors">{insight}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
