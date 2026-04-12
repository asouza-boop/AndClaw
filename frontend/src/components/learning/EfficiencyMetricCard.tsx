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
        <div className="glass-card p-6 flex flex-col justify-between h-32 group">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">{title}</span>
                <div className={`w-2 h-2 rounded-full glass-glow-accent ${
                    trend === 'up' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 
                    trend === 'down' ? 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]' : 
                    'bg-white/20'
                }`} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
                  {trend === 'up' && <span className="text-emerald-400 text-[10px] font-black uppercase tracking-tighter self-end mb-1">+Yield</span>}
              </div>
              <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest mt-1">{subtitle}</p>
            </div>
        </div>
    );
};
