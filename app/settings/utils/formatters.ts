// Export existing formatters from lib
export {
  validateWeightsSum,
  calculatePayout,
  formatCurrency,
  formatAttainment
} from '@/lib/commission/calculator';

export function formatDate(date: string | Date): string {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatBudget(amount: number): string {
  if (!amount) return '$0';
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatPercentage(value: number, decimals: number = 0): string {
  if (value === null || value === undefined) return '0%';
  return `${value.toFixed(decimals)}%`;
}

export function formatNumber(value: number, decimals: number = 0): string {
  if (value === null || value === undefined) return '0';
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}
