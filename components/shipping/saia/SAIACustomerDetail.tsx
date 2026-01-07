'use client';

import { SAIACustomer, SAIAShipment } from '@/types/saia';
import { X } from 'lucide-react';

interface SAIACustomerDetailProps {
  customer: SAIACustomer;
  shipments: SAIAShipment[];
  onClose: () => void;
}

export default function SAIACustomerDetail({ customer, shipments, onClose }: SAIACustomerDetailProps) {
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('delivered')) return 'bg-green-100 text-green-800';
    if (statusLower.includes('transit')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-600 to-blue-700">
          <div>
            <h2 className="text-2xl font-bold text-white">{customer.name}</h2>
            <p className="text-blue-100 text-sm">
              {customer.address}, {customer.city}, {customer.state} {customer.zip}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Performance Metrics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Metrics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Total Shipments</div>
                <div className="text-2xl font-bold text-gray-900">{customer.totalShipments}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">On-Time Deliveries</div>
                <div className="text-2xl font-bold text-green-600">
                  {customer.onTimeShipments} ({customer.onTimePercentage.toFixed(1)}%)
                </div>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Late Deliveries</div>
                <div className="text-2xl font-bold text-red-600">{customer.lateShipments}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">In Transit</div>
                <div className="text-2xl font-bold text-blue-600">{customer.inTransitShipments}</div>
              </div>
            </div>
          </div>

          {/* Financial Summary */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 mb-3">Financial Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Net Charges (Before Discount)</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${customer.totalNetCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">
                  Discount Savings ({customer.avgDiscountPercent.toFixed(1)}%)
                </div>
                <div className="text-lg font-semibold text-green-600">
                  -${customer.totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Charges (Actual Billed)</div>
                <div className="text-xl font-bold text-gray-900">
                  ${customer.totalCharges.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Fuel Surcharge</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${customer.totalFuelSurcharge.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Avg/Shipment</div>
                <div className="text-lg font-semibold text-gray-900">
                  ${customer.avgCharges.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Avg Discount/Shipment</div>
                <div className="text-lg font-semibold text-green-600">
                  ${customer.avgDiscount.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">First Shipment</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Date(customer.firstShipmentDate).toLocaleDateString()}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-500">Last Shipment</div>
                <div className="text-lg font-semibold text-gray-900">
                  {new Date(customer.lastShipmentDate).toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Shipments */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Recent Shipments ({shipments.length})
            </h3>
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">PRO #</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pickup Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Delivery Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Weight</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Charges</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Signature</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {shipments.slice(0, 20).map((shipment) => (
                      <tr key={shipment.proNumber} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium">
                          <a
                            href={`https://www.saia.com/track/details;pro=${shipment.proNumber}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline"
                          >
                            {shipment.proNumber}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(shipment.status)}`}>
                            {shipment.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {new Date(shipment.pickupDate).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">{shipment.weight} lbs</td>
                        <td className="px-4 py-3 text-sm text-gray-900">${shipment.charges.toFixed(2)}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {shipment.originTerminal} → {shipment.destTerminal}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{shipment.signature || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
