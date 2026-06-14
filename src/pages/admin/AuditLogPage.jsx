import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from 'lib/supabase';
import AppShell from 'components/layout/AppShell';
import { ClipboardIcon } from 'components/ui/Icons';
import { format } from 'date-fns';

const ACTION_COLORS = {
  approve_kyc: '#22c55e', reject_kyc: '#ef4444',
  approve_job: '#22c55e', reject_job: '#ef4444',
  approve_document: '#22c55e', reject_document: '#ef4444',
  release_escrow: '#22c55e', refund_payment: '#ef4444',
  approve_withdrawal: '#60a5fa', reject_withdrawal: '#ef4444',
  mark_withdrawal_processed: '#22c55e',
  suspend_user: '#ef4444', activate_user: '#22c55e',
  update_settings: '#f59e0b', feature_job: '#f59e0b',
};

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 30;

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit_logs', actionFilter, page],
    queryFn: async () => {
      let q = supabase.from('audit_logs')
        .select(`*, profiles!audit_logs_actor_id_fkey(first_name, last_name, role)`)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (actionFilter) q = q.eq('action', actionFilter);
      const { data } = await q;
      return data || [];
    },
  });

  const ACTIONS = [
    'approve_kyc', 'reject_kyc', 'approve_job', 'reject_job',
    'release_escrow', 'refund_payment', 'suspend_user', 'update_settings',
  ];

  return (
    <AppShell title="Audit Log">
      <div className="page">
        <div style={styles.pageTitle}>Audit Log</div>
        <div style={styles.pageSub}>Complete record of all admin actions on the platform</div>

        <div style={styles.filterRow}>
          <select style={styles.filterSelect} value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(0); }}>
            <option value="">All Actions</option>
            {ACTIONS.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner spinner-lg" /></div>
        ) : logs.length === 0 ? (
          <div className="empty-state">
            <ClipboardIcon size={36} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No audit logs yet</div>
            <div className="empty-sub">Admin actions will be logged here automatically</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map(log => {
              const color = ACTION_COLORS[log.action] || 'var(--text-2)';
              return (
                <div key={log.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                        {log.profiles?.first_name} {log.profiles?.last_name}
                      </span>
                      <span style={{ fontSize: 12, color, fontWeight: 500, background: `${color}15`, padding: '2px 8px', borderRadius: 20 }}>
                        {log.action?.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{log.entity_type}</span>
                    </div>
                    {log.new_value && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, fontFamily: 'monospace' }}>
                        {JSON.stringify(log.new_value).slice(0, 100)}
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, textAlign: 'right' }}>
                    <div>{format(new Date(log.created_at), 'MMM d')}</div>
                    <div>{format(new Date(log.created_at), 'HH:mm')}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={styles.pagination}>
          <button style={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {page + 1}</span>
          <button style={styles.pageBtn} disabled={logs.length < PAGE_SIZE} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      </div>
    </AppShell>
  );
}

const styles = {
  pageTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)', marginBottom: 20 },
  filterRow: { marginBottom: 20 },
  filterSelect: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', outline: 'none' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 24 },
  pageBtn: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
};
