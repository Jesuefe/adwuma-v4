import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppShell from '../../components/layout/AppShell';
import { useAuth } from '../../context/AuthContext';
import { supabase, subscribeToMessages } from '../../lib/supabase';
import { formatMoney } from '../../lib/currency';
import { formatDistanceToNow, format } from 'date-fns';
import { CheckIcon, ClockIcon, ArrowLeftIcon, DownloadIcon, SendIcon, MessageIcon } from '../../components/ui/Icons';

const STEPS = [
  { n: 1, label: 'Application Received', desc: 'Your application has been submitted to the agent.' },
  { n: 2, label: 'Payment Secured', desc: 'Your service fee is held in escrow — protected until milestones are met.' },
  { n: 3, label: 'Document Review', desc: 'The agent is reviewing your profile and preparing your documents.' },
  { n: 4, label: 'Employer Processing', desc: 'Your application is being processed with the employer.' },
  { n: 5, label: 'Offer / Decision', desc: 'The employer has made a decision on your application.' },
  { n: 6, label: 'Relocation Support', desc: 'Final documents and relocation support are being arranged.' },
];

const STEP_STATUS = {
  completed: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)', border: '#22c55e' },
  in_progress: { color: 'var(--gold)', bg: 'var(--gold-dim)', border: 'var(--gold)' },
  pending: { color: 'var(--text-3)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
};

