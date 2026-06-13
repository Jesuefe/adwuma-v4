import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/currency';
import { SearchIcon, MapPinIcon, BriefcaseIcon, StarIcon, LockIcon, FilterIcon, UserIcon } from '../components/ui/Icons';


const COUNTRY_FLAGS = {
  DE: '🇩🇪', GB: '🇬🇧', CA: '🇨🇦', AE: '🇦🇪', PL: '🇵🇱',
  NL: '🇳🇱', US: '🇺🇸', AU: '🇦🇺', BE: '🇧🇪', IE: '🇮🇪',
  NG: '🇳🇬', GH: '🇬🇭',
};

function JobCard({ job, onClickLocked }) {
  const country = job.countries;
  const currency = job.currencies;
  const agent = job.profiles;
  const kyc = job.agent_kyc;
  const flag = COUNTRY_FLAGS[country?.code] || '🌍';

  return (
    <div style={styles.jobCard} onClick={onClickLocked}>
      {job.is_featured && (
        <div style={styles.featuredBadge}>
          <StarIcon size={10} /> Featured
        </div>
      )}
      <div style={styles.jobCardTop}>
        <div style={styles.jobMeta}>
          <span style={styles.jobFlag}>{flag}</span>
          <div>
            <div style={styles.jobCountry}>{country?.name} · {country?.code} · {currency?.code}</div>
          </div>
        </div>
        <div style={styles.jobTypeBadge}>{job.job_type?.replace('_', ' ')}</div>
      </div>
      <div style={styles.jobTitle}>{job.title}</div>
      <div style={styles.jobCompany}>{job.company_name}</div>
      <div style={styles.jobSalary}>
        {job.salary_min && job.salary_max
          ? `${formatMoney(job.salary_min, job.salary_currency, { compact: true })} – ${formatMoney(job.salary_max, job.salary_currency, { compact: true })} / ${job.salary_period || 'mo'}`
          : 'Salary negotiable'}
      </div>
      <div style={styles.jobFooter}>
        <div style={styles.jobAgent}>
          <div style={styles.agentAvatar}>
            {agent?.first_name?.[0]}{agent?.last_name?.[0]}
          </div>
          <span style={styles.agentName}>{kyc?.business_name || `${agent?.first_name} ${agent?.last_name}`}</span>
        </div>
        <div style={styles.viewBtn}>
          View <LockIcon size={12} />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showGate, setShowGate] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  const fetchJobs = async () => {
    setLoading(true);
    let query = supabase
      .from('jobs')
      .select(`*, countries(name, code), currencies!jobs_service_fee_currency_fkey(symbol, code),
        profiles!jobs_agent_id_fkey(first_name, last_name),
        agent_kyc(business_name)`, { count: 'exact' })
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (search) query = query.or(`title.ilike.%${search}%,company_name.ilike.%${search}%`);
    const { data, count } = await query;
    setJobs(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); fetchJobs(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .job-card-anim { animation: fadeIn 0.3s ease forwards; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      <div style={styles.root}>
        {/* ── Header ── */}
        <div style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.logo}>Adwuma</div>
            <div style={styles.headerRight}>
              <Link to="/auth/login" style={styles.loginBtn}>Sign in</Link>
              <Link to="/auth/register" style={styles.registerBtn}>Get started</Link>
            </div>
          </div>
        </div>

        {/* ── Hero ── */}
        <div style={styles.hero}>
          <div style={styles.heroPill}>Verified international recruitment</div>
          <h1 style={styles.heroTitle}>Find your job<br />abroad, safely.</h1>
          <p style={styles.heroSub}>Every agent is KYC-verified. Every payment is escrow-protected. Every step is tracked.</p>

          {/* Search */}
          <div style={styles.searchWrap}>
            <SearchIcon size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input
              style={styles.searchInput}
              placeholder="Search jobs, companies, countries…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div style={styles.heroStats}>
            <span style={styles.heroStat}><strong style={{ color: 'var(--gold)' }}>{total}</strong> live jobs</span>
            <span style={styles.heroStatDot} />
            <span style={styles.heroStat}><strong style={{ color: 'var(--gold)' }}>12</strong> countries</span>
            <span style={styles.heroStatDot} />
            <span style={styles.heroStat}><strong style={{ color: 'var(--gold)' }}>100%</strong> KYC-verified agents</span>
          </div>
        </div>

        {/* ── Jobs grid ── */}
        <div style={styles.jobsSection}>
          <div style={styles.jobsSectionHeader}>
            <div style={styles.jobsSectionTitle}>
              {search ? `Results for "${search}"` : 'All Available Jobs'}
              <span style={styles.jobsCount}>{total} jobs</span>
            </div>
          </div>

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : jobs.length === 0 ? (
            <div style={styles.emptyWrap}>
              <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
              <div style={styles.emptyTitle}>No jobs found</div>
              <div style={styles.emptySub}>Try a different search term</div>
            </div>
          ) : (
            <div style={styles.jobsGrid}>
              {jobs.map((job, i) => (
                <div key={job.id} className="job-card-anim" style={{ animationDelay: `${i * 30}ms` }}>
                  <JobCard job={job} onClickLocked={() => setShowGate(true)} />
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {total > PAGE_SIZE && (
            <div style={styles.pagination}>
              <button style={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span style={styles.pageInfo}>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button style={styles.pageBtn} disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </div>

        {/* ── Login gate modal ── */}
        {showGate && (
          <div style={styles.gateOverlay} onClick={() => setShowGate(false)}>
            <div style={styles.gateModal} onClick={e => e.stopPropagation()}>
              <div style={styles.gateLockIcon}><LockIcon size={28} style={{ color: 'var(--gold)' }} /></div>
              <h3 style={styles.gateTitle}>Create a free account to view this job</h3>
              <p style={styles.gateSub}>Sign up to see full job details, apply, and track your application in real time.</p>
              <Link to="/auth/register" style={styles.gateRegisterBtn}>Create free account</Link>
              <Link to="/auth/login" style={styles.gateLoginBtn}>Already have an account? Sign in</Link>
            </div>
          </div>
        )}

        {/* ── Trust section ── */}
        <div style={styles.trust}>
          {[
            { icon: '🛡️', title: 'KYC-verified agents', desc: 'Every recruitment agent is manually verified before posting jobs.' },
            { icon: '🔒', title: 'Escrow-protected payments', desc: 'Your service fee is held securely until your agent delivers.' },
            { icon: '📄', title: 'Document gatekeeping', desc: 'All documents are admin-reviewed before they reach you.' },
            { icon: '📍', title: 'Live 6-step tracker', desc: 'See exactly where your application is at all times.' },
          ].map(t => (
            <div key={t.title} style={styles.trustCard}>
              <div style={styles.trustIcon}>{t.icon}</div>
              <div style={styles.trustTitle}>{t.title}</div>
              <div style={styles.trustDesc}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* ── Footer CTA ── */}
        <div style={styles.cta}>
          <h2 style={styles.ctaTitle}>Ready to find your international career?</h2>
          <div style={styles.ctaBtns}>
            <Link to="/auth/register?role=seeker" style={styles.ctaPrimary}>I'm looking for a job</Link>
            <Link to="/auth/register?role=agent" style={styles.ctaSecondary}>I'm a recruitment agent</Link>
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={styles.footer}>
          <div style={styles.footerLogo}>Adwuma</div>
          <div style={styles.footerLinks}>
            <a href="/terms" style={styles.footerLink}>Terms</a>
            <a href="/privacy" style={styles.footerLink}>Privacy</a>
            <a href="mailto:hello@adwuma.com" style={styles.footerLink}>Contact</a>
          </div>
          <div style={styles.footerCopy}>© 2025 Adwuma. Built by Viarnex.</div>
        </div>
      </div>
    </>
  );
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" },
  // Header
  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)', },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, maxWidth: 1200, margin: '0 auto' },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)', letterSpacing: '-0.5px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  loginBtn: { fontSize: 13, fontWeight: 500, color: 'var(--text-2)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', border: '1px solid var(--border)' },
  registerBtn: { fontSize: 13, fontWeight: 600, color: '#000', background: 'var(--gold)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' },
  // Hero
  hero: { padding: '48px 16px 40px', textAlign: 'center', background: 'linear-gradient(180deg, #0a0d16 0%, var(--bg) 100%)', maxWidth: 720, margin: '0 auto' },
  heroPill: { display: 'inline-block', fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 20, padding: '4px 12px', marginBottom: 16, letterSpacing: '0.5px', textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, lineHeight: 1.15, color: 'var(--text-1)', letterSpacing: '-1px', marginBottom: 16 },
  heroSub: { fontSize: 15, color: 'var(--text-2)', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 28px' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px', maxWidth: 560, margin: '0 auto 20px' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-1)', padding: '14px 0', fontFamily: 'Inter, sans-serif' },
  heroStats: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: 'var(--text-2)' },
  heroStat: {},
  heroStatDot: { width: 3, height: 3, borderRadius: '50%', background: 'var(--text-3)', display: 'inline-block' },
  // Jobs section
  jobsSection: { maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' },
  jobsSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  jobsSectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 10 },
  jobsCount: { fontSize: 12, fontWeight: 500, color: 'var(--text-3)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 },
  jobsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: 60, color: 'var(--text-3)' },
  emptyTitle: { fontSize: 16, fontWeight: 600, color: 'var(--text-2)' },
  emptySub: { fontSize: 13 },
  // Job card
  jobCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s', position: 'relative', display: 'flex', flexDirection: 'column', gap: 8 },
  featuredBadge: { position: 'absolute', top: 12, right: 12, display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 20, padding: '2px 8px' },
  jobCardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  jobMeta: { display: 'flex', alignItems: 'center', gap: 8 },
  jobFlag: { fontSize: 22 },
  jobCountry: { fontSize: 11, color: 'var(--text-3)', fontWeight: 500 },
  jobTypeBadge: { fontSize: 10, fontWeight: 600, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'capitalize' },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-1)', lineHeight: 1.3 },
  jobCompany: { fontSize: 13, color: 'var(--text-2)' },
  jobSalary: { fontSize: 13, fontWeight: 600, color: 'var(--gold-text)' },
  jobFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--border)' },
  jobAgent: { display: 'flex', alignItems: 'center', gap: 8 },
  agentAvatar: { width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--gold-text)' },
  agentName: { fontSize: 11, color: 'var(--text-3)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: 'var(--gold)', background: 'var(--gold-dim)', padding: '4px 10px', borderRadius: 20 },
  // Gate modal
  gateOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  gateModal: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  gateLockIcon: { width: 64, height: 64, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  gateTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: 'var(--text-1)', lineHeight: 1.3 },
  gateSub: { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6 },
  gateRegisterBtn: { display: 'block', width: '100%', background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: 15, padding: '13px 20px', borderRadius: 10, textDecoration: 'none', marginTop: 4 },
  gateLoginBtn: { fontSize: 13, color: 'var(--text-2)', textDecoration: 'none' },
  // Pagination
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 },
  pageBtn: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
  pageInfo: { fontSize: 13, color: 'var(--text-2)' },
  // Trust section
  trust: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 1200, margin: '0 auto', padding: '0 16px 48px' },
  trustCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  trustIcon: { fontSize: 28 },
  trustTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)' },
  trustDesc: { fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 },
  // CTA
  cta: { background: 'linear-gradient(135deg, var(--gold-dim) 0%, transparent 100%)', border: '1px solid var(--gold-border)', borderRadius: 20, margin: '0 16px 48px', padding: '40px 24px', textAlign: 'center', maxWidth: 1168, marginLeft: 'auto', marginRight: 'auto' },
  ctaTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: 'var(--text-1)', marginBottom: 24, lineHeight: 1.3 },
  ctaBtns: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' },
  ctaPrimary: { background: 'var(--gold)', color: '#000', fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 10, textDecoration: 'none', display: 'block' },
  ctaSecondary: { border: '1px solid var(--border)', color: 'var(--text-1)', fontWeight: 500, fontSize: 15, padding: '14px 24px', borderRadius: 10, textDecoration: 'none', display: 'block' },
  // Footer
  footer: { borderTop: '1px solid var(--border)', padding: '28px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' },
  footerLogo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--gold)' },
  footerLinks: { display: 'flex', gap: 20 },
  footerLink: { fontSize: 13, color: 'var(--text-3)', textDecoration: 'none' },
  footerCopy: { fontSize: 12, color: 'var(--text-3)' },
};
