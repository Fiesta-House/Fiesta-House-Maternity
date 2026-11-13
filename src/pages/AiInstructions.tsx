import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  BookOpenCheck,
  ChevronRight,
  Copy,
  FileText,
  ListFilter,
  LoaderCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { fetchAiInstructions } from '@/api/aiInstructions';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Rule = { code: string; text: string };
type RuleSection = { code: string; title: string; rules: Rule[] };

const SECTION_COLORS: Record<string, string> = {
  A: 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200',
  B: 'border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200',
  C: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200',
  D: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200',
};

function parseInstructions(source: string): RuleSection[] {
  const sections: RuleSection[] = [];
  let currentSection: RuleSection | undefined;
  let currentRule: Rule | undefined;

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // Expected headings look like: **[A]** General rules
    const sectionMatch = line.match(/^(?:\*\*)?\[([A-D])\](?:\*\*)?\s+(.+)$/);
    if (sectionMatch) {
      currentSection = {
        code: sectionMatch[1],
        title: sectionMatch[2].replace(/\*+$/g, '').trim(),
        rules: [],
      };
      sections.push(currentSection);
      currentRule = undefined;
      continue;
    }

    if (!currentSection || line === 'Instructions:') continue;

    // Expected rule lines look like: A1. *Rule text*
    const ruleMatch = line.match(/^([A-D]\d+[a-z]?)\.\s+\*?(.*)$/);
    if (ruleMatch) {
      currentRule = {
        code: ruleMatch[1],
        text: ruleMatch[2].replace(/\*+$/g, '').trim(),
      };
      currentSection.rules.push(currentRule);
      continue;
    }

    // Wrapped lines belong to the rule immediately above them.
    if (currentRule) {
      currentRule.text += `${currentRule.text ? '\n' : ''}${line.replace(/^\*|\*$/g, '').trim()}`;
    }
  }

  return sections;
}

export default function AiInstructions() {
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all');
  const [showSource, setShowSource] = useState(false);

  const instructionQuery = useQuery({
    queryKey: ['ai-instructions'],
    queryFn: fetchAiInstructions,
    staleTime: 60_000,
  });

  const sections = useMemo(
    () => parseInstructions(instructionQuery.data || ''),
    [instructionQuery.data],
  );
  const normalizedSearch = search.trim().toLowerCase();

  const visibleSections = useMemo(() => {
    return sections
      .filter((section) => activeSection === 'all' || section.code === activeSection)
      .map((section) => ({
        ...section,
        rules: section.rules.filter((rule) =>
          !normalizedSearch || `${section.title} ${rule.code} ${rule.text}`.toLowerCase().includes(normalizedSearch),
        ),
      }))
      .filter((section) => section.rules.length > 0);
  }, [sections, activeSection, normalizedSearch]);

  const ruleCount = useMemo(
    () => sections.reduce((total, section) => total + section.rules.length, 0),
    [sections],
  );

  const copySource = async () => {
    if (!instructionQuery.data) return;
    try {
      await navigator.clipboard.writeText(instructionQuery.data);
      toast.success('AI instructions copied');
    } catch {
      toast.error('Could not copy instructions');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI Instructions"
        description="The active rules and guidance used to shape customer-facing AI replies."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => setShowSource((value) => !value)}
              disabled={!instructionQuery.data}
            >
              <FileText className="h-4 w-4" />
              {showSource ? 'Hide source' : 'View source'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={copySource}
              disabled={!instructionQuery.data}
            >
              <Copy className="h-4 w-4" />
              Copy all
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2"
              onClick={() => void instructionQuery.refetch()}
              disabled={instructionQuery.isFetching}
            >
              <RefreshCw className={cn('h-4 w-4', instructionQuery.isFetching && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        )}
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border/70 py-2.5 text-sm">
        <span className="inline-flex items-center gap-2 text-foreground">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <strong className="tabular-nums">{sections.length}</strong>
          <span className="text-muted-foreground">instruction groups</span>
        </span>
        <span className="inline-flex items-center gap-2 text-foreground">
          <BookOpenCheck className="h-4 w-4 text-muted-foreground" />
          <strong className="tabular-nums">{ruleCount}</strong>
          <span className="text-muted-foreground">rules</span>
        </span>
        <span className="text-xs text-muted-foreground">Live WhatsApp assistant prompt</span>
      </div>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search AI instructions"
          placeholder="Search rule text or section..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 pl-9"
        />
      </div>

      {instructionQuery.isError ? (
        <div className="flex items-start gap-3 border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-foreground">Couldn’t load AI instructions</p>
            <p className="mt-1 text-muted-foreground">Check that the backend is running, then try again.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 h-8"
              onClick={() => void instructionQuery.refetch()}
              disabled={instructionQuery.isFetching}
            >
              Try again
            </Button>
          </div>
        </div>
      ) : null}

      {instructionQuery.isLoading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          Loading active instructions...
        </div>
      ) : null}

      {!instructionQuery.isLoading && !instructionQuery.isError && showSource && instructionQuery.data ? (
        <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words border border-border bg-muted/30 p-3 font-mono text-xs leading-5 text-foreground">
          {instructionQuery.data}
        </pre>
      ) : null}

      {!instructionQuery.isLoading && !instructionQuery.isError ? (
        <div className="grid gap-4 lg:grid-cols-[205px_minmax(0,1fr)]">
          <aside className="space-y-2 lg:self-start">
            <div className="flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <ListFilter className="h-3.5 w-3.5" />
              Filter by group
            </div>
            <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
              <button
                type="button"
                onClick={() => setActiveSection('all')}
                className={cn(
                  'flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                  activeSection === 'all'
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span className="flex items-center gap-2"><ListFilter className="h-4 w-4" /> All rules</span>
                <span className="text-xs tabular-nums">{ruleCount}</span>
              </button>
              {sections.map((section) => (
                <button
                  key={section.code}
                  type="button"
                  onClick={() => setActiveSection(section.code)}
                  className={cn(
                    'flex shrink-0 items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors',
                    activeSection === section.code
                      ? 'bg-primary/10 font-semibold text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <span className="truncate">{section.title}</span>
                  <span className="text-xs tabular-nums">{section.rules.length}</span>
                </button>
              ))}
            </div>
            <p className="hidden border-t border-border/70 px-2 pt-3 text-xs leading-5 text-muted-foreground lg:block">
              When instructions conflict, higher-priority groups take precedence over lower-priority groups.
            </p>
          </aside>

          <section className="min-w-0 space-y-4">
            {visibleSections.map((section) => (
              <section key={section.code} className="border-t border-border/70 pt-3 first:border-t-0 first:pt-0">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className={cn('rounded-md font-semibold', SECTION_COLORS[section.code])}>
                    {section.code}
                  </Badge>
                  <h2 className="text-sm font-semibold text-foreground">{section.title}</h2>
                  <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                    {section.rules.length} {section.rules.length === 1 ? 'rule' : 'rules'}
                  </span>
                </div>
                <div className="divide-y divide-border/60 border-y border-border/60">
                  {section.rules.map((rule) => (
                    <article key={rule.code} className="grid gap-1.5 py-2.5 sm:grid-cols-[58px_minmax(0,1fr)] sm:gap-3">
                      <div className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                        <ChevronRight className="h-3.5 w-3.5" />
                        {rule.code}
                      </div>
                      <p className="whitespace-pre-line text-sm leading-6 text-foreground">{rule.text}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}

            {visibleSections.length === 0 ? (
              <div className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                {sections.length === 0
                  ? 'No instruction groups were detected in the active prompt.'
                  : `No instructions match “${search}”. Try another search or select a different group.`}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}