export default function ApplicationDetailPage() {
  const { applicationId } = useParams();
  const { user } = useAuth();
  const [app, setApp] = useState(null);
  const [docs, setDocs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [thread, setThread] = useState(null);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('tracker'); // tracker | docs | chat
  const msgEndRef = useRef(null);

  useEffect(() => {
    loadApp();
  }, [applicationId]);

  useEffect(() => {
    if (thread) {
      loadMessages();
      const channel = subscribeToMessages(thread.id, (payload) => {
        setMessages(m => [...m, payload.new]);
      });
      return () => supabase.removeChannel(channel);
    }
  }, [thread]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function loadApp() {
    const { data } = await supabase
      .from('applications')
      .select(`*, jobs(title, company_name, destination_country_id, service_fee, service_fee_currency, countries(name, code)),
        application_steps(step_number, step_name, status, updated_at),
        profiles!applications_agent_id_fkey(first_name, last_name),
        payments(amount, currency, escrow_status),
        application_documents(id, document_name, file_url, status, uploaded_at)`)
      .eq('id', applicationId)
      .single();
    setApp(data);
    setDocs((data?.application_documents || []).filter(d => d.status === 'approved'));

    // Load message thread
    const { data: t } = await supabase.from('message_threads').select('*').eq('application_id', applicationId).single();
    if (t) setThread(t);
  }

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
    setMessages(data || []);
    // Mark read
    await supabase.from('messages').update({ is_read: true }).eq('thread_id', thread.id).neq('sender_id', user.id);
  }

  async function sendMessage() {
    if (!newMsg.trim()) return;
    setSending(true);
    let threadId = thread?.id;
    if (!threadId) {
      const { data: t } = await supabase.from('message_threads').insert({ application_id: applicationId, seeker_id: user.id, agent_id: app.agent_id }).select().single();
      setThread(t);
      threadId = t.id;
    }
    await supabase.from('messages').insert({ thread_id: threadId, sender_id: user.id, body: newMsg.trim() });
    setNewMsg('');
    setSending(false);
  }

  if (!app) return (
    <AppShell title="Application">
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
    </AppShell>
  );

  const steps = [...(app.application_steps || [])].sort((a, b) => a.step_number - b.step_number);
  const payment = app.payments?.[0];

  return (
    <AppShell title="Application Tracker">
      <div className="page" style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Back */}
        <Link to="/dashboard/applications" style={styles.back}>
          <ArrowLeftIcon size={16} /> All Applications
        </Link>

        {/* Job info card */}
        <div className="card-gold" style={{ marginBottom: 20 }}>
          <div style={styles.jobTitle}>{app.jobs?.title}</div>
          <div style={styles.jobMeta}>{app.jobs?.company_name} · {app.jobs?.countries?.name}</div>
          {payment && (
            <div style={styles.paymentInfo}>
              <span style={styles.payLabel}>Service fee</span>
              <span style={styles.payAmount}>{formatMoney(payment.amount, payment.currency)}</span>
              <span style={{ ...styles.escrowBadge, background: payment.escrow_status === 'released' ? 'rgba(34,197,94,0.1)' : 'rgba(96,165,250,0.1)', color: payment.escrow_status === 'released' ? '#22c55e' : '#60a5fa' }}>
                {payment.escrow_status === 'released' ? 'Released' : 'In Escrow'}
              </span>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {[{ id: 'tracker', label: 'Tracker' }, { id: 'docs', label: `Documents (${docs.length})` }, { id: 'chat', label: 'Chat' }].map(t => (
            <button key={t.id} style={{ ...styles.tab, ...(tab === t.id ? styles.tabActive : {}) }} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tracker ── */}
        {tab === 'tracker' && (
          <div style={styles.timeline}>
            {steps.map((step, i) => {
              const info = STEPS.find(s => s.n === step.step_number) || {};
              const st = STEP_STATUS[step.status] || STEP_STATUS.pending;
              const isLast = i === steps.length - 1;
              return (
                <div key={step.step_number} style={styles.timelineItem}>
                  {/* Connector line */}
                  {!isLast && <div style={{ ...styles.timelineLine, background: step.status === 'completed' ? '#22c55e' : 'rgba(255,255,255,0.07)' }} />}
                  {/* Dot */}
                  <div style={{ ...styles.timelineDot, background: st.bg, border: `2px solid ${st.border}`, color: st.color }}>
                    {step.status === 'completed' ? <CheckIcon size={12} /> : <span style={{ fontSize: 11, fontWeight: 700 }}>{step.step_number}</span>}
                  </div>
                  {/* Content */}
                  <div style={styles.timelineContent}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={styles.stepLabel}>{info.label || step.step_name}</span>
                      <span style={{ ...styles.stepStatus, color: st.color }}>{step.status?.replace('_', ' ')}</span>
                    </div>
                    <div style={styles.stepDesc}>{info.desc}</div>
                    {step.updated_at && step.status !== 'pending' && (
                      <div style={styles.stepTime}>
                        <ClockIcon size={11} /> {formatDistanceToNow(new Date(step.updated_at), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Documents ── */}
        {tab === 'docs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {docs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-title">No documents yet</div>
                <div className="empty-sub">Documents will appear here after your agent uploads and admin approves them.</div>
              </div>
            ) : docs.map(doc => (
              <div key={doc.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-1)', marginBottom: 3 }}>{doc.document_name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{format(new Date(doc.uploaded_at), 'MMM d, yyyy')}</div>
                </div>
                <a href={doc.file_url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gold-text)', background: 'var(--gold-dim)', padding: '7px 12px', borderRadius: 8, textDecoration: 'none' }}>
                  <DownloadIcon size={14} /> Download
                </a>
              </div>
            ))}
          </div>
        )}

        {/* ── Chat ── */}
        {tab === 'chat' && (
          <div style={styles.chatWrap}>
            <div style={styles.messages}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-3)', fontSize: 13 }}>
                  No messages yet. Say hello to your agent!
                </div>
              ) : messages.map(m => {
                const isMine = m.sender_id === user.id;
                return (
                  <div key={m.id} style={{ ...styles.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ ...styles.bubble, background: isMine ? '#1a5c3a' : 'var(--card-2)', borderBottomRightRadius: isMine ? 4 : 12, borderBottomLeftRadius: isMine ? 12 : 4 }}>
                      <div style={styles.bubbleText}>{m.body}</div>
                      <div style={styles.bubbleTime}>{format(new Date(m.created_at), 'HH:mm')}</div>
                    </div>
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>
            <div style={styles.msgInput}>
              <input style={styles.msgInputField} value={newMsg} onChange={e => setNewMsg(e.target.value)}
                placeholder="Type a message…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
              <button style={styles.sendBtn} onClick={sendMessage} disabled={sending || !newMsg.trim()}>
                <SendIcon size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  back: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-2)', textDecoration: 'none', marginBottom: 20 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)', marginBottom: 4 },
  jobMeta: { fontSize: 13, color: 'var(--text-2)', marginBottom: 12 },
  paymentInfo: { display: 'flex', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--gold-border)' },
  payLabel: { fontSize: 12, color: 'var(--text-3)' },
  payAmount: { fontSize: 16, fontWeight: 700, color: 'var(--gold-text)', flex: 1 },
  escrowBadge: { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20 },
  tabs: { display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20, gap: 4 },
  tab: { padding: '10px 16px', fontSize: 13, fontWeight: 500, color: 'var(--text-2)', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '2px solid transparent', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s' },
  tabActive: { color: 'var(--gold)', borderBottomColor: 'var(--gold)' },
  // Timeline
  timeline: { display: 'flex', flexDirection: 'column', position: 'relative' },
  timelineItem: { display: 'flex', gap: 16, paddingBottom: 28, position: 'relative' },
  timelineLine: { position: 'absolute', left: 15, top: 32, width: 2, bottom: 0, borderRadius: 1 },
  timelineDot: { width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1 },
  timelineContent: { flex: 1, paddingTop: 4 },
  stepLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text-1)' },
  stepStatus: { fontSize: 11, fontWeight: 600, textTransform: 'capitalize' },
  stepDesc: { fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 4 },
  stepTime: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-3)' },
  // Chat
  chatWrap: { display: 'flex', flexDirection: 'column', height: 480, border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' },
  messages: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-2)' },
  msgRow: { display: 'flex' },
  bubble: { maxWidth: '75%', padding: '8px 12px', borderRadius: 12 },
  bubbleText: { fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5 },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 4, textAlign: 'right' },
  msgInput: { display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', background: 'var(--card)' },
  msgInputField: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' },
  sendBtn: { width: 44, height: 44, borderRadius: 8, background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 },
};
