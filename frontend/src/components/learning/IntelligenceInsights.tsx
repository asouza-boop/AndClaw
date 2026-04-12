import React from 'react';

interface Props {
    insights: string[];
}

export const IntelligenceInsights: React.FC<Props> = ({ insights }) => {
    return (
        <div className="glass-card p-6 border border-white/10 rounded-2xl bg-gradient-to-br from-blue-500/5 to-purple-500/5">
            <h3 className="text-xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 flex items-center gap-2">
                Intelligence Insights
            </h3>
            <div className="space-y-3">
                {insights.map((insight, b) => (
                    <div key={b} className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5 items-start">
                        <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 shrink-0 animate-pulse"></div>
                        <p className="text-sm text-white/80 leading-relaxed">{insight}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};
