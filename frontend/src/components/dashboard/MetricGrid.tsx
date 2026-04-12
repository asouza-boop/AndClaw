import React from 'react';
import { EfficiencyMetricCard } from './EfficiencyMetricCard';

interface Metric {
  title: string;
  value: string | number;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
}

interface MetricGridProps {
  metrics: Metric[];
}

export const MetricGrid: React.FC<MetricGridProps> = ({ metrics }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {metrics.map((metric, i) => (
        <EfficiencyMetricCard 
          key={i}
          {...metric}
        />
      ))}
    </div>
  );
};
