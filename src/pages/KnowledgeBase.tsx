import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Edit, Trash2, Search, Loader2, BookOpen, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { knowledgeBaseApi, KBEntry } from '@/api/knowledgeBase';
import { useToast } from '@/components/ui/use-toast';
import { PageHeader } from '@/components/PageHeader';

const EMPTY_FORM = {
  question: '',
  answer: '',
  category: '',
};

export default function KnowledgeBase() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<KBEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const { toast } = useToast();

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await knowledgeBaseApi.getAll({ search: searchTerm.trim() });
      const nextEntries = Array.isArray(data?.items) ? data.items : [];
      setEntries(nextEntries);

      // Keep the selected detail pane in sync after a refresh or edit.
      if (selectedEntry) {
        const refreshedEntry = nextEntries.find((entry) => entry.id === selectedEntry.id);
        if (refreshedEntry) setSelectedEntry(refreshedEntry);
      }
    } catch (error) {
      console.error('Failed to fetch entries', error);
      toast({
        title: 'Could not load knowledge base',
        description: 'Please try again. Your existing entries have not been changed.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [searchTerm, toast]);

  useEffect(() => {
    const debounce = window.setTimeout(() => {
      void fetchEntries();
    }, searchTerm ? 350 : 0);

    return () => window.clearTimeout(debounce);
  }, [fetchEntries, searchTerm]);

  const handleCreateNew = () => {
    setSelectedEntry(null);
    setIsEditing(true);
    setFormData({ ...EMPTY_FORM });
  };

  const handleSelectEntry = (entry: KBEntry) => {
    setSelectedEntry(entry);
    setIsEditing(false);
    setFormData({
      question: entry.question,
      answer: entry.answer,
      category: entry.category || '',
    });
  };

  const handleEdit = (entry: KBEntry) => {
    setSelectedEntry(entry);
    setIsEditing(true);
    setFormData({
      question: entry.question,
      answer: entry.answer,
      category: entry.category || '',
    });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (selectedEntry) {
      setFormData({
        question: selectedEntry.question,
        answer: selectedEntry.answer,
        category: selectedEntry.category || '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const question = formData.question.trim();
    const answer = formData.answer.trim();

    if (!question || !answer) {
      toast({
        title: 'Required fields missing',
        description: 'Add both a question and an answer before saving.',
        variant: 'destructive',
      });
      return;
    }

    const payload = {
      question,
      answer,
      category: formData.category.trim(),
    };

    setSaving(true);
    try {
      if (selectedEntry) {
        await knowledgeBaseApi.update(selectedEntry.id, payload);
        setSelectedEntry({ ...selectedEntry, ...payload });
        toast({ title: 'Entry updated', description: 'Your changes have been saved.' });
      } else {
        await knowledgeBaseApi.create(payload);
        setSelectedEntry(null);
        toast({ title: 'Entry created', description: 'The new entry has been added.' });
      }

      setIsEditing(false);
      setFormData({ ...EMPTY_FORM });
      await fetchEntries();
    } catch (error) {
      console.error('Failed to save entry', error);
      toast({
        title: 'Could not save entry',
        description: 'Please check the details and try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: KBEntry) => {
    const confirmed = window.confirm(`Delete "${entry.question}"? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(entry.id);
    try {
      await knowledgeBaseApi.delete(entry.id);
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry(null);
        setIsEditing(false);
        setFormData({ ...EMPTY_FORM });
      }
      toast({ title: 'Entry deleted', description: 'The knowledge base entry has been removed.' });
      await fetchEntries();
    } catch (error) {
      console.error('Failed to delete entry', error);
      toast({
        title: 'Could not delete entry',
        description: 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Knowledge Base"
        description="Manage the information used in customer responses."
        actions={
          <Button onClick={handleCreateNew} size="sm" className="h-9 gap-1.5">
            <Plus className="h-4 w-4" />
            New entry
          </Button>
        }
      />

      <div className="grid min-h-[560px] grid-cols-1 gap-3 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.65fr)]">
        {/* Entry list */}
        <Card className="flex min-h-0 flex-col overflow-hidden border-border/70 shadow-none">
          <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-medium">Entries</h2>
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <CardContent className="flex min-h-0 flex-1 flex-col p-3">
            <div className="relative mb-2.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search questions or answers..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="h-9 pl-8 text-sm"
              />
            </div>

            <ScrollArea className="min-h-[360px] flex-1 pr-2">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading entries
                </div>
              ) : entries.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <BookOpen className="mx-auto mb-2 h-5 w-5 text-muted-foreground/60" />
                  <p className="text-sm font-medium">No entries found</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {searchTerm ? 'Try another search term.' : 'Create an entry to start building your knowledge base.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {entries.map((entry) => {
                    const active = selectedEntry?.id === entry.id && !isEditing;
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => handleSelectEntry(entry)}
                        className={cn(
                          'w-full rounded-md border px-3 py-2.5 text-left transition-colors',
                          active
                            ? 'border-primary/30 bg-accent'
                            : 'border-transparent hover:border-border/70 hover:bg-muted/50'
                        )}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-muted-foreground">
                            {entry.category?.trim() || 'Uncategorized'}
                          </span>
                          {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">
                          {entry.question}
                        </p>
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {entry.answer}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Detail and editor */}
        <Card className="flex min-h-0 flex-col overflow-hidden border-border/70 shadow-none">
          <div className="flex min-h-11 items-center justify-between gap-3 border-b border-border/70 px-4 py-2.5">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium">
                {isEditing ? (selectedEntry ? 'Edit entry' : 'New entry') : 'Entry details'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEditing ? 'Update the question, answer and category.' : selectedEntry ? 'Knowledge base content' : 'Select an entry to view its content.'}
              </p>
            </div>
            {!isEditing && selectedEntry && (
              <div className="flex shrink-0 items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => handleEdit(selectedEntry)}>
                  <Edit className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => void handleDelete(selectedEntry)}
                  disabled={deletingId === selectedEntry.id}
                >
                  {deletingId === selectedEntry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  Delete
                </Button>
              </div>
            )}
            {isEditing && (
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleCancelEdit} aria-label="Cancel editing">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <CardContent className="flex-1 p-4">
            {isEditing ? (
              <form onSubmit={handleSave} className="flex h-full flex-col gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="kb-category" className="text-xs">Category</Label>
                  <Input
                    id="kb-category"
                    value={formData.category}
                    onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                    placeholder="e.g. Packages, Booking policy, Studio information"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="kb-question" className="text-xs">Question</Label>
                  <Input
                    id="kb-question"
                    value={formData.question}
                    onChange={(event) => setFormData((current) => ({ ...current, question: event.target.value }))}
                    placeholder="Enter the question"
                    className="h-9"
                    required
                  />
                </div>
                <div className="flex min-h-[220px] flex-1 flex-col space-y-1.5">
                  <Label htmlFor="kb-answer" className="text-xs">Answer</Label>
                  <Textarea
                    id="kb-answer"
                    value={formData.answer}
                    onChange={(event) => setFormData((current) => ({ ...current, answer: event.target.value }))}
                    placeholder="Write the information the assistant should use..."
                    className="min-h-[220px] flex-1 resize-y text-sm leading-6"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 border-t border-border/70 pt-3">
                  <Button type="button" variant="outline" size="sm" onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" disabled={saving}>
                    {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
                    {saving ? 'Saving...' : 'Save entry'}
                  </Button>
                </div>
              </form>
            ) : selectedEntry ? (
              <div className="flex h-full flex-col">
                <div className="border-b border-border/70 pb-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    {selectedEntry.category?.trim() || 'Uncategorized'}
                  </p>
                  <h3 className="text-base font-semibold leading-6 text-foreground">
                    {selectedEntry.question}
                  </h3>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto py-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Answer</p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                    {selectedEntry.answer}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
                <BookOpen className="mb-3 h-7 w-7 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">No entry selected</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Choose an entry from the list, or create a new one to add information to the knowledge base.
                </p>
                <Button variant="outline" size="sm" className="mt-4 h-8" onClick={handleCreateNew}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  New entry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
