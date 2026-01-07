import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, query, orderByChild } from 'firebase/database';
import { SAIAShipment } from '@/types/saia';

interface UseSAIAShipmentsOptions {
  customerName?: string;
  status?: string;
}

export function useSAIAShipments(options: UseSAIAShipmentsOptions = {}) {
  const [shipments, setShipments] = useState<SAIAShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const database = getDatabase();
    const shipmentsRef = ref(database, 'shipping/saia/shipments');

    const unsubscribe = onValue(
      shipmentsRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            let shipmentsArray = Object.keys(data).map(key => ({
              ...data[key]
            }));

            // Apply filters
            if (options.customerName) {
              shipmentsArray = shipmentsArray.filter(s => 
                s.customerName === options.customerName
              );
            }

            if (options.status) {
              shipmentsArray = shipmentsArray.filter(s => 
                s.status === options.status
              );
            }

            setShipments(shipmentsArray);
          } else {
            setShipments([]);
          }
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load shipments');
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
  }, [options.customerName, options.status]);

  const refetch = () => {
    setLoading(true);
    setError(null);
  };

  return { shipments, loading, error, refetch };
}
