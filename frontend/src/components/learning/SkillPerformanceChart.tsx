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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 border border-white/10 rounded-2xl">
                <h3 className="text-xl font-bold mb-4 text-emerald-400">Top Performing Skills</h3>
                <div className="space-y-4">
                    {top.map(skill => (
                        <div key={skill.skillId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <div>
                                <span className="block font-medium text-white">{skill.skillId}</span>
                                <span className="text-xs text-white/50">{skill.usageCount} execs</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-emerald-400 font-bold">{((skill.successCount / skill.usageCount) * 100).toFixed(0)}%</span>
                                <span className="text-xs text-white/50">{skill.avgLatencyMs}ms</span>
                            </div>
                        </div>
                    ))}
                    {top.length === 0 && <p className="text-white/30 text-center py-8 italic">Sem dados de execução</p>}
                </div>
            </div>

            <div className="glass-card p-6 border border-white/10 rounded-2xl">
                <h3 className="text-xl font-bold mb-4 text-rose-400">Skills sob Observação</h3>
                <div className="space-y-4">
                    {worst.map(skill => (
                        <div key={skill.skillId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                            <div>
                                <span className="block font-medium text-white">{skill.skillId}</span>
                                <span className="text-xs text-white/50">{skill.usageCount} execs</span>
                            </div>
                            <div className="text-right">
                                <span className="block text-rose-400 font-bold">{((skill.successCount / skill.usageCount) * 100).toFixed(0)}%</span>
                                <span className="text-xs text-white/50">{skill.avgLatencyMs}ms</span>
                            </div>
                        </div>
                    ))}
                    {worst.length === 0 && <p className="text-white/30 text-center py-8 italic">Sem dados críticos</p>}
                </div>
            </div>
        </div>
    );
};
