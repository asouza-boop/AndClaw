import React from 'react';

export interface Insight {
    id: string;
    type: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
}

interface Props {
    insights: Insight[];
}

export const IntelligenceInsights: React.FC<Props> = ({ insights }) => {
    return (
        <div className="glass-card p-8 bg-gradient-to-br from-primary/5 to-transparent h-full">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-6 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                Intelligence Insights
            </h3>
            <div className="space-y-4">
                {insights.map((insight) => (
                    <div key={insight.id} className="flex gap-4 p-4 bg-white/[0.03] rounded-2xl border border-white/5 items-start hover:bg-white/5 transition-all group">
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 glass-glow-accent shadow-[0_0_8px_rgba(52,211,153,0.5)] opacity-40 group-hover:opacity-100 transition-opacity ${
                            insight.priority === 'high' ? 'bg-primary' : insight.priority === 'medium' ? 'bg-accent' : 'bg-white/20'
                        }`}></div>
                        <p className="text-xs text-white/60 leading-relaxed font-medium group-hover:text-white transition-colors">{insight.content}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
