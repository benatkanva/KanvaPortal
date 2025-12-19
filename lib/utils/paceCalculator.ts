// Pace Calculator Utilities for Goals Tracker

export interface PaceResult {
  currentPace: number;
  targetPace: number;
  percentOfTarget: number;
  isOnTrack: boolean;
  daysRemaining: number;
  projectedTotal: number;
}

export function calculateDailyPace(
  currentValue: number,
  targetValue: number,
  startDate: Date,
  endDate: Date
): PaceResult {
  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysElapsed = Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.max(0, totalDays - daysElapsed);
  
  const currentPace = daysElapsed > 0 ? currentValue / daysElapsed : 0;
  const targetPace = totalDays > 0 ? targetValue / totalDays : 0;
  const percentOfTarget = targetValue > 0 ? (currentValue / targetValue) * 100 : 0;
  const projectedTotal = currentPace * totalDays;
  const isOnTrack = currentPace >= targetPace * 0.9; // Within 90% of target pace
  
  return {
    currentPace,
    targetPace,
    percentOfTarget,
    isOnTrack,
    daysRemaining,
    projectedTotal
  };
}

export function formatPaceValue(value: number, type: string): string {
  if (type.includes('revenue') || type.includes('sales')) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (type.includes('time') || type.includes('minutes')) {
    const hours = Math.floor(value / 60);
    const mins = Math.round(value % 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  }
  return value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}
