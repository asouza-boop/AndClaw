import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Label, Caption } from '@/components/ui/Typography';
import { Badge } from '@/components/ui/badge';

interface Props {
    title: string;
    value: string | number;
    subtitle: string;
    icon?: string;
    trend?: 'up' | 'down' | 'neutral';
}

const trendConfig = {
    up: { Icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-400', glow: 'shadow-[0_0_8px_rgba(52,211,153,0.5)]', badge: 'success' as const, label: '↑ Up' },
    down: { Icon: TrendingDown, color: 'text-rose-400', bg: 'bg-rose-400', glow: 'shadow-[0_0_8px_rgba(251,113,133,0.5)]', badge: 'error' as const, label: '↓ Down' },
    neutral: { Icon: Minus, color: 'text-white/30', bg: 'bg-white/20', glow: '', badge: 'glass' as const, label: '— Stable' },
};

export const EfficiencyMetricCard: React.FC<Props> = ({ title, value, subtitle, trend = 'neutral' }) => {
    const config = trendConfig[trend] || trendConfig.neutral;
    const { Icon } = config;

    return (
        <div className="glass-card p-5 flex flex-col justify-between h-36 group hover:border-white/[0.12] transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
                <Label className="text-white/30">{title}</Label>
                <div className={`w-2 h-2 rounded-full ${config.bg} ${config.glow}`} />
            </div>
            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white tracking-tighter">{value}</span>
                    <Badge variant={config.badge} className="text-[7px] px-1.5 py-0 gap-0.5">
                        <Icon className="h-2.5 w-2.5" />
                        {config.label}
                    </Badge>
                </div>
                <Caption as="p" className="mt-1.5">{subtitle}</Caption>
            </div>
        </div>
    );
};
