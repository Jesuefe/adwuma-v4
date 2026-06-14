import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/currency';
import AppShell from '../../components/layout/AppShell';
import { TrendingUpIcon, DollarIcon, UsersIcon, BriefcaseIcon, MapPinIcon } from '../../components/ui/Icons';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

function StatCard({ icon: Ico, label, value, sub, color }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{label}</span>
        <Ico size={16} style={{ color }} />
      </div>
      <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 28, color: 'var(--text-1)' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{sub}</div>}
    </div>
  );
}

function BarChart({ data, valueKey, labelKey, color = 'var(--gold)', formatVal }) {
  if (!data?.length) return <div style={{ fontSize: 13, color: 'var(--text-3)', padding: 20, textAlign: 'center' }}>No data yet</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0));
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 160, paddingTop: 8 }}>
      {data.map((d, i) => {
        const pct = max > 0 ? ((d[valueKey] || 0) / max) * 100 : 0;
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{formatVal ? formatVal(d[valueKey]) : d[valueKey]}</div>
            <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', borderRadius: 4, height: 120, display: 'flex', alignItems: 'flex-end' }}>
              <div style={{ width: '100%', background: color, borderRadius: '4px 4px 0 0', height: `${Math.max(pct, 2)}%`, transition: 'height 0.5s ease' }} />
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-3)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{d[labelKey]}</div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const [months] = useState(6);

  const { data: stats } = useQuery({
    queryKey: ['admin_analytics', months],
    queryFn: async () => {
      const now = new Date();
      const monthlyData = [];

      for (let i = months - 1; i >= 0; i--) {
        const start = startOfMonth(subMonths(now, i));
        const end = endOfMonth(subMonths(now, i));
        const label = format(start, 'MMM');

        const [
          { count: apps },
          { data: payments },
          { count: newUsers },
          { count: newJobs },
        ] = await Promise.all([
          supabase.from('applications').select('id', { count: 'exact', head: true })
            .gte('applied_at', start.toISOString()).lte('applied_at', end.toISOString()),
          supabase.from('payments').select('amount, platform_fee_amount')
            .eq('escrow_status', 'released')
            .gte('released_at', start.toISOString()).lte('released_at', end.toISOString()),
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
          supabase.from('jobs').select('id', { count: 'exact', head: true })
            .gte('created_at', start.toISOString()).lte('created_at', end.toISOString()),
        ]);

        const revenue = (payments || []).reduce((s, p) => s + Number(p.platform_fee_amount || 0), 0);
        const escrow = (payments || []).reduce((s, p) => s + Number(p.amount || 0), 0);

        monthlyData.push({ label, apps: apps || 0, revenue, escrow, newUsers: newUsers || 0, newJobs: newJobs || 0 });
      }

      // Top countries
      const { data: countryJobs } = await supabase.from('jobs')
        .select('destination_country_id, countries(name)')
        .eq('status', 'active');
      const countryCounts = {};
      (countryJobs || []).forEach(j => {
        const name = j.countries?.name || 'Unknown';
        countryCounts[name] = (countryCounts[name] || 0) + 1;
      });
      const topCountries = Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([name, count]) => ({ name, count }));

      // Top agents
      const { data: agentApps } = await supabase.from('applications')
        .select('agent_id, profiles!applications_agent_id_fkey(first_name, last_name)')
        .eq('status', 'approved');
      const agentCounts = {};
      const agentNames = {};
      (agentApps || []).forEach(a => {
        const id = a.agent_id;
        agentCounts[id] = (agentCounts[id] || 0) + 1;
        agentNames[id] = `${a.profiles?.first_name} ${a.profiles?.last_name}`;
      });
      const topAgents = Object.entries(agentCounts)
        .sort((a, b) => b[1] - a[1]).slice(0, 5)
        .map(([id, count]) => ({ name: agentNames[id], count }));

      // Totals
      const totalRevenue = monthlyData.reduce((s, m) => s + m.revenue, 0);
      const totalApps = monthlyData.reduce((s, m) => s + m.apps, 0);
      const totalEscrow = monthlyData.reduce((s, m) => s + m.escrow, 0);
      const totalUsers = monthlyData.reduce((s, m) => s + m.newUsers, 0);

      return { monthlyData, topCountries, topAgents, totalRevenue, totalApps, totalEscrow, totalUsers };
    },
    refetchInterval: 60000,
  });

  return (
    <AppShell title="Analytics">
      <div className="page">
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 22, color: 'var(--text-1)', marginBottom: 4 }}>Platform Analytics</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24 }}>Last 6 months overview</div>

        {/* Summary stats */}
        <div className="grid-4" style={{ marginBottom: 28 }}>
          <StatCard icon={DollarIcon} label="Platform Revenue" value={formatMoney(stats?.totalRevenue || 0, 'NGN', { compact: true })} sub="10% of released escrow" color="var(--gold)" />
          <StatCard icon={TrendingUpIcon} label="Total Applications" value={stats?.totalApps || 0} sub="Last 6 months" color="#60a5fa" />
          <StatCard icon={DollarIcon} label="Escrow Processed" value={formatMoney(stats?.totalEscrow || 0, 'NGN', { compact: true })} sub="Released payments" color="#22c55e" />
          <StatCard icon={UsersIcon} label="New Users" value={stats?.totalUsers || 0} sub="Last 6 months" color="#a78bfa" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {/* Applications chart */}
          <div className="card">
            <div style={styles.chartTitle}>Applications per Month</div>
            <BarChart data={stats?.monthlyData || []} valueKey="apps" labelKey="label" color="var(--gold)" />
          </div>

          {/* Revenue chart */}
          <div className="card">
            <div style={styles.chartTitle}>Platform Revenue per Month (NGN)</div>
            <BarChart data={stats?.monthlyData || []} valueKey="revenue" labelKey="label" color="#22c55e" formatVal={v => formatMoney(v, 'NGN', { compact: true })} />
          </div>

          {/* New users chart */}
          <div className="card">
            <div style={styles.chartTitle}>New Users per Month</div>
            <BarChart data={stats?.monthlyData || []} valueKey="newUsers" labelKey="label" color="#60a5fa" />
          </div>

          {/* Top countries + top agents */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div className="card">
              <div style={styles.chartTitle}>Top Destination Countries</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {(stats?.topCountries || []).map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)', width: 16, flexShrink: 0 }}>{i + 1}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', marginBottom: 4 }}>{c.name}</div>
                      <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                        <div style={{ height: '100%', background: 'var(--gold)', borderRadius: 3, width: `${(c.count / (stats?.topCountries?.[0]?.count || 1)) * 100}%` }} />
                      </div>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--gold-text)', fontWeight: 600, flexShrink: 0 }}>{c.count}</span>
                  </div>
                ))}
                {!stats?.topCountries?.length && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No data yet</div>}
              </div>
            </div>

            <div className="card">
              <div style={styles.chartTitle}>Top Performing Agents</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                {(stats?.topAgents || []).map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--gold-dim)', border: '1px solid var(--gold-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: 'var(--gold-text)', flexShrink: 0 }}>
                      {a.name?.[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.count} placements</div>
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', flexShrink: 0 }}>#{i + 1}</div>
                  </div>
                ))}
                {!stats?.topAgents?.length && <div style={{ fontSize: 13, color: 'var(--text-3)' }}>No completed placements yet</div>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

const styles = {
  chartTitle: { fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 14, color: 'var(--text-1)', marginBottom: 4 },
};
