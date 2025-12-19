/**
 * ShipStation Service
 * Handles API calls via proxy and Firestore caching
 */

import { db } from '@/lib/firebase/config';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc,
  Timestamp 
} from 'firebase/firestore';
import type { 
  ShipStationOrder, 
  ShipStationOrdersResponse,
  ShipStationShipmentsResponse,
  ShipStationLabelsResponse,
  ShipStationSyncMeta,
  FirestoreShipStationOrder
} from '@/types/shipstation';

const API_BASE = '/api/shipstation';
const API_V2_BASE = '/api/shipstation-v2';

/**
 * List orders from ShipStation API via proxy
 */
export async function listOrders(params: {
  start: Date;
  end: Date;
  page?: number;
  pageSize?: number;
}): Promise<ShipStationOrdersResponse> {
  const { start, end, page = 1, pageSize = 100 } = params;
  
  const searchParams = new URLSearchParams({
    createDateStart: start.toISOString(),
    createDateEnd: end.toISOString(),
    page: String(page),
    pageSize: String(Math.min(pageSize, 500))
  });

  const response = await fetch(`${API_BASE}/orders?${searchParams}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch orders: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    orders: data.orders || [],
    total: data.total || 0,
    page: data.page || page,
    pages: data.pages || 1
  };
}

/**
 * List shipments from ShipStation v1 API (has orderId, orderNumber, trackingNumber)
 */
export async function listShipments(params: {
  start?: Date;
  end?: Date;
  page?: number;
  pageSize?: number;
}): Promise<ShipStationShipmentsResponse> {
  const { start, end, page = 1, pageSize = 500 } = params;
  
  const searchParams = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sortBy: 'ShipDate',
    sortDir: 'DESC'
  });

  if (start) searchParams.set('shipDateStart', start.toISOString());
  if (end) searchParams.set('shipDateEnd', end.toISOString());

  const response = await fetch(`${API_BASE}/shipments?${searchParams}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch shipments: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    shipments: data.shipments || [],
    total: data.total || 0,
    page: data.page || page,
    pages: data.pages || 1
  };
}

/**
 * List shipments from ShipStation v2 API (has shipment_status)
 */
export async function listShipmentsV2(params: {
  start?: Date;
  end?: Date;
  page?: number;
  pageSize?: number;
}): Promise<ShipStationShipmentsResponse> {
  const { start, end, page = 1, pageSize = 100 } = params;
  
  const searchParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
    sort_by: 'created_at',
    sort_dir: 'desc',
    shipment_status: 'label_purchased'
  });

  if (start) searchParams.set('created_at_start', start.toISOString());
  if (end) searchParams.set('created_at_end', end.toISOString());

  const response = await fetch(`${API_V2_BASE}/v2/shipments?${searchParams}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch v2 shipments: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    shipments: data.shipments || [],
    total: data.total || 0,
    page: data.page || page,
    pages: data.pages || 1
  };
}

/**
 * List labels from ShipStation v2 API (has tracking_status)
 */
export async function listLabelsV2(params: {
  start?: Date;
  end?: Date;
  pageSize?: number;
}): Promise<ShipStationLabelsResponse> {
  const { start, end, pageSize = 100 } = params;
  
  const searchParams = new URLSearchParams({
    page_size: String(pageSize),
    sort_by: 'created_at',
    sort_dir: 'desc'
  });

  if (start) searchParams.set('created_at_start', start.toISOString());
  if (end) searchParams.set('created_at_end', end.toISOString());

  const response = await fetch(`${API_V2_BASE}/v2/labels?${searchParams}`);
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to fetch labels: ${response.status} ${text}`);
  }

  const data = await response.json();
  return {
    labels: data.labels || [],
    total: data.total || 0,
    page: data.page || 1,
    pages: data.pages || 1
  };
}

/**
 * Fetch orders with enriched shipment and tracking data
 */
