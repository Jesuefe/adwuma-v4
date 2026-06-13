// Shared inbox component used by seeker, agent, and admin
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase, subscribeToMessages } from '../lib/supabase';
import { format, formatDistanceToNow } from 'date-fns';
import { SendIcon, MessageIcon, SearchIcon } from '../components/ui/Icons';
import AppShell from '../components/layout/AppShell';

function ThreadList({ threads, activeId, onSelect, userId }) {
  const [search, setSearch] = useState('');
  const filtered = threads.filter(t => {
    const other = t.seeker_id === userId ? t.agent_name : t.seeker_name;
    return other?.toLowerCase().includes(search.toLowerCase()) || t.job_title?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div style={styles.threadList}>
      <div style={styles.threadListHeader}>
        <div style={styles.threadListTitle}>Messages</div>
        <div style={styles.threadSearch}>
          <SearchIcon size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input style={styles.threadSearchInput} placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div style={styles.noThreads}>No conversations yet</div>
      ) : filtered.map(t => {
        const isActive = t.id === activeId;
        const otherName = t.seeker_id === userId ? t.agent_name : t.seeker_name;
        const initials = otherName?.split(' ').map(n => n[0]).join('').slice(0, 2);
        return (
          <div key={t.id} style={{ ...styles.threadItem, background: isActive ? 'rgba(245,158,11,0.08)' : 'transparent', borderColor: isActive ? 'var(--gold-border)' : 'transparent' }} onClick={() => onSelect(t)}>
            <div style={styles.threadAvatar}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={styles.threadName}>{otherName}</div>
              <div style={styles.threadJob}>{t.job_title}</div>
              {t.last_message && <div style={styles.threadPreview}>{t.last_message}</div>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
              {t.last_message_at && <div style={styles.threadTime}>{formatDistanceToNow(new Date(t.last_message_at), { addSuffix: false })}</div>}
              {t.unread_count > 0 && <div style={styles.unreadBadge}>{t.unread_count}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MessageArea({ thread, userId, isAdmin }) {
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    if (!thread) return;
    loadMessages();
    const ch = subscribeToMessages(thread.id, (p) => setMessages(m => [...m, p.new]));
    return () => supabase.removeChannel(ch);
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
    setSending(true);
    await supabase.from('messages').insert({ thread_id: thread.id, sender_id: userId, body: newMsg.trim() });
    setNewMsg('');
    setSending(false);
  }

  if (!thread) return (
    <div style={styles.emptyChat}>
      <MessageIcon size={40} style={{ color: 'var(--text-3)' }} />
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginTop: 12 }}>Select a conversation</div>
      <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>Choose a thread from the left to view messages</div>
    </div>
  );

  return (
    <div style={styles.chatArea}>
      {/* Chat header */}
      <div style={styles.chatHeader}>
        <div style={styles.chatHeaderInfo}>
          <div style={styles.chatHeaderName}>{thread.job_title}</div>
          <div style={styles.chatHeaderSub}>{thread.seeker_name} ↔ {thread.agent_name}</div>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messages}>
        {messages.length === 0 ? (
          <div style={styles.noMessages}>No messages yet. Say hello!</div>
        ) : messages.map(m => {
          const isMine = !isAdmin && m.sender_id === userId;
          return (
            <div key={m.id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 4 }}>
              <div style={{ ...styles.bubble, background: isMine ? '#1a5c3a' : 'var(--card-2)', borderBottomRightRadius: isMine ? 4 : 14, borderBottomLeftRadius: isMine ? 14 : 4, maxWidth: '75%' }}>
                {isAdmin && <div style={styles.bubbleSender}>{m.sender_id === thread.seeker_id ? thread.seeker_name : thread.agent_name}</div>}
                <div style={styles.bubbleText}>{m.body}</div>
                <div style={styles.bubbleTime}>{format(new Date(m.created_at), 'HH:mm')}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {/* Input */}
      {!isAdmin ? (
        <div style={styles.inputRow}>
          <input
            style={styles.msgInput}
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button style={{ ...styles.sendBtn, opacity: !newMsg.trim() ? 0.5 : 1 }} onClick={sendMessage} disabled={sending || !newMsg.trim()}>
            <SendIcon size={18} />
          </button>
        </div>
      ) : (
        <div style={styles.adminNote}>Admin view — read only</div>
      )}
    </div>
  );
}

export default function InboxPage({ role }) {
  const { user } = useAuth();
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [loading, setLoading] = useState(true);
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
      const msgs = t.messages || [];
      const lastMsg = msgs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
      const unread = msgs.filter(m => !m.is_read && m.sender_id !== user.id).length;
      return {
        ...t,
        seeker_name: `${t.seeker?.first_name} ${t.seeker?.last_name}`,
        agent_name: `${t.agent?.first_name} ${t.agent?.last_name}`,
        job_title: t.applications?.jobs?.title || 'Application',
        last_message: lastMsg?.body,
        last_message_at: lastMsg?.created_at,
        unread_count: unread,
      };
    });
    setThreads(enriched);
    setLoading(false);
  }

  const title = role === 'admin' ? 'All Threads' : 'Inbox';

  return (
    <AppShell title={title}>
      <div style={styles.root}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        ) : (
          <div style={styles.layout}>
            <ThreadList threads={threads} activeId={activeThread?.id} onSelect={setActiveThread} userId={user?.id} />
            <MessageArea thread={activeThread} userId={user?.id} isAdmin={isAdmin} />
          </div>
        )}
      </div>
    </AppShell>
  );
}

const styles = {
  root: { height: 'calc(100vh - 56px)', overflow: 'hidden' },
  layout: { display: 'flex', height: '100%' },
  threadList: { width: 300, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', background: 'var(--bg-2)' },
  threadListHeader: { padding: '16px 14px 10px', borderBottom: '1px solid var(--border)' },
  threadListTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', marginBottom: 10 },
  threadSearch: { display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' },
  threadSearchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-1)', fontFamily: 'Inter, sans-serif' },
  noThreads: { padding: 24, fontSize: 13, color: 'var(--text-3)', textAlign: 'center' },
  threadItem: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', cursor: 'pointer', border: '1px solid', borderRadius: 0, transition: 'background 0.1s' },
  threadAvatar: { width: 36, height: 36, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 },
  threadName: { fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 },
  threadJob: { fontSize: 11, color: 'var(--gold-text)', marginBottom: 2 },
  threadPreview: { fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  threadTime: { fontSize: 10, color: 'var(--text-3)' },
  unreadBadge: { background: 'var(--gold)', color: '#000', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  chatArea: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  chatHeader: { padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' },
  chatHeaderName: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 2 },
  chatHeaderSub: { fontSize: 12, color: 'var(--text-3)' },
  emptyChat: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 },
  messages: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg)' },
  noMessages: { fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: 20 },
  bubble: { padding: '8px 12px', borderRadius: 14 },
  bubbleSender: { fontSize: 10, fontWeight: 600, color: 'var(--gold-text)', marginBottom: 4 },
  bubbleText: { fontSize: 14, color: 'var(--text-1)', lineHeight: 1.5 },
  bubbleTime: { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 4, textAlign: 'right' },
  inputRow: { display: 'flex', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)', background: 'var(--card)' },
  msgInput: { flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'Inter, sans-serif' },
  sendBtn: { width: 44, height: 44, borderRadius: 10, background: 'var(--gold)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', flexShrink: 0 },
  adminNote: { padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: 12, color: 'var(--text-3)', textAlign: 'center', background: 'var(--card)' },
};
