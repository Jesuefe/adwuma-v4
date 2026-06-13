import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { UsersIcon, SearchIcon, ShieldIcon, AlertCircleIcon } from '../../components/ui/Icons';

const ROLE_STYLES = {
  seeker: { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa'  },
  agent:  { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b'  },
  admin:  { bg: 'rgba(167,139,250,0.1)', color: '#a78bfa'  },
};

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin_users', roleFilter, statusFilter],
    queryFn: async () => {
      let q = supabase.from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (roleFilter !== 'all') q = q.eq('role', roleFilter);
      if (statusFilter === 'active') q = q.eq('is_suspended', false);
      if (statusFilter === 'suspended') q = q.eq('is_suspended', true);
      const { data } = await q;
      return data || [];
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: async (user) => {
      if (user.role === 'admin') throw new Error('Admin accounts cannot be suspended here. Edit the database directly.');
      await supabase.from('profiles').update({ is_suspended: !user.is_suspended }).eq('id', user.id);
    },
    onSuccess: (_, user) => {
      toast.success(`User ${user.is_suspended ? 'activated' : 'suspended'}`);
      queryClient.invalidateQueries(['admin_users']);
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.first_name?.toLowerCase().includes(q) ||
      u.last_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    );
  });

  const ROLES = ['all', 'seeker', 'agent', 'admin'];
  const STATUSES = ['all', 'active', 'suspended'];

  return (
    <AppShell title="Users">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>User Management</div>
          <div style={styles.pageSub}>Search, filter and manage all platform users</div>
        </div>

        {/* Stats row */}
        <div className="grid-4" style={{ marginBottom: 20 }}>
          {[
            { label: 'Total', value: users.length, color: 'var(--text-2)' },
            { label: 'Seekers', value: users.filter(u => u.role === 'seeker').length, color: '#60a5fa' },
            { label: 'Agents', value: users.filter(u => u.role === 'agent').length, color: 'var(--gold)' },
            { label: 'Suspended', value: users.filter(u => u.is_suspended).length, color: 'var(--error)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Syne, sans-serif', color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Search + filters */}
        <div style={styles.searchRow}>
          <div style={styles.searchWrap}>
            <SearchIcon size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input style={styles.searchInput} placeholder="Search by name or phone…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div style={styles.filterRow}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Role:</span>
            {ROLES.map(r => (
              <button key={r} style={{ ...styles.filterBtn, ...(roleFilter === r ? styles.filterBtnActive : {}) }} onClick={() => setRoleFilter(r)}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </button>
            ))}
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Status:</span>
            {STATUSES.map(s => (
              <button key={s} style={{ ...styles.filterBtn, ...(statusFilter === s ? styles.filterBtnActive : {}) }} onClick={() => setStatusFilter(s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <UsersIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No users found</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(user => {
              const rs = ROLE_STYLES[user.role] || ROLE_STYLES.seeker;
              return (
                <div key={user.id} style={{ ...styles.userRow, opacity: user.is_suspended ? 0.6 : 1 }}>
                  <div style={styles.userAvatar}>{user.first_name?.[0]}{user.last_name?.[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.userName}>{user.first_name} {user.last_name}</div>
                    <div style={styles.userMeta}>{user.phone || 'No phone'} · Joined {format(new Date(user.created_at), 'MMM d, yyyy')}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ ...styles.roleBadge, background: rs.bg, color: rs.color }}>{user.role}</span>
                    {user.is_suspended && <span style={styles.suspendedBadge}>Suspended</span>}
                    {user.role !== 'admin' && (
                      <button
                        style={{ ...styles.actionBtn, color: user.is_suspended ? '#22c55e' : 'var(--error)', borderColor: user.is_suspended ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}
                        onClick={() => toggleSuspend.mutate(user)}
                      >
                        {user.is_suspended ? 'Activate' : 'Suspend'}
                      </button>
                    )}
                    {user.role === 'admin' && (
                      <span style={styles.adminNote}><ShieldIcon size={12} /> Admin</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  searchRow: { marginBottom: 12 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '0 14px' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: 'var(--text-1)', padding: '12px 0', fontFamily: 'Inter, sans-serif' },
  filterRow: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 },
  filterGroup: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  filterLabel: { fontSize: 12, color: 'var(--text-3)', flexShrink: 0 },
  filterBtn: { padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  filterBtnActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  userRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' },
  userAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  userName: { fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  userMeta: { fontSize: 11, color: 'var(--text-3)' },
  roleBadge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, textTransform: 'capitalize' },
  suspendedBadge: { fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: 'var(--error-dim)', color: 'var(--error)' },
  actionBtn: { fontSize: 12, fontWeight: 500, padding: '5px 12px', borderRadius: 6, border: '1px solid', background: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  adminNote: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#a78bfa' },
};
