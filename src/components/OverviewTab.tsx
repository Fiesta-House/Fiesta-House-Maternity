import { useEffect, useState, type ReactNode } from 'react';
import { fetchModelUsage, type ModelUsage } from '@/api/analytics';
import { useAuthStore } from '@/state/authStore';
import { businessAnalyticsApi } from '@/api/businessAnalytics';
import { fetchCustomerEmotionsStats, fetchSystemStats } from '@/api/statistics';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertTriangle, Users, CalendarDays, DollarSign } from 'lucide-react';
import {
  LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar,
} from 'recharts';

type Kpis = any;
type CustomerEmotions = any;
type SystemStats = any;

const MODEL_COLORS = {
  groq: '#0f766e',
  groq2: '#2563eb',
  gemini: '#dc6b3f',
  gemini2: '#b45309',
};

const SENTIMENT_COLORS = ['#10b981', '#22c55e', '#94a3b8', '#f59e0b', '#ef4444'];

const formatTokens = (value: number) => new Intl.NumberFormat('en-KE').format(value || 0);
const formatCurrency = (amount: number) => `KSH ${Number(amount || 0).toLocaleString('en-KE')}`;

const getUsageErrorMessage = (error: unknown): string => {
  const response = (error as { response?: { status?: number; data?: { error?: unknown } } })?.response;
  if (response?.status === 401) return 'Your session is missing or expired. Sign in again to view model usage.';
  if (response?.status === 403) return 'Administrator access is required to view model usage.';
  if (response) {
    const detail = typeof response.data?.error === 'string' ? `: ${response.data.error}` : '';
    return `Usage request failed (HTTP ${response.status ?? 'unknown'})${detail}`;
  }
  return 'Could not reach the backend. Check that it is running and reachable.';
};

