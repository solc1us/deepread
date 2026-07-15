import { performance } from "node:perf_hooks";

export interface TimingStatistics {
  count: number;
  average: number;
  minimum: number;
  p50: number;
  p95: number;
  maximum: number;
}

export interface ProfileSnapshot {
  timings: Record<string, TimingStatistics>;
  totalWallMs: number;
  cpuUserMs: number;
  cpuSystemMs: number;
  eventLoopUtilization: number;
}

export interface ProfileMetric {
  name: string;
  label: string;
  kind: "duration" | "latency";
}

export interface ProfileSummaryOptions {
  title: string;
  metadata: Record<string, string | number | boolean>;
  snapshot: ProfileSnapshot;
  metrics: ProfileMetric[];
}

const EMPTY_TIMING_STATISTICS: TimingStatistics = {
  count: 0,
  average: 0,
  minimum: 0,
  p50: 0,
  p95: 0,
  maximum: 0,
};

function percentile(sortedValues: number[], percentileValue: number) {
  if (sortedValues.length === 0) {
    return 0;
  }

  const position = (sortedValues.length - 1) * percentileValue;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  const lowerValue = sortedValues[lowerIndex] ?? 0;
  const upperValue = sortedValues[upperIndex] ?? lowerValue;

  return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
}

export function calculateTimingStatistics(values: number[]): TimingStatistics {
  const sortedValues = values
    .filter((value) => Number.isFinite(value) && value >= 0)
    .sort((left, right) => left - right);

  if (sortedValues.length === 0) {
    return { ...EMPTY_TIMING_STATISTICS };
  }

  const total = sortedValues.reduce((sum, value) => sum + value, 0);

  return {
    count: sortedValues.length,
    average: total / sortedValues.length,
    minimum: sortedValues[0] ?? 0,
    p50: percentile(sortedValues, 0.5),
    p95: percentile(sortedValues, 0.95),
    maximum: sortedValues.at(-1) ?? 0,
  };
}

export class BackendProfiler {
  private readonly cpuStartedAt = process.cpuUsage();
  private readonly eventLoopStartedAt = performance.eventLoopUtilization();
  private readonly timings = new Map<string, number[]>();
  private readonly wallStartedAt = performance.now();

  recordDuration(name: string, durationMs: number) {
    const durations = this.timings.get(name);

    if (durations) {
      durations.push(durationMs);
      return;
    }

    this.timings.set(name, [durationMs]);
  }

  measureSync<TResult>(name: string, operation: () => TResult) {
    const startedAt = performance.now();

    try {
      return operation();
    } finally {
      this.recordDuration(name, performance.now() - startedAt);
    }
  }

  async measure<TResult>(name: string, operation: () => Promise<TResult>) {
    const startedAt = performance.now();

    try {
      return await operation();
    } finally {
      this.recordDuration(name, performance.now() - startedAt);
    }
  }

  finish(): ProfileSnapshot {
    const cpuUsage = process.cpuUsage(this.cpuStartedAt);
    const eventLoopUsage = performance.eventLoopUtilization(this.eventLoopStartedAt);

    return {
      timings: Object.fromEntries(
        Array.from(this.timings, ([name, durations]) => [name, calculateTimingStatistics(durations)]),
      ),
      totalWallMs: performance.now() - this.wallStartedAt,
      cpuUserMs: cpuUsage.user / 1_000,
      cpuSystemMs: cpuUsage.system / 1_000,
      eventLoopUtilization: Number.isFinite(eventLoopUsage.utilization) ? eventLoopUsage.utilization : 0,
    };
  }
}

function formatNumber(value: number, decimalPlaces = 2) {
  return Number(value.toFixed(decimalPlaces)).toString();
}

export function formatProfileSummary(options: ProfileSummaryOptions) {
  const lines = [`[${options.title}]`];

  for (const [name, value] of Object.entries(options.metadata)) {
    lines.push(`${name}: ${value}`);
  }

  for (const metric of options.metrics) {
    const statistics = options.snapshot.timings[metric.name] ?? EMPTY_TIMING_STATISTICS;

    if (metric.kind === "duration") {
      lines.push(`${metric.label}: ${formatNumber(statistics.average)}`);
      continue;
    }

    lines.push(
      `${metric.label}: count=${statistics.count} avg=${formatNumber(statistics.average)} min=${formatNumber(statistics.minimum)} p50=${formatNumber(statistics.p50)} p95=${formatNumber(statistics.p95)} max=${formatNumber(statistics.maximum)}`,
    );
  }

  lines.push(`total_wall_ms: ${formatNumber(options.snapshot.totalWallMs)}`);
  lines.push(`cpu_user_ms: ${formatNumber(options.snapshot.cpuUserMs)}`);
  lines.push(`cpu_system_ms: ${formatNumber(options.snapshot.cpuSystemMs)}`);
  lines.push(`event_loop_utilization: ${formatNumber(options.snapshot.eventLoopUtilization, 4)}`);

  return lines.join("\n");
}
