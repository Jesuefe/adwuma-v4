import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/currency';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import { SearchIcon, BriefcaseIcon } from '../components/ui/Icons';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

function JobCard({ job }) {
  const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
  return (
    <Link to={`/jobs/${job.id}`} style={styles.jobCard}>
      {job.cover_image_url && (
        <div style={styles.jobCover}>
          <img src={job.cover_image_url} alt="" style={styles.jobCoverImg} />
        </div>
      )}
      {job.is_featured && <div style={styles.featuredBadge}>⭐ Featured</div>}
      <div style={styles.jobCardBody}>
        <div style={styles.jobCardTop}>
          {job.company_logo_url
            ? <img src={job.company_logo_url} alt={job.company_name} style={styles.companyLogo} />
            : <span style={{ fontSize: 26 }}>{flag}</span>}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.jobCountry}>{job.countries?.name} · {job.service_fee_currency}</div>
            <div style={styles.jobTypeBadge}>{job.job_type?.replace('_', ' ')}</div>
          </div>
        </div>
        <div style={styles.jobTitle}>{job.title}</div>
        <div style={styles.jobCompany}>{job.company_name}</div>
        {job.salary_min && (
          <div style={styles.jobSalary}>
            {formatMoney(job.salary_min, job.salary_currency, { compact: true })} – {formatMoney(job.salary_max, job.salary_currency, { compact: true })} / {job.salary_period}
          </div>
        )}
        <div style={styles.jobFooter}>
          <div style={styles.agentInfo}>
            <div style={styles.agentAvatar}>{job.profiles?.first_name?.[0]}{job.profiles?.last_name?.[0]}</div>
            <span style={styles.agentName}>{job.profiles?.first_name} {job.profiles?.last_name}</span>
          </div>
          <div style={styles.applyTag}>View & Apply →</div>
        </div>
      </div>
    </Link>
  );
}

function JobsContent({ isAuthenticated }) {
  const [jobs, setJobs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [countries, setCountries] = useState([]);
  const [countryFilter, setCountryFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  useEffect(() => {
    supabase.from('countries').select('*').order('sort_order').then(({ data }) => setCountries(data || []));
  }, []);

  useEffect(() => { fetchJobs(); }, [page, countryFilter, typeFilter]);
  useEffect(() => {
    const t = setTimeout(() => { setPage(0); fetchJobs(); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  async function fetchJobs() {
    setLoading(true);
    let q = supabase.from('jobs')
      .select(`*, countries(name, code), currencies!jobs_service_fee_currency_fkey(symbol, code),
        profiles!jobs_agent_id_fkey(first_name, last_name)`, { count: 'exact' })
      .eq('status', 'active')
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (search) q = q.or(`title.ilike.%${search}%,company_name.ilike.%${search}%`);
    if (countryFilter) q = q.eq('destination_country_id', countryFilter);
    if (typeFilter) q = q.eq('job_type', typeFilter);
    const { data, count } = await q;
    setJobs(data || []);
    setTotal(count || 0);
    setLoading(false);
  }

  return (
    <div style={styles.body}>
      <div style={styles.searchSection}>
        <h1 style={styles.pageTitle}>Find Jobs Abroad</h1>
        <p style={styles.pageSub}>{total} verified international jobs available</p>
        <div style={styles.searchWrap}>
          <SearchIcon size={18} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
          <input style={styles.searchInput} placeholder="Search jobs, companies…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div style={styles.filters}>
          <select style={styles.filterSelect} value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(0); }}>
            <option value="">All Countries</option>
            {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={styles.filterSelect} value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }}>
            <option value="">All Types</option>
            <option value="full_time">Full Time</option>
            <option value="part_time">Part Time</option>
            <option value="contract">Contract</option>
            <option value="internship">Internship</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={styles.loadingWrap}><div className="spinner spinner-lg" /></div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <BriefcaseIcon size={40} style={{ color: 'var(--text-3)' }} />
          <div className="empty-title">No jobs found</div>
          <div className="empty-sub">Try adjusting your search or filters</div>
        </div>
      ) : (
        <div style={styles.grid}>
          {jobs.map(job => <JobCard key={job.id} job={job} />)}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div style={styles.pagination}>
          <button style={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
          <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
          <button style={styles.pageBtn} disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default function JobsPage() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return (
      <AppShell title="Browse Jobs">
        <JobsContent isAuthenticated={true} />
      </AppShell>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" }}>
      {/* Public header */}
      <div style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/" style={styles.logo}>Adwuma</Link>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/auth/login" style={styles.loginBtn}>Sign in</Link>
            <Link to="/auth/register" style={styles.registerBtn}>Get started</Link>
          </div>
        </div>
      </div>
      <JobsContent isAuthenticated={false} />
    </div>
  );
}

const styles = {
  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, maxWidth: 1200, margin: '0 auto' },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)', textDecoration: 'none' },
  loginBtn: { fontSize: 13, fontWeight: 500, color: 'var(--text-2)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', border: '1px solid var(--border)' },
  registerBtn: { fontSize: 13, fontWeight: 600, color: '#000', background: 'var(--gold)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' },
  body: { maxWidth: 1200, margin: '0 auto', padding: '28px 16px 48px' },
  searchSection: { marginBottom: 28 },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text-1)', marginBottom: 6, letterSpacing: '-0.5px' },
  pageSub: { fontSize: 14, color: 'var(--text-2)', marginBottom: 16 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px', marginBottom: 12, maxWidth: 600 },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-1)', padding: '14px 0', fontFamily: 'Inter, sans-serif' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  filterSelect: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', outline: 'none' },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  jobCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden', textDecoration: 'none', display: 'block', transition: 'border-color 0.15s, transform 0.15s' },
  jobCover: { width: '100%', height: 120, overflow: 'hidden' },
  jobCoverImg: { width: '100%', height: '100%', objectFit: 'cover' },
  jobCardBody: { padding: 16, display: 'flex', flexDirection: 'column', gap: 6 },
  featuredBadge: { fontSize: 10, fontWeight: 700, color: '#000', background: 'var(--gold)', padding: '3px 10px', display: 'inline-block', margin: '8px 16px 0' },
  jobCardTop: { display: 'flex', alignItems: 'center', gap: 10 },
  companyLogo: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 },
  jobCountry: { fontSize: 11, color: 'var(--text-3)', fontWeight: 500, marginBottom: 2 },
  jobTypeBadge: { fontSize: 10, fontWeight: 600, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20, display: 'inline-block', textTransform: 'capitalize' },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', lineHeight: 1.3 },
  jobCompany: { fontSize: 13, color: 'var(--text-2)' },
  jobSalary: { fontSize: 13, fontWeight: 600, color: 'var(--gold-text)' },
  jobFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)', marginTop: 4 },
  agentInfo: { display: 'flex', alignItems: 'center', gap: 6 },
  agentAvatar: { width: 24, height: 24, borderRadius: '50%', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--gold-text)' },
  agentName: { fontSize: 11, color: 'var(--text-3)' },
  applyTag: { fontSize: 11, fontWeight: 600, color: 'var(--gold)' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 },
  pageBtn: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
};