const SectionHeading = ({ title, description, action }: {
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
    </div>
    {action}
  </div>
);

const OverviewTab = () => {
  const [kpis, setKpis] = useState<Kpis>(null);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [revenueByPackage, setRevenueByPackage] = useState<any[]>([]);
  const [customerEmotions, setCustomerEmotions] = useState<CustomerEmotions>(null);
  const [systemStats, setSystemStats] = useState<SystemStats>(null);
  const [loading, setLoading] = useState(true);
  const [usageDays, setUsageDays] = useState<7 | 30>(7);
  const [modelUsage, setModelUsage] = useState<ModelUsage | null>(null);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadUsage = async () => {
      try {
        const data = await fetchModelUsage(usageDays);
        if (active) {
          setModelUsage(data);
          setUsageError(null);
        }
      } catch (error) {
        if (active) setUsageError(getUsageErrorMessage(error));
      } finally {
        if (active) setUsageLoading(false);
      }
    };

    setUsageLoading(true);
    setUsageError(null);
    void loadUsage();
    const refresh = window.setInterval(() => { void loadUsage(); }, 60_000);
    return () => {
      active = false;
      window.clearInterval(refresh);
    };
  }, [usageDays]);

  useEffect(() => {
    let active = true;
    const loadAnalytics = async () => {
      try {
        const token = useAuthStore.getState().token;
        if (!token) return;

        const [kpisData, monthlyData, packageData, emotionsData, systemData] = await Promise.allSettled([
          businessAnalyticsApi.getBusinessKPIs(),
          businessAnalyticsApi.getMonthlyRevenue(),
          businessAnalyticsApi.getRevenueByPackage(),
          fetchCustomerEmotionsStats(),
          fetchSystemStats(),
        ]);

        if (!active) return;
        setKpis(kpisData.status === 'fulfilled' ? kpisData.value : null);
        setMonthlyRevenue(monthlyData.status === 'fulfilled' && Array.isArray(monthlyData.value) ? monthlyData.value : []);
        setRevenueByPackage(packageData.status === 'fulfilled' && Array.isArray(packageData.value) ? packageData.value : []);
        setCustomerEmotions(emotionsData.status === 'fulfilled' ? emotionsData.value : null);
        setSystemStats(systemData.status === 'fulfilled' ? systemData.value : null);
      } catch (error: any) {
        const isConnectionError = error?.code === 'ERR_NETWORK' ||
          error?.message?.includes('Failed to fetch') ||
          error?.message?.includes('ERR_CONNECTION_REFUSED');
        if (!isConnectionError) console.error('Failed to load analytics:', error);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadAnalytics();
    return () => { active = false; };
  }, []);

  const refreshUsage = async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const data = await fetchModelUsage(usageDays);
      setModelUsage(data);
    } catch (error) {
      setUsageError(getUsageErrorMessage(error));
    } finally {
      setUsageLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
        Loading overview...
      </div>
    );
  }

  const todayUsage = modelUsage?.daily.find((day) => day.date === new Date().toISOString().slice(0, 10));
  const groqTokensToday = (todayUsage?.groq || 0) + (todayUsage?.groq2 || 0);
  const groqCooldownActive = !!modelUsage?.groqCooldownUntil && new Date(modelUsage.groqCooldownUntil).getTime() > Date.now();
  const latestGroqCall = modelUsage?.recent.find((row) => row.provider === 'groq');
  const providerTotal = modelUsage
    ? modelUsage.summary.groq.totalTokens + modelUsage.summary.groq2.totalTokens + modelUsage.summary.gemini.totalTokens + modelUsage.summary.gemini2.totalTokens
    : 0;
  const providerCalls = modelUsage
    ? modelUsage.summary.groq.calls + modelUsage.summary.groq2.calls + modelUsage.summary.gemini.calls + modelUsage.summary.gemini2.calls
    : 0;

  const kpiItems = [
    { label: 'Total revenue', value: formatCurrency(kpis?.revenue?.total || 0), icon: DollarSign },
    { label: 'Total bookings', value: systemStats?.bookings?.total || 0, icon: CalendarDays },
    { label: 'Total customers', value: kpis?.customerMetrics?.totalCustomers || 0, icon: Users },
    { label: 'Open escalations', value: systemStats?.escalations?.open || 0, icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      {/* Key business figures */}
      <section aria-label="Business overview" className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border lg:grid-cols-4 lg:divide-y-0">
        {kpiItems.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center justify-between gap-3 px-3 py-3 first:pl-0 lg:py-4">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
            </div>
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        ))}
      </section>

      {/* AI model usage */}
      <section aria-label="AI model usage" className="space-y-4">
        <SectionHeading
          title="AI model usage"
          description="Provider usage for the selected period · UTC · refreshes every minute"
          action={(
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border border-border p-0.5" aria-label="Usage period">
                {([7, 30] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setUsageDays(days)}
                    aria-pressed={usageDays === days}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${usageDays === days ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {days} days
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void refreshUsage()} aria-label="Refresh model usage" title="Refresh model usage">
                <RefreshCw className={`h-3.5 w-3.5 ${usageLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          )}
        />

        {usageError && <p role="alert" className="text-xs text-destructive">{usageError}</p>}

        {modelUsage && (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border pb-3">
            <span className="text-xl font-semibold tabular-nums text-foreground">{formatTokens(modelUsage.allTimeTokens)}</span>
            <span className="text-xs text-muted-foreground">Lifetime customer counters · older usage has no provider attribution</span>
          </div>
        )}

        {modelUsage && (modelUsage.summary.groq.calls + modelUsage.summary.groq2.calls > 0 || groqCooldownActive) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Groq · today UTC</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums">{formatTokens(groqTokensToday)} <span className="text-xs font-normal text-muted-foreground">tokens recorded here</span></p>
            </div>
            <div className="text-right">
              <p className={`text-xs font-medium ${groqCooldownActive ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'}`}>
                {groqCooldownActive ? 'Rate limited · cooldown active' : latestGroqCall?.errorCode ? `Latest primary error: ${latestGroqCall.errorCode} · no active cooldown` : 'No active Groq cooldown'}
              </p>
              {groqCooldownActive && <p className="mt-1 text-xs text-muted-foreground">Retry after {new Date(modelUsage.groqCooldownUntil!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · configured fallbacks handle new turns</p>}
              <p className="mt-1 text-xs text-muted-foreground">Local usage does not show Groq’s actual remaining balance.</p>
            </div>
          </div>
        )}

        {!modelUsage ? (
          usageLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Loading model usage...</p> : !usageError && <p className="py-8 text-center text-sm text-muted-foreground">No usage data available.</p>
        ) : providerCalls === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-medium text-foreground">No Groq or Gemini calls recorded in this period</p>
            <p className="mt-1 text-xs text-muted-foreground">Provider breakdown starts with new AI responses.</p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,1fr)]">
            <div className="min-w-0">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-xs text-muted-foreground">Daily tokens · UTC</span>
                <span className="text-xs font-semibold tabular-nums">{formatTokens(providerTotal)} total</span>
              </div>
              <div className="h-[190px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelUsage.daily} margin={{ top: 6, right: 4, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={usageDays === 30 ? 4 : 0} />
                    <YAxis tickFormatter={(value: number) => value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip formatter={(value: number, name: string) => [formatTokens(value), name === 'groq' ? 'Groq primary' : name === 'groq2' ? 'Groq backup' : name === 'gemini' ? 'Gemini' : 'Gemini backup 2']} contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }} />
                    <Bar dataKey="groq" stackId="usage" fill={MODEL_COLORS.groq} name="Groq" maxBarSize={28} />
                    <Bar dataKey="groq2" stackId="usage" fill={MODEL_COLORS.groq2} name="Groq backup" maxBarSize={28} />
                    <Bar dataKey="gemini" stackId="usage" fill={MODEL_COLORS.gemini} name="Gemini" maxBarSize={28} />
                    <Bar dataKey="gemini2" stackId="usage" fill={MODEL_COLORS.gemini2} name="Gemini backup 2" maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0 divide-y divide-border border-y border-border">
              {(['groq', 'groq2', 'gemini', 'gemini2'] as const).map((provider) => {
                const row = modelUsage.summary[provider];
                return (
                  <div key={provider} className="py-2.5 first:pt-2 last:pb-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-xs font-medium">
                        <span className="h-2 w-2 rounded-sm" style={{ background: MODEL_COLORS[provider] }} />
                        {provider === 'groq' ? 'Groq · Primary' : provider === 'groq2' ? 'Groq · Backup' : provider === 'gemini' ? 'Gemini · Backup' : 'Gemini · Final fallback'}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">{formatTokens(row.totalTokens)}</span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${providerTotal ? row.totalTokens / providerTotal * 100 : 0}%`, background: MODEL_COLORS[provider] }} />
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{formatTokens(row.inputTokens)} input · {formatTokens(row.outputTokens)} output · {row.calls} calls{row.failures ? ` · ${row.failures} failed` : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {modelUsage && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-foreground">Recent model activity</h3>
              <span className="text-[11px] text-muted-foreground">Latest 4 calls</span>
            </div>
            {modelUsage.recent.length === 0 ? (
              <p className="text-xs text-muted-foreground">No model calls recorded yet.</p>
            ) : (
              <div className="divide-y divide-border/70">
                {modelUsage.recent.slice(0, 4).map((row, index) => (
                  <div key={`${row.createdAt}-${index}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-xs">
                    <span className="min-w-0 truncate text-muted-foreground">
                      <span className="font-medium text-foreground">{row.provider === 'gemini2' ? 'Gemini backup 2' : row.provider === 'gemini' ? 'Gemini' : row.provider === 'groq2' ? 'Groq backup' : 'Groq primary'}</span>
                      {row.failover ? ' · failover' : ''}{row.status !== 'success' ? ` · error ${row.errorCode || ''}` : ''}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{formatTokens(row.totalTokens)} tokens · {new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {modelUsage && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold text-foreground">Customer token counters</h3>
              <span className="text-[11px] text-muted-foreground">Top 20 · lifetime customer counters, not period provider totals</span>
            </div>
            {!modelUsage.customerUsage?.length ? (
              <p className="py-3 text-xs text-muted-foreground">No customer token usage recorded yet.</p>
            ) : (
              <div className="max-h-[340px] overflow-auto">
                <table className="w-full min-w-[440px] text-xs">
                  <thead className="sticky top-0 bg-background text-[11px] text-muted-foreground">
                    <tr className="border-b border-border">
                      <th scope="col" className="py-2 pr-3 text-left font-medium">Customer</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">Today (server time)</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">All time</th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modelUsage.customerUsage.map((customer) => {
                      const share = modelUsage.allTimeTokens > 0 ? customer.totalTokens / modelUsage.allTimeTokens * 100 : 0;
                      return (
                        <tr key={customer.id} className="border-b border-border/60 last:border-0">
                          <td className="max-w-[200px] truncate py-2 pr-3 font-medium text-foreground" title={customer.name}>{customer.name || 'Unnamed customer'}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{formatTokens(customer.todayTokens)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-foreground">{formatTokens(customer.totalTokens)}</td>
                          <td className="w-28 py-2 pl-3 text-right tabular-nums text-muted-foreground">
                            <span>{share.toFixed(1)}%</span>
                            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-teal-700" style={{ width: `${Math.min(100, share)}%` }} /></div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Revenue */}
      <section className="space-y-3">
        <SectionHeading title="Revenue" description="Monthly revenue and package performance" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
          <div className="min-w-0">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Monthly revenue</h3>
            {monthlyRevenue.length === 0 ? (
              <p className="flex h-48 items-center justify-center text-xs text-muted-foreground">No revenue data available.</p>
            ) : (
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyRevenue} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(value) => value >= 1000 ? `${Math.round(value / 1000)}k` : value} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }} formatter={(value: any) => formatCurrency(value)} />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Package performance</h3>
            <div className="overflow-x-auto border-y border-border">
              <table className="w-full min-w-[360px] text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 pr-2 text-left font-medium">Package</th>
                    <th className="px-2 py-2 text-right font-medium">Revenue</th>
                    <th className="px-2 py-2 text-right font-medium">Bookings</th>
                    <th className="py-2 pl-2 text-right font-medium">Avg. value</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueByPackage.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground">No bookings yet.</td></tr>
                  ) : revenueByPackage.map((pkg, index) => (
                    <tr key={`${pkg.package}-${index}`} className="border-b border-border/60 last:border-0">
                      <td className="py-2.5 pr-2 font-medium text-foreground">{pkg.package}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums">{formatCurrency(pkg.revenue)}</td>
                      <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{pkg.bookings}</td>
                      <td className="py-2.5 pl-2 text-right tabular-nums text-muted-foreground">{formatCurrency(pkg.avgValue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* Customer sentiment */}
      {customerEmotions && (
        <section className="space-y-3">
          <SectionHeading title="Customer sentiment" description="Recorded customer sentiment and recent trend" />
          <div className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border lg:grid-cols-4 lg:divide-y-0">
            {[
              { label: 'Total sentiments', value: customerEmotions.total || 0 },
              { label: 'Average score', value: (customerEmotions.averageScore || 0).toFixed(2) },
              { label: 'Positive', value: `${(customerEmotions.distribution?.percentages?.positive || 0).toFixed(1)}%` },
              { label: 'Needs attention', value: customerEmotions.customersNeedingAttention?.length || 0 },
            ].map((item) => (
              <div key={item.label} className="px-3 py-3 first:pl-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="min-w-0">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Sentiment distribution</h3>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Very positive', value: customerEmotions.distribution?.very_positive || 0 },
                        { name: 'Positive', value: customerEmotions.distribution?.positive || 0 },
                        { name: 'Neutral', value: customerEmotions.distribution?.neutral || 0 },
                        { name: 'Negative', value: customerEmotions.distribution?.negative || 0 },
                        { name: 'Very negative', value: customerEmotions.distribution?.very_negative || 0 },
                      ]}
                      cx="50%"
                      cy="48%"
                      labelLine={false}
                      label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={68}
                      dataKey="value"
                    >
                      {SENTIMENT_COLORS.map((color, index) => <Cell key={`sentiment-${index}`} fill={color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="min-w-0">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Sentiment trend · 7 days</h3>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={Array.isArray(customerEmotions?.recentTrends) ? customerEmotions.recentTrends : []} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 11 }} />
                    <Area type="monotone" dataKey="avgScore" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.12} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default OverviewTab;
