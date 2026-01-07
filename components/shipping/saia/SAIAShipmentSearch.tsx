'use client';

import { useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { SAIAShipment } from '@/types/saia';
import { Search } from 'lucide-react';

export default function SAIAShipmentSearch() {
  const [proNumber, setProNumber] = useState('');
  const [shipment, setShipment] = useState<SAIAShipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!proNumber.trim()) return;

    setLoading(true);
    setError(null);
    setShipment(null);

    try {
      const database = getDatabase();
      const shipmentRef = ref(database, `shipping/saia/shipments/${proNumber.trim()}`);
      const snapshot = await get(shipmentRef);

      if (snapshot.exists()) {
        setShipment(snapshot.val());
      } else {
        setError('Shipment not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search shipment');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('delivered')) return 'bg-green-100 text-green-800';
    if (statusLower.includes('transit')) return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Search Shipment by PRO Number</h2>
        <div className="flex gap-4">
          <input
            type="text"
            value={proNumber}
            onChange={(e) => setProNumber(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Enter PRO number..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading || !proNumber.trim()}
            className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Search className="w-4 h-4" />
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Shipment Details */}
      {shipment && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700">
            <h3 className="text-xl font-bold text-white">Shipment Details</h3>
            <a
              href={`https://www.saia.com/track/details;pro=${shipment.proNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-100 hover:text-white hover:underline inline-flex items-center gap-1"
            >
              PRO# {shipment.proNumber}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>

          <div className="p-6 space-y-6">
            {/* Status and Tracking */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Status & Tracking</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`inline-block mt-1 px-3 py-1 text-sm font-medium rounded-full ${getStatusColor(shipment.status)}`}>
                    {shipment.status}
                  </span>
                </div>
                <div>
                  <div className="text-sm text-gray-500">BOL Number</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.bolNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">PO Number</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.poNumber || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">On Time</div>
                  <div className={`text-sm font-medium ${shipment.onTime ? 'text-green-600' : 'text-red-600'}`}>
                    {shipment.onTime ? 'Yes' : 'No'}
                  </div>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-gray-900 mb-2">{shipment.customerName}</div>
                <div className="text-sm text-gray-600">{shipment.customerAddress}</div>
                <div className="text-sm text-gray-600">
                  {shipment.customerCity}, {shipment.customerState} {shipment.customerZip}
                </div>
                <div className="text-sm text-gray-500 mt-2">Code: {shipment.customerCode}</div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Delivery Timeline</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Pickup Date</div>
                  <div className="text-sm font-medium text-gray-900">
                    {new Date(shipment.pickupDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Delivery Date</div>
                  <div className="text-sm font-medium text-gray-900">
                    {shipment.deliveryDate ? new Date(shipment.deliveryDate).toLocaleDateString() : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Actual Days</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.actualDays}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Standard Days</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.standardDays}</div>
                </div>
              </div>
            </div>

            {/* Charges Breakdown */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Charges Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Net Charges (Before Discount)</div>
                  <div className="text-xl font-bold text-gray-900">${shipment.netCharges.toFixed(2)}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Discount ({shipment.discountPercent.toFixed(1)}%)</div>
                  <div className="text-xl font-bold text-green-600">-${shipment.discount.toFixed(2)}</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Total Charges (Actual Billed)</div>
                  <div className="text-2xl font-bold text-gray-900">${shipment.charges.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Fuel Surcharge</div>
                  <div className="text-lg font-semibold text-gray-900">${shipment.fuelSurcharge.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Weight</div>
                  <div className="text-lg font-semibold text-gray-900">{shipment.weight} lbs</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Pieces</div>
                  <div className="text-lg font-semibold text-gray-900">{shipment.pieces}</div>
                </div>
              </div>
            </div>

            {/* Terminal Routing */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Terminal Routing</h4>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Origin Terminal</div>
                  <div className="text-lg font-medium text-gray-900">{shipment.originTerminal}</div>
                </div>
                <div className="text-gray-400">→</div>
                <div className="flex-1 bg-blue-50 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Destination Terminal</div>
                  <div className="text-lg font-medium text-gray-900">{shipment.destTerminal}</div>
                </div>
              </div>
            </div>

            {/* Delivery Confirmation */}
            {shipment.signature && (
              <div>
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Delivery Confirmation</h4>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-sm text-gray-500">Signed By</div>
                  <div className="text-lg font-medium text-gray-900">{shipment.signature}</div>
                  {shipment.deliveryTime && (
                    <div className="text-sm text-gray-600 mt-1">
                      Delivered at {shipment.deliveryTime}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional Details */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Additional Details</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Pieces</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.pieces}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Arrive Time</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.timeArrive || '-'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Depart Time</div>
                  <div className="text-sm font-medium text-gray-900">{shipment.timeDepart || '-'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
