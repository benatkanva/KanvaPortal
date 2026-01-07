'use client';

import { useState } from 'react';
import { SAIACustomer } from '@/types/saia';
import { ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

interface SAIACustomerTableProps {
  customers: SAIACustomer[];
  onCustomerClick: (customerId: string) => void;
}

type SortField = 'name' | 'location' | 'shipments' | 'weight' | 'charges' | 'avgCharges' | 'onTime' | 'shipDate' | 'deliveryDate';
type SortDirection = 'asc' | 'desc';

export default function SAIACustomerTable({ customers, onCustomerClick }: SAIACustomerTableProps) {
  const [sortField, setSortField] = useState<SortField>('shipments');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const getOnTimeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getOnTimeLabel = (percentage: number) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 75) return 'Warning';
    return 'Needs Attention';
  };

  const handleProClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click from firing
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 text-gray-400" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 text-blue-600" />
      : <ArrowDown className="w-4 h-4 text-blue-600" />;
  };

  const sortedCustomers = [...customers].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    
    switch (sortField) {
      case 'name':
        return direction * a.name.localeCompare(b.name);
      case 'location':
        return direction * `${a.city}, ${a.state}`.localeCompare(`${b.city}, ${b.state}`);
      case 'shipments':
        return direction * (a.totalShipments - b.totalShipments);
      case 'weight':
        return direction * (a.totalWeight - b.totalWeight);
      case 'charges':
        return direction * (a.totalCharges - b.totalCharges);
      case 'avgCharges':
        return direction * (a.avgCharges - b.avgCharges);
      case 'onTime':
        return direction * (a.onTimePercentage - b.onTimePercentage);
      case 'shipDate': {
        const aDate = a.recentShipments?.[0]?.pickupDate || '';
        const bDate = b.recentShipments?.[0]?.pickupDate || '';
        return direction * aDate.localeCompare(bDate);
      }
      case 'deliveryDate': {
        const aDate = a.recentShipments?.[0]?.deliveryDate || '';
        const bDate = b.recentShipments?.[0]?.deliveryDate || '';
        return direction * aDate.localeCompare(bDate);
      }
      default:
        return 0;
    }
  });

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th 
                onClick={() => handleSort('name')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Customer
                  {getSortIcon('name')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('location')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Location
                  {getSortIcon('location')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Latest PRO#
              </th>
              <th 
                onClick={() => handleSort('shipDate')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Ship Date
                  {getSortIcon('shipDate')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('deliveryDate')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Delivery Date
                  {getSortIcon('deliveryDate')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('shipments')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Shipments
                  {getSortIcon('shipments')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('weight')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Total Weight
                  {getSortIcon('weight')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('charges')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Total Charges
                  {getSortIcon('charges')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('avgCharges')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  Avg/Shipment
                  {getSortIcon('avgCharges')}
                </div>
              </th>
              <th 
                onClick={() => handleSort('onTime')}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  On-Time %
                  {getSortIcon('onTime')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Performance
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedCustomers.map((customer) => {
              const mostRecentPro = customer.recentShipments?.[0]?.proNumber;
              const mostRecentShipment = customer.recentShipments?.[0];
              
              return (
                <tr
                  key={customer.id}
                  onClick={() => onCustomerClick(customer.id)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                    <div className="text-sm text-gray-500">Code: {customer.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{customer.city}</div>
                    <div className="text-sm text-gray-500">{customer.state}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {mostRecentPro ? (
                      <a
                        href={`https://www.saia.com/track/details;pro=${mostRecentPro}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleProClick}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {mostRecentPro}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {mostRecentShipment?.pickupDate 
                      ? new Date(mostRecentShipment.pickupDate).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {mostRecentShipment?.deliveryDate ? (
                      <div className="text-sm text-gray-900">
                        {new Date(mostRecentShipment.deliveryDate).toLocaleDateString()}
                      </div>
                    ) : mostRecentShipment ? (
                      <span className="text-sm text-blue-600 font-medium">In Transit</span>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {customer.totalShipments}
                  </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {customer.totalWeight.toLocaleString()} lbs
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${customer.totalCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  ${customer.avgCharges.toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm font-semibold ${getOnTimeColor(customer.onTimePercentage)}`}>
                    {customer.onTimePercentage.toFixed(1)}%
                  </span>
                </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-xs font-medium ${getOnTimeColor(customer.onTimePercentage)}`}>
                      {getOnTimeLabel(customer.onTimePercentage)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
