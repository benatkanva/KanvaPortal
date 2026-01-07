import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, get } from 'firebase/database';
import { SAIACustomer, SAIAShipment } from '@/types/saia';

export function useSAIACustomerDetail(customerKey: string | null) {
  const [customer, setCustomer] = useState<SAIACustomer | null>(null);
  const [shipments, setShipments] = useState<SAIAShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!customerKey) {
      setCustomer(null);
      setShipments([]);
      return;
    }

    setLoading(true);
    const database = getDatabase();
    const customerRef = ref(database, `shipping/saia/customers/${customerKey}`);

    const unsubscribe = onValue(
      customerRef,
      async (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            setCustomer({ id: customerKey, ...data });

            // Fetch all shipments for this customer
            const shipmentsRef = ref(database, 'shipping/saia/shipments');
            const shipmentsSnapshot = await get(shipmentsRef);
            const shipmentsData = shipmentsSnapshot.val();

            if (shipmentsData) {
              const customerShipments = Object.keys(shipmentsData)
                .map(key => shipmentsData[key])
                .filter(s => s.customerName === data.name)
                .sort((a, b) => new Date(b.pickupDate).getTime() - new Date(a.pickupDate).getTime());
              
              setShipments(customerShipments);
            }
          } else {
            setCustomer(null);
            setShipments([]);
          }
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load customer details');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [customerKey]);

  return { customer, shipments, loading, error };
}
