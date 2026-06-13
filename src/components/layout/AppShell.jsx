import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'context/AuthContext';
import { ThemeToggle } from 'context/ThemeContext';
import { useNotifications } from 'hooks';
import {
  HomeIcon, BriefcaseIcon, FileTextIcon, MessageIcon, UserIcon,
  WalletIcon, BellIcon, LogOutIcon, SettingsIcon, UsersIcon,
  ClipboardIcon, CreditCardIcon, ShieldIcon, BuildingIcon, ChevronRightIcon
} from 'components/ui/Icons';
import { formatDistanceToNow } from 'date-fns';

// ─── Nav config per role ──────────────────────────────────────────────────────
const NAV = {
  seeker: [
    { to: '/dashboard', icon: HomeIcon, label: 'Home' },
    { to: '/jobs', icon: BriefcaseIcon, label: 'Jobs' },
    { to: '/dashboard/applications', icon: FileTextIcon, label: 'Applied' },
    { to: '/dashboard/inbox', icon: MessageIcon, label: 'Inbox' },
    { to: '/dashboard/profile', icon: UserIcon, label: 'Profile' },
  ],
  agent: [
    { to: '/agent', icon: HomeIcon, label: 'Home' },
    { to: '/agent/jobs', icon: BriefcaseIcon, label: 'Jobs' },
    { to: '/agent/applications', icon: FileTextIcon, label: 'Apps' },
    { to: '/agent/wallet', icon: WalletIcon, label: 'Wallet' },
    { to: '/agent/inbox', icon: MessageIcon, label: 'Inbox' },
  ],
  admin: [
    { to: '/admin', icon: HomeIcon, label: 'Home' },
    { to: '/admin/kyc', icon: ShieldIcon, label: 'KYC' },
    { to: '/admin/jobs', icon: BriefcaseIcon, label: 'Jobs' },
    { to: '/admin/payments', icon: CreditCardIcon, label: 'Escrow' },
    { to: '/admin/users', icon: UsersIcon, label: 'Users' },
  ],
};

const SIDEBAR_EXTRAS = {
  seeker: [],
  agent: [
    { to: '/agent/kyc', icon: ShieldIcon, label: 'KYC Verification' },
    { to: '/agent/profile', icon: UserIcon, label: 'Profile' },
  ],
  admin: [
    { to: '/admin/documents', icon: ClipboardIcon, label: 'Documents' },
    { to: '/admin/withdrawals', icon: WalletIcon, label: 'Withdrawals' },
    { to: '/admin/settings', icon: SettingsIcon, label: 'Settings' },
    { to: '/admin/inbox', icon: MessageIcon, label: 'All Threads' },
  ],
};

// ─── Notification Bell ────────────────────────────────────────────────────────
function NotifBell() {
  const { data: notifs = [], unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="notif-bell-wrap" ref={ref}>
      <button className="notif-bell-btn" onClick={() => { setOpen(o => !o); if (!open && unreadCount > 0) markRead(); }}>
        <BellIcon />
        {unreadCount > 0 && <span className="notif-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>
      {open && (
        <div className="notif-dropdown">
          <div className="notif-dropdown-header">
            <span className="notif-dropdown-title">Notifications</span>
            {unreadCount > 0 && <button className="notif-mark-read" onClick={markRead}>Mark all read</button>}
          </div>
          {notifs.length === 0 ? (
            <div className="notif-empty">No notifications yet</div>
          ) : (
            <div style={{ maxHeight: 360, overflowY: 'auto' }}>
              {notifs.slice(0, 15).map(n => (
                <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                  <div className={`notif-dot ${n.is_read ? 'read' : ''}`} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-body">{n.body}</div>
                    <div className="notif-item-time">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── App Shell ────────────────────────────────────────────────────────────────
export default function AppShell({ children, title = 'Adwuma' }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = profile?.role || 'seeker';
  const navItems = NAV[role] || [];
  const extraItems = SIDEBAR_EXTRAS[role] || [];

  const isActive = (to) => {
    if (to === '/dashboard' || to === '/agent' || to === '/admin') return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth/login'); };

  return (
    <div className="app-shell">
      {/* ── Sidebar (desktop) ── */}
      <nav className="sidebar">
        {/* Logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)', letterSpacing: '-0.5px' }}>
            Adwuma
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
            {role.charAt(0).toUpperCase() + role.slice(1)} Portal
          </div>
        </div>

        {/* Main nav */}
        <div style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[...navItems, ...extraItems].map(({ to, icon: Ico, label }) => (
            <Link key={to} to={to} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              fontSize: 14, fontWeight: isActive(to) ? 600 : 400,
              color: isActive(to) ? 'var(--gold)' : 'var(--text-2)',
              background: isActive(to) ? 'var(--gold-dim)' : 'transparent',
              transition: 'all 0.15s', textDecoration: 'none',
            }}>
              <Ico size={18} />
              {label}
            </Link>
          ))}
        </div>

        {/* Profile + sign out */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid var(--border)' }}>
          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', marginBottom: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 2 }}>
              {profile?.first_name} {profile?.last_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.role}
            </div>
          </div>
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '10px 12px', borderRadius: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, color: 'var(--text-3)', fontFamily: 'inherit',
          }}>
            <LogOutIcon size={16} /> Sign out
          </button>
        </div>
      </nav>

      {/* ── Main area ── */}
      <div className="main-content">
        {/* Top bar */}
        <div className="topbar">
          <span className="topbar-title">{title}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ThemeToggle />
            <NotifBell />
          </div>
        </div>

        {/* Page content */}
        {children}
      </div>

      {/* ── Bottom nav (mobile) ── */}
      <nav className="bottom-nav">
        {navItems.map(({ to, icon: Ico, label }) => (
          <Link key={to} to={to} className={`bottom-nav-item ${isActive(to) ? 'active' : ''}`}>
            <Ico size={22} />
            <span className="bottom-nav-label">{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
