'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  ArrowLeft, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Calendar,
  MapPin,
  Phone,
  Mail,
  Globe,
  Package,
  BarChart3,
  Clock
} from 'lucide-react';
import { format } from 'date-fns';

interface CustomerProfile {
  customerId: string;
  customerName: string;
  accountType: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  shippingAddress: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  region: string | null;
  regionColor: string;
  totalSales: number;
  totalSalesYTD: number;
  orderCount: number;
  orderCountYTD: number;
  avgOrderValue: number;
  sales_30d: number;
  sales_90d: number;
  sales_12m: number;
  orders_30d: number;
  orders_90d: number;
  orders_12m: number;
  velocity: number;
  trend: number;
  daysSinceLastOrder: number | null;
  monthlySales: Array<{ month: string; sales: number }>;
  firstOrderDate: string | null;
  lastOrderDate: string | null;
  lastOrderAmount: number;
  recentOrders: any[];
  skuMix: Array<{
    sku: string;
    productName: string;
    quantity: number;
    revenue: number;
    orderCount: number;
  }>;
  topProduct: any;
  salesPerson: string | null;
  salesPersonName: string | null;
}

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && params.id) {
      loadCustomer();
    }
  }, [user, params.id]);

  const loadCustomer = async () => {
    try {
      const token = await user?.getIdToken();
      const response = await fetch(`/api/customers/${params.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to load customer');

      const data = await response.json();
      setCustomer(data.customer);
    } catch (error) {
      console.error('Error loading customer:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-kanva-green"></div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Customer Not Found</h2>
          <button
            onClick={() => router.push('/customers')}
            className="text-kanva-green hover:underline"
          >
            Back to Customers
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/customers')}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{customer.customerName}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  customer.accountType === 'Wholesale' ? 'bg-blue-100 text-blue-800' :
                  customer.accountType === 'Distributor' ? 'bg-purple-100 text-purple-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {customer.accountType}
                </span>
                {customer.region && (
                  <span 
                    className="px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ backgroundColor: customer.regionColor }}
                  >
                    {customer.region}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Lifetime Value */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Lifetime Value</span>
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(customer.totalSales)}</p>
            <p className="text-sm text-gray-500 mt-1">
              YTD: {formatCurrency(customer.totalSalesYTD)}
            </p>
          </div>

          {/* Total Orders */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Orders</span>
              <ShoppingCart className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{customer.orderCount}</p>
            <p className="text-sm text-gray-500 mt-1">
              YTD: {customer.orderCountYTD}
            </p>
          </div>

          {/* Average Order Value */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Avg Order Value</span>
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(customer.avgOrderValue)}</p>
            <p className="text-sm text-gray-500 mt-1">
              Last: {formatCurrency(customer.lastOrderAmount)}
            </p>
          </div>

          {/* Velocity */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Velocity</span>
              <Clock className="w-5 h-5 text-orange-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{customer.velocity.toFixed(1)}</p>
            <p className="text-sm text-gray-500 mt-1">orders/month</p>
          </div>
        </div>

        {/* Trend & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Ordering Trend */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              {customer.trend >= 0 ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
              Ordering Trend
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">Last 90 Days</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {formatCurrency(customer.sales_90d)}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {customer.orders_90d} orders
                </div>
              </div>
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                customer.trend >= 0 ? 'bg-green-50' : 'bg-red-50'
              }`}>
                {customer.trend >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600" />
                )}
                <span className={`font-semibold ${
                  customer.trend >= 0 ? 'text-green-700' : 'text-red-700'
                }`}>
                  {customer.trend >= 0 ? '+' : ''}{customer.trend.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-600">vs previous 90 days</span>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-kanva-green" />
              Recent Activity
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Last Order</span>
                <span className="font-medium text-gray-900">
                  {customer.lastOrderDate ? format(new Date(customer.lastOrderDate), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Days Since Last Order</span>
                <span className={`font-medium ${
                  customer.daysSinceLastOrder && customer.daysSinceLastOrder > 90 
                    ? 'text-red-600' 
                    : 'text-gray-900'
                }`}>
                  {customer.daysSinceLastOrder || 'N/A'} days
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">First Order</span>
                <span className="font-medium text-gray-900">
                  {customer.firstOrderDate ? format(new Date(customer.firstOrderDate), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
              <div className="pt-3 border-t">
                <div className="text-sm text-gray-600 mb-2">Last 30 Days</div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{customer.orders_30d} orders</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(customer.sales_30d)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Contact & Location */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-3">
              {customer.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-5 h-5 text-gray-400" />
                  <a href={`mailto:${customer.email}`} className="text-kanva-green hover:underline">
                    {customer.email}
                  </a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-gray-400" />
                  <a href={`tel:${customer.phone}`} className="text-kanva-green hover:underline">
                    {customer.phone}
                  </a>
                </div>
              )}
              {customer.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-5 h-5 text-gray-400" />
                  <a href={customer.website} target="_blank" rel="noopener noreferrer" className="text-kanva-green hover:underline">
                    {customer.website}
                  </a>
                </div>
              )}
              {customer.salesPersonName && (
                <div className="pt-3 border-t">
                  <div className="text-sm text-gray-600 mb-1">Sales Rep</div>
                  <div className="font-medium text-gray-900">{customer.salesPersonName}</div>
                </div>
              )}
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-kanva-green" />
              Shipping Address
            </h2>
            <div className="text-gray-700">
              {customer.shippingAddress && <div>{customer.shippingAddress}</div>}
              {(customer.shippingCity || customer.shippingState || customer.shippingZip) && (
                <div>
                  {customer.shippingCity}{customer.shippingCity && ', '}
                  {customer.shippingState} {customer.shippingZip}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Products (SKU Mix) */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-kanva-green" />
            Top Products
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">SKU</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Quantity</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.skuMix.slice(0, 10).map((product, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{product.productName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{product.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{product.quantity}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(product.revenue)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">{product.orderCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-kanva-green" />
            Recent Orders
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order #</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customer.recentOrders.slice(0, 20).map((order, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{order.orderNum}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {order.postingDate ? format(new Date(order.postingDate), 'MMM d, yyyy') : 'N/A'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                      {formatCurrency(order.revenue || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{order.status || 'Completed'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
