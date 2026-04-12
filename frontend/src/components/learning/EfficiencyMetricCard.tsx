import React from 'react';

interface Props {
    title: string;
    value: string | number;
    subtitle: string;
    icon?: string;
    trend?: 'up' | 'down' | 'neutral';
}

export const EfficiencyMetricCard: React.FC<Props> = ({ title, value, subtitle, trend }) => {
    return (
        <div className="glass-card p-6 border border-white/10 rounded-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
                <div className="w-16 h-16 rounded-full bg-blue-500 blur-xl"></div>
            </div>
            
            <h4 className="text-sm font-medium text-white/60 mb-1">{title}</h4>
            <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{value}</span>
                {trend === 'up' && <span className="text-emerald-400 text-xs font-bold">↑</span>}
                {trend === 'down' && <span className="text-rose-400 text-xs font-bold">↓</span>}
            </div>
            <p className="text-xs text-white/40 mt-1">{subtitle}</p>
        </div>
    );
};
