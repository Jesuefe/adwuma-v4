import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { formatMoney } from '../../lib/currency';
import { WalletIcon, CheckCircleIcon, XIcon, AlertCircleIcon } from '../../components/ui/Icons';

function RejectModal({ withdrawal, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>Reject Withdrawal</div>
        <div style={styles.modalSub}>The amount will be returned to the agent's wallet. Provide a reason.</div>
        <textarea style={styles.textarea} rows={3} placeholder="e.g. Bank account details could not be verified." value={reason} onChange={e => setReason(e.target.value)} />
        <div style={styles.modalBtns}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" disabled={!reason.trim()} onClick={() => onConfirm(reason)}>Reject & Return Funds</button>
        </div>
      </div>
    </div>
  );
}

function WithdrawalCard({ w, onApprove, onProcess, onReject }) {
  const ST = {
    pending:   { bg: 'rgba(245,158,11,0.1)',  color: 'var(--brand)', label: 'Pending' },
    approved:  { bg: 'rgba(96,165,250,0.1)',   color: '#60a5fa', label: 'Approved' },
    processed: { bg: 'rgba(34,197,94,0.1)',    color: '#22c55e', label: 'Processed' },
    rejected:  { bg: 'rgba(239,68,68,0.08)',   color: '#ef4444', label: 'Rejected' },
  };
  const st = ST[w.status] || ST.pending;

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={{ flex: 1 }}>
          <div style={styles.agentName}>{w.profiles?.first_name} {w.profiles?.last_name}</div>
          <div style={styles.agentEmail}>{w.profiles?.email}</div>
          <div style={styles.requestDate}>{format(new Date(w.created_at), 'MMM d, yyyy · HH:mm')}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={styles.amount}>{formatMoney(w.amount, w.currency)}</div>
          <span style={{ ...styles.badge, background: st.bg, color: st.color }}>{st.label}</span>
        </div>
      </div>

      {/* Bank details */}
      <div style={styles.bankDetails}>
        <div style={styles.bankRow}>
          <span style={styles.bankLabel}>Bank</span>
          <span style={styles.bankValue}>{w.bank_name}</span>
        </div>
        <div style={styles.bankRow}>
          <span style={styles.bankLabel}>Account</span>
          <span style={styles.bankValue}>{w.account_number}</span>
        </div>
        <div style={styles.bankRow}>
          <span style={styles.bankLabel}>Name</span>
          <span style={styles.bankValue}>{w.account_name}</span>
        </div>
        {w.bank_code && (
          <div style={styles.bankRow}>
            <span style={styles.bankLabel}>Code</span>
            <span style={styles.bankValue}>{w.bank_code}</span>
          </div>
        )}
      </div>

      {w.status === 'pending' && (
        <div style={styles.cardActions}>
          <button className="btn btn-danger" style={{ flex: 1, fontSize: 13 }} onClick={() => onReject(w)}>
            <XIcon size={13} /> Reject
          </button>
          <button className="btn btn-gold" style={{ flex: 1, fontSize: 13 }} onClick={() => onApprove(w)}>
            <CheckCircleIcon size={13} /> Approve
          </button>
        </div>
      )}

      {w.status === 'approved' && (
        <div style={styles.cardActions}>
          <div style={styles.approvedNote}>
            <AlertCircleIcon size={13} style={{ flexShrink: 0 }} />
            Transfer the funds via bank or Paystack, then mark as processed.
          </div>
          <button className="btn btn-gold" style={{ fontSize: 13 }} onClick={() => onProcess(w)}>
            <CheckCircleIcon size={13} /> Mark Processed
          </button>
        </div>
      )}

      {w.status === 'rejected' && w.rejection_reason && (
        <div style={styles.rejectionNote}>
          <XIcon size={13} style={{ flexShrink: 0 }} />
          {w.rejection_reason}
        </div>
      )}
    </div>
  );
}

