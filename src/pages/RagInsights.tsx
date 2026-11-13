import { useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Brain,
  CheckCircle2,
  Database,
  FileSearch,
  Lightbulb,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

import type { KBEntry } from '@/api/knowledgeBase';
import { type ConversationLearningRow, ragInsightsApi } from '@/api/ragInsights';

function formatDate(value?: string) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return new Intl.DateTimeFormat('en-KE', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function compactText(value: string | undefined, max = 180) {
  const text = value || '';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trim()}...`;
}

function formatSectionLabel(value: string) {
  if (value === 'all') return 'All';
  if (value === 'kb_candidate') return 'KB candidates';
  if (value === 'likely_incorrect') return 'Likely incorrect';
  return value.replace(/_/g, ' ');
}

function StatItem({
  title,
  value,
  detail,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="min-w-0 px-3 py-2 first:pl-0 last:pr-0">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{title}</span>
      </div>
      <p className="mt-1 text-xl font-semibold leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function KnowledgeRow({ entry }: { entry: KBEntry }) {
  return (
    <div className="grid gap-2 border-b border-border/70 px-3 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] sm:items-start">
      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px] font-medium">
            {entry.category || 'Uncategorised'}
          </Badge>
          {entry.mediaUrls?.length ? (
            <Badge variant="outline" className="rounded-sm px-1.5 py-0 text-[10px]">
              {entry.mediaUrls.length} media
            </Badge>
          ) : null}
        </div>
        <h3 className="text-sm font-medium leading-5 text-foreground">{entry.question}</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Updated {formatDate(entry.updatedAt || entry.createdAt)}</p>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{compactText(entry.answer, 420)}</p>
    </div>
  );
}

function LearningRow({
  row,
  onPromote,
}: {
  row: ConversationLearningRow;
  onPromote?: (row: ConversationLearningRow) => void;
}) {
  return (
    <article
      className={cn(
        'border-b border-border/70 px-3 py-3 last:border-b-0',
        row.likelyIncorrect && 'bg-destructive/[0.025]'
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge className="rounded-sm px-1.5 py-0 text-[10px]" variant={row.wasSuccessful ? 'default' : 'secondary'}>
          {row.extractedIntent || 'general'}
        </Badge>
        <Badge className="rounded-sm px-1.5 py-0 text-[10px]" variant="outline">
          {row.detectedEmotionalTone || 'neutral'}
        </Badge>
        {row.shouldAddToKB ? (
          <Badge className="rounded-sm border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            KB candidate
          </Badge>
        ) : null}
        {row.likelyIncorrect ? <Badge variant="destructive" className="rounded-sm px-1.5 py-0 text-[10px]">Review</Badge> : null}
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDate(row.createdAt)}</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Customer asked</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-foreground">{compactText(row.userMessage, 360)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">AI answered</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-5 text-muted-foreground">{compactText(row.aiResponse, 360)}</p>
        </div>
      </div>

      {row.newKnowledgeExtracted ? (
        <div className="mt-2 border-l-2 border-primary/40 pl-2.5 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground">Extracted learning: </span>{row.newKnowledgeExtracted}
        </div>
      ) : null}
      {row.likelyIncorrectReasons?.length ? (
        <div className="mt-2 flex items-start gap-1.5 text-xs text-destructive">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Signals: {row.likelyIncorrectReasons.join(', ')}</span>
        </div>
      ) : null}
      {onPromote && (row.shouldAddToKB || row.newKnowledgeExtracted) ? (
        <div className="mt-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => onPromote(row)} className="h-7 gap-1.5 px-2 text-xs">
            <PlusCircle className="h-3.5 w-3.5" />
            Promote to Knowledge Base
          </Button>
        </div>
      ) : null}
    </article>
  );
}

const TONE_COLORS: Record<string, string> = {
  positive: '#10b981',
  very_positive: '#059669',
  neutral: '#6b7280',
  negative: '#f59e0b',
  very_negative: '#ef4444',
};

export default function RagInsights() {
  const [query, setQuery] = useState('');
  const [sourceCategory, setSourceCategory] = useState('all');
  const [learningSection, setLearningSection] = useState('all');
  const [reviewSection, setReviewSection] = useState('all');
  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [promoteForm, setPromoteForm] = useState({ question: '', answer: '', category: 'General' });
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const knowledgeQuery = useQuery({
    queryKey: ['rag-insights', 'knowledge'],
    queryFn: ragInsightsApi.getKnowledge,
  });
  const learningQuery = useQuery({
    queryKey: ['rag-insights', 'learning'],
    queryFn: () => ragInsightsApi.getRecentLearning(100),
  });

  const knowledge = knowledgeQuery.data?.items || [];
  const learning = learningQuery.data || [];
  const loading = knowledgeQuery.isLoading || learningQuery.isLoading;
  const refreshing = knowledgeQuery.isFetching || learningQuery.isFetching;

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    knowledge.forEach((entry) => {
      const category = entry.category || 'Uncategorised';
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [knowledge]);

  const sourceCategoryOptions = useMemo<Array<[string, number]>>(
    () => [['all', knowledge.length], ...categories],
    [categories, knowledge.length]
  );

  const learningSections = useMemo<Array<[string, number]>>(() => {
    const counts = new Map<string, number>();
    learning.forEach((row) => {
      const intent = row.extractedIntent || 'general';
      counts.set(intent, (counts.get(intent) || 0) + 1);
    });
    return [['all', learning.length], ...[...counts.entries()].sort((a, b) => b[1] - a[1])];
  }, [learning]);

  const kbCandidates = useMemo(
    () => learning.filter((row) => row.shouldAddToKB || Boolean(row.newKnowledgeExtracted)),
    [learning]
  );
  const reviewRows = useMemo(
    () => learning.filter((row) => row.likelyIncorrect || row.shouldAddToKB),
    [learning]
  );
  const reviewSections = useMemo<Array<[string, number]>>(() => {
    const counts = new Map<string, number>();
    reviewRows.forEach((row) => {
      if (row.shouldAddToKB) counts.set('kb_candidate', (counts.get('kb_candidate') || 0) + 1);
      if (row.likelyIncorrect) counts.set('likely_incorrect', (counts.get('likely_incorrect') || 0) + 1);
      row.likelyIncorrectReasons?.forEach((reason) => counts.set(reason, (counts.get(reason) || 0) + 1));
    });
    return [['all', reviewRows.length], ...[...counts.entries()].sort((a, b) => b[1] - a[1])];
  }, [reviewRows]);

  const autonomousCount = useMemo(
    () => learning.filter(
      (row) => row.wasSuccessful && !row.likelyIncorrect && !/(team member|human|follow up|agent)/i.test(row.aiResponse)
    ).length,
    [learning]
  );
  const autonomousRate = learning.length ? Math.round((autonomousCount / learning.length) * 100) : 0;
  const successRate = learning.length
    ? Math.round((learning.filter((row) => row.wasSuccessful).length / learning.length) * 100)
    : 0;

  const intentChartData = useMemo(() => {
    const counts = new Map<string, number>();
    learning.forEach((row) => {
      const intent = formatSectionLabel(row.extractedIntent || 'general');
      counts.set(intent, (counts.get(intent) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);
  }, [learning]);

  const sentimentChartData = useMemo(() => {
    const counts = new Map<string, number>();
    learning.forEach((row) => {
      const tone = (row.detectedEmotionalTone || 'neutral').toLowerCase();
      counts.set(tone, (counts.get(tone) || 0) + 1);
    });
    return [...counts.entries()].map(([tone, value]) => ({
      name: tone.replace(/_/g, ' '),
      value,
      color: TONE_COLORS[tone] || '#6366f1',
    }));
  }, [learning]);

  const needle = query.trim().toLowerCase();
  const filteredKnowledge = useMemo(() => knowledge.filter((entry) => {
    const category = entry.category || 'Uncategorised';
    const matchesCategory = sourceCategory === 'all' || category === sourceCategory;
    const matchesQuery = !needle || [entry.question, entry.answer, category].join(' ').toLowerCase().includes(needle);
    return matchesCategory && matchesQuery;
  }), [knowledge, sourceCategory, needle]);

  const filteredLearning = useMemo(() => learning.filter((row) => {
    const intent = row.extractedIntent || 'general';
    const matchesIntent = learningSection === 'all' || intent === learningSection;
    const matchesQuery = !needle || [row.userMessage, row.aiResponse, row.extractedIntent, row.newKnowledgeExtracted || ''].join(' ').toLowerCase().includes(needle);
    return matchesIntent && matchesQuery;
  }), [learning, learningSection, needle]);

  const filteredReview = useMemo(() => reviewRows.filter((row) => {
    const matchesSection = reviewSection === 'all' ||
      (reviewSection === 'kb_candidate' && row.shouldAddToKB) ||
      (reviewSection === 'likely_incorrect' && row.likelyIncorrect) ||
      Boolean(row.likelyIncorrectReasons?.includes(reviewSection));
    const matchesQuery = !needle || [
      row.userMessage,
      row.aiResponse,
      row.extractedIntent,
      row.newKnowledgeExtracted || '',
      ...(row.likelyIncorrectReasons || []),
    ].join(' ').toLowerCase().includes(needle);
    return matchesSection && matchesQuery;
  }), [reviewRows, reviewSection, needle]);

  const selectedCategoryCount = sourceCategory === 'all'
    ? knowledge.length
    : categories.find(([category]) => category === sourceCategory)?.[1] || 0;
  const selectedLearningCount = learningSection === 'all'
    ? learning.length
    : learningSections.find(([section]) => section === learningSection)?.[1] || 0;
  const selectedReviewCount = reviewSection === 'all'
    ? reviewRows.length
    : reviewSections.find(([section]) => section === reviewSection)?.[1] || 0;

  const refetchAll = () => {
    void knowledgeQuery.refetch();
    void learningQuery.refetch();
  };

  const handleOpenPromote = (row: ConversationLearningRow) => {
    setPromoteForm({
      question: row.userMessage || '',
      answer: row.newKnowledgeExtracted || row.aiResponse || '',
      category: row.category || 'General',
    });
    setPromoteDialogOpen(true);
  };

  const handleSaveToKB = async () => {
    if (!promoteForm.question.trim() || !promoteForm.answer.trim()) {
      toast.error('Question and Answer cannot be empty.');
      return;
    }
    setIsSavingEntry(true);
    try {
      await ragInsightsApi.createKnowledgeEntry({
        question: promoteForm.question.trim(),
        answer: promoteForm.answer.trim(),
        category: promoteForm.category.trim() || 'General',
      });
      toast.success('Added successfully to Knowledge Base!');
      setPromoteDialogOpen(false);
      void knowledgeQuery.refetch();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(message || 'Failed to add entry to Knowledge Base.');
    } finally {
      setIsSavingEntry(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="RAG Insights & AI Learning"
        description="Review knowledge coverage, conversation signals and answers that may need attention."
        actions={
          <Button variant="outline" size="sm" onClick={refetchAll} disabled={refreshing} className="h-8 gap-2">
            <RefreshCcw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {/* Compact performance summary */}
      <div className="grid grid-cols-2 divide-x divide-border rounded-md border border-border bg-card sm:grid-cols-3 xl:grid-cols-5">
        <StatItem title="RAG sources" value={knowledge.length} detail={`${categories.length} categories`} icon={Database} />
        <StatItem title="Autonomous" value={`${autonomousRate}%`} detail={`${autonomousCount} of ${learning.length} signals`} icon={ShieldCheck} />
        <StatItem title="Success rate" value={`${successRate}%`} detail="Successful outcomes" icon={CheckCircle2} />
        <StatItem title="KB candidates" value={kbCandidates.length} detail="Potential additions" icon={Sparkles} />
        <StatItem title="Needs review" value={reviewRows.length} detail="Flagged signals" icon={AlertTriangle} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search knowledge, customer questions and AI replies..."
            className="h-9 pl-9"
          />
        </div>
        <div className="text-xs text-muted-foreground sm:whitespace-nowrap">
          {knowledge.length} sources · {learning.length} recent learning records
        </div>
      </div>

      {knowledgeQuery.error || learningQuery.error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Could not load all RAG data. Check that the backend is running and reachable from this frontend.
        </div>
      ) : null}

      <Tabs defaultValue="analytics" className="space-y-3">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-md bg-muted/60 p-1">
          <TabsTrigger value="analytics" className="h-8 shrink-0 gap-1.5 px-3 text-xs"><BarChart2 className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
          <TabsTrigger value="gaps" className="h-8 shrink-0 gap-1.5 px-3 text-xs"><Lightbulb className="h-3.5 w-3.5" /> Gaps & candidates <span className="text-[10px] text-muted-foreground">{kbCandidates.length}</span></TabsTrigger>
          <TabsTrigger value="sources" className="h-8 shrink-0 gap-1.5 px-3 text-xs"><BookOpen className="h-3.5 w-3.5" /> Sources</TabsTrigger>
          <TabsTrigger value="learning" className="h-8 shrink-0 gap-1.5 px-3 text-xs"><Sparkles className="h-3.5 w-3.5" /> Learning</TabsTrigger>
          <TabsTrigger value="review" className="h-8 shrink-0 gap-1.5 px-3 text-xs"><FileSearch className="h-3.5 w-3.5" /> Review <span className="text-[10px] text-muted-foreground">{reviewRows.length}</span></TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-0 space-y-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="shadow-none">
              <CardHeader className="px-4 pb-1 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold"><TrendingUp className="h-4 w-4 text-muted-foreground" /> Customer intents</CardTitle>
                <CardDescription className="text-xs">Most common intent categories in recent conversations.</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-1">
                <div className="h-[230px] w-full">
                  {intentChartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={intentChartData} margin={{ top: 8, right: 8, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '6px', fontSize: 12 }} />
                        <Bar dataKey="count" name="Conversations" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={42} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No intent data logged yet.</div>}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-none">
              <CardHeader className="px-4 pb-1 pt-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold"><Brain className="h-4 w-4 text-muted-foreground" /> Emotional tone</CardTitle>
                <CardDescription className="text-xs">Sentiment signals detected across recent chats.</CardDescription>
              </CardHeader>
              <CardContent className="px-3 pb-3 pt-1">
                <div className="h-[230px] w-full">
                  {sentimentChartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={sentimentChartData} dataKey="value" nameKey="name" cx="50%" cy="48%" outerRadius={76} innerRadius={42} paddingAngle={2}>
                          {sentimentChartData.map((entry, index) => <Cell key={`tone-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', borderColor: 'hsl(var(--border))', borderRadius: '6px', fontSize: 12 }} />
                        <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No sentiment signals found.</div>}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-md border border-border px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold"><Database className="h-3.5 w-3.5 text-muted-foreground" /> Knowledge coverage</div>
              <p className="text-xs leading-5 text-muted-foreground">{knowledge.length} Q&A sources across {categories.length} categories are currently available to the retrieval system.</p>
            </div>
            <div className="rounded-md border border-border px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-muted-foreground" /> Learning workflow</div>
              <p className="text-xs leading-5 text-muted-foreground">Conversation signals marked as candidates can be reviewed and promoted to the permanent knowledge base.</p>
            </div>
            <div className="rounded-md border border-border px-3 py-3">
              <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" /> Review and safety</div>
              <p className="text-xs leading-5 text-muted-foreground">{autonomousRate}% of recent signals meet the current autonomous-resolution heuristic. Flagged answers appear in Review.</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="gaps" className="mt-0">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Knowledge candidates</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">Conversation details flagged as possible additions to the knowledge base.</CardDescription>
                </div>
                <Badge variant="secondary" className="rounded-sm">{kbCandidates.length} candidates</Badge>
              </div>
            </CardHeader>
            <CardContent className="border-t border-border p-0">
              <ScrollArea className="h-[min(620px,65vh)]">
                {kbCandidates.length ? kbCandidates.map((row) => <LearningRow key={row.id} row={row} onPromote={handleOpenPromote} />) : (
                  <div className="px-4 py-12 text-center">
                    <Sparkles className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                    <p className="text-sm font-medium">No knowledge candidates</p>
                    <p className="mt-1 text-xs text-muted-foreground">New candidate signals will appear here when detected.</p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="mt-0 space-y-3">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Source categories</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">Filter the stored Q&A entries by category.</CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">{selectedCategoryCount} entries</span>
              </div>
            </CardHeader>
            <CardContent className="border-t border-border px-3 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {sourceCategoryOptions.map(([category, count]) => {
                  const selected = sourceCategory === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setSourceCategory(category)}
                      className={cn(
                        'inline-flex h-7 items-center gap-2 rounded border px-2 text-xs transition-colors',
                        selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <span>{category === 'all' ? 'All sources' : category}</span>
                      <span className={cn('tabular-nums', selected ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{count}</span>
                    </button>
                  );
                })}
                {!categories.length ? <p className="py-2 text-xs text-muted-foreground">No source categories loaded.</p> : null}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm">{sourceCategory === 'all' ? 'All knowledge entries' : `${sourceCategory} entries`} <span className="font-normal text-muted-foreground">({filteredKnowledge.length})</span></CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border p-0">
              <ScrollArea className="h-[min(620px,65vh)]">
                {filteredKnowledge.length ? filteredKnowledge.map((entry) => <KnowledgeRow key={entry.id} entry={entry} />) : (
                  <p className="px-4 py-10 text-center text-xs text-muted-foreground">No source entries match this view.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="mt-0 space-y-3">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Learning intents</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">Select an intent to inspect its conversation signals.</CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">{selectedLearningCount} records</span>
              </div>
            </CardHeader>
            <CardContent className="border-t border-border px-3 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {learningSections.map(([section, count]) => {
                  const selected = learningSection === section;
                  return (
                    <button key={section} type="button" onClick={() => setLearningSection(section)} className={cn(
                      'inline-flex h-7 items-center gap-2 rounded border px-2 text-xs capitalize transition-colors',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}>
                      <span>{formatSectionLabel(section)}</span><span className={cn('tabular-nums', selected ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{count}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm">{learningSection === 'all' ? 'Recent conversation signals' : `${formatSectionLabel(learningSection)} signals`} <span className="font-normal text-muted-foreground">({filteredLearning.length})</span></CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border p-0">
              <ScrollArea className="h-[min(620px,65vh)]">
                {filteredLearning.length ? filteredLearning.map((row) => <LearningRow key={row.id} row={row} onPromote={handleOpenPromote} />) : (
                  <p className="px-4 py-10 text-center text-xs text-muted-foreground">No learning rows match this view.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="review" className="mt-0 space-y-3">
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-sm">Review filters</CardTitle>
                  <CardDescription className="mt-0.5 text-xs">Focus on knowledge candidates or answers flagged for review.</CardDescription>
                </div>
                <span className="text-xs text-muted-foreground">{selectedReviewCount} flags</span>
              </div>
            </CardHeader>
            <CardContent className="border-t border-border px-3 py-2.5">
              <div className="flex flex-wrap gap-1.5">
                {reviewSections.map(([section, count]) => {
                  const selected = reviewSection === section;
                  return (
                    <button key={section} type="button" onClick={() => setReviewSection(section)} className={cn(
                      'inline-flex h-7 items-center gap-2 rounded border px-2 text-xs capitalize transition-colors',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}>
                      <span>{formatSectionLabel(section)}</span><span className={cn('tabular-nums', selected ? 'text-primary-foreground/75' : 'text-muted-foreground')}>{count}</span>
                    </button>
                  );
                })}
                {!reviewRows.length ? <span className="py-2 text-xs text-muted-foreground">No review flags in the latest learning records.</span> : null}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-none">
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm">{reviewSection === 'all' ? 'Answers to review' : formatSectionLabel(reviewSection)} <span className="font-normal text-muted-foreground">({filteredReview.length})</span></CardTitle>
            </CardHeader>
            <CardContent className="border-t border-border p-0">
              <ScrollArea className="h-[min(620px,65vh)]">
                {filteredReview.length ? filteredReview.map((row) => <LearningRow key={row.id} row={row} onPromote={handleOpenPromote} />) : (
                  <p className="px-4 py-10 text-center text-xs text-muted-foreground">No review rows match this view.</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={promoteDialogOpen} onOpenChange={(open) => !isSavingEntry && setPromoteDialogOpen(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <PlusCircle className="h-4 w-4 text-primary" /> Promote to Knowledge Base
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review the question and answer before adding this entry to the permanent knowledge base.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="kb-category">Category</Label>
              <Input id="kb-category" value={promoteForm.category} onChange={(e) => setPromoteForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="e.g. Services, Pricing, Preparation" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-question">Customer question / trigger</Label>
              <Textarea id="kb-question" rows={3} value={promoteForm.question} onChange={(e) => setPromoteForm((prev) => ({ ...prev, question: e.target.value }))} placeholder="The question or topic customers ask about" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kb-answer">Verified answer</Label>
              <Textarea id="kb-answer" rows={4} value={promoteForm.answer} onChange={(e) => setPromoteForm((prev) => ({ ...prev, answer: e.target.value }))} placeholder="The clear, verified response the AI should provide" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)} disabled={isSavingEntry}>Cancel</Button>
            <Button onClick={handleSaveToKB} disabled={isSavingEntry} className="gap-2">
              {isSavingEntry ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {isSavingEntry ? 'Saving...' : 'Save to Knowledge Base'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {loading ? (
        <div className="fixed bottom-4 right-4 rounded-md border border-border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow-sm">Loading RAG data...</div>
      ) : null}
    </div>
  );
}
