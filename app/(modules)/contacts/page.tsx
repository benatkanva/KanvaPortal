'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ColumnDef } from '@tanstack/react-table';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useContacts, useRefreshCRMData } from '@/lib/crm/hooks';
import { DataTable } from '@/components/crm/DataTable';
import type { UnifiedContact } from '@/lib/crm/dataService';
import { 
  Plus,
  RefreshCw,
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  Briefcase,
} from 'lucide-react';

export default function ContactsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { data: contacts = [], isLoading, isFetching } = useContacts();
  const { refreshContacts } = useRefreshCRMData();

  // Define table columns
  const columns = useMemo<ColumnDef<UnifiedContact, any>[]>(
    () => [
      {
        id: 'name',
        accessorFn: (row) => `${row.firstName || ''} ${row.lastName || ''}`.trim(),
        header: 'Name',
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <span className="font-medium text-gray-900">
              {row.original.firstName} {row.original.lastName}
            </span>
          </div>
        ),
      },
      {
        id: 'title',
        accessorKey: 'title',
        header: 'Title',
        cell: ({ getValue }) => (
          <div className="flex items-center gap-1 text-gray-600">
            <Briefcase className="w-3.5 h-3.5 text-gray-400" />
            {getValue() || '-'}
          </div>
        ),
      },
      {
        id: 'accountName',
        accessorKey: 'accountName',
        header: 'Account',
        cell: ({ row }) => {
          const account = row.original.accountName;
          const accountId = row.original.accountId;
          return account ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (accountId) router.push(`/accounts/${accountId}`);
              }}
              className="flex items-center gap-1 text-gray-700 hover:text-[#93D500]"
            >
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              {account}
            </button>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: 'Source',
        cell: ({ getValue }) => {
          const source = getValue() as string;
          const colors: Record<string, string> = {
            copper_person: 'bg-orange-100 text-orange-700',
            manual: 'bg-gray-100 text-gray-600',
          };
          return (
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[source] || 'bg-gray-100'}`}>
              {source === 'copper_person' ? 'Copper' : source}
            </span>
          );
        },
      },
      {
        id: 'phone',
        accessorKey: 'phone',
        header: 'Phone',
        cell: ({ getValue }) => {
          const phone = getValue() as string;
          return phone ? (
            <a href={`tel:${phone}`} className="flex items-center gap-1 text-gray-600 hover:text-[#93D500]">
              <Phone className="w-3.5 h-3.5" />
              {phone}
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'email',
        accessorKey: 'email',
        header: 'Email',
        cell: ({ getValue }) => {
          const email = getValue() as string;
          return email ? (
            <a href={`mailto:${email}`} className="flex items-center gap-1 text-gray-600 hover:text-[#93D500] truncate max-w-[200px]">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{email}</span>
            </a>
          ) : <span className="text-gray-400">-</span>;
        },
      },
      {
        id: 'location',
        accessorFn: (row) => `${row.city || ''} ${row.state || ''}`.trim(),
        header: 'Location',
        cell: ({ row }) => {
          const city = row.original.city;
          const state = row.original.state;
          return city || state ? (
            <div className="flex items-center gap-1 text-gray-600">
              <MapPin className="w-3.5 h-3.5" />
              {city && `${city}, `}{state}
            </div>
          ) : <span className="text-gray-400">-</span>;
        },
      },
    ],
    [router]
  );

  // Handle row click - navigate to contact detail
  const handleRowClick = (contact: UnifiedContact) => {
    router.push(`/contacts/${contact.id}`);
  };

  // Auth check
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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your contacts from Copper and manual entries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refreshContacts()}
            disabled={isFetching}
            className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => router.push('/contacts/new')}
            className="px-4 py-2 bg-[#93D500] text-white rounded-lg hover:bg-[#84c000] flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Contact
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">Total Contacts</div>
          <div className="text-2xl font-bold text-gray-900">{contacts.length.toLocaleString()}</div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">From Copper</div>
          <div className="text-2xl font-bold text-orange-600">
            {contacts.filter(c => c.source === 'copper_person').length.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="text-sm text-gray-500">With Accounts</div>
          <div className="text-2xl font-bold text-green-600">
            {contacts.filter(c => c.accountId).length.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={contacts}
        columns={columns}
        loading={isLoading}
        onRowClick={handleRowClick}
        tableId="contacts"
        searchPlaceholder="Search contacts by name, email, phone, account..."
        pageSize={50}
      />
    </div>
  );
}
