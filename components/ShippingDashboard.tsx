'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

interface SAIAShipment {
  id: string;
  proNumber: string;
  consigneeName: string;
  consigneeCity: string;
  consigneeState: string;
  pickupDate: string;
  deliveryDate: string;
  currentStatus: string;
  weight: number;
  totalCharges: number;
  actualDays: number;
  standardDays: number;
  onTime: string;
  pieces?: string;
  customerId?: string;
  customerName?: string;
  signature?: string;
}

interface ShippingMetrics {
  totalShipments: number;
  onTimeDeliveries: number;
  lateDeliveries: number;
  totalWeight: number;
  totalCharges: number;
  avgDeliveryDays: number;
}

export default function ShippingDashboard({ customerId }: { customerId?: string }) {
  const [shipments, setShipments] = useState<SAIAShipment[]>([]);
  const [metrics, setMetrics] = useState<ShippingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<SAIAShipment | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  useEffect(() => {
    loadShipments();
  }, [customerId, dateRange]);

  const loadShipments = async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'saia_shipments'),
        orderBy('pickupDate', 'desc'),
        limit(100)
      );

      if (customerId) {
        q = query(
          collection(db, 'saia_shipments'),
          where('customerId', '==', customerId),
          orderBy('pickupDate', 'desc'),
          limit(100)
        );
      }

      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SAIAShipment[];

      setShipments(data);
      calculateMetrics(data);
    } catch (error) {
      console.error('Error loading shipments:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateMetrics = (data: SAIAShipment[]) => {
    const metrics: ShippingMetrics = {
      totalShipments: data.length,
      onTimeDeliveries: data.filter(s => s.onTime === 'Y').length,
      lateDeliveries: data.filter(s => s.onTime === 'N').length,
      totalWeight: data.reduce((sum, s) => sum + (s.weight || 0), 0),
      totalCharges: data.reduce((sum, s) => sum + (s.totalCharges || 0), 0),
      avgDeliveryDays: data.length > 0 
        ? data.reduce((sum, s) => sum + (s.actualDays || 0), 0) / data.length 
        : 0,
    };
    setMetrics(metrics);
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('delivered')) return 'text-green-600 bg-green-50';
    if (statusLower.includes('transit')) return 'text-blue-600 bg-blue-50';
    if (statusLower.includes('arrived')) return 'text-yellow-600 bg-yellow-50';
    return 'text-gray-600 bg-gray-50';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading shipping data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total Shipments</div>
            <div className="text-2xl font-bold text-gray-900">{metrics.totalShipments}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">On-Time %</div>
            <div className="text-2xl font-bold text-green-600">
              {metrics.totalShipments > 0 
                ? ((metrics.onTimeDeliveries / metrics.totalShipments) * 100).toFixed(1)
                : 0}%
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Late Deliveries</div>
            <div className="text-2xl font-bold text-red-600">{metrics.lateDeliveries}</div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total Weight</div>
            <div className="text-2xl font-bold text-gray-900">
              {metrics.totalWeight.toLocaleString()} lbs
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Total Charges</div>
            <div className="text-2xl font-bold text-gray-900">
              ${metrics.totalCharges.toLocaleString()}
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <div className="text-sm text-gray-500">Avg Days</div>
            <div className="text-2xl font-bold text-gray-900">
              {metrics.avgDeliveryDays.toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">SAIA Shipments</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  PRO #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destination
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pickup Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Weight
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Charges
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Days
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {shipments.map((shipment) => (
                <tr 
                  key={shipment.id}
                  onClick={() => setSelectedShipment(shipment)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                    {shipment.proNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {shipment.customerName || shipment.consigneeName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {shipment.consigneeCity}, {shipment.consigneeState}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {shipment.pickupDate}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {shipment.deliveryDate || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(shipment.currentStatus)}`}>
                      {shipment.currentStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {shipment.weight} lbs
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${shipment.totalCharges.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className={shipment.onTime === 'Y' ? 'text-green-600' : 'text-red-600'}>
                      {shipment.actualDays} / {shipment.standardDays}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Shipment Details - PRO #{selectedShipment.proNumber}
              </h3>
              <button
                onClick={() => setSelectedShipment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500">Customer</div>
                  <div className="text-sm text-gray-900">{selectedShipment.customerName || selectedShipment.consigneeName}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Status</div>
                  <div className="text-sm text-gray-900">{selectedShipment.currentStatus}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Pickup Date</div>
                  <div className="text-sm text-gray-900">{selectedShipment.pickupDate}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Delivery Date</div>
                  <div className="text-sm text-gray-900">{selectedShipment.deliveryDate || 'Not delivered'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Weight</div>
                  <div className="text-sm text-gray-900">{selectedShipment.weight} lbs</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Pieces</div>
                  <div className="text-sm text-gray-900">{selectedShipment.pieces || '-'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Total Charges</div>
                  <div className="text-sm text-gray-900">${selectedShipment.totalCharges.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500">Delivery Time</div>
                  <div className="text-sm text-gray-900">
                    {selectedShipment.actualDays} days ({selectedShipment.onTime === 'Y' ? 'On Time' : 'Late'})
                  </div>
                </div>
                {selectedShipment.signature && (
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-gray-500">Signed By</div>
                    <div className="text-sm text-gray-900">{selectedShipment.signature}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
