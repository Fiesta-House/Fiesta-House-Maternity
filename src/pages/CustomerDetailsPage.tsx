import React, { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getCustomer,
  getCustomerMessages,
  toggleCustomerAi,
  getCustomerPhotoLinks,
  getCustomerSessionNotes,
  updateSessionNote,
  getCustomerSentiment,
  getAverageActivity,
  SessionNote,
} from '../api/customers';
import { getCustomerBookings } from '../api/bookings';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  ArrowLeft,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Activity,
  Clock,
  Power,
  CalendarCheck,
  Image as ImageIcon,
  FileText,
  TrendingUp,
  ClipboardList,
  CheckCircle2,
  Smile,
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isYesterday, isValid } from 'date-fns';
import { toast } from 'sonner';
import SendPhotoLinkCard from '../components/ui/SendPhotoLinkCard';
import InvoiceCard from '../components/InvoiceCard';
import { invoicesApi } from '../api/invoices';
import { useAuth } from '@/hooks/useAuth';

type NoteFilter = 'all' | 'pending' | 'approved' | 'reviewed' | 'declined';
type NoteAction = 'review' | 'approve' | null;

const toValidDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
};

const displayDate = (value?: string | Date | null, pattern = 'MMM d, yyyy • h:mm a') => {
  const date = toValidDate(value);
  return date ? format(date, pattern) : '—';
};

const displayRelativeDate = (value?: string | Date | null) => {
  const date = toValidDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : 'Unknown';
};

