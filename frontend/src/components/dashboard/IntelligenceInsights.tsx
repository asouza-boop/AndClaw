import React from 'react';
import { Label, Caption } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/badge';
import { Stack } from '@/components/ui/Layout';
import { EmptyState } from '@/components/ui/EmptyState';
import { Lightbulb, TrendingUp, AlertTriangle, Zap } from 'lucide-react';

export interface Insight {
    id: string;
    type: string;
    content: string;
    priority: 'high' | 'medium' | 'low';
}

interface Props {
    insights: Insight[];
}

const priorityConfig = {
    high: { badge: 'optimizing' as const, icon: TrendingUp },
    medium: { badge: 'fallback' as const, icon: AlertTriangle },
    low: { badge: 'glass' as const, icon: Zap },
};

export const IntelligenceInsights: React.FC<Props> = ({ insights }) => {
    const safeInsights = Array.isArray(insights) ? insights : [];

    return (
        <div className="glass-card p-6 bg-gradient-to-br from-primary/5 to-transparent h-full">
            <div className="flex items-center justify-between mb-5">
                <Label className="text-white/40 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Intelligence Insights
                </Label>
                {safeInsights.length > 0 && (
                    <Badge variant="glass" className="text-[8px]">
                        {safeInsights.length} insight{safeInsights.length > 1 ? 's' : ''}
                    </Badge>
                )}
            </div>

            {safeInsights.length === 0 ? (
                <EmptyState
                    icon={<Lightbulb size={48} />}
                    title="No insights yet"
                    description="The intelligence engine needs more data to generate meaningful insights."
                    className="py-10"
                />
            ) : (
                <Stack className="gap-3">
                    {safeInsights.map((insight, i) => {
                        const config = priorityConfig[insight.priority] || priorityConfig.low;
                        const PriorityIcon = config.icon;
                        return (
                            <div
                                key={insight.id}
                                className="flex gap-3 p-3.5 rounded-xl border border-white/5 bg-white/[0.03] items-start hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-300 group animate-in slide-in-from-bottom-1"
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                <div className="mt-0.5 shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 text-muted-foreground group-hover:text-primary transition-colors">
                                    <PriorityIcon className="h-3.5 w-3.5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <Caption as="p" className="text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                                        {insight.content}
                                    </Caption>
                                </div>
                                <Badge variant={config.badge} className="text-[7px] px-1.5 py-0 shrink-0 mt-0.5">
                                    {insight.priority}
                                </Badge>
                            </div>
                        );
                    })}
                </Stack>
            )}
        </div>
    );
};
