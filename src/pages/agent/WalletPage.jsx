import React, { useState } from 'react';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { useWallet, useWalletTransactions } from 'hooks';
import { supabase } from '../../lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { formatMoney } from '../../lib/currency';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { ArrowUpIcon, ArrowDownIcon, WalletIcon, AlertCircleIcon } from '../../components/ui/Icons';

const CURRENCIES = ['NGN', 'GHS'];

export default function WalletPage() {
  const { user } = useAuth();
  const [currency, setCurrency] = useState('NGN');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const { data: wallet, isLoading: walletLoading } = useWallet(currency);
  const { data: txns = [], isLoading: txLoading } = useWalletTransactions(currency);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ amount: '', bankName: '', accountNumber: '', accountName: '', bankCode: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.bankName || !form.accountNumber || !form.accountName) {
      toast.error('Fill in all required fields'); return;
    }
    if (Number(form.amount) > (wallet?.balance || 0)) {
      toast.error('Amount exceeds available balance'); return;
    }
    if (Number(form.amount) < 1000) {
      toast.error('Minimum withdrawal is ₦1,000'); return;
    }
    setSubmitting(true);
    try {
      await supabase.from('withdrawals').insert({
        agent_id: user.id, amount: Number(form.amount), currency,
        bank_name: form.bankName, account_number: form.accountNumber,
        account_name: form.accountName, bank_code: form.bankCode || null,
      });
      toast.success('Withdrawal request submitted! Admin will process within 2–3 business days.');
      setShowWithdraw(false);
      setForm({ amount: '', bankName: '', accountNumber: '', accountName: '', bankCode: '' });
      queryClient.invalidateQueries(['wallet', user.id, currency]);
    } catch (err) { toast.error(err.message); }
    setSubmitting(false);
  };

  return (
    <AppShell title="Wallet">
      <div className="page" style={{ maxWidth: 600, margin: '0 auto' }}>

        {/* Currency tabs */}
        <div style={styles.currencyTabs}>
          {CURRENCIES.map(c => (
            <button key={c} style={{ ...styles.currencyTab, ...(currency === c ? styles.currencyTabActive : {}) }} onClick={() => setCurrency(c)}>{c}</button>
          ))}
        </div>

        {/* Balance card */}
        <div className="card-gold" style={styles.balanceCard}>
          <WalletIcon size={20} style={{ color: 'var(--gold)', marginBottom: 8 }} />
          <div style={styles.balanceLabel}>Available Balance</div>
          {walletLoading ? (
            <div className="spinner" style={{ margin: '12px 0' }} />
          ) : (
            <div style={{ ...styles.balanceAmount, color: (wallet?.balance || 0) < 0 ? 'var(--error)' : 'var(--gold-text)' }}>
              {formatMoney(wallet?.balance || 0, currency)}
            </div>
          )}
          {(wallet?.balance || 0) < 0 && (
            <div style={styles.negativeNote}>
              <AlertCircleIcon size={13} /> Negative balance will be recovered from your next payment
            </div>
          )}
          <button
            style={{ ...styles.withdrawBtn, opacity: (wallet?.balance || 0) <= 0 ? 0.5 : 1 }}
            disabled={(wallet?.balance || 0) <= 0}
            onClick={() => setShowWithdraw(true)}
          >
            Withdraw Funds
          </button>
        </div>

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="card" style={{ marginBottom: 20 }}>
            <div style={styles.sectionTitle}>Withdrawal Request</div>
            <form onSubmit={handleWithdraw} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="input-label">Amount ({currency}) *</label>
                <input className="input" type="number" min="1000" max={wallet?.balance}
                  value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder="e.g. 50000" inputMode="numeric" />
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>Min: {formatMoney(1000, currency)} · Max: {formatMoney(wallet?.balance || 0, currency)}</div>
              </div>
              <div>
                <label className="input-label">Bank Name *</label>
                <input className="input" value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. Access Bank" />
              </div>
              <div className="grid-2">
                <div>
                  <label className="input-label">Account Number *</label>
                  <input className="input" value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="0123456789" inputMode="numeric" maxLength={10} />
                </div>
                <div>
                  <label className="input-label">Bank Code</label>
                  <input className="input" value={form.bankCode} onChange={e => setForm(f => ({ ...f, bankCode: e.target.value }))} placeholder="044" />
                </div>
              </div>
              <div>
                <label className="input-label">Account Name *</label>
                <input className="input" value={form.accountName} onChange={e => setForm(f => ({ ...f, accountName: e.target.value }))} placeholder="John Doe" />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-outline btn-full" onClick={() => setShowWithdraw(false)}>Cancel</button>
                <button type="submit" className="btn btn-gold btn-full" disabled={submitting}>
                  {submitting ? <span className="spinner spinner-sm" /> : null}
                  {submitting ? 'Submitting…' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Transactions */}
        <div style={styles.sectionTitle}>Transaction History</div>
        {txLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>
        ) : txns.length === 0 ? (
          <div className="empty-state">
            <WalletIcon size={36} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No transactions yet</div>
            <div className="empty-sub">Transactions will appear here when escrow is released to your wallet</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {txns.map(tx => (
              <div key={tx.id} style={styles.txRow}>
                <div style={{ ...styles.txIcon, background: tx.type === 'credit' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.08)', color: tx.type === 'credit' ? '#22c55e' : '#ef4444' }}>
                  {tx.type === 'credit' ? <ArrowDownIcon size={16} /> : <ArrowUpIcon size={16} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.txDesc}>{tx.description}</div>
                  <div style={styles.txTime}>{format(new Date(tx.created_at), 'MMM d, yyyy · HH:mm')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ ...styles.txAmount, color: tx.type === 'credit' ? '#22c55e' : '#ef4444' }}>
                    {tx.type === 'credit' ? '+' : '-'}{formatMoney(tx.amount, tx.currency)}
                  </div>
                  <div style={styles.txBalance}>Bal: {formatMoney(tx.balance_after, tx.currency)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  currencyTabs: { display: 'flex', gap: 8, marginBottom: 20 },
  currencyTab: { padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'none', color: 'var(--text-2)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  currencyTabActive: { background: 'var(--gold-dim)', borderColor: 'var(--gold-border)', color: 'var(--gold-text)' },
  balanceCard: { marginBottom: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '32px 24px' },
  balanceLabel: { fontSize: 13, color: 'var(--text-2)', marginBottom: 8 },
  balanceAmount: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 40, letterSpacing: '-1px', marginBottom: 8 },
  negativeNote: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--error)', marginBottom: 12 },
  withdrawBtn: { background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: 15, border: 'none', borderRadius: 10, padding: '12px 32px', cursor: 'pointer', marginTop: 12, fontFamily: 'Inter, sans-serif' },
  sectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 14 },
  txRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' },
  txIcon: { width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  txDesc: { fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 2 },
  txTime: { fontSize: 11, color: 'var(--text-3)' },
  txAmount: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  txBalance: { fontSize: 11, color: 'var(--text-3)' },
};
