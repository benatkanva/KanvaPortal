import { Customer, SortDirection } from '../types/settings';

export function filterCustomers(
  customers: Customer[],
  filters: {
    searchTerm: string;
    selectedRep: string;
    selectedAccountType: string;
    selectedCity: string;
    selectedState: string;
  }
): Customer[] {
  return customers.filter((customer) => {
    const matchesSearch =
      !filters.searchTerm ||
      customer.customerName?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      customer.customerNum?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      customer.accountNumber?.toLowerCase().includes(filters.searchTerm.toLowerCase());

    const matchesRep =
      filters.selectedRep === 'all' || customer.salesPerson === filters.selectedRep;

    const matchesAccountType =
      filters.selectedAccountType === 'all' ||
      customer.accountType === filters.selectedAccountType;

    const matchesCity =
      filters.selectedCity === 'all' || customer.shippingCity === filters.selectedCity;

    const matchesState =
      filters.selectedState === 'all' || customer.shippingState === filters.selectedState;

    return matchesSearch && matchesRep && matchesAccountType && matchesCity && matchesState;
  });
}

export function sortCustomers(
  customers: Customer[],
  sortField: string,
  sortDirection: SortDirection
): Customer[] {
  return [...customers].sort((a, b) => {
    const aVal = (a as any)[sortField] || '';
    const bVal = (b as any)[sortField] || '';

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    return sortDirection === 'asc' ? (aVal > bVal ? 1 : -1) : bVal > aVal ? 1 : -1;
  });
}

export function validateCustomerCSV(csvData: any[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const requiredFields = ['customerNum', 'customerName'];

  if (!csvData || csvData.length === 0) {
    errors.push('CSV file is empty');
    return { valid: false, errors };
  }

  csvData.forEach((row, index) => {
    requiredFields.forEach((field) => {
      if (!row[field]) {
        errors.push(`Row ${index + 1}: Missing required field "${field}"`);
      }
    });
  });

  return { valid: errors.length === 0, errors };
}

export function parseCSV(csvText: string): any[] {
  const lines = csvText.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
  const data: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim().replace(/"/g, ''));
    const row: any = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    data.push(row);
  }

  return data;
}
