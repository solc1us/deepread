export type ProgressRecordForMerge = {
  status: "not_started" | "reading" | "completed";
  progressPercentage: number;
  startedAt: Date | null;
  completedAt: Date | null;
  lastReadAt: Date | null;
  createdAt: Date;
};

function earliestDate(values: Array<Date | null>) {
  return values.reduce<Date | null>((earliest, value) => {
    if (!value) {
      return earliest;
    }
    return !earliest || value < earliest ? value : earliest;
  }, null);
}

function latestDate(values: Array<Date | null>) {
  return values.reduce<Date | null>((latest, value) => {
    if (!value) {
      return latest;
    }
    return !latest || value > latest ? value : latest;
  }, null);
}

export function mergeReadingProgressValues(records: ProgressRecordForMerge[]) {
  const isCompleted = records.some(
    (record) => record.status === "completed" || record.progressPercentage >= 100,
  );
  const progressPercentage = isCompleted
    ? 100
    : Math.max(0, ...records.map((record) => record.progressPercentage));

  return {
    status: isCompleted
      ? ("completed" as const)
      : records.some((record) => record.status === "reading") || progressPercentage > 0
        ? ("reading" as const)
        : ("not_started" as const),
    progressPercentage,
    startedAt: earliestDate(records.map((record) => record.startedAt)),
    completedAt: isCompleted
      ? earliestDate(records.map((record) => record.completedAt))
      : null,
    lastReadAt: latestDate(records.map((record) => record.lastReadAt)),
    createdAt: earliestDate(records.map((record) => record.createdAt)) ?? new Date(0),
  };
}
