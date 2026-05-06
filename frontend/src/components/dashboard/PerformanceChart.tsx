import React from 'react';
import { Label, Caption } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/badge';
import { Stack } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3 } from 'lucide-react';

export interface PerformanceRecord {
    skillId: string;
    successCount: number;
    failureCount: number;
    usageCount: number;
    avgLatencyMs: number;
}

interface PerformanceChartProps {
    top: PerformanceRecord[];
    worst: PerformanceRecord[];
    topTitle?: string;
    worstTitle?: string;
}

function SkillRow({ skill, accent }: { skill: PerformanceRecord; accent: 'emerald' | 'rose' }) {
    const successRate = ((skill.successCount / (skill.usageCount || 1)) * 100).toFixed(0);
    const barWidth = Math.min(Number(successRate), 100);
    const isEmerald = accent === 'emerald';

    return (
        <div className="group p-4 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <span className={`block text-xs font-black text-white tracking-tight transition-colors group-hover:${isEmerald ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {skill.skillId || 'Unknown Skill'}
                    </span>
                    <Caption>{skill.usageCount || 0} executions</Caption>
                </div>
                <div className="text-right flex items-center gap-2">
                    <span className={`block font-black text-sm tracking-tighter ${isEmerald ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {successRate}%
                    </span>
                    <Badge variant="glass" className="text-[7px] px-1.5 py-0">
                        {skill.avgLatencyMs || 0}ms
                    </Badge>
                </div>
            </div>
            {/* Progress Bar */}
            <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-700 ${
                        isEmerald
                            ? 'bg-gradient-to-r from-emerald-500/60 to-emerald-400'
                            : 'bg-gradient-to-r from-rose-500/60 to-rose-400'
                    }`}
                    style={{ width: `${barWidth}%` }}
                />
            </div>
        </div>
    );
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
    top,
    worst,
    topTitle = "Top Performing Skills",
    worstTitle = "Under Observation"
}) => {
    const safeTop = Array.isArray(top) ? top : [];
    const safeWorst = Array.isArray(worst) ? worst : [];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-in slide-in-from-bottom-4 duration-500">
            {/* Top Skills */}
            <div className="glass-card p-6 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <div className="flex items-center justify-between mb-5">
                    <Label className="text-emerald-400/60 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                        {topTitle}
                    </Label>
                    {safeTop.length > 0 && (
                        <Badge variant="success" className="text-[8px]">{safeTop.length} skills</Badge>
                    )}
                </div>
                {safeTop.length > 0 ? (
                    <Stack className="gap-2.5">
                        {safeTop.map((skill, i) => (
                            <div key={skill.skillId || i} className="animate-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 60}ms` }}>
                                <SkillRow skill={skill} accent="emerald" />
                            </div>
                        ))}
                    </Stack>
                ) : (
                    <EmptyState
                        icon={<BarChart3 size={48} />}
                        title="Awaiting data"
                        description="Performance data will appear here as the agent processes requests."
                        className="py-10"
                    />
                )}
            </div>

            {/* Worst Skills */}
            <div className="glass-card p-6 bg-gradient-to-br from-rose-500/5 to-transparent">
                <div className="flex items-center justify-between mb-5">
                    <Label className="text-rose-400/60 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]" />
                        {worstTitle}
                    </Label>
                    {safeWorst.length > 0 && (
                        <Badge variant="error" className="text-[8px]">{safeWorst.length} skills</Badge>
                    )}
                </div>
                {safeWorst.length > 0 ? (
                    <Stack className="gap-2.5">
                        {safeWorst.map((skill, i) => (
                            <div key={skill.skillId || i} className="animate-in slide-in-from-bottom-1" style={{ animationDelay: `${i * 60}ms` }}>
                                <SkillRow skill={skill} accent="rose" />
                            </div>
                        ))}
                    </Stack>
                ) : (
                    <EmptyState
                        icon={<BarChart3 size={48} />}
                        title="No anomalies"
                        description="No skills are currently underperforming. All systems nominal."
                        className="py-10"
                    />
                )}
            </div>
        </div>
    );
};
