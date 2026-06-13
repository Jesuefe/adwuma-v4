import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell from '../components/layout/AppShell';
import { supabase } from '../lib/supabase';
import { formatMoney } from '../lib/currency';
import { SearchIcon, MapPinIcon, FilterIcon, BriefcaseIcon } from '../components/ui/Icons';

const COUNTRY_FLAGS = { DE:'🇩🇪',GB:'🇬🇧',CA:'🇨🇦',AE:'🇦🇪',PL:'🇵🇱',NL:'🇳🇱',US:'🇺🇸',AU:'🇦🇺',BE:'🇧🇪',IE:'🇮🇪',NG:'🇳🇬',GH:'🇬🇭' };

function JobCard({ job }) {
  const flag = COUNTRY_FLAGS[job.countries?.code] || '🌍';
  return (
    <Link to={`/jobs/${job.id}`} style={styles.jobCard}>
      {job.is_featured && <div style={styles.featuredBadge}>⭐ Featured</div>}
      <div style={styles.jobCardTop}>
        <span style={{ fontSize: 28 }}>{flag}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.jobTitle}>{job.title}</div>
          <div style={styles.jobMeta}>{job.company_name}</div>
          <div style={styles.jobCountry}>{job.countries?.name} · {job.countries?.code} · {job.service_fee_currency}</div>
        </div>
        <div style={styles.jobTypeBadge}>{job.job_type?.replace('_', ' ')}</div>
      </div>
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
    </Link>
  );
}

export default function JobsPage() {
  const { isAuthenticated, profile } = useAuth();
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

  useEffect(() => {
    fetchJobs();
  }, [page, countryFilter, typeFilter]);

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

  const inner = (
    <div style={styles.root}>
      {/* Header — only show when not in AppShell */}
      {!isAuthenticated && <div style={styles.header}>
        <div style={styles.headerInner}>
          <Link to="/" style={styles.logo}>Adwuma</Link>
          <div style={styles.headerRight}>
            {isAuthenticated ? (
              <Link to="/dashboard" style={styles.dashBtn}>My Dashboard</Link>
            ) : (
              <>
                <Link to="/auth/login" style={styles.loginBtn}>Sign in</Link>
                <Link to="/auth/register" style={styles.registerBtn}>Get started</Link>
              </>
            )}
          </div>
        </div>
      </div>}

      <div style={styles.body}>
        {/* Search + filters */}
        <div style={styles.searchSection}>
          <h1 style={styles.pageTitle}>Find Jobs Abroad</h1>
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
          <div style={styles.resultCount}>{total} job{total !== 1 ? 's' : ''} found</div>
        </div>

        {/* Jobs grid */}
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

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div style={styles.pagination}>
            <button style={styles.pageBtn} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Previous</button>
            <span style={styles.pageInfo}>Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}</span>
            <button style={styles.pageBtn} disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        )}
      </div>
    </div>
  );

  if (isAuthenticated) return <AppShell title="Browse Jobs">{inner}</AppShell>;
  return inner;
}

const styles = {
  root: { minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Inter', sans-serif" },
  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,15,0.92)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border)' },
  headerInner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: 56, maxWidth: 1200, margin: '0 auto' },
  logo: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)', textDecoration: 'none' },
  headerRight: { display: 'flex', gap: 8 },
  loginBtn: { fontSize: 13, fontWeight: 500, color: 'var(--text-2)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none', border: '1px solid var(--border)' },
  registerBtn: { fontSize: 13, fontWeight: 600, color: '#000', background: 'var(--gold)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' },
  dashBtn: { fontSize: 13, fontWeight: 600, color: '#000', background: 'var(--gold)', padding: '7px 14px', borderRadius: 8, textDecoration: 'none' },
  body: { maxWidth: 1200, margin: '0 auto', padding: '32px 16px' },
  searchSection: { marginBottom: 32 },
  pageTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text-1)', marginBottom: 16, letterSpacing: '-0.5px' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, padding: '0 16px', marginBottom: 12 },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 15, color: 'var(--text-1)', padding: '14px 0', fontFamily: 'Inter, sans-serif' },
  filters: { display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
  filterSelect: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'Inter, sans-serif', outline: 'none' },
  resultCount: { fontSize: 13, color: 'var(--text-3)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  loadingWrap: { display: 'flex', justifyContent: 'center', padding: 60 },
  jobCard: { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10, textDecoration: 'none', position: 'relative', transition: 'border-color 0.15s' },
  featuredBadge: { position: 'absolute', top: 12, right: 12, fontSize: 10, fontWeight: 700, color: 'var(--gold)', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', borderRadius: 20, padding: '2px 8px' },
  jobCardTop: { display: 'flex', alignItems: 'flex-start', gap: 10 },
  jobTitle: { fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--text-1)', marginBottom: 2 },
  jobMeta: { fontSize: 12, color: 'var(--text-2)', marginBottom: 2 },
  jobCountry: { fontSize: 11, color: 'var(--text-3)', fontWeight: 500 },
  jobTypeBadge: { fontSize: 10, fontWeight: 600, color: 'var(--text-2)', background: 'rgba(255,255,255,0.05)', padding: '3px 8px', borderRadius: 20, whiteSpace: 'nowrap', textTransform: 'capitalize', flexShrink: 0 },
  jobSalary: { fontSize: 13, fontWeight: 600, color: 'var(--gold-text)' },
  jobFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid var(--border)' },
  agentInfo: { display: 'flex', alignItems: 'center', gap: 6 },
  agentAvatar: { width: 24, height: 24, borderRadius: '50%', background: 'var(--gold-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--gold-text)' },
  agentName: { fontSize: 11, color: 'var(--text-3)' },
  applyTag: { fontSize: 11, fontWeight: 600, color: 'var(--gold-text)' },
  pagination: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginTop: 32 },
  pageBtn: { background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'Inter, sans-serif' },
  pageInfo: { fontSize: 13, color: 'var(--text-2)' },
};
