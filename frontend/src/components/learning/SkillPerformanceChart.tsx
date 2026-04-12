import React from 'react';

interface SkillRecord {
    skillId: string;
    successCount: number;
    failureCount: number;
    usageCount: number;
    avgLatencyMs: number;
}

interface Props {
    top: SkillRecord[];
    worst: SkillRecord[];
}

export const SkillPerformanceChart: React.FC<Props> = ({ top, worst }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="glass-card p-8 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400/60 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 glass-glow-accent shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                    Top Performing Skills
                </h3>
                <div className="space-y-3">
                    {top.map(skill => (
                        <div key={skill.skillId} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                            <div>
                                <span className="block text-xs font-black text-white tracking-tight group-hover:text-primary transition-colors">{skill.skillId}</span>
                                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{skill.usageCount} executions</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-emerald-400 font-black text-sm tracking-tighter">{((skill.successCount / skill.usageCount) * 100).toFixed(0)}%</span>
                                <span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter">{skill.avgLatencyMs}ms</span>
                            </div>
                        </div>
                    ))}
                    {top.length === 0 && <p className="text-[10px] text-white/20 text-center py-12 uppercase font-black tracking-widest italic border border-dashed border-white/5 rounded-2xl">Aguardando dados de performance...</p>}
                </div>
            </div>

            <div className="glass-card p-8 bg-gradient-to-br from-rose-500/5 to-transparent">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-400/60 mb-6 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-400 glass-glow-accent shadow-[0_0_8px_rgba(251,113,133,0.5)]" />
                    Skills Sob Observação
                </h3>
                <div className="space-y-3">
                    {worst.map(skill => (
                        <div key={skill.skillId} className="flex items-center justify-between p-4 bg-white/[0.03] rounded-2xl border border-white/5 hover:bg-white/5 transition-all group">
                            <div>
                                <span className="block text-xs font-black text-white tracking-tight group-hover:text-rose-400 transition-colors">{skill.skillId}</span>
                                <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{skill.usageCount} executions</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-rose-400 font-black text-sm tracking-tighter">{((skill.successCount / skill.usageCount) * 100).toFixed(0)}%</span>
                                <span className="text-[9px] font-mono text-white/20 uppercase tracking-tighter">{skill.avgLatencyMs}ms</span>
                            </div>
                        </div>
                    ))}
                    {worst.length === 0 && <p className="text-[10px] text-white/20 text-center py-12 uppercase font-black tracking-widest italic border border-dashed border-white/5 rounded-2xl">Nenhuma anomalia detectada.</p>}
                </div>
            </div>
        </div>
    );
};
