'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function CreateStylePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to products page - this feature is not yet implemented
    router.push('/admin/products');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
}
