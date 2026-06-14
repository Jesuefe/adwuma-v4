import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { formatMoney } from '../../lib/currency';
import { format } from 'date-fns';
import { toast } from 'react-toastify';
import AppShell from '../../components/layout/AppShell';
import { DollarIcon, ArrowUpIcon, ClockIcon, CheckCircleIcon, AlertCircleIcon } from '../../components/ui/Icons';

export default function WalletPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [form, setForm] = useState({ bank_name: '', account_number: '', account_name: '', bank_code: '', amount: '' });

  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('agent_wallets').select('*').eq('agent_id', user.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Pending = payments in holding for this agent
  const { data: pendingPayments = [] } = useQuery({
    queryKey: ['pending_payments', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payments')
        .select('*, applications(jobs(title))')
        .eq('agent_id', user.id)
        .eq('escrow_status', 'holding')
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['wallet_transactions', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('wallet_transactions')
        .select('*').eq('agent_id', user.id)
        .order('created_at', { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  const { data: withdrawals = [] } = useQuery({
    queryKey: ['my_withdrawals', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('withdrawals')
        .select('*').eq('agent_id', user.id)
        .order('created_at', { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const withdrawMutation = useMutation({
    mutationFn: async (data) => {
      if (Number(data.amount) > (wallet?.balance || 0)) throw new Error('Insufficient balance');
      if (Number(data.amount) < 100) throw new Error('Minimum withdrawal is ₦100');
      const { error } = await supabase.from('withdrawals').insert({
        agent_id: user.id, ...data, amount: Number(data.amount), currency: 'NGN', status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Withdrawal request submitted — admin will process within 24 hours');
      setShowWithdraw(false);
      setForm({ bank_name: '', account_number: '', account_name: '', bank_code: '', amount: '' });
      queryClient.invalidateQueries(['my_withdrawals', user?.id]);
    },
    onError: (e) => toast.error(e.message),
  });

  const pendingTotal = pendingPayments.reduce((s, p) => s + (p.agent_payout_amount || 0), 0);
  const balance = wallet?.balance || 0;
  const isNegative = balance < 0;

  const TX_COLORS = {
    escrow_release: { color: 'var(--green)', label: 'Escrow Released', icon: '💰' },
    posting_fee: { color: 'var(--error)', label: 'Posting Fee', icon: '📋' },
    withdrawal: { color: 'var(--error)', label: 'Withdrawal', icon: '🏦' },
    penalty: { color: 'var(--error)', label: 'Late Penalty', icon: '⚠️' },
    refund: { color: 'var(--error)', label: 'Refund', icon: '↩️' },
  };

  const WITHDRAWAL_STATUS = {
    pending: { color: 'var(--gold)', label: 'Pending' },
    approved: { color: 'var(--brand)', label: 'Approved' },
    processed: { color: 'var(--green)', label: 'Processed ✓' },
    rejected: { color: 'var(--error)', label: 'Rejected' },
  };

  return (
    <AppShell title="Wallet">
      <div className="page">

        {/* Balance cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* Available balance */}
          <div style={{ background: isNegative ? 'rgba(239,68,68,0.08)' : 'var(--brand-dim)', border: `1px solid ${isNegative ? 'rgba(239,68,68,0.25)' : 'var(--brand-border)'}`, borderRadius: 'var(--radius-card)', padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontWeight: 500 }}>Available Balance</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: isNegative ? 'var(--error)' : 'var(--brand)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
              {isNegative ? '-' : ''}{formatMoney(Math.abs(balance), 'NGN')}
            </div>
            {isNegative && <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 6 }}>Debt recovered from next release</div>}
          </div>

          {/* Pending in escrow */}
          <div style={{ background: 'var(--green-dim)', border: '1px solid var(--green-border)', borderRadius: 'var(--radius-card)', padding: 20 }}>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8, fontWeight: 500 }}>🔒 Pending in Escrow</div>
            <div style={{ fontWeight: 800, fontSize: 26, color: 'var(--green)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.5px' }}>
              {formatMoney(pendingTotal, 'NGN')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>{pendingPayments.length} application{pendingPayments.length !== 1 ? 's' : ''} awaiting release</div>
          </div>
        </div>

        {/* Pending escrow details */}
        {pendingPayments.length > 0 && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={styles.sectionTitle}>🔒 Escrow Holdings</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>These payments are held in escrow. Admin releases them after verifying your work.</div>
            {pendingPayments.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.applications?.jobs?.title || 'Application'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                    {format(new Date(p.created_at), 'MMM d, yyyy')} · You receive {formatMoney(p.agent_payout_amount, p.currency)} after 10% platform fee
                  </div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {formatMoney(p.amount, p.currency)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Withdraw button */}
        {balance > 0 && (
          <button className="btn btn-brand btn-full" style={{ marginBottom: 20 }} onClick={() => setShowWithdraw(true)}>
            <ArrowUpIcon size={18} /> Withdraw Funds
          </button>
        )}

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="card" style={{ marginBottom: 20, borderColor: 'var(--brand-border)' }}>
            <div style={styles.sectionTitle}>Request Withdrawal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2">
                <div>
                  <label className="input-label">Bank Name *</label>
                  <input className="input" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="e.g. First Bank" />
                </div>
                <div>
                  <label className="input-label">Bank Code</label>
                  <input className="input" value={form.bank_code} onChange={e => setForm(f => ({ ...f, bank_code: e.target.value }))} placeholder="e.g. 011" />
                </div>
              </div>
              <div>
                <label className="input-label">Account Number *</label>
                <input className="input" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="10-digit account number" maxLength={10} inputMode="numeric" />
              </div>
              <div>
                <label className="input-label">Account Name *</label>
                <input className="input" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="Name on account" />
              </div>
              <div>
                <label className="input-label">Amount (NGN) *</label>
                <input className="input" type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Enter amount" inputMode="numeric" max={balance} />
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Available: {formatMoney(balance, 'NGN')}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setShowWithdraw(false)}>Cancel</button>
                <button className="btn btn-brand" style={{ flex: 1 }} onClick={() => withdrawMutation.mutate(form)} disabled={withdrawMutation.isPending || !form.bank_name || !form.account_number || !form.account_name || !form.amount}>
                  {withdrawMutation.isPending ? <span className="spinner spinner-sm" /> : null}
                  Submit Request
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Transaction history */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={styles.sectionTitle}>Transaction History</div>
          {transactions.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '24px 0' }}>No transactions yet</div>
          ) : transactions.map(tx => {
            const txInfo = TX_COLORS[tx.type] || { color: 'var(--text-2)', label: tx.type, icon: '•' };
            const isCredit = tx.type === 'escrow_release';
            return (
              <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: isCredit ? 'var(--green-dim)' : 'var(--error-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{txInfo.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{txInfo.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{tx.description || format(new Date(tx.created_at), 'MMM d, yyyy')}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: isCredit ? 'var(--green)' : 'var(--error)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {isCredit ? '+' : '-'}{formatMoney(Math.abs(tx.amount), tx.currency || 'NGN')}
                </div>
              </div>
            );
          })}
        </div>

        {/* Withdrawal history */}
        {withdrawals.length > 0 && (
          <div className="card">
            <div style={styles.sectionTitle}>Withdrawal Requests</div>
            {withdrawals.map(w => {
              const ws = WITHDRAWAL_STATUS[w.status] || WITHDRAWAL_STATUS.pending;
              return (
                <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{formatMoney(w.amount, w.currency || 'NGN')}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{w.bank_name} · {w.account_number} · {format(new Date(w.created_at), 'MMM d')}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: ws.color, background: `${ws.color}15`, padding: '3px 10px', borderRadius: 999 }}>{ws.label}</span>
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
  sectionTitle: { fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
};