const CustomerDetailsPage = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [reviewingNoteId, setReviewingNoteId] = useState<string | null>(null);
  const [reviewNotesText, setReviewNotesText] = useState('');
  const [noteAction, setNoteAction] = useState<NoteAction>(null);
  const [sessionNoteFilter, setSessionNoteFilter] = useState<NoteFilter>('pending');
  const [isTogglingAi, setIsTogglingAi] = useState(false);

  const { data: customer, isLoading: customerLoading, refetch: refetchCustomer } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: () => getCustomer(customerId!),
    enabled: !!customerId,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['customer-messages', customerId],
    queryFn: () => getCustomerMessages(customerId!),
    enabled: !!customerId,
  });

  const { data: bookings, isLoading: bookingsLoading } = useQuery({
    queryKey: ['customer-bookings', customerId],
    queryFn: () => getCustomerBookings(customerId!),
    enabled: !!customerId,
  });

  const { data: photoLinks, isLoading: photoLinksLoading } = useQuery({
    queryKey: ['customer-photo-links', customerId],
    queryFn: () => getCustomerPhotoLinks(customerId!),
    enabled: !!customerId,
  });

  const { data: sessionNotes, isLoading: sessionNotesLoading, refetch: refetchSessionNotes } = useQuery({
    queryKey: ['customer-session-notes', customerId],
    queryFn: () => getCustomerSessionNotes(customerId!),
    enabled: !!customerId,
  });

  const { data: invoices, isLoading: invoicesLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['customer-invoices', customerId],
    queryFn: () => invoicesApi.getInvoicesByCustomer(customerId!),
    enabled: !!customerId,
  });

  const { data: sentimentHistory } = useQuery({
    queryKey: ['customer-sentiment', customerId],
    queryFn: () => getCustomerSentiment(customerId!),
    enabled: !!customerId,
  });

  const { data: averageActivity } = useQuery({
    queryKey: ['average-activity'],
    queryFn: getAverageActivity,
  });

  const handleToggleAi = async () => {
    if (!customer || isTogglingAi) return;
    setIsTogglingAi(true);
    try {
      await toggleCustomerAi(customer.id, !customer.aiEnabled);
      toast.success(`AI ${!customer.aiEnabled ? 'enabled' : 'disabled'} for this customer`);
      await refetchCustomer();
    } catch {
      toast.error('Failed to toggle AI status');
    } finally {
      setIsTogglingAi(false);
    }
  };

  const inboundMessages = messages?.filter((message) => message.direction === 'inbound') || [];
  const outboundMessages = messages?.filter((message) => message.direction === 'outbound') || [];
  const lastMessage = messages?.[messages.length - 1];
  const pendingSessionNotesCount = sessionNotes?.filter((note) => note.status === 'pending').length || 0;

  const inferredPlatform = useMemo(() => {
    if (!customer) return 'other';
    if (customer.platform) return customer.platform.toLowerCase();
    if (customer.whatsappId || customer.email?.endsWith('@whatsapp.local')) return 'whatsapp';
    if (customer.instagramId || customer.email?.endsWith('@instagram.local')) return 'instagram';
    if (customer.messengerId || customer.email?.endsWith('@messenger.local')) return 'messenger';
    return 'other';
  }, [customer]);

  const displayPhone = useMemo(() => {
    if (!customer) return 'Not provided';
    if (customer.phone?.trim()) return customer.phone;
    if (customer.whatsappId?.trim()) return customer.whatsappId;
    if (inferredPlatform === 'whatsapp' && /^\+?\d{8,}$/.test(customer.id || '')) return customer.id;
    return 'Not provided';
  }, [customer, inferredPlatform]);

  const conversationTimeline = useMemo(() => {
    const list = [...(messages || [])].sort((a, b) => {
      const aTime = toValidDate(a.createdAt)?.getTime() ?? 0;
      const bTime = toValidDate(b.createdAt)?.getTime() ?? 0;
      return aTime - bTime;
    });

    const items: Array<
      | { kind: 'day'; key: string; label: string }
      | { kind: 'message'; key: string; message: (typeof list)[number] }
    > = [];

    let lastDayKey = '';
    for (const message of list) {
      const date = toValidDate(message.createdAt);
      const dayKey = date ? format(date, 'yyyy-MM-dd') : `unknown-${message.id}`;
      if (dayKey !== lastDayKey) {
        const label = !date
          ? 'Date unavailable'
          : isToday(date)
            ? 'Today'
            : isYesterday(date)
              ? 'Yesterday'
              : format(date, 'EEEE, MMM d, yyyy');
        items.push({ kind: 'day', key: `day-${dayKey}`, label });
        lastDayKey = dayKey;
      }
      items.push({ kind: 'message', key: message.id, message });
    }
    return items;
  }, [messages]);

  const visibleSessionNotes = useMemo(() => {
    const list = sessionNotes || [];
    const filtered = sessionNoteFilter === 'all'
      ? list
      : list.filter((note) => note.status === sessionNoteFilter);

    return [...filtered].sort((a, b) => {
      const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2 };
      const priorityDifference = (priorityRank[a.priority] ?? 2) - (priorityRank[b.priority] ?? 2);
      if (priorityDifference !== 0) return priorityDifference;
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;
      return (toValidDate(b.createdAt)?.getTime() ?? 0) - (toValidDate(a.createdAt)?.getTime() ?? 0);
    });
  }, [sessionNotes, sessionNoteFilter]);

  const getNoteTypeLabel = (type: SessionNote['type']) => {
    if (type === 'external_people') return 'External People';
    if (type === 'external_items') return 'External Items';
    if (type === 'special_request') return 'Special Request';
    if (type === 'action_request') return 'Action Request';
    return 'Other';
  };

  const getNoteCategoryLabel = (category: SessionNote['category']) => {
    const labels: Record<SessionNote['category'], string> = {
      client_wish: 'Client wish',
      operational: 'Operations',
      addon: 'Add-on',
      accessibility: 'Accessibility',
      companion: 'Companion',
      styling: 'Styling',
      delivery: 'Delivery',
      other: 'Other',
    };
    return labels[category] || 'Client wish';
  };

  const getNoteSummary = (note: SessionNote) => {
    const itemsText = note.items?.length > 0 ? note.items.join(', ') : '';
    const detailsText = note.description?.trim() || '';

    if (note.type === 'special_request' && detailsText.toLowerCase().startsWith('delivery preference:')) {
      const methodMatch = detailsText.match(/delivery preference:\s*([^|]+)/i);
      const emailMatch = detailsText.match(/email:\s*([^|]+)/i);
      const whatsappMatch = detailsText.match(/whatsapp:\s*([^|]+)/i);
      const method = methodMatch?.[1]?.trim()?.toLowerCase();
      if (method === 'email') return `Request: Photo delivery via email${emailMatch?.[1] ? ` (${emailMatch[1].trim()})` : ''}`;
      if (method === 'whatsapp') return `Request: Photo delivery via WhatsApp${whatsappMatch?.[1] ? ` (${whatsappMatch[1].trim()})` : ''}`;
      if (method === 'download_link') return 'Request: Photo delivery via secure download link';
    }

    if (note.type === 'external_people') return `People: ${itemsText || detailsText || 'No details provided'}`;
    if (note.type === 'external_items') return `Items: ${itemsText || detailsText || 'No details provided'}`;
    if (note.type === 'special_request') return `Request: ${detailsText || itemsText || 'No details provided'}`;
    if (note.type === 'action_request') return `Action: ${detailsText || itemsText || 'No details provided'}`;
    return `Note: ${detailsText || itemsText || 'No details provided'}`;
  };

  const openNoteDialog = (noteId: string, action: NoteAction) => {
    setReviewingNoteId(noteId);
    setReviewNotesText('');
    setNoteAction(action);
  };

  const closeNoteDialog = () => {
    setReviewingNoteId(null);
    setNoteAction(null);
    setReviewNotesText('');
  };

  const saveNoteReview = async () => {
    if (!reviewingNoteId) return;
    try {
      await updateSessionNote(reviewingNoteId, {
        status: noteAction === 'approve' ? 'approved' : 'reviewed',
        actionStatus: noteAction === 'approve' ? 'ready' : 'acknowledged',
        adminNotes: reviewNotesText || undefined,
        reviewedBy: user?.name || user?.email || 'admin',
      });
      toast.success(noteAction === 'approve' ? 'Session note approved' : 'Session note reviewed');
      await refetchSessionNotes();
      closeNoteDialog();
    } catch {
      toast.error('Failed to update note');
    }
  };

  const approveNote = async (noteId: string) => {
    try {
      await updateSessionNote(noteId, {
        status: 'approved',
        actionStatus: 'ready',
        reviewedBy: user?.name || user?.email || 'admin',
      });
      toast.success('Session note approved');
      await refetchSessionNotes();
    } catch {
      toast.error('Failed to update note');
    }
  };

  if (customerLoading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 p-5 text-sm">
        <p className="font-medium text-foreground">Customer not found</p>
        <p className="mt-1 text-muted-foreground">Please check the customer ID and try again.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate('/customers')}>
          Back to customers
        </Button>
      </div>
    );
  }

  const customerName = customer.name || 'Unknown Customer';
  const initials = customer.name?.trim().split(/\s+/).map((part) => part[0]).join('').toUpperCase().slice(0, 2) || '?';
  const platformLabel = inferredPlatform === 'other'
    ? 'Other'
    : inferredPlatform.charAt(0).toUpperCase() + inferredPlatform.slice(1);

  return (
    <div className="mx-auto max-w-[1400px] space-y-4">
      {/* Compact customer header */}
      <div className="flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/customers')}
            className="h-8 w-8 shrink-0"
            aria-label="Back to customers"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-base font-semibold tracking-tight">{customerName}</h1>
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{platformLabel}</Badge>
              <Badge variant={customer.aiEnabled ? 'default' : 'secondary'} className="h-5 gap-1 px-1.5 text-[10px] font-normal">
                <span className={`h-1.5 w-1.5 rounded-full ${customer.aiEnabled ? 'bg-white' : 'bg-muted-foreground'}`} />
                {customer.aiEnabled ? 'AI Active' : 'AI Paused'}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {displayPhone !== 'Not provided' ? displayPhone : 'No phone number'}
              {customer.email ? ` · ${customer.email}` : ''}
              {' · Joined '}{displayDate(customer.createdAt, 'MMM d, yyyy')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5 pl-11 sm:pl-0">
          {displayPhone !== 'Not provided' && (
            <Button variant="outline" size="sm" asChild className="h-8 px-2.5">
              <a href={`tel:${displayPhone}`}><Phone className="mr-1.5 h-3.5 w-3.5" />Call</a>
            </Button>
          )}
          {customer.email && (
            <Button variant="outline" size="sm" asChild className="h-8 px-2.5">
              <a href={`mailto:${customer.email}`}><Mail className="mr-1.5 h-3.5 w-3.5" />Email</a>
            </Button>
          )}
          <Button onClick={handleToggleAi} disabled={isTogglingAi} variant="outline" size="sm" className="h-8 px-2.5">
            <Power className="mr-1.5 h-3.5 w-3.5" />
            {isTogglingAi ? 'Updating…' : customer.aiEnabled ? 'Pause AI' : 'Enable AI'}
          </Button>
        </div>
      </div>

      {/* At-a-glance metrics */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b pb-3">
        <div className="flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums">{messages?.length || 0}</span><span className="text-xs text-muted-foreground">Messages</span></div>
        <div className="flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums">{bookings?.length || 0}</span><span className="text-xs text-muted-foreground">Bookings</span></div>
        <div className="flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums">{inboundMessages.length}</span><span className="text-xs text-muted-foreground">Received</span></div>
        <div className="flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums">{outboundMessages.length}</span><span className="text-xs text-muted-foreground">Sent</span></div>
        <div className="flex items-baseline gap-1.5"><span className="text-lg font-semibold tabular-nums">{pendingSessionNotesCount}</span><span className="text-xs text-muted-foreground">Pending notes</span></div>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Updated {displayRelativeDate(customer.updatedAt)}
        </div>
      </div>

      <Tabs defaultValue="conversation" className="w-full">
        <TabsList className="flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-md bg-muted/60 p-1">
          <TabsTrigger value="conversation" className="h-8 shrink-0 px-3 text-xs">
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />Conversation <span className="ml-1 text-muted-foreground">{messages?.length || 0}</span>
          </TabsTrigger>
          <TabsTrigger value="bookings" className="h-8 shrink-0 px-3 text-xs">
            <CalendarCheck className="mr-1.5 h-3.5 w-3.5" />Bookings <span className="ml-1 text-muted-foreground">{bookings?.length || 0}</span>
          </TabsTrigger>
          <TabsTrigger value="session-notes" className="h-8 shrink-0 px-3 text-xs">
            <ClipboardList className="mr-1.5 h-3.5 w-3.5" />Notes
            {pendingSessionNotesCount > 0 && <span className="ml-1 rounded bg-destructive px-1 text-[10px] leading-4 text-destructive-foreground">{pendingSessionNotesCount}</span>}
          </TabsTrigger>
          <TabsTrigger value="photo-links" className="h-8 shrink-0 px-3 text-xs">
            <ImageIcon className="mr-1.5 h-3.5 w-3.5" />Photos <span className="ml-1 text-muted-foreground">{photoLinks?.length || 0}</span>
          </TabsTrigger>
          <TabsTrigger value="invoices" className="h-8 shrink-0 px-3 text-xs">
            <FileText className="mr-1.5 h-3.5 w-3.5" />Invoices <span className="ml-1 text-muted-foreground">{invoices?.length || 0}</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="h-8 shrink-0 px-3 text-xs">
            <TrendingUp className="mr-1.5 h-3.5 w-3.5" />Insights
          </TabsTrigger>
        </TabsList>

        {/* Conversation */}
        <TabsContent value="conversation" className="mt-3">
          <Card className="overflow-hidden rounded-md shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Conversation history</p>
                <p className="text-xs text-muted-foreground">{messages?.length || 0} messages · {inboundMessages.length} received · {outboundMessages.length} sent</p>
              </div>
              {lastMessage && <p className="text-xs text-muted-foreground">Last contact {displayRelativeDate(lastMessage.createdAt)}</p>}
            </div>
            <CardContent className="bg-muted/15 p-3">
              <div className="h-[min(65vh,720px)] min-h-[320px] overflow-y-auto pr-1">
                {messagesLoading ? (
                  <div className="flex h-full items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
                ) : !messages?.length ? (
                  <div className="flex h-full flex-col items-center justify-center py-12 text-muted-foreground">
                    <MessageSquare className="mb-2 h-8 w-8 opacity-30" />
                    <p className="text-sm">No messages yet</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {conversationTimeline.map((item) => {
                      if (item.kind === 'day') {
                        return <div key={item.key} className="sticky top-0 z-10 flex justify-center py-1"><span className="rounded-full border bg-background px-2.5 py-0.5 text-[10px] text-muted-foreground">{item.label}</span></div>;
                      }
                      const outbound = item.message.direction === 'outbound';
                      return (
                        <div key={item.key} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[90%] rounded-xl px-3 py-2 ${outbound ? 'rounded-br-sm bg-primary text-primary-foreground' : 'rounded-bl-sm border bg-background'}`}>
                            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{item.message.content}</p>
                            <div className="mt-1.5 flex items-center justify-end gap-2">
                              <span className={`text-[10px] ${outbound ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{displayDate(item.message.createdAt, 'h:mm a')}</span>
                              <span className={`text-[10px] ${outbound ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>{outbound ? 'Sent' : 'Customer'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bookings */}
        <TabsContent value="bookings" className="mt-3">
          <Card className="rounded-md shadow-none">
            <CardHeader className="px-3 py-2.5">
              <CardTitle className="text-sm font-medium">Booking history</CardTitle>
              <CardDescription className="text-xs">{bookings?.length || 0} total bookings</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-3">
              {bookingsLoading ? (
                <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
              ) : !bookings?.length ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No bookings yet</div>
              ) : (
                <div className="divide-y">
                  {bookings.map((booking) => (
                    <div key={booking.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{booking.service}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{displayDate(booking.dateTime)}</p>
                        </div>
                        <Badge variant={booking.status === 'confirmed' ? 'default' : booking.status === 'cancelled' ? 'destructive' : 'secondary'} className="h-5 text-[10px] font-normal">{booking.status}</Badge>
                      </div>
                      <div className="mt-2 rounded-sm bg-muted/40 px-2.5 py-2">
                        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Deposits & payments</p>
                        {booking.payments && booking.payments.length > 0 ? (
                          <div className="space-y-2">
                            {booking.payments.map((payment) => (
                              <div key={payment.id} className="border-b border-border/70 pb-2 last:border-0 last:pb-0">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-sm font-medium">KSh {Number(payment.amount || 0).toLocaleString()}</span>
                                  <Badge variant={payment.status === 'success' ? 'default' : payment.status === 'failed' ? 'destructive' : 'secondary'} className="h-5 text-[10px]">{payment.status}</Badge>
                                </div>
                                <div className="mt-1 grid gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground sm:grid-cols-2">
                                  <span>M-Pesa code: {payment.mpesaReceipt || 'Pending'}</span>
                                  <span>Checkout ID: {payment.checkoutRequestId || 'N/A'}</span>
                                  <span>Sent: {displayDate(payment.createdAt)}</span>
                                  <span>Updated: {displayDate(payment.updatedAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground">No deposit record attached to this booking yet.</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Session notes */}
        <TabsContent value="session-notes" className="mt-3">
          <Card className="rounded-md shadow-none">
            <CardHeader className="px-3 py-2.5">
              <CardTitle className="flex items-center gap-2 text-sm font-medium"><ClipboardList className="h-4 w-4" />Session notes & preferences</CardTitle>
              <CardDescription className="text-xs">Review customer requests and preferences before the shoot.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="p-3">
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[
                  { key: 'pending', label: `Pending (${pendingSessionNotesCount})` },
                  { key: 'all', label: `All (${sessionNotes?.length || 0})` },
                  { key: 'approved', label: 'Approved' },
                  { key: 'reviewed', label: 'Reviewed' },
                  { key: 'declined', label: 'Declined' },
                ].map((item) => (
                  <Button key={item.key} size="sm" variant={sessionNoteFilter === item.key ? 'default' : 'outline'} className="h-7 px-2.5 text-[11px]" onClick={() => setSessionNoteFilter(item.key as NoteFilter)}>{item.label}</Button>
                ))}
              </div>
              {sessionNotesLoading ? (
                <div className="flex justify-center py-8"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
              ) : visibleSessionNotes.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">No session notes match this filter.</div>
              ) : (
                <div className="divide-y">
                  {visibleSessionNotes.map((note) => (
                    <div key={note.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge variant="outline" className="h-5 text-[10px]">{getNoteTypeLabel(note.type)}</Badge>
                            <Badge variant={note.status === 'approved' ? 'default' : note.status === 'declined' ? 'destructive' : 'secondary'} className="h-5 text-[10px]">{note.status}</Badge>
                            {note.booking && <Badge variant="outline" className="h-5 text-[10px]">{note.booking.service}</Badge>}
                            <Badge variant="outline" className={`h-5 text-[10px] ${note.priority === 'urgent' ? 'border-destructive/40 text-destructive' : note.priority === 'high' ? 'border-amber-500/40 text-amber-700' : ''}`}>{note.priority === 'normal' ? 'Normal' : note.priority}</Badge>
                            <Badge variant="outline" className="h-5 text-[10px]">{getNoteCategoryLabel(note.category)}</Badge>
                            <Badge variant="outline" className="h-5 text-[10px]">{note.actionStatus}</Badge>
                          </div>
                          <p className="text-[13px] font-medium">{getNoteSummary(note)}</p>
                          {note.description && note.type !== 'special_request' && <p className="text-xs text-muted-foreground">{note.description}</p>}
                          {note.sourceMessage && note.sourceMessage.trim() !== (note.description || '').trim() && <p className="text-xs italic text-muted-foreground">“{note.sourceMessage}”</p>}
                          {note.booking && <p className="text-xs text-muted-foreground">Booking: {displayDate(note.booking.dateTime)}</p>}
                          {note.adminNotes && <div className="rounded-sm border bg-muted/30 px-2.5 py-2"><p className="mb-0.5 text-[10px] font-medium text-muted-foreground">Admin notes</p><p className="text-xs">{note.adminNotes}</p></div>}
                          <p className="text-[10px] text-muted-foreground">{displayDate(note.createdAt)}{note.reviewedAt ? ` · Reviewed ${displayDate(note.reviewedAt, 'MMM d, yyyy')}` : ''}</p>
                        </div>
                        {note.status === 'pending' && (
                          <div className="flex shrink-0 flex-wrap gap-1.5 lg:justify-end">
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => approveNote(note.id)}><CheckCircle2 className="mr-1 h-3 w-3" />Approve</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => openNoteDialog(note.id, 'approve')}><FileText className="mr-1 h-3 w-3" />Approve + note</Button>
                            <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => openNoteDialog(note.id, 'review')}><Clock className="mr-1 h-3 w-3" />Review</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Photo links */}
        <TabsContent value="photo-links" className="mt-3">
          <Card className="rounded-md shadow-none">
            <CardHeader className="px-3 py-2.5">
              <CardTitle className="flex items-center gap-2 text-sm font-medium"><ImageIcon className="h-4 w-4" />Photo links</CardTitle>
              <CardDescription className="text-xs">Send a photo link and review links previously sent to this customer.</CardDescription>
            </CardHeader>
            <Separator />
            <CardContent className="space-y-3 p-3">
              <SendPhotoLinkCard customerId={customer.id} />
              {photoLinksLoading ? (
                <div className="flex justify-center py-6"><div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
              ) : !photoLinks?.length ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No photo links sent yet.</p>
              ) : (
                <div className="divide-y rounded-sm border">
                  {photoLinks.map((photoLink) => (
                    <div key={photoLink.id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <a href={photoLink.link} target="_blank" rel="noopener noreferrer" className="break-all text-xs font-medium text-primary hover:underline">{photoLink.link}</a>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{displayDate(photoLink.sentAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoices */}
        <TabsContent value="invoices" className="mt-3">
          <InvoiceCard customerId={customer.id} invoices={invoices || []} isLoading={invoicesLoading} onRefresh={refetchInvoices} />
        </TabsContent>

        {/* Insights */}
        <TabsContent value="insights" className="mt-3">
          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="rounded-md shadow-none">
              <CardHeader className="px-3 py-2.5">
                <CardTitle className="flex items-center gap-2 text-sm font-medium"><Smile className="h-4 w-4" />Customer sentiment</CardTitle>
                <CardDescription className="text-xs">Based on this customer's own messages.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="p-3">
                {!sentimentHistory?.length ? (
                  <p className="py-5 text-center text-sm text-muted-foreground">No sentiment data yet for this customer.</p>
                ) : (
                  <>
                    <div className="mb-3 flex gap-6">
                      <div><p className="text-[11px] text-muted-foreground">Average score</p><p className="text-lg font-semibold tabular-nums">{(sentimentHistory.reduce((sum, item) => sum + item.score, 0) / sentimentHistory.length).toFixed(2)}</p></div>
                      <div><p className="text-[11px] text-muted-foreground">Readings</p><p className="text-lg font-semibold tabular-nums">{sentimentHistory.length}</p></div>
                    </div>
                    <div className="divide-y border-t">
                      {sentimentHistory.slice(0, 5).map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-2">
                          <Badge variant={item.sentiment.includes('negative') ? 'destructive' : item.sentiment.includes('positive') ? 'default' : 'secondary'} className="text-[10px] capitalize">{item.sentiment.replace('_', ' ')}</Badge>
                          <span className="text-[11px] text-muted-foreground">{displayRelativeDate(item.createdAt)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-md shadow-none">
              <CardHeader className="px-3 py-2.5">
                <CardTitle className="text-sm font-medium">Activity vs. average customer</CardTitle>
                <CardDescription className="text-xs">Comparison with current business-wide averages.</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="space-y-4 p-3">
                {[
                  { label: 'Messages', value: messages?.length || 0, avg: averageActivity?.avgMessages || 0 },
                  { label: 'Bookings', value: bookings?.length || 0, avg: averageActivity?.avgBookings || 0 },
                ].map(({ label, value, avg }) => {
                  const max = Math.max(value, avg, 1);
                  return (
                    <div key={label}>
                      <div className="mb-1.5 flex items-center justify-between gap-2"><span className="text-xs font-medium">{label}</span><span className="text-[11px] tabular-nums text-muted-foreground">{value} · average {avg.toFixed(1)}</span></div>
                      <div className="space-y-1.5">
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min((value / max) * 100, 100)}%` }} /></div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-muted-foreground/40" style={{ width: `${Math.min((avg / max) * 100, 100)}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-4 border-t pt-2 text-[10px] text-muted-foreground"><span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-primary" />Customer</span><span className="flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-muted-foreground/40" />Average</span></div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Session note review dialog */}
      <Dialog open={reviewingNoteId !== null} onOpenChange={(open) => { if (!open) closeNoteDialog(); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="text-base">{noteAction === 'approve' ? 'Approve session note' : 'Review session note'}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder={noteAction === 'approve' ? 'Add approval notes (optional)…' : 'Add review notes (optional)…'}
            value={reviewNotesText}
            onChange={(event) => setReviewNotesText(event.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={closeNoteDialog}>Cancel</Button>
            <Button size="sm" onClick={saveNoteReview}>{noteAction === 'approve' ? 'Approve note' : 'Save review'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDetailsPage;
