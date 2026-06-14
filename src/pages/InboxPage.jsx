import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, subscribeToMessages } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { SendIcon, MessageIcon, SearchIcon, ArrowLeftIcon } from '../components/ui/Icons';
import AppShell from '../components/layout/AppShell';

// Blocks any message containing phone numbers, emails, social links
function sanitizeMessage(text) {
  const blocked = [
    /\b\d{10,13}\b/g,                          // phone numbers
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, // emails
    /(https?:\/\/|www\.)[^\s]+/gi,              // URLs
    /(\+?\d[\d\s\-]{8,})/g,                    // international numbers
    /(whatsapp|telegram|instagram|facebook|twitter|tiktok|snapchat|signal)/gi, // social platforms
    /t\.me\/[^\s]*/gi,                          // telegram links
    /wa\.me\/[^\s]*/gi,                         // whatsapp links
  ];
  let out = text;
  for (const r of blocked) out = out.replace(r, '***');
  return out;
}

function ThreadList({ threads, activeId, onSelect, userId, onBack, showBack }) {
  const [search, setSearch] = useState('');
  const filtered = threads.filter(t => {
    const other = t.seeker_id === userId ? t.agent_name : t.seeker_name;
    return !search || other?.toLowerCase().includes(search.toLowerCase()) || t.job_title?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={styles.threadList}>
      <div style={styles.threadHeader}>
        <div style={styles.threadTitle}>Messages</div>
        <div style={styles.threadSearch}>
          <SearchIcon size={13} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input style={styles.threadSearchInput} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={styles.noThreads}>
            <MessageIcon size={32} style={{ color: 'var(--text-3)', margin: '0 auto 8px' }} />
            <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center' }}>No conversations yet</div>
          </div>
        ) : filtered.map(t => {
          const isActive = t.id === activeId;
          const otherName = t.seeker_id === userId ? t.agent_name : t.seeker_name;
          const initials = otherName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          return (
            <div key={t.id}
              style={{ ...styles.threadItem, background: isActive ? 'var(--gold-dim)' : 'transparent', borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent' }}
              onClick={() => onSelect(t)}
            >
              <div style={styles.threadAvatar}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={styles.threadName}>{otherName}</div>
                <div style={styles.threadJob}>{t.job_title}</div>
                {t.last_message && <div style={styles.threadPreview}>{t.last_message.slice(0, 40)}{t.last_message.length > 40 ? '…' : ''}</div>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                {t.last_message_at && <div style={styles.threadTime}>{formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false })}</div>}
                {t.unread_count > 0 && <div style={styles.unreadBadge}>{t.unread_count}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MessageArea({ thread, userId, isAdmin, onBack }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const endRef = useRef(null);

  const lastMessageIdRef = useRef(null);

  useEffect(() => {
    if (!thread) return;

    // Initial load
    loadMessages();

    // Realtime subscription
    const ch = subscribeToMessages(thread.id, (p) => {
      const newMsg = p.new;
      setMessages(m => {
        if (m.find(msg => msg.id === newMsg.id)) return m;
        return [...m, newMsg];
      });
    });

    // 2-second polling fallback (catches messages realtime misses)
    const poll = setInterval(async () => {
      const { data } = await supabase.from('messages')
        .select('*')
        .eq('thread_id', thread.id)
        .order('created_at');
      if (data) {
        setMessages(prev => {
          // Only update if count changed
          if (data.length !== prev.length) return data;
          return prev;
        });
      }
    }, 2000);

    return () => {
      supabase.removeChannel(ch);
      clearInterval(poll);
    };
  }, [thread?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function loadMessages() {
    const { data } = await supabase.from('messages').select('*').eq('thread_id', thread.id).order('created_at');
    setMessages(data || []);
    if (!isAdmin) {
      await supabase.from('messages').update({ is_read: true }).eq('thread_id', thread.id).neq('sender_id', userId);
    }
  }

  async function sendMessage() {
    if (!newMsg.trim() || isAdmin) return;
    const sanitized = sanitizeMessage(newMsg.trim());
    if (sanitized !== newMsg.trim()) {
      setBlocked(true);
      setTimeout(() => setBlocked(false), 3000);
      // Log flagged message
      const patterns = ['phone', 'email', 'url', 'social'];
      const flaggedPattern = patterns.find(p => {
        if (p === 'phone') return /\b\d{10,13}\b/.test(newMsg);
        if (p === 'email') return /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/.test(newMsg);
        if (p === 'url') return /(https?:\/\/|www\.)/.test(newMsg);
        if (p === 'social') return /(whatsapp|telegram|instagram|facebook)/i.test(newMsg);
        return false;
      }) || 'contact_info';
      supabase.from('flagged_messages').insert({
        thread_id: thread.id, sender_id: userId,
        original_body: newMsg.trim(), flagged_pattern: flaggedPattern,
      }).then(() => {});
      return;
    }
    setSending(true);
    await supabase.from('messages').insert({ thread_id: thread.id, sender_id: userId, body: newMsg.trim() });
    setNewMsg('');
    setSending(false);
  }

  if (!thread) return (
    <div style={styles.emptyChat}>
      <MessageIcon size={40} style={{ color: 'var(--text-3)' }} />
      <div style={styles.emptyChatTitle}>Select a conversation</div>
      <div style={styles.emptyChatSub}>Choose a thread from the list to view messages</div>
    </div>
  );

  return (
    <div style={styles.chatArea}>
      <div style={styles.chatHeader}>
        <button style={styles.backBtn} onClick={onBack}><ArrowLeftIcon size={16} /></button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.chatTitle}>{thread.job_title}</div>
          <div style={styles.chatSub}>{thread.seeker_name} ↔ {thread.agent_name}</div>
        </div>
      </div>

      <div style={styles.safetyBanner}>
         For your safety, contact details and external links are blocked. All communication must stay on Ajuma Link.
        {!isAdmin && (
          <button
            onClick={async () => {
              if (!window.confirm('Request admin to join this conversation to help resolve an issue?')) return;
              const reason = window.prompt('Briefly describe the issue:');
              if (!reason) return;
              await supabase.from('message_threads').update({
                admin_invited: true,
                admin_invited_at: new Date().toISOString(),
                admin_invited_by: userId,
                dispute_reason: reason,
              }).eq('id', thread.id);
              // Notify admin
              await supabase.from('notifications').insert({
                recipient_id: (await supabase.from('profiles').select('id').eq('role', 'admin').limit(1).maybeSingle()).data?.id,
                type: 'admin_invited',
                title: ' Admin Help Requested',
                body: `A user requested admin help in a chat. Reason: ${reason}`,
                link: '/admin/inbox',
              });
              toast.success('Admin has been notified and will join shortly.');
            }}
            style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--error)', background: 'none', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}
          >
             Request Admin Help
          </button>
        )}
        {thread?.admin_invited && (
          <span style={{ marginLeft: 8, fontSize: 11, color: '#22c55e', fontWeight: 600 }}>✓ Admin notified</span>
        )}
      </div>

      <div style={styles.messages}>
        {messages.length === 0 ? (
          <div style={styles.noMessages}>No messages yet — say hello!</div>
        ) : messages.map(m => {
          const isMine = !isAdmin && m.sender_id === userId;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
              <div style={{ ...styles.bubble, background: isMine ? '#1a5c3a' : 'var(--card-2)', borderBottomRightRadius: isMine ? 4 : 14, borderBottomLeftRadius: isMine ? 14 : 4, maxWidth: '78%' }}>
                {isAdmin && <div style={styles.bubbleSender}>{m.sender_id === thread.seeker_id ? thread.seeker_name : thread.agent_name}</div>}
                <div style={styles.bubbleText}>{m.body}</div>
                <div style={styles.bubbleTime}>{format(new Date(m.created_at), 'HH:mm')}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {(!isAdmin || thread?.admin_invited) ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {blocked && <div style={styles.blockedWarning}> Contact details, phone numbers, and external links are not allowed in messages.</div>}
          <div style={styles.inputRow}>
            <input
              style={styles.msgInput}
              value={newMsg}
              onChange={e => setNewMsg(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <button style={{ ...styles.sendBtn, opacity: !newMsg.trim() ? 0.5 : 1 }} onClick={sendMessage} disabled={sending || !newMsg.trim()}>
              <SendIcon size={17} />
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.adminNote}>Admin view — read only. You cannot send messages.</div>
      )}
    </div>
  );
}

export default function InboxPage({ role }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileView, setMobileView] = useState('list'); // 'list' | 'chat'
  const isAdmin = role === 'admin';

  useEffect(() => { loadThreads(); }, [user]);

  async function loadThreads() {
    if (!user) return;
    let q = supabase.from('message_threads')
      .select(`*, messages(id, body, created_at, sender_id, is_read),
        seeker:profiles!message_threads_seeker_id_fkey(first_name, last_name),
        agent:profiles!message_threads_agent_id_fkey(first_name, last_name),
        applications(jobs(title))`);
    if (!isAdmin) {
      if (role === 'seeker') q = q.eq('seeker_id', user.id);
      if (role === 'agent') q = q.eq('agent_id', user.id);
    }
    const { data } = await q.order('created_at', { ascending: false });
    const enriched = (data || []).map(t => {
      const msgs = [...(t.messages || [])].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastMsg = msgs[0];
      const unread = msgs.filter(m => !m.is_read && m.sender_id !== user.id).length;
      return {
        ...t,
        seeker_name: `${t.seeker?.first_name || ''} ${t.seeker?.last_name || ''}`.trim(),
        agent_name: `${t.agent?.first_name || ''} ${t.agent?.last_name || ''}`.trim(),
        job_title: t.applications?.jobs?.title || 'Application',
        last_message: lastMsg?.body,
        last_message_at: lastMsg?.created_at,
        unread_count: unread,
      };
    });
    setThreads(enriched);
    setLoading(false);
  }

  const handleSelectThread = (t) => {
    setActiveThread(t);
    setMobileView('chat');
  };

  const handleBack = () => {
    setMobileView('list');
    setActiveThread(null);
  };

  const title = role === 'admin' ? 'All Threads' : 'Inbox';

  return (
    <AppShell title={title}>
      <style>{`
        @media (max-width: 767px) {
          .inbox-thread-list { display: ${mobileView === 'list' ? 'flex' : 'none'} !important; width: 100% !important; }
          .inbox-chat-area { display: ${mobileView === 'chat' ? 'flex' : 'none'} !important; }
          .inbox-back-btn { display: flex !important; }
        }
        @media (min-width: 768px) {
          .inbox-thread-list { display: flex !important; width: 300px !important; }
          .inbox-chat-area { display: flex !important; }
          .inbox-back-btn { display: none !important; }
        }
      `}</style>
      <div style={styles.root}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <div style={styles.layout}>
            <div className="inbox-thread-list" style={{ ...styles.threadList, flexDirection: 'column' }}>
              <ThreadList threads={threads} activeId={activeThread?.id} onSelect={handleSelectThread} userId={user?.id} />
            </div>
            <div className="inbox-chat-area" style={{ ...styles.chatArea, flexDirection: 'column', display: 'flex' }}>
              <MessageArea thread={activeThread} userId={user?.id} isAdmin={isAdmin} onBack={handleBack} />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  root: { height: 'calc(100dvh - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  layout: { display: 'flex', flex: 1, overflow: 'hidden' },
  threadList: { width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-2)', overflow: 'hidden' },
  threadHeader: { padding: '14px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  threadTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 10 },
  threadSearch: { display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' },
  threadSearchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' },
  noThreads: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 20px' },
  threadItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', cursor: 'pointer', transition: 'background 0.1s', borderLeft: '3px solid transparent' },
  threadAvatar: { width: 38, height: 38, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  threadName: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  threadJob: { fontSize: 11, color: 'var(--gold-text)', marginBottom: 2 },
  threadPreview: { fontSize: 11, color: 'var(--text-3)' },
  threadTime: { fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' },
  unreadBadge: { background: 'var(--gold)', color: '#000', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' },
  chatHeader: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', flexShrink: 0 },
  backBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-2)', display: 'none', alignItems: 'center', padding: 4, fontFamily: 'Inter, sans-serif' },
  chatTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  chatSub: { fontSize: 11, color: 'var(--text-3)' },
  safetyBanner: { fontSize: 11, color: 'var(--text-3)', background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.1)', padding: '7px 16px', flexShrink: 0 },
  emptyChat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyChatTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginTop: 12 },
  emptyChatSub: { fontSize: 13, color: 'var(--text-3)', marginTop: 4 },
  messages: { flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 2 },
  noMessages: { fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 20 },
  bubble: { padding: '8px 12px', borderRadius: 14 },
  bubbleSender: { fontSize: 10, fontWeight: 600, color: 'var(--gold-text)', marginBottom: 3 },
  bubbleText: { fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5, wordBreak: 'break-word' },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 3, textAlign: 'right' },
  blockedWarning: { fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '8px 16px', borderTop: '1px solid rgba(239,68,68,0.15)' },
  inputRow: { display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--card)', flexShrink: 0 },
  msgInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' },
  sendBtn: { width: 44, height: 44, borderRadius: 10, background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 },
  adminNote: { padding: '12px 16px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', textAlign: 'center', background: 'var(--card)', flexShrink: 0 },
};
