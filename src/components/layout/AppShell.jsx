import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from 'context/AuthContext';
import { ThemeToggle } from 'context/ThemeContext';
import { useNotifications } from 'hooks';
import {
  HomeIcon, BriefcaseIcon, FileTextIcon, MessageIcon, UserIcon,
  WalletIcon, BellIcon, LogOutIcon, SettingsIcon, UsersIcon,
  ClipboardIcon, CreditCardIcon, ShieldIcon, ChevronRightIcon,
  TrendingUpIcon, AlertCircleIcon, SearchIcon
} from 'components/ui/Icons';
import { formatDistanceToNow } from 'date-fns';

const NAV = {
  seeker: [
    { to: '/dashboard',              icon: HomeIcon,      label: 'Home'      },
    { to: '/jobs',                   icon: SearchIcon,    label: 'Jobs'      },
    { to: '/dashboard/applications', icon: FileTextIcon,  label: 'Applied'   },
    { to: '/dashboard/inbox',        icon: MessageIcon,   label: 'Inbox'     },
    { to: '/dashboard/profile',      icon: UserIcon,      label: 'Profile'   },
  ],
  agent: [
    { to: '/agent',                  icon: HomeIcon,      label: 'Home'      },
    { to: '/agent/jobs',             icon: BriefcaseIcon, label: 'Jobs'      },
    { to: '/agent/applications',     icon: FileTextIcon,  label: 'Apps'      },
    { to: '/agent/wallet',           icon: WalletIcon,    label: 'Wallet'    },
    { to: '/agent/profile',          icon: UserIcon,      label: 'Profile'   },
  ],
  admin: [
    { to: '/admin',                  icon: HomeIcon,      label: 'Home'      },
    { to: '/admin/kyc',              icon: ShieldIcon,    label: 'KYC'       },
    { to: '/admin/jobs',             icon: BriefcaseIcon, label: 'Jobs'      },
    { to: '/admin/payments',         icon: CreditCardIcon,label: 'Escrow'    },
    { to: '/admin/users',            icon: UsersIcon,     label: 'Users'     },
  ],
};

const SIDEBAR_EXTRAS = {
  seeker: [
    { to: '/dashboard/saved',    icon: BriefcaseIcon,  label: 'Saved Jobs'  },
    { to: '/dashboard/inbox',    icon: MessageIcon,    label: 'Inbox'       },
    { to: '/dashboard/profile',  icon: UserIcon,       label: 'Profile'     },
  ],
  agent: [
    { to: '/agent/inbox',        icon: MessageIcon,    label: 'Inbox'       },
    { to: '/agent/kyc',          icon: ShieldIcon,     label: 'KYC'         },
  ],
  admin: [
    { to: '/admin/documents',    icon: ClipboardIcon,  label: 'Documents'   },
    { to: '/admin/withdrawals',  icon: WalletIcon,     label: 'Withdrawals' },
    { to: '/admin/analytics',    icon: TrendingUpIcon, label: 'Analytics'   },
    { to: '/admin/fraud',        icon: AlertCircleIcon,label: 'Fraud'       },
    { to: '/admin/audit',        icon: ClipboardIcon,  label: 'Audit Log'   },
    { to: '/admin/inbox',        icon: MessageIcon,    label: 'Threads'     },
    { to: '/admin/settings',     icon: SettingsIcon,   label: 'Settings'    },
  ],
};