export default function WithdrawalsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('pending');
  const [rejectTarget, setRejectTarget] = useState(null);

  const { data: withdrawals = [], isLoading } = useQuery({
    queryKey: ['admin_withdrawals', filter],
    queryFn: async () => {
      let q = supabase.from('withdrawals')
        .select(`*, profiles!withdrawals_agent_id_fkey(first_name, last_name, email)`)
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      const { data } = await q;
      return data || [];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (w) => {
      await supabase.from('withdrawals').update({ status: 'approved' }).eq('id', w.id);
      await supabase.from('audit_logs').insert({ action: 'approve_withdrawal', entity_type: 'withdrawal', entity_id: w.id, new_value: { amount: w.amount, currency: w.currency } });
      await supabase.from('notifications').insert({ recipient_id: w.agent_id, type: 'withdrawal_approved', title: 'Withdrawal Approved', body: `Your withdrawal of ${formatMoney(w.amount, w.currency)} has been approved. Transfer in progress.`, link: '/agent/wallet' });
    },
    onSuccess: () => { toast.success('Withdrawal approved — now process the bank transfer'); queryClient.invalidateQueries(['admin_withdrawals']); },
    onError: (e) => toast.error(e.message),
  });

  const processMutation = useMutation({
    mutationFn: async (w) => {
      await supabase.from('withdrawals').update({ status: 'processed', processed_at: new Date().toISOString() }).eq('id', w.id);
      await supabase.from('notifications').insert({ recipient_id: w.agent_id, type: 'withdrawal_processed', title: 'Funds Sent!', body: `Your withdrawal of ${formatMoney(w.amount, w.currency)} has been processed and sent to ${w.bank_name} — ${w.account_number}.`, link: '/agent/wallet' });
    },
    onSuccess: () => { toast.success('Marked as processed — agent notified'); queryClient.invalidateQueries(['admin_withdrawals']); },
    onError: (e) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ w, reason }) => {
      // Return funds to wallet
      const { data: wallet } = await supabase.from('agent_wallets').select('balance').eq('agent_id', w.agent_id).eq('currency', w.currency).single();
      const newBalance = (wallet?.balance || 0) + Number(w.amount);
      await supabase.from('agent_wallets').update({ balance: newBalance }).eq('agent_id', w.agent_id).eq('currency', w.currency);
      await supabase.from('wallet_transactions').insert({ agent_id: w.agent_id, currency: w.currency, type: 'credit', amount: w.amount, description: 'Withdrawal rejected — funds returned', reference_id: w.id, balance_after: newBalance });
      await supabase.from('withdrawals').update({ status: 'rejected', rejection_reason: reason }).eq('id', w.id);
      await supabase.from('notifications').insert({ recipient_id: w.agent_id, type: 'withdrawal_rejected', title: 'Withdrawal Rejected', body: `Your withdrawal request was rejected. Reason: ${reason}. Funds have been returned to your wallet.`, link: '/agent/wallet' });
    },
    onSuccess: () => { toast.success('Rejected — funds returned to agent wallet'); setRejectTarget(null); queryClient.invalidateQueries(['admin_withdrawals']); },
    onError: (e) => toast.error(e.message),
  });

  const FILTERS = ['pending', 'approved', 'processed', 'rejected', 'all'];

  return (
    <AppShell title="Withdrawals">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>Withdrawal Requests</div>
          <div style={styles.pageSub}>Review and process agent withdrawal requests</div>
        </div>

        <div style={styles.filterTabs}>
          {FILTERS.map(f => (
            <button key={f} style={{ ...styles.filterTab, ...(filter === f ? styles.filterTabActive : {}) }} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : withdrawals.length === 0 ? (
          <div className="empty-state">
            <WalletIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No {filter} withdrawals</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {withdrawals.map(w => (
              <WithdrawalCard key={w.id} w={w}
                onApprove={(w) => approveMutation.mutate(w)}
                onProcess={(w) => processMutation.mutate(w)}
                onReject={(w) => setRejectTarget(w)}
              />
            ))}
          </div>
        )}

        {rejectTarget && (
          <RejectModal withdrawal={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={(reason) => rejectMutation.mutate({ w: rejectTarget, reason })} />
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  pageHeader: { marginBottom: 20 },
  pageTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 },
  pageSub: { fontSize: 13, color: 'var(--text-2)' },
  filterTabs: { display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' },
  filterTab: { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  filterTabActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  card: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  agentName: { fontSize: 15, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  agentEmail: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  requestDate: { fontSize: 11, color: 'var(--text-3)' },
  amount: { fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold-text)', marginBottom: 4 },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  bankDetails: { background: 'var(--bg-2)', borderRadius: 8, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 },
  bankRow: { display: 'flex', justifyContent: 'space-between', gap: 12 },
  bankLabel: { fontSize: 12, color: 'var(--text-3)', flexShrink: 0 },
  bankValue: { fontSize: 12, fontWeight: 500, color: 'var(--text-1)', textAlign: 'right' },
  cardActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  approvedNote: { display: 'flex', gap: 6, fontSize: 12, color: '#60a5fa', flex: 1, alignItems: 'center' },
  rejectionNote: { display: 'flex', gap: 8, fontSize: 12, color: 'var(--error)', background: 'var(--error-dim)', padding: '8px 12px', borderRadius: 6, alignItems: 'flex-start' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)' },
  modalSub: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginTop: -8 },
  textarea: { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: 12, fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif', resize: 'vertical' },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};
