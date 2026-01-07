'use client';

import { SAIACustomer } from '@/types/saia';
import { ExternalLink } from 'lucide-react';

interface SAIACustomerCardProps {
  customer: SAIACustomer;
  onClick: () => void;
}

export default function SAIACustomerCard({ customer, onClick }: SAIACustomerCardProps) {
  const getOnTimeColor = (percentage: number) => {
    if (percentage >= 90) return 'text-green-600 bg-green-50';
    if (percentage >= 75) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getOnTimeLabel = (percentage: number) => {
    if (percentage >= 90) return 'Excellent';
    if (percentage >= 75) return 'Warning';
    return 'Needs Attention';
  };

  // Get most recent shipment PRO number
  const mostRecentPro = customer.recentShipments?.[0]?.proNumber;

  const handleProClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click from firing
  };

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6 border border-gray-200 hover:border-blue-300"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">{customer.name}</h3>
          <p className="text-sm text-gray-500">
            {customer.city}, {customer.state}
          </p>
        </div>
        <div className={`px-3 py-1 rounded-full text-xs font-medium ${getOnTimeColor(customer.onTimePercentage)}`}>
          {customer.onTimePercentage.toFixed(1)}%
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500">Shipments</div>
          <div className="text-lg font-semibold text-gray-900">{customer.totalShipments}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Total Weight</div>
          <div className="text-lg font-semibold text-gray-900">{customer.totalWeight.toLocaleString()} lbs</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-gray-500">Total Charges</div>
          <div className="text-lg font-semibold text-gray-900">${customer.totalCharges.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-xs text-gray-500">Avg/Shipment</div>
          <div className="text-lg font-semibold text-gray-900">${customer.avgCharges.toFixed(2)}</div>
        </div>
      </div>

      <div className={`text-center py-2 rounded ${getOnTimeColor(customer.onTimePercentage)}`}>
        <span className="text-xs font-medium">{getOnTimeLabel(customer.onTimePercentage)}</span>
      </div>

      {/* Most Recent Shipment Details */}
      {mostRecentPro && customer.recentShipments?.[0] && (
        <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
          <a
            href={`https://www.saia.com/track/details;pro=${mostRecentPro}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleProClick}
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Latest: PRO# {mostRecentPro}
          </a>
          
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <div className="text-gray-500">Ship Date</div>
              <div className="font-medium text-gray-900">
                {new Date(customer.recentShipments[0].pickupDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-gray-500">
                {customer.recentShipments[0].deliveryDate ? 'Delivered' : 'Est. Arrival'}
              </div>
              <div className="font-medium text-gray-900">
                {customer.recentShipments[0].deliveryDate 
                  ? new Date(customer.recentShipments[0].deliveryDate).toLocaleDateString()
                  : 'In Transit'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
