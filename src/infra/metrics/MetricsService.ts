import { logger } from '@/infra/logger';

type MetricCounter = {
  type: 'counter';
  value: number;
};

type MetricObservation = {
  type: 'observation';
  count: number;
  sum: number;
  average: number;
  min: number;
  max: number;
  last: number;
};

type MetricState = MetricCounter | MetricObservation;

type MetricsSnapshot = Record<string, {
  count?: number;
  value?: number;
  sum?: number;
  average?: number;
  min?: number;
  max?: number;
  last?: number;
}>;

class MetricsServiceImpl {
  private store = new Map<string, MetricState>();
  private mutationCount = 0;
  private readonly snapshotEvery = 100;

  public increment(metric: string): void {
    const current = this.store.get(metric);
    if (!current || current.type !== 'counter') {
      this.store.set(metric, { type: 'counter', value: 1 });
    } else {
      current.value += 1;
    }
    this.bump();
  }

  public observe(metric: string, value: number): void {
    const safeValue = Number.isFinite(value) ? value : 0;
    const current = this.store.get(metric);
    if (!current || current.type !== 'observation') {
      this.store.set(metric, {
        type: 'observation',
        count: 1,
        sum: safeValue,
        average: safeValue,
        min: safeValue,
        max: safeValue,
        last: safeValue,
      });
    } else {
      current.count += 1;
      current.sum += safeValue;
      current.last = safeValue;
      current.min = Math.min(current.min, safeValue);
      current.max = Math.max(current.max, safeValue);
      current.average = current.sum / current.count;
    }
    this.bump();
  }

  public getMetrics(): MetricsSnapshot {
    const snapshot: MetricsSnapshot = {};
    for (const [metric, state] of this.store.entries()) {
      if (state.type === 'counter') {
        snapshot[metric] = { value: state.value };
      } else {
        snapshot[metric] = {
          count: state.count,
          sum: state.sum,
          average: state.average,
          min: state.min,
          max: state.max,
          last: state.last,
        };
      }
    }
    return snapshot;
  }

  public reset(): void {
    this.store.clear();
    this.mutationCount = 0;
  }

  private bump(): void {
    this.mutationCount += 1;
    if (this.mutationCount % this.snapshotEvery === 0) {
      logger.info('metrics.snapshot', {
        mutationCount: this.mutationCount,
        metrics: this.getMetrics(),
      });
    }
  }
}

export const metrics = new MetricsServiceImpl();
export { MetricsServiceImpl };
