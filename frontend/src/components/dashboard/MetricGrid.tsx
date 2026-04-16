import React from 'react';
import { Grid } from '@/components/ui/Layout';
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
  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  return (
    <Grid className="grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {safeMetrics.map((metric, i) => (
        <EfficiencyMetricCard
          key={metric.title || i}
          {...metric}
        />
      ))}
    </Grid>
  );
};
