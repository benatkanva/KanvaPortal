'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useAccount, useAccountContacts, useAccountOrders, useAccountSales } from '@/lib/crm/hooks';
import { 
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  DollarSign,
  ShoppingCart,
  Calendar,
  User,
  FileText,
  Package,
  TrendingUp,
  Edit,
  ExternalLink,
  Users,
  Briefcase,
} from 'lucide-react';

export default function AccountDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const accountId = params.id as string;
  
  const account = useAccount(accountId);
  const contacts = useAccountContacts(accountId);
  const { data: orders = [], isLoading: loadingOrders } = useAccountOrders(accountId);
  const { data: salesSummary, isLoading: loadingSales } = useAccountSales(accountId);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#93D500]"></div>
      </div>
    );
  }

  if (!user) {
    router.push('/login');
    return null;
  }

  if (!account) {
    return (
      <div className="p-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Accounts
        </button>
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Account Not Found</h2>
          <p className="text-gray-500 mt-2">This account may have been deleted or does not exist.</p>
        </div>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-600',
    prospect: 'bg-blue-100 text-blue-700',
    churned: 'bg-red-100 text-red-700',
  };

  const sourceColors: Record<string, string> = {
    fishbowl: 'bg-purple-100 text-purple-700',
    copper: 'bg-orange-100 text-orange-700',
    manual: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{account.name}</h1>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[account.status] || 'bg-gray-100'}`}>
                {account.status}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${sourceColors[account.source] || 'bg-gray-100'}`}>
                {account.source}
              </span>
            </div>
            {account.accountNumber && (
              <p className="text-sm text-gray-500 mt-1">Account #{account.accountNumber}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => router.push(`/accounts/${accountId}/edit`)}
          className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
        >
          <Edit className="w-4 h-4" />
          Edit Account
        </button>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left Column - Account Info */}
        <div className="col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-[#93D500]" />
              Contact Information
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {account.phone && (
                <a href={`tel:${account.phone}`} className="flex items-center gap-2 text-gray-700 hover:text-[#93D500]">
                  <Phone className="w-4 h-4 text-gray-400" />
                  {account.phone}
                </a>
              )}
              {account.email && (
                <a href={`mailto:${account.email}`} className="flex items-center gap-2 text-gray-700 hover:text-[#93D500]">
                  <Mail className="w-4 h-4 text-gray-400" />
                  {account.email}
                </a>
              )}
              {account.website && (
                <a href={account.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-700 hover:text-[#93D500]">
                  <Globe className="w-4 h-4 text-gray-400" />
                  {account.website.replace(/^https?:\/\//, '')}
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {(account.shippingCity || account.shippingState) && (
                <div className="flex items-center gap-2 text-gray-700">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {account.shippingStreet && <span>{account.shippingStreet}, </span>}
                  {account.shippingCity && <span>{account.shippingCity}, </span>}
                  {account.shippingState} {account.shippingZip}
                </div>
              )}
            </div>
          </div>

          {/* Account Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#93D500]" />
              Account Details
            </h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Region</span>
                <p className="font-medium text-gray-900">{account.region || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Segment</span>
                <p className="font-medium text-gray-900">{account.segment || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Priority</span>
                <p className="font-medium text-gray-900">{account.customerPriority ? `P${account.customerPriority}` : '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Account Type</span>
                <p className="font-medium text-gray-900">{account.accountType?.join(', ') || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Business Model</span>
                <p className="font-medium text-gray-900">{account.businessModel || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Organization Level</span>
                <p className="font-medium text-gray-900">{account.organizationLevel || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Payment Terms</span>
                <p className="font-medium text-gray-900">{account.paymentTerms || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Shipping Terms</span>
                <p className="font-medium text-gray-900">{account.shippingTerms || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Carrier</span>
                <p className="font-medium text-gray-900">{account.carrierName || '-'}</p>
              </div>
              <div>
                <span className="text-gray-500">Sales Rep</span>
                <p className="font-medium text-gray-900">{account.salesPerson || '-'}</p>
              </div>
            </div>
          </div>

          {/* Associated Contacts */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-[#93D500]" />
                Associated Contacts ({contacts.length})
              </h2>
              <button className="text-sm text-[#93D500] hover:underline">
                Add Contact
              </button>
            </div>
            {contacts.length === 0 ? (
              <p className="text-gray-500 text-sm">No contacts associated with this account.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    onClick={() => router.push(`/contacts/${contact.id}`)}
                    className="py-3 flex items-center justify-between cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {contact.firstName} {contact.lastName}
                        </p>
                        {contact.title && (
                          <p className="text-sm text-gray-500">{contact.title}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {contact.email || contact.phone}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Order History */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-[#93D500]" />
              Order History
            </h2>
            {loadingOrders ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#93D500]"></div>
              </div>
            ) : orders.length === 0 ? (
              <p className="text-gray-500 text-sm">No orders found for this account.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Order #</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Date</th>
                      <th className="text-left py-2 text-sm font-medium text-gray-500">Status</th>
                      <th className="text-right py-2 text-sm font-medium text-gray-500">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.slice(0, 10).map((order) => (
                      <tr key={order.orderId} className="hover:bg-gray-50">
                        <td className="py-2 text-sm font-mono text-gray-700">{order.orderNumber}</td>
                        <td className="py-2 text-sm text-gray-600">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </td>
                        <td className="py-2">
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                            {order.status}
                          </span>
                        </td>
                        <td className="py-2 text-sm text-right font-medium text-gray-900">
                          ${order.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {orders.length > 10 && (
                  <p className="text-center text-sm text-gray-500 mt-4">
                    Showing 10 of {orders.length} orders
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Stats & Quick Actions */}
        <div className="space-y-6">
          {/* Sales Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#93D500]" />
              Sales Summary
            </h2>
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">Total Revenue</span>
                <p className="text-2xl font-bold text-gray-900 flex items-center">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  {(account.totalSpent || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Total Orders</span>
                <p className="text-2xl font-bold text-gray-900">
                  {account.totalOrders || 0}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Avg Order Value</span>
                <p className="text-2xl font-bold text-gray-900 flex items-center">
                  <DollarSign className="w-5 h-5 text-gray-400" />
                  {account.totalOrders && account.totalSpent
                    ? (account.totalSpent / account.totalOrders).toLocaleString(undefined, { minimumFractionDigits: 2 })
                    : '0.00'}
                </p>
              </div>
              {account.firstOrderDate && (
                <div>
                  <span className="text-sm text-gray-500">First Order</span>
                  <p className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(account.firstOrderDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {account.lastOrderDate && (
                <div>
                  <span className="text-sm text-gray-500">Last Order</span>
                  <p className="text-lg font-medium text-gray-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    {new Date(account.lastOrderDate).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {account.phone && (
                <a
                  href={`tel:${account.phone}`}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700"
                >
                  <Phone className="w-4 h-4 text-[#93D500]" />
                  Call Account
                </a>
              )}
              {account.email && (
                <a
                  href={`mailto:${account.email}`}
                  className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700"
                >
                  <Mail className="w-4 h-4 text-[#93D500]" />
                  Send Email
                </a>
              )}
              <button className="w-full flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700">
                <Briefcase className="w-4 h-4 text-[#93D500]" />
                Create Deal
              </button>
              <button className="w-full flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 text-gray-700">
                <Package className="w-4 h-4 text-[#93D500]" />
                Create Quote
              </button>
            </div>
          </div>

          {/* Notes */}
          {account.notes && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{account.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