export async function fetchEnrichedOrders(params: {
  start: Date;
  end: Date;
  page?: number;
  pageSize?: number;
  onProgress?: (message: string) => void;
}): Promise<{
  orders: ShipStationOrder[];
  total: number;
  page: number;
  pages: number;
}> {
  const { start, end, page = 1, pageSize = 100, onProgress } = params;
  
  onProgress?.('Loading orders...');
  const ordersResponse = await listOrders({ start, end, page, pageSize });
  
  // Build shipments map
  const shipmentsMap: Record<string | number, any[]> = {};
  try {
    onProgress?.('Loading tracking info...');
    const { shipments } = await listShipments({ start, end, pageSize: 500 });
    
    for (const s of shipments) {
      const key = s.orderId || s.orderNumber;
      if (key) {
        if (!shipmentsMap[key]) shipmentsMap[key] = [];
        shipmentsMap[key].push(s);
      }
      if (s.orderNumber && s.orderNumber !== key) {
        if (!shipmentsMap[s.orderNumber]) shipmentsMap[s.orderNumber] = [];
        shipmentsMap[s.orderNumber].push(s);
      }
    }
  } catch (err) {
    console.warn('Could not fetch shipments:', err);
  }

  // Build v2 status map
  const v2StatusMap: Record<string, { status: string; shipmentId?: string; modifiedAt?: string }> = {};
  try {
    onProgress?.('Loading carrier status...');
    const v2Data = await listShipmentsV2({ start, end, pageSize: 200 });
    
    for (const s of v2Data.shipments as any[]) {
      const statusInfo = {
        status: s.shipment_status || 'unknown',
        shipmentId: s.shipment_id,
        modifiedAt: s.modified_at
      };
      if (s.shipment_number) v2StatusMap[s.shipment_number] = statusInfo;
      if (s.external_shipment_id) v2StatusMap[s.external_shipment_id] = statusInfo;
      if (s.external_shipment_id?.startsWith('S')) {
        v2StatusMap[s.external_shipment_id.substring(1)] = statusInfo;
      }
    }
  } catch (err) {
    console.warn('Could not fetch v2 shipments:', err);
  }

  // Build tracking status map from labels
  const trackingStatusMap: Record<string, { status: string; shipDate?: string; labelId?: string }> = {};
  try {
    onProgress?.('Loading delivery status...');
    const labelsData = await listLabelsV2({ start, end, pageSize: 100 });
    
    for (const label of labelsData.labels as any[]) {
      if (label.tracking_number && label.tracking_status) {
        trackingStatusMap[label.tracking_number] = {
          status: label.tracking_status,
          shipDate: label.ship_date,
          labelId: label.label_id
        };
      }
    }
  } catch (err) {
    console.warn('Could not fetch labels:', err);
  }

  // Enrich orders with tracking data
  const enrichedOrders = ordersResponse.orders.map(order => {
    const matchedShipments = shipmentsMap[order.orderId] || shipmentsMap[order.orderNumber] || [];
    const v2Status = v2StatusMap[order.orderNumber] || v2StatusMap[`S${order.orderNumber}`] || null;

    if (matchedShipments.length > 0) {
      order.shipments = matchedShipments.map((s: any) => {
        const labelTracking = trackingStatusMap[s.trackingNumber];
        return {
          shipmentId: s.shipmentId,
          carrierCode: s.carrierCode || '',
          trackingNumber: s.trackingNumber || '',
          shipDate: labelTracking?.shipDate || s.shipDate,
          serviceCode: s.serviceCode || '',
          voided: s.voided,
          shipmentCost: s.shipmentCost,
          shipmentStatus: v2Status?.status || null,
          modifiedAt: v2Status?.modifiedAt || null,
          carrierStatus: labelTracking?.status || null
        };
      });
    } else if (v2Status) {
      order._v2Status = v2Status;
    }

    return order;
  });

  return {
    orders: enrichedOrders,
    total: ordersResponse.total,
    page: ordersResponse.page,
    pages: ordersResponse.pages
  };
}

/**
 * Get orders from Firestore cache
 */
export async function getOrdersFromCache(params: {
  startDate: Date;
  endDate: Date;
}): Promise<FirestoreShipStationOrder[]> {
  if (!db) throw new Error('Firestore not initialized');
  
  const { startDate, endDate } = params;
  
  const ordersRef = collection(db, 'shipstation_orders');
  const q = query(
    ordersRef,
    where('orderDate', '>=', Timestamp.fromDate(startDate)),
    where('orderDate', '<=', Timestamp.fromDate(endDate)),
    orderBy('orderDate', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
    } as unknown as FirestoreShipStationOrder;
  });
}

/**
 * Get sync metadata
 */
export async function getSyncMeta(): Promise<ShipStationSyncMeta | null> {
  if (!db) return null;
  
  const metaRef = doc(db, 'shipstation_sync_meta', 'lastSync');
  const snapshot = await getDoc(metaRef);
  
  if (!snapshot.exists()) return null;
  return snapshot.data() as ShipStationSyncMeta;
}

/**
 * Trigger manual sync via API
 */
export async function triggerSync(): Promise<{ success: boolean; message: string }> {
  const response = await fetch('/api/shipstation/sync', {
    method: 'POST'
  });
  
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Sync failed: ${response.status} ${text}`);
  }
  
  return response.json();
}