function NotifBell() {
  const { data: notifs = [], unreadCount, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) markRead(); }}
        style={{
          position: 'relative', background: 'none',
          border: '1px solid var(--border)', borderRadius: 8,
          cursor: 'pointer', padding: 7, color: 'var(--text-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, flexShrink: 0,
          WebkitTapHighlightColor: 'transparent',
        }}
        aria-label="Notifications"
      >
        <BellIcon size={18} />
        {unreadCount > 0 && (
          <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 44, right: 0,
          width: 320, maxHeight: 420, overflowY: 'auto',
          background: 'var(--card)', border: '1px solid var(--border)',
          borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-lg)',
          zIndex: 200,
        }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markRead} style={{ fontSize: 12, color: 'var(--brand)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Mark all read
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>No notifications yet</div>
          ) : notifs.slice(0, 15).map(n => (
            <Link key={n.id} to={n.link || '#'} onClick={() => setOpen(false)} style={{
              display: 'block', padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              background: n.is_read ? 'transparent' : 'var(--brand-dim)',
              textDecoration: 'none',
              transition: 'background 0.1s',
            }}>
              <div style={{ fontSize: 13, fontWeight: n.is_read ? 400 : 600, color: 'var(--text-1)', marginBottom: 3 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>{n.body}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children, title = 'Ajuma Link' }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const role = profile?.role || 'seeker';
  const navItems    = NAV[role] || [];
  const extraItems  = SIDEBAR_EXTRAS[role] || [];

  const isActive = (to) => {
    if (to === '/dashboard' || to === '/agent' || to === '/admin') return location.pathname === to;
    return location.pathname.startsWith(to);
  };

  const handleSignOut = async () => { await signOut(); navigate('/auth/login'); };

  return (
    <div className="app-shell">

      {/* ── SIDEBAR (desktop only) ────────────────────────── */}
      <nav className="sidebar">
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--brand)', letterSpacing: '-0.3px', marginBottom: 2 }}>
            Ajuma Link
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>
            {role} Portal
          </div>
        </div>

        <div style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {[...navItems, ...extraItems].map(({ to, icon: Ico, label }) => (
            <Link key={to} to={to} className={`nav-link ${isActive(to) ? 'active' : ''}`}>
              <Ico size={17} />
              {label}
            </Link>
          ))}
        </div>

        <div style={{ padding: '10px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ padding: '10px 12px', borderRadius: 'var(--r-sm)', background: 'var(--bg-3)', marginBottom: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.first_name} {profile?.last_name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>{role}</div>
          </div>
          <button onClick={handleSignOut} style={{
            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
            padding: '9px 12px', borderRadius: 'var(--r-sm)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: 'var(--text-3)', fontFamily: 'inherit',
            transition: 'color 0.15s',
          }}>
            <LogOutIcon size={15} /> Sign out
          </button>
        </div>
      </nav>

      {/* ── MAIN ─────────────────────────────────────────── */}
      <div className="main-content">

        {/* Topbar */}
        <div className="topbar">
          {/* Mobile logo */}
          <Link to={role === 'admin' ? '/admin' : role === 'agent' ? '/agent' : '/dashboard'}
            style={{ fontWeight: 800, fontSize: 16, color: 'var(--brand)', textDecoration: 'none', flexShrink: 0, display: 'none' }}
            className="mobile-logo">
            AL
          </Link>

          <span className="topbar-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>{title}</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <ThemeToggle />
            <NotifBell />
            {/* Profile avatar — always visible on mobile */}
            <Link
              to={role === 'admin' ? '/admin' : role === 'agent' ? '/agent/profile' : '/dashboard/profile'}
              style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'var(--brand-dim)',
                border: '2px solid var(--brand-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: 'var(--brand-text)',
                textDecoration: 'none', flexShrink: 0,
              }}
              aria-label="Profile"
            >
              {profile?.first_name?.[0]?.toUpperCase()}{profile?.last_name?.[0]?.toUpperCase()}
            </Link>
          </div>
        </div>

        {/* Page */}
        {children}
      </div>

      {/* ── BOTTOM NAV (mobile only) ──────────────────────── */}
      <nav className="bottom-nav">
        {navItems.map(({ to, icon: Ico, label }) => (
          <Link key={to} to={to} className={`bottom-nav-item ${isActive(to) ? 'active' : ''}`}>
            <Ico size={22} />
            <span style={{ fontSize: 10 }}>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
