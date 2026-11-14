
import { useEffect, useMemo, useState } from 'react';
import { DataTable, Badge } from '@/components/DataTable';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Search,
  RefreshCw,
  MessageSquare,
  CreditCard,
  CalendarDays,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useToast } from '@/hooks/use-toast';
import {
  listBookingDrafts,
  type BookingDraft,
  type BookingDraftMessage,
} from '@/api/bookings';
import { useNavigate } from 'react-router-dom';

function formatStep(step: string): string {
  return step
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getStepClass(step: string): string {
  switch (step) {
    case 'awaiting_confirmation':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'payment_pending':
    case 'awaiting_payment_message':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'processing_till_receipt':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    case 'reschedule_confirm':
    case 'cancel_confirm':
      return 'border-orange-200 bg-orange-50 text-orange-700';
    case 'collecting_slots':
      return 'border-border bg-muted text-muted-foreground';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateAndTime(draft: BookingDraft): string {
  if (draft.dateTimeIso) return formatDateTime(draft.dateTimeIso);

  const date = draft.date || '';
  const time = draft.time || '';

  if (!date && !time) return 'Not selected';

  return [date, time].filter(Boolean).join(' · ');
}

function formatMessageDirection(direction: string): string {
  if (direction.toLowerCase() === 'incoming') return 'Customer';
  if (direction.toLowerCase() === 'outgoing') return 'Assistant';
  return direction || 'Unknown';
}

function getCustomerName(draft: BookingDraft): string {
  const name = draft.customer?.name?.trim();
  return name || 'Unknown customer';
}

function getPaymentLabel(draft: BookingDraft): string {
  if (!draft.payment) return 'No payment record';

  return draft.payment.status || 'Unknown';
}

export default function BookingDrafts() {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [drafts, setDrafts] = useState<BookingDraft[]>([]);
  const [countsByStep, setCountsByStep] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [stepFilter, setStepFilter] = useState('all');
  const [selectedDraft, setSelectedDraft] = useState<BookingDraft | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const fetchDrafts = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);

    try {
      const response = await listBookingDrafts();

      setDrafts(Array.isArray(response.drafts) ? response.drafts : []);
      setCountsByStep(response.countsByStep || {});
    } catch (error) {
      console.error('Failed to load booking drafts:', error);

      toast({
        title: 'Could not load booking drafts',
        description: 'Check the backend connection and try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void fetchDrafts();

    const interval = window.setInterval(() => {
      void fetchDrafts();
    }, 20000);

    return () => window.clearInterval(interval);
    // Initial load and polling intentionally use the same fetcher.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredDrafts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return drafts.filter((draft) => {
      const customerName = getCustomerName(draft).toLowerCase();
      const phone = draft.customer?.phone || '';
      const service = draft.service || '';
      const receipt = draft.payment?.mpesaReceipt || '';
      const recipient = draft.recipientName || '';

      const matchesSearch =
        !query ||
        customerName.includes(query) ||
        phone.toLowerCase().includes(query) ||
        service.toLowerCase().includes(query) ||
        receipt.toLowerCase().includes(query) ||
        recipient.toLowerCase().includes(query);

      const matchesStep =
        stepFilter === 'all' || draft.step === stepFilter;

      return matchesSearch && matchesStep;
    });
  }, [drafts, searchTerm, stepFilter]);

  const totalDrafts = drafts.length;

  const draftsWithPayment = drafts.filter(
    (draft) => draft.payment !== null
  ).length;

  const draftsAwaitingPayment = drafts.filter(
    (draft) =>
      draft.step === 'payment_pending' ||
      draft.step === 'awaiting_payment_message'
  ).length;

  const draftsWithLinkedBooking = drafts.filter(
    (draft) => draft.linkedBooking !== null
  ).length;

  const columns = [
    {
      header: 'Customer',
      accessor: 'customerId' as keyof BookingDraft,
      cell: (row: BookingDraft) => (
        <div className="min-w-[150px]">
          <p className="font-medium leading-5 text-foreground">
            {getCustomerName(row)}
          </p>
          <p className="text-xs leading-4 text-muted-foreground">
            {row.customer?.phone || 'No phone number'}
          </p>
        </div>
      ),
    },
    {
      header: 'Package',
      accessor: 'service' as keyof BookingDraft,
      cell: (row: BookingDraft) => (
        <span className="text-sm text-foreground">
          {row.service || 'Not selected'}
        </span>
      ),
    },
    {
      header: 'Requested session',
      accessor: 'date' as keyof BookingDraft,
      cell: (row: BookingDraft) => (
        <div className="min-w-[145px]">
          <p className="text-sm text-foreground">
            {formatDateAndTime(row)}
          </p>
          {row.isForSomeoneElse && row.recipientName && (
            <p className="text-xs text-muted-foreground">
              For: {row.recipientName}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Workflow stage',
      accessor: 'step' as keyof BookingDraft,
      cell: (row: BookingDraft) => (
        <Badge
          variant="outline"
          className={`whitespace-nowrap capitalize ${getStepClass(row.step)}`}
        >
          {formatStep(row.step)}
        </Badge>
      ),
    },
    {
      header: 'Payment',
      accessor: 'payment' as keyof BookingDraft,
      cell: (row: BookingDraft) => (
        <div className="min-w-[115px]">
          <p className="text-sm text-foreground">
            {getPaymentLabel(row)}
          </p>
          {row.payment?.mpesaReceipt && (
            <p className="text-xs text-muted-foreground">
              {row.payment.mpesaReceipt}
            </p>
          )}
        </div>
      ),
    },
    {
      header: 'Last updated',
      accessor: 'updatedAt' as keyof BookingDraft,
      cell: (row: BookingDraft) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatDateTime(row.updatedAt)}
        </span>
      ),
    },
  ];

  const openDraftDetails = (draft: BookingDraft) => {
    setSelectedDraft(draft);
    setDetailsOpen(true);
  };

  const renderMessage = (message: BookingDraftMessage) => {
    const isIncoming = message.direction.toLowerCase() === 'incoming';

    return (
      <div
        key={message.id}
        className="border-b border-border/60 px-3 py-2.5 last:border-0"
      >
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px]">
              {formatMessageDirection(message.direction)}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {message.platform}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {formatDateTime(message.createdAt)}
          </span>
        </div>
        <p className={`whitespace-pre-wrap text-xs leading-5 ${isIncoming ? 'text-foreground' : 'text-muted-foreground'}`}>
          {message.content}
        </p>
        {message.handledBy && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Handled by: {message.handledBy}
          </p>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-4 pb-8">
      <PageHeader
        title="Booking Drafts"
        description="Inspect active booking conversations and workflow state"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => void fetchDrafts(true)}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border/70 py-2.5 text-sm">
        <div>
          <span className="text-muted-foreground">Active drafts</span>
          <span className="ml-2 font-semibold tabular-nums">{totalDrafts}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Awaiting payment</span>
          <span className="ml-2 font-semibold tabular-nums">{draftsAwaitingPayment}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Payment records</span>
          <span className="ml-2 font-semibold tabular-nums">{draftsWithPayment}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Linked bookings</span>
          <span className="ml-2 font-semibold tabular-nums">{draftsWithLinkedBooking}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search booking drafts"
            placeholder="Search customer, phone, package or receipt"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>

        <Select value={stepFilter} onValueChange={setStepFilter}>
          <SelectTrigger className="h-9 w-full text-sm md:w-[220px]">
            <SelectValue placeholder="All workflow stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All workflow stages</SelectItem>
            {Object.keys(countsByStep).sort().map((step) => (
              <SelectItem key={step} value={step}>
                {formatStep(step)} ({countsByStep[step]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(searchTerm || stepFilter !== 'all') && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 text-xs"
            onClick={() => {
              setSearchTerm('');
              setStepFilter('all');
            }}
          >
            Clear
          </Button>
        )}

        <span className="shrink-0 text-xs text-muted-foreground md:ml-1">
          {filteredDrafts.length} results
        </span>
      </div>

      <section className="overflow-hidden rounded-md border border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
          <div>
            <h2 className="text-sm font-semibold">Active booking drafts</h2>
            <p className="text-xs text-muted-foreground">
              Select a row to inspect its stored data and recent conversation.
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {filteredDrafts.length} shown
          </span>
        </div>

        {filteredDrafts.length === 0 ? (
          <div className="flex min-h-[150px] flex-col items-center justify-center gap-2 px-4 text-center">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">No matching booking drafts</p>
            <p className="text-xs text-muted-foreground">
              Drafts will appear here when customers enter a booking workflow.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <DataTable
              data={filteredDrafts}
              columns={columns}
              onRowClick={openDraftDetails}
            />
          </div>
        )}
      </section>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Booking draft details</DialogTitle>
          </DialogHeader>

          {selectedDraft && (
            <div className="space-y-4">
              <section className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-md border border-border p-3 sm:grid-cols-3">
                <div>
                  <p className="text-[11px] text-muted-foreground">Customer</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {getCustomerName(selectedDraft)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Phone</p>
                  <p className="mt-0.5 text-sm">
                    {selectedDraft.customer?.phone || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Platform</p>
                  <p className="mt-0.5 text-sm">
                    {selectedDraft.customer?.whatsappId
                      ? 'WhatsApp'
                      : selectedDraft.customer?.instagramUsername
                        ? 'Instagram'
                        : selectedDraft.customer?.messengerId
                          ? 'Messenger'
                          : 'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Package</p>
                  <p className="mt-0.5 text-sm font-medium">
                    {selectedDraft.service || 'Not selected'}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Requested session</p>
                  <p className="mt-0.5 text-sm">
                    {formatDateAndTime(selectedDraft)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Workflow stage</p>
                  <div className="mt-1">
                    <Badge
                      variant="outline"
                      className={`capitalize ${getStepClass(selectedDraft.step)}`}
                    >
                      {formatStep(selectedDraft.step)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Draft created</p>
                  <p className="mt-0.5 text-xs">
                    {formatDateTime(selectedDraft.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Last updated</p>
                  <p className="mt-0.5 text-xs">
                    {formatDateTime(selectedDraft.updatedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Version</p>
                  <p className="mt-0.5 text-sm tabular-nums">
                    {selectedDraft.version}
                  </p>
                </div>
              </section>

              {(selectedDraft.isForSomeoneElse || selectedDraft.recipientName || selectedDraft.recipientPhone) && (
                <section className="space-y-2">
                  <h3 className="border-b border-border pb-1.5 text-sm font-semibold">
                    Recipient details
                  </h3>
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Recipient name</p>
                      <p className="mt-0.5 text-sm">
                        {selectedDraft.recipientName || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Recipient phone</p>
                      <p className="mt-0.5 text-sm">
                        {selectedDraft.recipientPhone || '—'}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <CreditCard className="h-3.5 w-3.5" />
                    Payment record
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedDraft.payment ? '1 record' : 'No record'}
                  </span>
                </div>

                {!selectedDraft.payment ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    No Payment record is currently linked to this draft.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-md border border-border p-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Amount</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums">
                        KSh {selectedDraft.payment.amount.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Payment status</p>
                      <p className="mt-0.5 text-sm capitalize">
                        {selectedDraft.payment.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Payment phone</p>
                      <p className="mt-0.5 text-sm">
                        {selectedDraft.payment.phone || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">M-Pesa receipt</p>
                      <p className="mt-0.5 break-all text-sm font-medium">
                        {selectedDraft.payment.mpesaReceipt || 'Not recorded'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Payment created</p>
                      <p className="mt-0.5 text-xs">
                        {formatDateTime(selectedDraft.payment.createdAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Checkout request</p>
                      <p className="mt-0.5 break-all text-xs">
                        {selectedDraft.payment.checkoutRequestId || '—'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Linked booking
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedDraft.linkedBooking ? 'Found' : 'None'}
                  </span>
                </div>

                {!selectedDraft.linkedBooking ? (
                  <p className="py-2 text-xs text-muted-foreground">
                    No linked Booking record was found for this draft.
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3 rounded-md border border-border p-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Package</p>
                      <p className="mt-0.5 text-sm">
                        {selectedDraft.linkedBooking.service}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Session date</p>
                      <p className="mt-0.5 text-sm">
                        {formatDateTime(selectedDraft.linkedBooking.dateTime)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Booking status</p>
                      <p className="mt-0.5 text-sm capitalize">
                        {selectedDraft.linkedBooking.status}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground">Google Calendar</p>
                      <p className="mt-0.5 text-sm">
                        {selectedDraft.linkedBooking.googleEventId ? 'Event linked' : 'No event ID'}
                      </p>
                    </div>
                  </div>
                )}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Recent conversation
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {selectedDraft.customer?.messages?.length || 0} messages
                  </span>
                </div>

                {!selectedDraft.customer?.messages?.length ? (
                  <p className="py-3 text-center text-xs text-muted-foreground">
                    No recent messages were returned for this customer.
                  </p>
                ) : (
                  <div className="max-h-[350px] overflow-y-auto rounded-md border border-border">
                    {[...selectedDraft.customer.messages]
                      .reverse()
                      .map(renderMessage)}
                  </div>
                )}
              </section>

              {selectedDraft.conflictResolution && (
                <section className="space-y-1.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Conflict resolution
                  </h3>
                  <p className="rounded-md border border-border p-3 text-xs">
                    {selectedDraft.conflictResolution}
                  </p>
                </section>
              )}

              <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDetailsOpen(false);
                    navigate(`/customers/${selectedDraft.customerId}`);
                  }}
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Customer profile
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDetailsOpen(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
