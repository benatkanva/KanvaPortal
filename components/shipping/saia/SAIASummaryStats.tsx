'use client';

import { SAIACustomer } from '@/types/saia';

interface SAIASummaryStatsProps {
  customers: SAIACustomer[];
}

export default function SAIASummaryStats({ customers }: SAIASummaryStatsProps) {
  const stats = customers.reduce(
    (acc, customer) => ({
      totalCustomers: acc.totalCustomers + 1,
      totalShipments: acc.totalShipments + customer.totalShipments,
      totalWeight: acc.totalWeight + customer.totalWeight,
      totalCharges: acc.totalCharges + customer.totalCharges,
    }),
    { totalCustomers: 0, totalShipments: 0, totalWeight: 0, totalCharges: 0 }
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500 mb-1">Total Customers</div>
        <div className="text-3xl font-bold text-gray-900">{stats.totalCustomers}</div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500 mb-1">Total Shipments</div>
        <div className="text-3xl font-bold text-gray-900">{stats.totalShipments.toLocaleString()}</div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500 mb-1">Total Weight</div>
        <div className="text-3xl font-bold text-gray-900">{stats.totalWeight.toLocaleString()} lbs</div>
      </div>
      
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-500 mb-1">Total Charges</div>
        <div className="text-3xl font-bold text-gray-900">${stats.totalCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      </div>
    </div>
  );
}
