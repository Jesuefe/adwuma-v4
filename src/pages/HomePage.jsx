import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import { SearchIcon, BriefcaseIcon, StarIcon, LockIcon } from '../components/ui/Icons';
import SaveJobButton from '../components/ui/SaveJobButton';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

function JobCard({ job, onClickLocked, isLoggedIn }) {
  const country = job.countries;
  const flag = COUNTRY_FLAGS[country?.code] || '🌍';

  if (isLoggedIn) {
    return (
      <Link to={`/jobs/${job.id}`} style={styles.jobCard}>
        {job.cover_image_url && <div style={styles.jobCover}><img src={job.cover_image_url} alt="" style={styles.jobCoverImg} /></div>}
        {job.is_featured && <div style={styles.featuredBadge}><StarIcon size={10} /> Featured</div>}
        <div style={styles.jobCardTop}>
          {job.company_logo_url
            ? <img src={job.company_logo_url} alt={job.company_name} style={styles.companyLogo} />
            : <span style={{ fontSize: 26 }}>{flag}</span>}
          <div>
            <div style={styles.jobCountry}>{country?.name} · {job.service_fee_currency}</div>
            <div style={styles.jobTypeBadge}>{job.job_type?.replace('_', ' ')}</div>
          </div>
        </div>
        <div style={styles.jobTitle}>{job.title}</div>
        <div style={styles.jobCompany}>{job.company_name}</div>
        {job.salary_min && <div style={styles.jobSalary}>{formatMoney(job.salary_min, job.salary_currency, { compact: true })} – {formatMoney(job.salary_max, job.salary_currency, { compact: true })} / {job.salary_period}</div>}
        <div style={styles.jobFooter}>
          <div style={styles.jobAgent}>
            <div style={styles.agentAvatar}>{job.profiles?.first_name?.[0]}{job.profiles?.last_name?.[0]}</div>
            <span style={styles.agentName}>{job.profiles?.first_name} {job.profiles?.last_name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <SaveJobButton jobId={job.id} />
            <div style={styles.viewBtn}>View →</div>
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div style={styles.jobCard} onClick={onClickLocked}>
      {job.cover_image_url && <div style={styles.jobCover}><img src={job.cover_image_url} alt="" style={{ ...styles.jobCoverImg, filter: 'blur(4px)' }} /></div>}
      {job.is_featured && <div style={styles.featuredBadge}><StarIcon size={10} /> Featured</div>}
      <div style={styles.jobCardTop}>
        {job.company_logo_url
          ? <img src={job.company_logo_url} alt={job.company_name} style={{ ...styles.companyLogo, filter: 'blur(6px)' }} />
          : <span style={{ fontSize: 26 }}>{flag}</span>}
        <div>
          <div style={styles.jobCountry}>{country?.name} · {job.service_fee_currency}</div>
          <div style={styles.jobTypeBadge}>{job.job_type?.replace('_', ' ')}</div>
        </div>
      </div>
      <div style={styles.jobTitle}>{job.title}</div>
      <div style={styles.jobCompany}>{job.company_name}</div>
      {job.salary_min && <div style={styles.jobSalary}>{formatMoney(job.salary_min, job.salary_currency, { compact: true })} – {formatMoney(job.salary_max, job.salary_currency, { compact: true })} / {job.salary_period}</div>}
      <div style={styles.jobFooter}>
        <div style={styles.jobAgent}>
          <div style={styles.agentAvatar}>{job.profiles?.first_name?.[0]}{job.profiles?.last_name?.[0]}</div>
          <span style={styles.agentName}>{job.profiles?.first_name} {job.profiles?.last_name}</span>
        </div>
        <div style={styles.viewBtn}><LockIcon size={12} /> View</div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const { isAuthenticated, profile } = useAuth();
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
    let q = supabase.from('jobs')
      .select(`*, countries(name, code),
        currencies!jobs_service_fee_currency_fkey(symbol, code),
        profiles!jobs_agent_id_fkey(first_name, last_name)`,
        { count: 'exact' })
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (search) q = q.or(`title.ilike.%${search}%,company_name.ilike.%${search}%`);
    const { data, count } = await q;
    setJobs(data || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [page]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); fetchJobs(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const handleDashboard = () => {
    if (!profile) return navigate('/auth/login');
    if (profile.role === 'agent') navigate('/agent');
    else if (profile.role === 'admin') navigate('/admin');
    else navigate('/dashboard');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #05080f; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .job-card-anim { animation: fadeIn 0.3s ease forwards; }
        .job-card:hover { border-color: rgba(245,158,11,0.3) !important; transform: translateY(-2px); }
      `}</style>
      <div style={styles.root}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.logo}>Adwuma</div>
            <div style={styles.headerRight}>
              {isAuthenticated ? (
                <button onClick={handleDashboard} style={styles.registerBtn}>My Dashboard</button>
              ) : (
                <>
                  <Link to="/auth/login" style={styles.loginBtn}>Sign in</Link>
                  <Link to="/auth/register" style={styles.registerBtn}>Get started</Link>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          <div style={styles.heroPill}>Verified international recruitment</div>
          <h1 style={styles.heroTitle}>Find your job<br />abroad, safely.</h1>
          <p style={styles.heroSub}>Every agent is KYC-verified. Every payment is escrow-protected. Every step is tracked.</p>
          <div style={styles.searchWrap}>
            <SearchIcon size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            <input style={styles.searchInput} placeholder="Search jobs, companies, countries…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={styles.heroStats}>
            <span><strong style={{ color: '#f59e0b' }}>{total}</strong> live jobs</span>
            <span style={styles.dot} />
            <span><strong style={{ color: '#f59e0b' }}>12</strong> countries</span>
            <span style={styles.dot} />
            <span><strong style={{ color: '#f59e0b' }}>100%</strong> KYC-verified agents</span>
          </div>
        </div>

        {/* Jobs grid */}
        <div style={styles.jobsSection}>
          <div style={styles.jobsSectionHeader}>
            <div style={styles.jobsSectionTitle}>
              All Available Jobs
              <span style={styles.jobsCount}>{total} jobs</span>
            </div>
            <Link to="/jobs" style={styles.seeAllBtn}>See all →</Link>
          </div>

          {loading ? (
            <div style={styles.loadingWrap}>
              <div style={{ width: 32, height: 32, border: '3px solid rgba(245,158,11,0.2)', borderTop: '3px solid #f59e0b', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : jobs.length === 0 ? (
            <div style={styles.emptyWrap}>
              <BriefcaseIcon size={40} style={{ color: '#4b5563' }} />
              <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af', marginTop: 12 }}>No jobs available yet</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 6 }}>Check back soon — agents are posting new opportunities</div>
            </div>
          ) : (
            <div style={styles.jobsGrid}>
              {jobs.map((job, i) => (
                <div key={job.id} className="job-card-anim" style={{ animationDelay: `${i * 30}ms` }}>
                  <JobCard
                    job={job}
                    isLoggedIn={isAuthenticated}
                    onClickLocked={() => setShowGate(true)}
                  />
                </div>
              ))}
            </div>
          )}

          {total > PAGE_SIZE && (
            <div style={styles.pagination}>
              <button style={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
              <button style={styles.pageBtn} disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </div>

        {/* Login gate */}
        {showGate && (
          <div style={styles.gateOverlay} onClick={() => setShowGate(false)}>
            <div style={styles.gateModal} onClick={e => e.stopPropagation()}>
              <div style={styles.gateLock}><LockIcon size={28} style={{ color: '#f59e0b' }} /></div>
              <h3 style={styles.gateTitle}>Create a free account to view this job</h3>
              <p style={styles.gateSub}>Sign up to see full job details, salary, and apply securely through escrow.</p>
              <Link to="/auth/register" style={styles.gateRegisterBtn}>Create free account</Link>
              <Link to="/auth/login" style={styles.gateLoginBtn}>Already have an account? Sign in</Link>
            </div>
          </div>
        )}

        {/* Trust section */}
        <div style={styles.trust}>
          {[
            { icon: '🛡️', title: 'KYC-verified agents', desc: 'Every recruitment agent is manually verified before posting jobs.' },
            { icon: '🔒', title: 'Escrow-protected payments', desc: 'Your service fee is held securely until your agent delivers.' },
            { icon: '📄', title: 'Document gatekeeping', desc: 'All documents are admin-reviewed before they reach you.' },
            { icon: '📍', title: 'Live 6-step tracker', desc: 'See exactly where your application is at all times.' },
          ].map(t => (
            <div key={t.title} style={styles.trustCard}>
              <div style={{ fontSize: 28 }}>{t.icon}</div>
              <div style={styles.trustTitle}>{t.title}</div>
              <div style={styles.trustDesc}>{t.desc}</div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={styles.cta}>
          <h2 style={styles.ctaTitle}>Ready to find your international career?</h2>
          <div style={styles.ctaBtns}>
            <Link to="/auth/register" style={styles.ctaPrimary}>I'm looking for a job</Link>
            <Link to="/auth/register" style={styles.ctaSecondary}>I'm a recruitment agent</Link>
          </div>
        </div>

        {/* Footer */}
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
  root: { minHeight: '100vh', background: '#05080f', fontFamily: "'Inter', sans-serif" },
  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, maxWidth: 1200, margin: '0 auto' },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: '#f59e0b' },
  headerRight: { display: 'flex', gap: 8 },
  loginBtn: { fontSize: 13, fontWeight: 500, color: '#9ca3af', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', border: '1px solid rgba(255,255,255,0.07)' },
  registerBtn: { fontSize: 13, fontWeight: 600, color: '#000', background: '#f59e0b', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif' },
  hero: { padding: '48px 16px 40px', textAlign: 'center', maxWidth: 720, margin: '0 auto' },
  heroPill: { display: 'inline-block', fontSize: 11, fontWeight: 600, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 20, padding: '4px 12px', marginBottom: 16, letterSpacing: '0.5px', textTransform: 'uppercase' },
  heroTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 36, lineHeight: 1.15, color: '#f0f0f0', letterSpacing: '-1px', marginBottom: 16 },
  heroSub: { fontSize: 15, color: '#9ca3af', lineHeight: 1.7, maxWidth: 480, margin: '0 auto 28px' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '0 16px', maxWidth: 560, margin: '0 auto 20px' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: '#f0f0f0', padding: '14px 0', fontFamily: 'Inter, sans-serif' },
  heroStats: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap', fontSize: 13, color: '#9ca3af' },
  dot: { width: 3, height: 3, borderRadius: '50%', background: '#4b5563', display: 'inline-block' },
  jobsSection: { maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' },
  jobsSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  jobsSectionTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 18, color: '#f0f0f0', display: 'flex', alignItems: 'center', gap: 10 },
  jobsCount: { fontSize: 12, fontWeight: 500, color: '#4b5563', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 },
  seeAllBtn: { fontSize: 13, color: '#f59e0b', textDecoration: 'none', fontWeight: 500 },
  jobsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  emptyWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 24px', textAlign: 'center' },
  jobCard: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s', display: 'flex', flexDirection: 'column', gap: 0, textDecoration: 'none' },
  jobCover: { width: '100%', height: 120, overflow: 'hidden', position: 'relative' },
  jobCoverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  jobCardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '14px 16px 8px' },
  companyLogo: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.07)' },
  jobCountry: { fontSize: 11, color: '#4b5563', fontWeight: 500 },
  jobTypeBadge: { fontSize: 10, fontWeight: 600, color: '#9ca3af', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20, textTransform: 'capitalize' },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#f0f0f0', lineHeight: 1.3, padding: '0 16px 4px' },
  jobCompany: { fontSize: 13, color: '#9ca3af', padding: '0 16px 4px' },
  jobSalary: { fontSize: 13, fontWeight: 600, color: '#fbbf24', padding: '0 16px 4px' },
  jobFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 14px', borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 8 },
  jobAgent: { display: 'flex', alignItems: 'center', gap: 6 },
  agentAvatar: { width: 24, height: 24, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fbbf24' },
  agentName: { fontSize: 11, color: '#4b5563', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  viewBtn: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#f59e0b' },
  featuredBadge: { position: 'absolute', top: 8, right: 8, display: 'flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.9)', padding: '2px 8px', borderRadius: 20, color: '#000' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 },
  pageBtn: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', color: '#f0f0f0', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
  gateOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  gateModal: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: 32, maxWidth: 380, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  gateLock: { width: 64, height: 64, borderRadius: '50%', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  gateTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 20, color: '#f0f0f0', lineHeight: 1.3 },
  gateSub: { fontSize: 14, color: '#9ca3af', lineHeight: 1.6 },
  gateRegisterBtn: { display: 'block', width: '100%', background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: 15, padding: '13px 20px', borderRadius: 10, textDecoration: 'none' },
  gateLoginBtn: { fontSize: 13, color: '#9ca3af', textDecoration: 'none' },
  trust: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, maxWidth: 1200, margin: '0 auto', padding: '0 16px 48px' },
  trustCard: { background: '#0d1117', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 8 },
  trustTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: '#f0f0f0' },
  trustDesc: { fontSize: 13, color: '#9ca3af', lineHeight: 1.6 },
  cta: { background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, transparent 100%)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20, margin: '0 16px 48px', padding: '40px 24px', textAlign: 'center', maxWidth: 1168, marginLeft: 'auto', marginRight: 'auto' },
  ctaTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 24, color: '#f0f0f0', marginBottom: 24, lineHeight: 1.3 },
  ctaBtns: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 360, margin: '0 auto' },
  ctaPrimary: { background: '#f59e0b', color: '#000', fontWeight: 700, fontSize: 15, padding: '14px 24px', borderRadius: 10, textDecoration: 'none', display: 'block' },
  ctaSecondary: { border: '1px solid rgba(255,255,255,0.07)', color: '#f0f0f0', fontWeight: 500, fontSize: 15, padding: '14px 24px', borderRadius: 10, textDecoration: 'none', display: 'block' },
  footer: { borderTop: '1px solid rgba(255,255,255,0.07)', padding: '28px 16px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' },
  footerLogo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 18, color: '#f59e0b' },
  footerLinks: { display: 'flex', gap: 20 },
  footerLink: { fontSize: 13, color: '#4b5563', textDecoration: 'none' },
  footerCopy: { fontSize: 12, color: '#4b5563' },
};
