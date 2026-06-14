import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import AppShell from '../../components/layout/AppShell';
import { formatMoney, calculateEscrowSplit } from '../../lib/currency';
import { CreditCardIcon, CheckCircleIcon, XIcon, AlertCircleIcon } from '../../components/ui/Icons';

function ConfirmModal({ title, body, confirmLabel, onClose, onConfirm, danger, requireTyping }) {
  const [typed, setTyped] = React.useState('');
  const canConfirm = !requireTyping || typed === requireTyping;
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.modalTitle}>{title}</div>
        <div style={styles.modalSub}>{body}</div>
        {requireTyping && (
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>
              Type <strong style={{ color: 'var(--gold)' }}>{requireTyping}</strong> to confirm:
            </div>
            <input
              style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' }}
              value={typed}
              onChange={e => setTyped(e.target.value.toUpperCase())}
              placeholder={requireTyping}
              autoFocus
            />
          </div>
        )}
        <div style={styles.modalBtns}>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className={danger ? 'btn btn-danger' : 'btn btn-gold'} onClick={onConfirm} disabled={!canConfirm} style={{ opacity: canConfirm ? 1 : 0.5 }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function PaymentCard({ payment, onRelease, onRefund }) {
  const { platformFee, agentPayout } = calculateEscrowSplit(payment.amount, payment.platform_fee_pct || 10);
  const ST = {
    holding:  { bg: 'rgba(96,165,250,0.1)',  color: '#60a5fa',  label: 'Holding' },
    released: { bg: 'rgba(34,197,94,0.1)',   color: '#22c55e',  label: 'Released' },
    refunded: { bg: 'rgba(239,68,68,0.08)',  color: '#ef4444',  label: 'Refunded' },
  };
  const st = ST[payment.escrow_status] || ST.holding;

  return (
    <div style={styles.card}>
      <div style={styles.cardTop}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.payJobTitle}>{payment.applications?.jobs?.title || 'Job Application'}</div>
          <div style={styles.payMeta}>
            Seeker: {payment.seeker?.first_name} {payment.seeker?.last_name} ·
            Agent: {payment.agent?.first_name} {payment.agent?.last_name}
          </div>
          <div style={styles.payDate}>{format(new Date(payment.created_at), 'MMM d, yyyy · HH:mm')}</div>
        </div>
        <span style={{ ...styles.badge, background: st.bg, color: st.color, flexShrink: 0 }}>{st.label}</span>
      </div>

      {/* Split breakdown */}
      <div style={styles.splitRow}>
        <div style={styles.splitItem}>
          <div style={styles.splitLabel}>Total Paid</div>
          <div style={styles.splitAmount}>{formatMoney(payment.amount, payment.currency)}</div>
        </div>
        <div style={styles.splitDivider} />
        <div style={styles.splitItem}>
          <div style={styles.splitLabel}>Platform (10%)</div>
          <div style={{ ...styles.splitAmount, color: 'var(--gold-text)' }}>{formatMoney(platformFee, payment.currency)}</div>
        </div>
        <div style={styles.splitDivider} />
        <div style={styles.splitItem}>
          <div style={styles.splitLabel}>Agent Payout</div>
          <div style={{ ...styles.splitAmount, color: '#22c55e' }}>{formatMoney(agentPayout, payment.currency)}</div>
        </div>
      </div>

      {payment.escrow_status === 'holding' && (
        <div style={styles.cardActions}>
          <button className="btn btn-danger" style={{ flex: 1, fontSize: 13 }} onClick={() => onRefund(payment)}>
            <XIcon size={13} /> Refund Seeker
          </button>
          <button className="btn btn-gold" style={{ flex: 1, fontSize: 13 }} onClick={() => onRelease(payment)}>
            <CheckCircleIcon size={13} /> Release to Agent
          </button>
        </div>
      )}

      {payment.escrow_status === 'released' && (
        <div style={styles.releasedNote}>
          Released {payment.released_at ? format(new Date(payment.released_at), 'MMM d, yyyy') : ''} · Agent credited {formatMoney(agentPayout, payment.currency)}
        </div>
      )}
      {payment.escrow_status === 'refunded' && (
        <div style={styles.refundedNote}>
          Refunded {payment.refunded_at ? format(new Date(payment.refunded_at), 'MMM d, yyyy') : ''} · Process refund in Paystack dashboard
        </div>
      )}
    </div>
  );
}

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('holding');
  const [confirmAction, setConfirmAction] = useState(null); // { type, payment }

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['admin_payments', filter],
    queryFn: async () => {
      let q = supabase.from('payments')
        .select(`*, applications(id, jobs(title)),
          seeker:profiles!payments_seeker_id_fkey(first_name, last_name),
          agent:profiles!payments_agent_id_fkey(first_name, last_name)`)
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('escrow_status', filter);
      const { data } = await q;
      return data || [];
    },
  });

  // Total in escrow
  const totalHolding = payments.filter(p => p.escrow_status === 'holding').reduce((s, p) => s + Number(p.amount), 0);

  const releaseMutation = useMutation({
    mutationFn: async (payment) => {
      const { agentPayout, platformFee } = calculateEscrowSplit(payment.amount, payment.platform_fee_pct || 10);
      // Update payment
      await supabase.from('payments').update({ escrow_status: 'released', agent_payout_amount: agentPayout, platform_fee_amount: platformFee, released_at: new Date().toISOString() }).eq('id', payment.id);
      // Audit log
      await supabase.from('audit_logs').insert({ action: 'release_escrow', entity_type: 'payment', entity_id: payment.id, new_value: { amount: payment.amount, agent_payout: agentPayout, platform_fee: platformFee } });
      // Credit agent wallet — always use NGN as wallet currency
      const walletCurrency = 'NGN';
      const { data: wallet, error: walletErr } = await supabase.from('agent_wallets')
        .select('id, balance').eq('agent_id', payment.agent_id).eq('currency', walletCurrency).single();
      
      let newBalance;
      if (wallet) {
        newBalance = (Number(wallet.balance) || 0) + agentPayout;
        await supabase.from('agent_wallets').update({ balance: newBalance }).eq('id', wallet.id);
      } else {
        newBalance = agentPayout;
        await supabase.from('agent_wallets').insert({ agent_id: payment.agent_id, currency: walletCurrency, balance: newBalance });
      }
      
      await supabase.from('wallet_transactions').insert({
        agent_id: payment.agent_id, currency: walletCurrency, type: 'escrow_release',
        amount: agentPayout, description: `Escrow released — ${payment.applications?.jobs?.title || 'Application'}`,
        reference_id: payment.id, balance_after: newBalance
      });
      // Notify agent
      await supabase.from('notifications').insert({ recipient_id: payment.agent_id, type: 'escrow_released', title: 'Payment Released!', body: `${formatMoney(agentPayout, payment.currency)} has been credited to your wallet.`, link: '/agent/wallet' });
      // Update application status
      await supabase.from('applications').update({ status: 'approved' }).eq('id', payment.application_id);
    },
    onSuccess: () => { toast.success('Escrow released — agent wallet credited'); setConfirmAction(null); queryClient.invalidateQueries(['admin_payments']); },
    onError: (e) => toast.error(e.message),
  });

  const refundMutation = useMutation({
    mutationFn: async (payment) => {
      await supabase.from('payments').update({ escrow_status: 'refunded', refunded_at: new Date().toISOString() }).eq('id', payment.id);
      await supabase.from('applications').update({ status: 'refunded' }).eq('id', payment.application_id);
      await supabase.from('notifications').insert({ recipient_id: payment.seeker_id, type: 'escrow_released', title: 'Refund Processed', body: `Your payment of ${formatMoney(payment.amount, payment.currency)} has been marked for refund. Please allow 3–5 business days.`, link: '/dashboard/applications' });
    },
    onSuccess: () => { toast.success('Marked as refunded — process in Paystack dashboard'); setConfirmAction(null); queryClient.invalidateQueries(['admin_payments']); },
    onError: (e) => toast.error(e.message),
  });

  const FILTERS = ['holding', 'released', 'refunded', 'all'];

  return (
    <AppShell title="Payments & Escrow">
      <div className="page">
        <div style={styles.pageHeader}>
          <div style={styles.pageTitle}>Payments & Escrow</div>
          <div style={styles.pageSub}>Manage held payments and release to agents</div>
        </div>

        {/* Escrow total */}
        {filter === 'holding' && payments.length > 0 && (
          <div className="card-gold" style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 4 }}>Total in Escrow</div>
              <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--gold-text)' }}>{formatMoney(totalHolding, 'NGN')}</div>
            </div>
            <CreditCardIcon size={28} style={{ color: 'var(--gold)', opacity: 0.4 }} />
          </div>
        )}

        <div style={styles.filterTabs}>
          {FILTERS.map(f => (
            <button key={f} style={{ ...styles.filterTab, ...(filter === f ? styles.filterTabActive : {}) }} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : payments.length === 0 ? (
          <div className="empty-state">
            <CreditCardIcon size={40} style={{ color: 'var(--text-3)' }} />
            <div className="empty-title">No {filter} payments</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {payments.map(p => (
              <PaymentCard key={p.id} payment={p}
                onRelease={(pay) => setConfirmAction({ type: 'release', payment: pay })}
                onRefund={(pay) => setConfirmAction({ type: 'refund', payment: pay })}
              />
            ))}
          </div>
        )}

        {confirmAction?.type === 'release' && (
          <ConfirmModal
            title="Release Escrow"
            body={`Release ${formatMoney(confirmAction.payment.amount, confirmAction.payment.currency)} to the agent? Platform keeps ${formatMoney(calculateEscrowSplit(confirmAction.payment.amount).platformFee, confirmAction.payment.currency)} (10%). Agent receives ${formatMoney(calculateEscrowSplit(confirmAction.payment.amount).agentPayout, confirmAction.payment.currency)}.`}
            confirmLabel="Release Payment"
            requireTyping="RELEASE"
            onClose={() => setConfirmAction(null)}
            onConfirm={() => releaseMutation.mutate(confirmAction.payment)}
          />
        )}
        {confirmAction?.type === 'refund' && (
          <ConfirmModal
            title="Refund Payment"
            body="This will mark the payment as refunded and notify the seeker. You must process the actual refund separately in your Paystack dashboard."
            confirmLabel="Mark as Refunded"
            danger
            onClose={() => setConfirmAction(null)}
            onConfirm={() => refundMutation.mutate(confirmAction.payment)}
          />
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
  payJobTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 4 },
  payMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  payDate: { fontSize: 11, color: 'var(--text-3)' },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  splitRow: { display: 'flex', background: 'var(--bg-2)', borderRadius: 8, overflow: 'hidden' },
  splitItem: { flex: 1, padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 3 },
  splitDivider: { width: 1, background: 'var(--border)' },
  splitLabel: { fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.3px' },
  splitAmount: { fontSize: 14, fontWeight: 700, color: 'var(--text-1)' },
  cardActions: { display: 'flex', gap: 8 },
  releasedNote: { fontSize: 12, color: '#22c55e', background: 'rgba(34,197,94,0.08)', padding: '8px 12px', borderRadius: 6 },
  refundedNote: { fontSize: 12, color: 'var(--error)', background: 'var(--error-dim)', padding: '8px 12px', borderRadius: 6 },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  modal: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 16 },
  modalTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)' },
  modalSub: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginTop: -8 },
  modalBtns: { display: 'flex', gap: 10, justifyContent: 'flex-end' },
};
