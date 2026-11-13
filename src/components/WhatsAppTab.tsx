import React, { useEffect, useMemo, useState } from 'react';
import {
  fetchTotalWhatsAppCustomers,
  fetchTotalInboundWhatsAppMessages,
  fetchTotalOutboundWhatsAppMessages,
  fetchWhatsAppBookingConversionRate,
  fetchPeakChatHours,
  fetchPeakChatDays,
  fetchWhatsAppSentimentAnalytics,
  fetchWhatsAppSentimentTrend,
  fetchWhatsAppSentimentByTopic,
  fetchWhatsAppMostExtremeMessages,
  fetchWhatsAppKeywordTrends,
  fetchWhatsAppAgentAIPerformance,
  fetchRecentConversationLearning,
  updateConversationLearningQaLabel,
} from '@/api/analytics';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend, AreaChart, Area,
} from 'recharts';
import {
  Users, MessageSquare, Send, TrendingUp, Clock, Calendar, Smile,
  MessageCircle, Activity, Bot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

type ConversationLearningRow = {
  id: string;
  createdAt: string;
  extractedIntent: string;
  detectedEmotionalTone?: string | null;
  wasSuccessful: boolean;
  conversationOutcome?: string | null;
  userMessage: string;
  aiResponse: string;
  metadata?: {
    isFallback?: boolean;
    platform?: string;
    intentConfidence?: number;
    toneConfidence?: number;
    intentRule?: string;
    likelyIncorrect?: boolean;
    likelyIncorrectScore?: number;
    likelyIncorrectReasons?: string[];
    qaLabel?: 'correct' | 'partially_correct' | 'incorrect' | 'unsafe';
    qaReviewedAt?: string;
    qaNote?: string | null;
  } | null;
  customer?: { id: string; name: string } | null;
};

type ConversationLearningResponse = {
  items: ConversationLearningRow[];
  source?: 'conversation_learning' | 'derived_from_messages';
};

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const COLORS = {
  primary: '#3b82f6', success: '#22c55e', warning: '#eab308', danger: '#ef4444',
  neutral: '#94a3b8', purple: '#8b5cf6', teal: '#14b8a6', slate: '#64748b',
};
const SENTIMENT_COLORS = {
  positive: COLORS.success,
  negative: COLORS.danger,
  neutral: COLORS.neutral,
};

type SectionProps = { title: string; icon?: React.ElementType; action?: React.ReactNode; children: React.ReactNode; className?: string };
const Section = ({ title, icon: Icon, action, children, className = '' }: SectionProps) => (
  <Card className={`border border-border/70 shadow-none ${className}`}>
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-3">
      <CardTitle className="flex items-center gap-2 text-[13px] font-semibold">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        {title}
      </CardTitle>
      {action}
    </CardHeader>
    <CardContent className="px-4 pb-4 pt-0">{children}</CardContent>
  </Card>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">{label}</p>
      {payload.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium text-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

const chartAxis = { fontSize: 10, fill: 'hsl(var(--muted-foreground))' };
const chartGrid = '#e2e8f0';

const WhatsAppTab = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    inboundMessages: 0,
    outboundMessages: 0,
    bookingConversionRate: 0,
    peakHours: [] as any[],
    peakDays: [] as any[],
  });
  const [sentiment, setSentiment] = useState<any>(null);
  const [sentimentTrend, setSentimentTrend] = useState<any[]>([]);
  const [sentimentByTopic, setSentimentByTopic] = useState<any[]>([]);
  const [extremeMessages, setExtremeMessages] = useState<{ mostPositive: any[]; mostNegative: any[] }>({ mostPositive: [], mostNegative: [] });
  const [keywordTrends, setKeywordTrends] = useState<any[]>([]);
  const [agentAIPerformance, setAgentAIPerformance] = useState<any>(null);
  const [learningRows, setLearningRows] = useState<ConversationLearningRow[]>([]);
  const [learningSource, setLearningSource] = useState<'conversation_learning' | 'derived_from_messages' | null>(null);
  const [showLowConfidenceOnly, setShowLowConfidenceOnly] = useState(false);
  const [showLikelyIncorrectOnly, setShowLikelyIncorrectOnly] = useState(false);
  const [qaUpdating, setQaUpdating] = useState<Record<string, boolean>>({});

  const confidenceLabel = (value?: number) => {
    if (typeof value !== 'number') return 'n/a';
    if (value >= 0.85) return 'high';
    if (value >= LOW_CONFIDENCE_THRESHOLD) return 'med';
    return 'low';
  };
  const riskLabel = (score?: number) => {
    if (typeof score !== 'number') return 'n/a';
    if (score >= 0.8) return 'high';
    if (score >= LOW_CONFIDENCE_THRESHOLD) return 'med';
    return 'low';
  };

  const topLearningRows = useMemo(() => learningRows.slice(0, 20), [learningRows]);
  const lowConfidenceCount = useMemo(
    () => topLearningRows.filter((row) => typeof row.metadata?.intentConfidence === 'number' && row.metadata.intentConfidence < LOW_CONFIDENCE_THRESHOLD).length,
    [topLearningRows],
  );
  const likelyIncorrectCount = useMemo(
    () => topLearningRows.filter((row) => row.metadata?.likelyIncorrect === true || (row.metadata?.likelyIncorrectScore || 0) >= 0.6).length,
    [topLearningRows],
  );
  const visibleLearningRows = useMemo(() => topLearningRows.filter((row) => {
    const isLowConfidence = typeof row.metadata?.intentConfidence === 'number' && row.metadata.intentConfidence < LOW_CONFIDENCE_THRESHOLD;
    const isLikelyIncorrect = row.metadata?.likelyIncorrect === true || (row.metadata?.likelyIncorrectScore || 0) >= 0.6;
    if (showLowConfidenceOnly && !isLowConfidence) return false;
    if (showLikelyIncorrectOnly && !isLikelyIncorrect) return false;
    return true;
  }), [showLowConfidenceOnly, showLikelyIncorrectOnly, topLearningRows]);

  const setQaLabel = async (rowId: string, qaLabel: 'correct' | 'partially_correct' | 'incorrect' | 'unsafe') => {
    try {
      setQaUpdating((previous) => ({ ...previous, [rowId]: true }));
      await updateConversationLearningQaLabel(rowId, qaLabel);
      setLearningRows((previous) => previous.map((row) => row.id !== rowId ? row : ({
        ...row,
        metadata: { ...(row.metadata || {}), qaLabel, qaReviewedAt: new Date().toISOString() },
      })));
    } catch (error) {
      console.error('Failed to update QA label:', error);
    } finally {
      setQaUpdating((previous) => ({ ...previous, [rowId]: false }));
    }
  };

  const escapeCsv = (value: unknown) => {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const exportLowConfidenceCsv = () => {
    const rows = topLearningRows.filter((row) => typeof row.metadata?.intentConfidence === 'number' && row.metadata.intentConfidence < LOW_CONFIDENCE_THRESHOLD);
    if (!rows.length) return;
    const header = ['when', 'customer', 'intent', 'intent_confidence', 'tone', 'outcome', 'status', 'platform', 'intent_rule', 'user_message', 'ai_response'];
    const lines = rows.map((row) => [
      new Date(row.createdAt).toISOString(), row.customer?.name || row.customer?.id || 'Unknown',
      row.extractedIntent || 'unknown', typeof row.metadata?.intentConfidence === 'number' ? Math.round(row.metadata.intentConfidence * 100) : '',
      row.detectedEmotionalTone || 'neutral', row.conversationOutcome || 'unknown', row.wasSuccessful ? 'success' : 'fallback',
      row.metadata?.platform || '', row.metadata?.intentRule || '', row.userMessage || '', row.aiResponse || '',
    ]);
    const csv = [header, ...lines].map((cells) => cells.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `low-confidence-learning-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    let active = true;
    async function loadStats() {
      setLoading(true);
      try {
        const [
          totalCustomers, inboundMessages, outboundMessages, bookingConversionRate,
          peakHours, peakDays, sentimentData, sentimentTrendData, sentimentByTopicData,
          extremeMessagesData, keywordTrendsData, agentAIPerformanceData, recentLearningData,
        ] = await Promise.all([
          fetchTotalWhatsAppCustomers(),
          fetchTotalInboundWhatsAppMessages(),
          fetchTotalOutboundWhatsAppMessages(),
          fetchWhatsAppBookingConversionRate(),
          fetchPeakChatHours(),
          fetchPeakChatDays(),
          fetchWhatsAppSentimentAnalytics(),
          fetchWhatsAppSentimentTrend(),
          fetchWhatsAppSentimentByTopic(),
          fetchWhatsAppMostExtremeMessages(),
          fetchWhatsAppKeywordTrends(),
          fetchWhatsAppAgentAIPerformance(),
          fetchRecentConversationLearning(20),
        ]);
        if (!active) return;
        setStats({ totalCustomers, inboundMessages, outboundMessages, bookingConversionRate, peakHours, peakDays });
        setSentiment(sentimentData);
        setSentimentTrend(sentimentTrendData);
        setSentimentByTopic(sentimentByTopicData);
        setExtremeMessages(extremeMessagesData);
        setKeywordTrends(keywordTrendsData);
        setAgentAIPerformance(agentAIPerformanceData);
        const learningPayload = (recentLearningData || {}) as ConversationLearningResponse;
        setLearningRows(Array.isArray(learningPayload.items) ? learningPayload.items : []);
        setLearningSource(learningPayload.source || null);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadStats();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[68px] rounded-md" />)}</div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[230px] rounded-md" />)}</div>
      </div>
    );
  }

  const metricCards = [
    { label: 'Customers', value: stats.totalCustomers, icon: Users },
    { label: 'Inbound messages', value: stats.inboundMessages, icon: MessageSquare },
    { label: 'Outbound messages', value: stats.outboundMessages, icon: Send },
    { label: 'Booking conversion', value: `${(stats.bookingConversionRate * 100).toFixed(1)}%`, icon: TrendingUp },
  ];

  const sentimentData = sentiment?.distribution
    ? Object.entries(sentiment.distribution).map(([name, value]) => ({ name, value }))
    : [];

  const badgeTone = (tone: string) => {
    if (tone === 'high') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
    if (tone === 'med') return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400';
    if (tone === 'low') return 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400';
    return 'border-border text-muted-foreground';
  };

  return (
    <div className="space-y-4 p-1">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">WhatsApp Analytics</h2>
          <p className="text-xs text-muted-foreground">Customer engagement, sentiment and assistant performance</p>
        </div>
        <span className="text-[11px] text-muted-foreground">WhatsApp channel</span>
      </div>

      {/* Compact KPI strip */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border rounded-md border border-border/70 bg-card sm:grid-cols-4 sm:divide-y-0">
        {metricCards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 items-center gap-3 px-3 py-3">
            <div className="hidden rounded-md bg-muted p-2 text-muted-foreground sm:block"><Icon className="h-4 w-4" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <p className="mt-0.5 text-xl font-semibold leading-none tabular-nums text-foreground">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Activity patterns */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Section title="Peak chat hours" icon={Clock}>
          <div className="h-[190px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.peakHours} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs><linearGradient id="whatsapp-hour-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.18} /><stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={chartAxis} tickFormatter={(value) => `${value}:00`} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="count" name="Messages" stroke={COLORS.primary} strokeWidth={2} fill="url(#whatsapp-hour-fill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Peak chat days" icon={Calendar}>
          <div className="h-[190px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.peakDays} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={chartAxis} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Messages" fill={COLORS.purple} radius={[3, 3, 0, 0]} maxBarSize={34} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Sentiment */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Section title="Customer sentiment" icon={Smile}>
          <div className="relative h-[220px] w-full">
            {sentimentData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={sentimentData} cx="50%" cy="46%" innerRadius={52} outerRadius={72} paddingAngle={3} dataKey="value">
                    {sentimentData.map((entry, index) => <Cell key={`${entry.name}-${index}`} fill={SENTIMENT_COLORS[entry.name as keyof typeof SENTIMENT_COLORS] || COLORS.slate} />)}
                  </Pie>
                  <Tooltip />
                  <Legend verticalAlign="bottom" height={28} iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No sentiment data</div>}
            <div className="pointer-events-none absolute inset-x-0 top-[72px] text-center">
              <p className="text-2xl font-semibold tabular-nums text-foreground">{sentiment?.total || 0}</p>
              <p className="text-[9px] uppercase tracking-wide text-muted-foreground">Analysed</p>
            </div>
          </div>
        </Section>
        <Section title="Sentiment trend" icon={Activity} className="lg:col-span-2">
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={chartAxis} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="positive" name="Positive" stackId="sentiment" fill={SENTIMENT_COLORS.positive} />
                <Bar dataKey="neutral" name="Neutral" stackId="sentiment" fill={SENTIMENT_COLORS.neutral} />
                <Bar dataKey="negative" name="Negative" stackId="sentiment" fill={SENTIMENT_COLORS.negative} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Topics and keywords */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Section title="Sentiment by topic" icon={MessageCircle}>
          <div className="h-[225px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sentimentByTopic} layout="vertical" margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={chartGrid} />
                <XAxis type="number" hide />
                <YAxis dataKey="topic" type="category" axisLine={false} tickLine={false} tick={chartAxis} width={96} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="positive" name="Positive" stackId="topic" fill={SENTIMENT_COLORS.positive} barSize={17} />
                <Bar dataKey="neutral" name="Neutral" stackId="topic" fill={SENTIMENT_COLORS.neutral} barSize={17} />
                <Bar dataKey="negative" name="Negative" stackId="topic" fill={SENTIMENT_COLORS.negative} barSize={17} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <Section title="Trending keywords" icon={TrendingUp}>
          <div className="h-[225px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={keywordTrends?.slice(0, 10)} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartGrid} />
                <XAxis dataKey="keyword" axisLine={false} tickLine={false} tick={chartAxis} interval={0} angle={-18} textAnchor="end" height={48} />
                <YAxis axisLine={false} tickLine={false} tick={chartAxis} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" name="Mentions" fill={COLORS.teal} radius={[3, 3, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
      </div>

      {/* Agent and AI comparison */}
      {agentAIPerformance && (
        <Section title="Human agent vs AI assistant" icon={Bot}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-xs">
              <thead><tr className="border-b border-border text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-3 text-left font-medium">Metric</th>
                <th className="px-3 py-2 text-center font-medium">Human agent</th>
                <th className="px-3 py-2 text-center font-medium">AI assistant</th>
              </tr></thead>
              <tbody className="divide-y divide-border/70">
                <tr><td className="py-2.5 pr-3 font-medium text-foreground">Messages handled</td><td className="px-3 py-2.5 text-center tabular-nums">{agentAIPerformance.agent.count}</td><td className="px-3 py-2.5 text-center tabular-nums">{agentAIPerformance.ai.count}</td></tr>
                <tr><td className="py-2.5 pr-3 font-medium text-foreground">Resolution rate</td><td className="px-3 py-2.5 text-center"><Badge variant="outline" className="text-[10px]">{agentAIPerformance.agent.resolutionRate}%</Badge></td><td className="px-3 py-2.5 text-center"><Badge variant="outline" className="text-[10px]">{agentAIPerformance.ai.resolutionRate}%</Badge></td></tr>
                <tr><td className="py-2.5 pr-3 font-medium text-foreground">Positive sentiment</td>
                  {[agentAIPerformance.agent, agentAIPerformance.ai].map((item, index) => <td key={index} className="px-3 py-2.5"><div className="mx-auto flex max-w-[150px] items-center gap-2"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.sentiment.positive}%` }} /></div><span className="w-9 text-right tabular-nums text-muted-foreground">{item.sentiment.positive}%</span></div></td>)}
                </tr>
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Feedback excerpts */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Section title="Positive feedback" icon={Smile}>
          <div className="space-y-2">
            {extremeMessages.mostPositive?.slice(0, 3).map((message: any, index: number) => (
              <div key={message.id || index} className="border-b border-border/70 pb-2 last:border-0 last:pb-0">
                <p className="text-xs leading-relaxed text-foreground">“{message.content}”</p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Score: {message.score}</span><span>{new Date(message.createdAt).toLocaleDateString()}</span></div>
              </div>
            ))}
            {!extremeMessages.mostPositive?.length && <p className="py-3 text-xs text-muted-foreground">No positive feedback available</p>}
          </div>
        </Section>
        <Section title="Critical feedback" icon={Activity}>
          <div className="space-y-2">
            {extremeMessages.mostNegative?.slice(0, 3).map((message: any, index: number) => (
              <div key={message.id || index} className="border-b border-border/70 pb-2 last:border-0 last:pb-0">
                <p className="text-xs leading-relaxed text-foreground">“{message.content}”</p>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground"><span>Score: {message.score}</span><span>{new Date(message.createdAt).toLocaleDateString()}</span></div>
              </div>
            ))}
            {!extremeMessages.mostNegative?.length && <p className="py-3 text-xs text-muted-foreground">No critical feedback available</p>}
          </div>
        </Section>
      </div>

      {/* Conversation learning and QA */}
      <Section
        title="Recent AI learning"
        icon={Bot}
        action={<div className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge variant="outline" className="text-[10px]">Low confidence: {lowConfidenceCount}</Badge>
          <Badge variant="outline" className="text-[10px]">Likely incorrect: {likelyIncorrectCount}</Badge>
          <button type="button" onClick={exportLowConfidenceCsv} disabled={lowConfidenceCount === 0} className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40">Export CSV</button>
        </div>}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setShowLowConfidenceOnly((previous) => !previous)} className={`rounded border px-2 py-1 text-[10px] transition-colors ${showLowConfidenceOnly ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400' : 'border-border text-muted-foreground hover:bg-muted'}`}>{showLowConfidenceOnly ? 'Low confidence only ✓' : 'Filter low confidence'}</button>
            <button type="button" onClick={() => setShowLikelyIncorrectOnly((previous) => !previous)} className={`rounded border px-2 py-1 text-[10px] transition-colors ${showLikelyIncorrectOnly ? 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-400' : 'border-border text-muted-foreground hover:bg-muted'}`}>{showLikelyIncorrectOnly ? 'Likely incorrect only ✓' : 'Filter likely incorrect'}</button>
          </div>
          <span className="text-[10px] text-muted-foreground">Latest {topLearningRows.length} conversations</span>
        </div>
        {learningSource === 'derived_from_messages' && <p className="mb-3 rounded border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">Showing derived rows from message history until live ConversationLearning rows accumulate.</p>}
        {learningRows.length === 0 ? (
          <p className="py-5 text-center text-xs text-muted-foreground">No conversation learning rows yet. Send a few AI-handled messages, then refresh this page.</p>
        ) : visibleLearningRows.length === 0 ? (
          <p className="py-5 text-center text-xs text-muted-foreground">No rows match the selected filters in the latest 20 conversations.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-[11px]">
              <thead><tr className="border-b border-border bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-2 py-2 text-left font-medium">When</th><th className="px-2 py-2 text-left font-medium">Customer</th><th className="px-2 py-2 text-left font-medium">Intent</th><th className="px-2 py-2 text-left font-medium">Conf.</th><th className="px-2 py-2 text-left font-medium">Risk</th><th className="px-2 py-2 text-left font-medium">Tone</th><th className="px-2 py-2 text-left font-medium">Outcome</th><th className="px-2 py-2 text-left font-medium">Status</th><th className="px-2 py-2 text-left font-medium">QA review</th><th className="px-2 py-2 text-left font-medium">User message</th>
              </tr></thead>
              <tbody className="divide-y divide-border/70">
                {visibleLearningRows.map((row) => {
                  const confidence = confidenceLabel(row.metadata?.intentConfidence);
                  const risk = riskLabel(row.metadata?.likelyIncorrectScore);
                  return (
                    <tr key={row.id} className="align-top transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="max-w-[130px] truncate px-2 py-2 text-foreground" title={row.customer?.name || row.customer?.id || 'Unknown'}>{row.customer?.name || row.customer?.id || 'Unknown'}</td>
                      <td className="px-2 py-2"><Badge variant="outline" className="max-w-[130px] truncate text-[10px]">{row.extractedIntent || 'unknown'}</Badge></td>
                      <td className="px-2 py-2"><Badge variant="outline" className={`text-[10px] ${badgeTone(confidence)}`} title={`Rule: ${row.metadata?.intentRule || 'n/a'}`}>{typeof row.metadata?.intentConfidence === 'number' ? `${Math.round(row.metadata.intentConfidence * 100)}%` : 'n/a'}</Badge></td>
                      <td className="px-2 py-2"><Badge variant="outline" className={`text-[10px] ${risk === 'n/a' ? '' : badgeTone(risk)}`} title={row.metadata?.likelyIncorrectReasons?.join(', ') || 'n/a'}>{typeof row.metadata?.likelyIncorrectScore === 'number' ? `${Math.round(row.metadata.likelyIncorrectScore * 100)}%` : 'n/a'}</Badge></td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{row.detectedEmotionalTone || 'neutral'}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">{row.conversationOutcome || 'unknown'}</td>
                      <td className="px-2 py-2"><Badge variant="outline" className={`text-[10px] ${row.wasSuccessful ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400'}`}>{row.wasSuccessful ? 'Success' : 'Fallback'}</Badge></td>
                      <td className="px-2 py-2"><div className="flex min-w-[250px] flex-wrap gap-1">{(['correct', 'partially_correct', 'incorrect', 'unsafe'] as const).map((label) => (
                        <button key={label} type="button" disabled={qaUpdating[row.id] === true} onClick={() => setQaLabel(row.id, label)} className={`rounded border px-1.5 py-1 text-[9px] transition-colors ${row.metadata?.qaLabel === label ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted'} disabled:cursor-not-allowed disabled:opacity-50`}>{label === 'partially_correct' ? 'Partial' : label}</button>
                      ))}</div></td>
                      <td className="max-w-[280px] truncate px-2 py-2 text-muted-foreground" title={row.userMessage}>{row.userMessage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
};

export default WhatsAppTab;
