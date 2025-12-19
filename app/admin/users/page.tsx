'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';

type ApiUser = {
  id: string;
  email: string;
  name?: string;
  role?: string;
  passwordChanged?: boolean;
  photoUrl?: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'sales'|'manager'|'admin'>('sales');
  const [password, setPassword] = useState('');
  const [sendWelcome, setSendWelcome] = useState(true);
  const [creating, setCreating] = useState(false);

  const getToken = async () => auth.currentUser ? await auth.currentUser.getIdToken() : '';

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load users');
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => { if (!u) { setUsers([]); } else { loadUsers(); } });
    return () => unsub();
  }, []);

  const validateEmail = (em: string) => {
    const e = em.trim().toLowerCase();
    if (!e) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Invalid email format';
    const allowedDomains = ['@kanvabotanicals.com', '@cwlbrands.com'];
    const hasValidDomain = allowedDomains.some(domain => e.endsWith(domain));
    if (!hasValidDomain) return 'Email must be @kanvabotanicals.com or @cwlbrands.com';
    return null;
  };
  const validatePassword = (pw: string) => {
    if (pw.length < 8) return 'Password must be at least 8 characters';
    if (!/[0-9]/.test(pw)) return 'Include at least one number';
    if (!/[!@#$%^&*(),.?":{}|<>_\-\[\]\\/]/.test(pw)) return 'Include at least one special character';
    return null;
  };

  const createUser = async () => {
    setError(null);
    const eErr = validateEmail(email);
    if (eErr) return setError(eErr);
    const pErr = validatePassword(password);
    if (pErr) return setError(pErr);

    setCreating(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password, name, role, sendWelcome }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to create user');
      setEmail(''); setPassword(''); setName(''); setRole('sales'); setSendWelcome(true);
      await loadUsers();
    } catch (e: any) {
      setError(e.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const updateUser = async (u: ApiUser, patch: Partial<ApiUser>) => {
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to update user');
      await loadUsers();
    } catch (e: any) {
      setError(e.message || 'Failed to update user');
    }
  };

  const deleteUser = async (u: ApiUser) => {
    setError(null);
    try {
      const token = await getToken();
      const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to delete user');
      await loadUsers();
    } catch (e: any) {
      setError(e.message || 'Failed to delete user');
    } finally {
      setPendingDeleteId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">User Management</h1>
      {error && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</div>}

      <section className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="text-lg font-medium mb-2">Add User</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block">
            <span className="text-sm text-gray-600">Email</span>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="name@kanvabotanicals.com" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">Name</span>
            <input value={name} onChange={(e)=>setName(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="Name" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">Temporary Password</span>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="mt-1 w-full border rounded-md px-3 py-2" placeholder="Temp password" />
          </label>
          <label className="block">
            <span className="text-sm text-gray-600">Role</span>
            <select value={role} onChange={(e)=>setRole(e.target.value as any)} className="mt-1 w-full border rounded-md px-3 py-2">
              <option value="sales">Sales</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </label>
        </div>
        <label className="inline-flex items-center gap-2 mt-3 text-sm text-gray-700">
          <input type="checkbox" checked={sendWelcome} onChange={(e)=>setSendWelcome(e.target.checked)} />
          Send welcome email
        </label>
        <div className="mt-4">
          <button onClick={createUser} disabled={creating} className={`px-4 py-2 rounded-lg text-white ${creating ? 'bg-gray-400' : 'bg-kanva-green hover:bg-green-600'}`}>{creating ? 'Creating…' : 'Create User'}</button>
        </div>
      </section>

      <section className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">All Users</h2>
          <button onClick={loadUsers} disabled={loading} className="px-3 py-1.5 rounded-lg bg-gray-100 text-sm">Refresh</button>
        </div>
        {loading ? (
          <div className="text-sm text-gray-600">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Email</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Role</th>
                  <th className="py-2 pr-3">First Login?</th>
                  <th className="py-2 pr-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <img 
                          src={u.photoUrl || '/app_logo.png'} 
                          alt={u.name || u.email}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).src = '/app_logo.png'; }}
                        />
                      </div>
                    </td>
                    <td className="py-2 pr-3">{u.email}</td>
                    <td className="py-2 pr-3">
                      <input defaultValue={u.name || ''} onBlur={(e)=>{ const v = e.target.value; if (v !== (u.name||'')) updateUser(u, { name: v }); }} className="border rounded px-2 py-1 w-full" />
                    </td>
                    <td className="py-2 pr-3">
                      <select defaultValue={u.role || 'sales'} onChange={(e)=> updateUser(u, { role: e.target.value })} className="border rounded px-2 py-1">
                        <option value="sales">Sales</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-2 pr-3">{u.passwordChanged === false ? 'Yes (pending change)' : 'No'}</td>
                    <td className="py-2 pr-3 text-right">
                      {pendingDeleteId === u.id ? (
                        <div className="inline-flex items-center gap-2">
                          <button onClick={()=>deleteUser(u)} className="px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 text-xs">Confirm</button>
                          <button onClick={()=>setPendingDeleteId(null)} className="px-3 py-1.5 rounded bg-gray-100 text-xs">Cancel</button>
                        </div>
                      ) : (
                        <button onClick={()=>setPendingDeleteId(u.id)} className="px-3 py-1.5 rounded bg-red-50 text-red-700 hover:bg-red-100 text-xs">Delete</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
