import { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';
import { SAIACustomer } from '@/types/saia';

export function useSAIACustomers() {
  const [customers, setCustomers] = useState<SAIACustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const database = getDatabase();
    const customersRef = ref(database, 'shipping/saia/customers');

    const unsubscribe = onValue(
      customersRef,
      (snapshot) => {
        try {
          const data = snapshot.val();
          if (data) {
            const customersArray = Object.keys(data).map(key => ({
              id: key,
              ...data[key]
            }));
            setCustomers(customersArray);
          } else {
            setCustomers([]);
          }
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to load customers');
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
  }, []);

  const refetch = () => {
    setLoading(true);
    setError(null);
  };

  return { customers, loading, error, refetch };
}
