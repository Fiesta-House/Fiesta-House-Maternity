import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Search,
  Plus,
  CalendarDays,
  RefreshCw,
  FileText,
  Send,
  MoreHorizontal,
  Edit,
  History,
  X,
  Check,
  Info,
  CreditCard,
  Download,
  ExternalLink,
  ShieldCheck,
  Bell,
  MessageCircle,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  listBookings,
  getAvailableHours,
  updateBookingDraft,
  getBooking,
  updateBooking,
  getCustomerBookings,
  type Package,
} from '@/api/bookings';
import { invoicesApi, type Invoice } from '@/api/invoices';
import { followupsApi, type Followup } from '@/api/followups';
import { remindersApi, type Reminder } from '@/api/reminders';
import { getCustomer } from '@/api/customers';
import api from '@/api/apiInstance';
import { API_BASE_URL as API_BASE } from '@/config';
import { apiFetch } from '@/api/apiFetch';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { getPackageColor } from '@/utils/packageColors';
import { PageHeader } from '@/components/PageHeader';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { DayContentProps } from 'react-day-picker';

interface Booking {
  id: string;
  customerName: string;
  customerPhone?: string;
  service: string;
  date: Date;
  time: string;
  timeValue: string;
  durationMinutes?: number;
  recipientName?: string;
  status: 'provisional' | 'confirmed' | 'cancelled';
  googleEventId?: string;
}

interface BookingHour {
  time: string;
  available: boolean;
}

function formatPhoneDisplay(phone: string): string {
  if (!phone || !phone.trim()) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 9) return phone;
  if (digits.length >= 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

function shortenMessengerDisplay(name: string): string {
  if (!name || !name.trim()) return name;
  const match = name.match(/^Messenger\s+User\s+(\d+)$/i);
  return match ? `Messenger - ...${match[1].slice(-4)}` : name;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateInputValue(date: Date): string {
  return dateKey(date);
}

function getStatusClass(status: string): string {
  switch (status) {
    case 'confirmed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'provisional':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    case 'cancelled':
      return 'border-red-200 bg-red-50 text-red-700';
    default:
      return 'border-border bg-muted text-muted-foreground';
  }
}

function formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  return date.toLocaleDateString('en-GB', options || { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function toDateTime(date: Date, time: string): string {
  const value = new Date(date);
  const [hours, minutes] = time.split(':').map(Number);
  value.setHours(hours, minutes, 0, 0);
  return value.toISOString();
}

export default function Bookings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [showSchedule, setShowSchedule] = useState(false);

  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedTime, setSelectedTime] = useState('');
  const [availableHours, setAvailableHours] = useState<BookingHour[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'pod'>('mpesa');
  const [newBookingOpen, setNewBookingOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [isPaymentPending, setIsPaymentPending] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [invoices, setInvoices] = useState<Record<string, Invoice>>({});
  const [generatingInvoice, setGeneratingInvoice] = useState<string | null>(null);
  const [statistics, setStatistics] = useState({ total: 0, confirmed: 0, provisional: 0, cancelled: 0, revenue: 0 });

  const [selectedBookingDetails, setSelectedBookingDetails] = useState<Booking | null>(null);
  const [bookingDetailsOpen, setBookingDetailsOpen] = useState(false);
  const [loadingBookingDetails, setLoadingBookingDetails] = useState(false);
  const [fullBookingData, setFullBookingData] = useState<any>(null);
  const [bookingReminders, setBookingReminders] = useState<Reminder[]>([]);
  const [bookingFollowups, setBookingFollowups] = useState<Followup[]>([]);
  const [bookingPayments, setBookingPayments] = useState<any[]>([]);

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>();
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleService, setRescheduleService] = useState('');
  const [savingBooking, setSavingBooking] = useState(false);
  const [rescheduleAvailableHours, setRescheduleAvailableHours] = useState<BookingHour[]>([]);
  const [loadingRescheduleHours, setLoadingRescheduleHours] = useState(false);

  const [customerContextOpen, setCustomerContextOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState<any>(null);
  const [loadingCustomerHistory, setLoadingCustomerHistory] = useState(false);

  const scheduleRef = useRef<HTMLDivElement>(null);

  const bookingAddons: any[] = Array.isArray(fullBookingData?.bookingAddons)
    ? fullBookingData.bookingAddons
    : [];
  const addonsTotal = bookingAddons.reduce((sum, addon) => sum + (Number(addon.totalPrice) || 0), 0);

  const getPackageById = (id: string) => packages.find((pkg) => pkg.id === id);

  const fetchBookings = async () => {
    try {
      const response = await listBookings();
      const formatted: Booking[] = response.bookings.map((booking: any) => {
        const isId = (value: string) => !!value && /^[a-z0-9]{20,}$/i.test(value.trim());
        let name = booking.customer?.name || '';
        if (name.startsWith('WhatsApp User ')) name = name.replace(/^WhatsApp User\s+/, '');
        name = shortenMessengerDisplay(name);
        if (!name || name.trim().toLowerCase() === 'admin user' || isId(name)) {
          name = booking.customer?.phone && !isId(booking.customer.phone)
            ? formatPhoneDisplay(booking.customer.phone)
            : 'No name / no phone';
        }

        const date = new Date(booking.dateTime);
        return {
          id: booking.id,
          customerName: name,
          customerPhone: booking.customer?.phone ? formatPhoneDisplay(booking.customer.phone) : '',
          service: booking.service,
          date,
          time: formatTime(date),
          timeValue: `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`,
          durationMinutes: booking.durationMinutes || undefined,
          recipientName: booking.recipientName || undefined,
          status: booking.status,
          googleEventId: booking.googleEventId,
        };
      });
      setBookings(formatted);
    } catch {
      toast({ title: 'Could not load bookings', description: 'Please refresh the page and try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPackages = async () => {
    try {
      const response = await api.get(`${API_BASE}/api/bookings/packages`);
      const rows = Array.isArray(response.data) ? response.data : [];
      setPackages(rows);
      if (rows.length > 0) {
        setSelectedPackage((current) => current || rows[0].id);
        setSelectedService((current) => current || rows[0].name);
      }
    } catch {
      setPackages([]);
      toast({ title: 'Could not load packages', description: 'Packages are temporarily unavailable.', variant: 'destructive' });
    }
  };

  const fetchInvoices = async () => {
    try {
      const rows = await invoicesApi.getAllInvoices();
      const map: Record<string, Invoice> = {};
      rows.forEach((invoice) => { map[invoice.bookingId] = invoice; });
      setInvoices(map);
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  const fetchStatistics = async (total: number) => {
    try {
      const [statusCounts, revenue] = await Promise.all([
        api.get(`${API_BASE}/api/analytics/booking-status-counts`).catch(() => ({ data: {} })),
        api.get(`${API_BASE}/api/analytics/revenue`).catch(() => ({ data: { total: 0 } })),
      ]);
      setStatistics({
        total,
        confirmed: statusCounts.data?.confirmed || 0,
        provisional: statusCounts.data?.provisional || 0,
        cancelled: statusCounts.data?.cancelled || 0,
        revenue: revenue.data?.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch statistics:', error);
      setStatistics((current) => ({ ...current, total }));
    }
  };

  useEffect(() => {
    void fetchBookings();
    void fetchPackages();
    void fetchInvoices();

    const pollInterval = window.setInterval(() => {
      void fetchBookings();
    }, 20000);

    return () => window.clearInterval(pollInterval);
    // Initial load and polling intentionally use the same page-level fetchers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchStatistics(bookings.length);
    // Refresh status counts and revenue whenever the booking list refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings]);

  useEffect(() => {
    if (!selectedPackage || packages.length === 0) return;
    const pkg = packages.find((item) => item.id === selectedPackage);
    if (pkg && pkg.name !== selectedService) setSelectedService(pkg.name);
  }, [selectedPackage, packages, selectedService]);

  useEffect(() => {
    if (!selectedDate || !newBookingOpen || !selectedService) {
      setAvailableHours([]);
      return;
    }

    let active = true;
    const date = dateInputValue(selectedDate);
    getAvailableHours(date, selectedService)
      .then((hours) => {
        if (active) setAvailableHours(Array.isArray(hours) ? hours : []);
      })
      .catch(() => {
        if (active) setAvailableHours([]);
      });

    return () => { active = false; };
  }, [selectedDate, selectedService, newBookingOpen]);

  useEffect(() => {
    if (!rescheduleDate || !editDialogOpen || !rescheduleService) {
      setRescheduleAvailableHours([]);
      return;
    }

    let active = true;
    setLoadingRescheduleHours(true);
    getAvailableHours(dateInputValue(rescheduleDate), rescheduleService)
      .then((hours) => {
        if (active) setRescheduleAvailableHours(Array.isArray(hours) ? hours : []);
      })
      .catch(() => {
        if (active) setRescheduleAvailableHours([]);
      })
      .finally(() => {
        if (active) setLoadingRescheduleHours(false);
      });

    return () => { active = false; };
  }, [rescheduleDate, rescheduleService, editDialogOpen]);

  const handleSyncCalendar = async () => {
    setSyncing(true);
    try {
      await api.post(`${API_BASE}/api/calendar/sync`);
      toast({ title: 'Calendar synced', description: 'Confirmed bookings have been synced to Google Calendar.' });
      await fetchBookings();
    } catch {
      toast({ title: 'Calendar sync failed', description: 'Check the Google Calendar connection and try again.', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleGenerateInvoice = async (bookingId: string) => {
    setGeneratingInvoice(bookingId);
    try {
      const invoice = await invoicesApi.generateInvoice(bookingId);
      setInvoices((current) => ({ ...current, [bookingId]: invoice }));
      toast({ title: 'Invoice generated', description: `Invoice ${invoice.invoiceNumber} is ready.` });
    } catch {
      toast({ title: 'Invoice could not be generated', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setGeneratingInvoice(null);
    }
  };

  const handleSendInvoice = async (invoiceId: string, customerName: string) => {
    try {
      await invoicesApi.sendInvoice(invoiceId);
      toast({ title: 'Invoice sent', description: `Invoice sent to ${customerName} via WhatsApp.` });
      setInvoices((current) => {
        const bookingId = Object.keys(current).find((key) => current[key].id === invoiceId);
        if (!bookingId || !current[bookingId]) return current;
        return {
          ...current,
          [bookingId]: { ...current[bookingId], status: 'sent' as const, sentAt: new Date().toISOString() },
        };
      });
    } catch {
      toast({ title: 'Invoice could not be sent', description: 'Please try again.', variant: 'destructive' });
    }
  };

  const handleCreateBooking = async () => {
    if (!selectedDate || !selectedTime || !selectedService || !user || !selectedPackage) return;
    if (!recipientName.trim() || !recipientPhone.trim() || recipientPhone.trim().length < 8) {
      toast({ title: 'Customer details required', description: 'Enter the customer name and a valid phone number.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      await updateBookingDraft(user.id, {
        service: selectedService,
        packageId: selectedPackage,
        dateTimeIso: toDateTime(selectedDate, selectedTime),
        name: recipientName.trim(),
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
      });

      if (paymentMethod === 'pod') {
        const response = await apiFetch(`${API_BASE}/api/bookings/complete-pod/${user.id}`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to confirm Pay on Delivery booking');
        setNewBookingOpen(false);
        await fetchBookings();
        toast({ title: 'Booking confirmed', description: 'The Pay on Delivery booking has been confirmed.' });
        return;
      }

      const response = await apiFetch(`${API_BASE}/api/bookings/complete-draft/${user.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || 'Failed to initiate payment');

      toast({ title: 'Payment required', description: data.message || 'Complete the payment to confirm the booking.' });
      setNewBookingOpen(false);
      setIsPaymentPending(true);

      const checkoutRequestId = data.checkoutRequestId;
      if (!checkoutRequestId) throw new Error('No checkoutRequestId returned from backend');

      const { pollPaymentStatus } = await import('@/api/payments');
      let status = 'pending';
      for (let pollCount = 0; pollCount < 40; pollCount++) {
        try {
          const result = await pollPaymentStatus(checkoutRequestId);
          if (result && typeof result.status !== 'undefined') {
            status = result.status;
            if (status === 'success' || status === 'confirmed') {
              toast({ title: 'Booking confirmed', description: 'Payment was received and the booking is confirmed.' });
              await fetchBookings();
              setIsPaymentPending(false);
              setSelectedDate(new Date());
              setSelectedTime('');
              return;
            }
          }
        } catch (pollError) {
          console.warn('[pollPaymentStatus] request failed:', pollError);
        }
        await new Promise((resolve) => window.setTimeout(resolve, 3000));
      }

      setIsPaymentPending(false);
      if (status !== 'success' && status !== 'confirmed') {
        toast({ title: 'Payment still pending', description: `No confirmation was received before polling stopped. Last status: ${status}.` });
      }
      setSelectedDate(new Date());
      setSelectedTime('');
    } catch (error: any) {
      setIsPaymentPending(false);
      toast({ title: 'Booking could not be completed', description: error?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const fetchBookingDetails = async (booking: Booking) => {
    setLoadingBookingDetails(true);
    setSelectedBookingDetails(booking);
    setFullBookingData(null);
    setBookingPayments([]);
    setBookingReminders([]);
    setBookingFollowups([]);
    setBookingDetailsOpen(true);

    try {
      const bookingData: any = await getBooking(booking.id);
      setFullBookingData(bookingData);

      if (Array.isArray(bookingData.payments)) {
        setBookingPayments(bookingData.payments);
      } else {
        try {
          const response = await api.get(`${API_BASE}/api/payments`, { params: { bookingId: booking.id } });
          setBookingPayments(Array.isArray(response.data) ? response.data : []);
        } catch {
          setBookingPayments([]);
        }
      }

      if (Array.isArray(bookingData.reminders)) {
        setBookingReminders(bookingData.reminders);
      } else {
        try {
          const rows = await remindersApi.getBookingReminders(booking.id);
          setBookingReminders(Array.isArray(rows) ? rows : []);
        } catch {
          setBookingReminders([]);
        }
      }

      if (Array.isArray(bookingData.followups)) {
        setBookingFollowups(bookingData.followups);
      } else {
        try {
          const rows = await followupsApi.getBookingFollowups(booking.id);
          setBookingFollowups(Array.isArray(rows) ? rows : []);
        } catch {
          setBookingFollowups([]);
        }
      }
    } catch {
      toast({ title: 'Could not load booking details', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoadingBookingDetails(false);
    }
  };

  const fetchCustomerHistory = async (booking: Booking) => {
    setLoadingCustomerHistory(true);
    setCustomerHistory(null);
    setCustomerContextOpen(true);

    try {
      const fullData: any = await getBooking(booking.id);
      const customerId = fullData.customerId || fullData.customer?.id;
      if (!customerId) throw new Error('Customer ID not found');
      setSelectedCustomerId(customerId);

      const [customer, customerBookingsData] = await Promise.all([
        getCustomer(customerId).catch(() => null),
        getCustomerBookings(customerId).catch((): any => []),
      ]);
      const customerBookings = Array.isArray(customerBookingsData)
        ? customerBookingsData
        : (customerBookingsData?.bookings || []);

      let totalSpent = 0;
      try {
        const response = await api.get(`${API_BASE}/api/payments`, { params: { customerId } });
        const payments = Array.isArray(response.data) ? response.data : [];
        totalSpent = payments
          .filter((payment: any) => payment.status === 'success')
          .reduce((sum: number, payment: any) => sum + (payment.amount || 0), 0);
      } catch (error) {
        console.error('Failed to fetch customer payments:', error);
      }

      setCustomerHistory({
        customer: customer || { id: customerId, name: booking.customerName, phone: booking.customerPhone },
        bookings: customerBookings,
        totalSpent,
        totalBookings: customerBookings.length,
      });
    } catch {
      toast({ title: 'Customer history unavailable', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setLoadingCustomerHistory(false);
    }
  };

  const handleRescheduleBooking = async () => {
    if (!editingBooking || !rescheduleDate || !rescheduleTime) {
      toast({ title: 'Select a date and time', description: 'Both are required to reschedule a booking.', variant: 'destructive' });
      return;
    }

    setSavingBooking(true);
    try {
      await updateBooking(editingBooking.id, {
        dateTime: toDateTime(rescheduleDate, rescheduleTime),
        service: rescheduleService || editingBooking.service,
      });
      toast({ title: 'Booking updated', description: 'The new date and time have been saved.' });
      setEditDialogOpen(false);
      setEditingBooking(null);
      await fetchBookings();
    } catch (error: any) {
      toast({ title: 'Could not update booking', description: error.response?.data?.message || 'Please try again.', variant: 'destructive' });
    } finally {
      setSavingBooking(false);
    }
  };

  const handleSendReminder = async (reminderId: string) => {
    try {
      await remindersApi.sendReminder(reminderId);
      toast({ title: 'Reminder sent' });
      if (selectedBookingDetails) {
        const rows = await remindersApi.getBookingReminders(selectedBookingDetails.id);
        setBookingReminders(Array.isArray(rows) ? rows : []);
      }
    } catch {
      toast({ title: 'Reminder could not be sent', variant: 'destructive' });
    }
  };

  const handleSendFollowup = async (followupId: string) => {
    try {
      await followupsApi.sendFollowup(followupId);
      toast({ title: 'Follow-up sent' });
      if (selectedBookingDetails) {
        const rows = await followupsApi.getBookingFollowups(selectedBookingDetails.id);
        setBookingFollowups(Array.isArray(rows) ? rows : []);
      }
    } catch {
      toast({ title: 'Follow-up could not be sent', variant: 'destructive' });
    }
  };

  const handleQuickAction = async (bookingId: string, action: 'confirm' | 'cancel') => {
    try {
      await api.post(`${API_BASE}/api/bookings/${bookingId}/${action}`);
      toast({ title: action === 'confirm' ? 'Booking confirmed' : 'Booking cancelled' });
      await fetchBookings();
    } catch {
      toast({ title: `Could not ${action} booking`, variant: 'destructive' });
    }
  };

  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    const query = searchTerm.trim().toLowerCase();
    const matchesSearch = !query
      || booking.customerName.toLowerCase().includes(query)
      || booking.service.toLowerCase().includes(query)
      || booking.customerPhone?.toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'all'
      ? booking.status !== 'cancelled'
      : booking.status === statusFilter;
    const matchesPackage = packageFilter === 'all' || booking.service === packageFilter;
    return matchesSearch && matchesStatus && matchesPackage;
  }), [bookings, searchTerm, statusFilter, packageFilter]);

  const bookingDateKeys = useMemo(() => {
    const active = new Set<string>();
    const cancelled = new Set<string>();
    bookings.forEach((booking) => {
      (booking.status === 'cancelled' ? cancelled : active).add(dateKey(booking.date));
    });
    return { active, cancelled };
  }, [bookings]);

  const selectedDateBookings = useMemo(() => {
    if (!selectedDate) return [];
    return bookings
      .filter((booking) => dateKey(booking.date) === dateKey(selectedDate))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [bookings, selectedDate]);

  const activeSelectedDateBookings = selectedDateBookings.filter((booking) => booking.status !== 'cancelled');
  const selectedDayConfirmed = activeSelectedDateBookings.filter((booking) => booking.status === 'confirmed').length;

  const handleCalendarDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      window.setTimeout(() => scheduleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  };

  const renderBookingDayContent = ({ date }: DayContentProps) => {
    const key = dateKey(date);
    const hasActive = bookingDateKeys.active.has(key);
    const onlyCancelled = !hasActive && bookingDateKeys.cancelled.has(key);

    return (
      <div className="relative flex h-full w-full items-center justify-center">
        <span>{date.getDate()}</span>
        {hasActive && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-primary" aria-hidden="true" />}
        {onlyCancelled && <span className="absolute bottom-1 h-1 w-1 rounded-full border border-red-500" aria-label="Cancelled bookings only" />}
      </div>
    );
  };

  const columns = [
    {
      header: 'Customer',
      accessor: 'customerName' as keyof Booking,
      cell: (row: Booking) => (
        <div className="min-w-[150px]">
          <p className="font-medium leading-5 text-foreground">{row.customerName}</p>
          {row.customerPhone && <p className="text-xs leading-4 text-muted-foreground">{row.customerPhone}</p>}
        </div>
      ),
    },
    {
      header: 'Package',
      accessor: 'service' as keyof Booking,
      cell: (row: Booking) => {
        const color = getPackageColor(row.service);
        return (
          <span className="inline-flex whitespace-nowrap rounded border px-2 py-1 text-xs font-medium" style={{ backgroundColor: `${color}12`, color, borderColor: `${color}35` }}>
            {row.service}
          </span>
        );
      },
    },
    {
      header: 'Date & time',
      accessor: (row: Booking) => row.date.toLocaleDateString(),
      cell: (row: Booking) => (
        <div className="whitespace-nowrap">
          <p className="text-sm text-foreground">{formatDate(row.date)}</p>
          <p className="text-xs text-muted-foreground">{row.time}</p>
        </div>
      ),
    },
    {
      header: 'Status',
      accessor: (row: Booking) => (
        <Badge variant="outline" className={`capitalize ${getStatusClass(row.status)}`}>{row.status}</Badge>
      ),
    },
    {
      header: 'Invoice',
      accessor: (row: Booking) => {
        const invoice = invoices[row.id];
        if (!invoice) {
          return (
            <Button
              size="sm"
              variant="ghost"
              disabled={generatingInvoice === row.id || row.status !== 'confirmed'}
              onClick={(event) => { event.stopPropagation(); void handleGenerateInvoice(row.id); }}
              className="h-7 px-2 text-xs"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              {generatingInvoice === row.id ? 'Creating…' : 'Generate'}
            </Button>
          );
        }
        return (
          <div className="flex items-center gap-1" onClick={(event) => event.stopPropagation()}>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => window.open(invoicesApi.downloadInvoice(invoice.id), '_blank')} title="Download invoice">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void handleSendInvoice(invoice.id, row.customerName)} disabled={invoice.status === 'sent'}>
              <Send className="mr-1 h-3.5 w-3.5" />{invoice.status === 'sent' ? 'Sent' : 'Send'}
            </Button>
          </div>
        );
      },
    },
    {
      header: '',
      accessor: (row: Booking) => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(event) => event.stopPropagation()} aria-label={`Actions for ${row.customerName}`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-48 p-1" align="end" onClick={(event) => event.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-xs" onClick={() => void fetchBookingDetails(row)}>
              <Info className="mr-2 h-3.5 w-3.5" />Booking details
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start text-xs"
              onClick={() => {
                setEditingBooking(row);
                setRescheduleDate(row.date);
                setRescheduleTime(row.timeValue);
                setRescheduleService(row.service);
                setEditDialogOpen(true);
              }}
            >
              <Edit className="mr-2 h-3.5 w-3.5" />Edit / reschedule
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-xs" onClick={() => void fetchCustomerHistory(row)}>
              <History className="mr-2 h-3.5 w-3.5" />Customer history
            </Button>
            {row.status === 'provisional' && (
              <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-xs" onClick={() => void handleQuickAction(row.id, 'confirm')}>
                <Check className="mr-2 h-3.5 w-3.5" />Confirm booking
              </Button>
            )}
            {row.status !== 'cancelled' && (
              <Button variant="ghost" size="sm" className="h-8 w-full justify-start text-xs text-destructive hover:text-destructive" onClick={() => void handleQuickAction(row.id, 'cancel')}>
                <X className="mr-2 h-3.5 w-3.5" />Cancel booking
              </Button>
            )}
          </PopoverContent>
        </Popover>
      ),
    },
  ];

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
        title="Bookings"
        description="Appointments, payments and studio schedule"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => setShowSchedule((value) => !value)}>
              <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
              {showSchedule ? 'Hide schedule' : 'Schedule'}
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => void handleSyncCalendar()} disabled={syncing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync calendar'}
            </Button>
            <Button size="sm" className="h-8" onClick={() => setNewBookingOpen(true)}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />New booking
            </Button>
          </div>
        }
      />

      {/* Compact operational summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border/70 py-2.5 text-sm">
        <div><span className="text-muted-foreground">Bookings</span><span className="ml-2 font-semibold tabular-nums">{statistics.total}</span></div>
        <div><span className="text-muted-foreground">Confirmed</span><span className="ml-2 font-semibold tabular-nums">{statistics.confirmed}</span></div>
        <div><span className="text-muted-foreground">Provisional</span><span className="ml-2 font-semibold tabular-nums">{statistics.provisional}</span></div>
        <div><span className="text-muted-foreground">Cancelled</span><span className="ml-2 font-semibold tabular-nums">{statistics.cancelled}</span></div>
        <div className="ml-auto"><span className="text-muted-foreground">Revenue</span><span className="ml-2 font-semibold tabular-nums">KSh {statistics.revenue.toLocaleString()}</span></div>
      </div>

      {/* Search and filters stay on one compact toolbar where possible. */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search bookings"
            placeholder="Search customer, phone or package"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full text-sm md:w-[145px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Active bookings</SelectItem>
            <SelectItem value="provisional">Provisional</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={packageFilter} onValueChange={setPackageFilter}>
          <SelectTrigger className="h-9 w-full text-sm md:w-[180px]"><SelectValue placeholder="All packages" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All packages</SelectItem>
            {packages.map((pkg) => <SelectItem key={pkg.id} value={pkg.name}>{pkg.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {(searchTerm || statusFilter !== 'all' || packageFilter !== 'all') && (
          <Button variant="ghost" size="sm" className="h-9 px-2 text-xs" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setPackageFilter('all'); }}>
            <X className="mr-1 h-3.5 w-3.5" />Clear
          </Button>
        )}
        <span className="shrink-0 text-xs text-muted-foreground md:ml-1">{filteredBookings.length} results</span>
      </div>

      {/* Schedule is available on demand and uses a compact calendar + agenda. */}
      {showSchedule && (
        <section className="grid gap-3 rounded-md border border-border/70 p-3 lg:grid-cols-[270px_minmax(0,1fr)]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium">Studio schedule</p>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleCalendarDateSelect(new Date())}>Today</Button>
            </div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleCalendarDateSelect}
              className="w-full rounded-md border-0 p-1"
              classNames={{
                months: 'w-full',
                month: 'w-full space-y-2',
                caption: 'flex justify-center pt-1 relative items-center text-sm',
                head_row: 'flex w-full',
                head_cell: 'flex-1 text-muted-foreground rounded-md font-normal text-[11px]',
                row: 'flex w-full mt-1',
                cell: 'flex-1 h-8 text-center text-xs p-0 relative',
                day: 'h-8 w-full p-0 font-normal text-xs',
                table: 'w-full border-collapse space-y-1',
              }}
              dayContent={renderBookingDayContent}
            />
            <div className="mt-2 flex flex-wrap gap-3 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Active booking</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full border border-red-500" />Cancelled only</span>
            </div>
          </div>

          <div ref={scheduleRef} className="min-w-0 border-t border-border/60 pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium">{selectedDate ? formatDate(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Select a date'}</p>
                <p className="text-xs text-muted-foreground">{activeSelectedDateBookings.length} active · {selectedDayConfirmed} confirmed</p>
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setNewBookingOpen(true); if (!selectedDate) setSelectedDate(new Date()); }}>
                <Plus className="mr-1 h-3.5 w-3.5" />Book this day
              </Button>
            </div>

            {selectedDateBookings.length === 0 ? (
              <div className="flex min-h-[110px] items-center justify-center rounded border border-dashed border-border px-4 text-center">
                <div>
                  <p className="text-sm text-foreground">No bookings on this date</p>
                  <p className="mt-1 text-xs text-muted-foreground">Choose another day or create a booking.</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border/60 rounded-md border border-border/60">
                {selectedDateBookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => void fetchBookingDetails(booking)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <span className="w-[68px] shrink-0 text-xs font-medium tabular-nums text-foreground">{booking.time}</span>
                    <span className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: getPackageColor(booking.service) }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{booking.recipientName && booking.recipientName !== booking.customerName ? booking.recipientName : booking.customerName}</span>
                      <span className="block truncate text-xs text-muted-foreground">{booking.service} · {getBookingDuration(booking)} min</span>
                    </span>
                    <Badge variant="outline" className={`shrink-0 text-[10px] capitalize ${getStatusClass(booking.status)}`}>{booking.status}</Badge>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* The bookings table is the main working surface. */}
      <section className="overflow-hidden rounded-md border border-border/70">
        <div className="flex items-center justify-between border-b border-border/70 px-3 py-2.5">
          <div>
            <h2 className="text-sm font-semibold">All bookings</h2>
            <p className="text-xs text-muted-foreground">Select a row to view its details.</p>
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{filteredBookings.length} shown</span>
        </div>
        <div className="overflow-x-auto">
          <DataTable data={filteredBookings} columns={columns} onRowClick={(booking) => void fetchBookingDetails(booking)} />
        </div>
      </section>

      {/* Create booking */}
      <Dialog open={newBookingOpen} onOpenChange={setNewBookingOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">New booking</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="recipientName" className="text-xs">Customer name</Label>
                <Input id="recipientName" value={recipientName} onChange={(event) => setRecipientName(event.target.value)} placeholder="Customer name" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipientPhone" className="text-xs">Phone number</Label>
                <Input id="recipientPhone" value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} placeholder="e.g. 2547…" className="h-9" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Package</Label>
                <Select value={selectedPackage} onValueChange={(value) => { setSelectedPackage(value); const pkg = getPackageById(value); if (pkg) setSelectedService(pkg.name); }}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choose package" /></SelectTrigger>
                  <SelectContent>
                    {packages.map((pkg) => (
                      <SelectItem key={pkg.id} value={pkg.id}>
                        <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: getPackageColor(pkg.name) }} />{pkg.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <div className="rounded-md border border-border p-2">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => { setSelectedDate(date); setSelectedTime(''); }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 1}
                    className="mx-auto w-full p-1"
                    classNames={{
                      months: 'w-full', month: 'w-full space-y-2', caption: 'flex justify-center pt-1 relative items-center text-sm',
                      head_row: 'flex w-full', head_cell: 'flex-1 text-muted-foreground text-[11px] font-normal',
                      row: 'flex w-full mt-1', cell: 'flex-1 h-8 p-0 text-center text-xs', day: 'h-8 w-full p-0 text-xs',
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Available time</Label>
                {selectedDate && <span className="text-xs text-muted-foreground">{formatDate(selectedDate)}</span>}
              </div>
              <div className="min-h-[76px] rounded-md border border-border p-2">
                {!selectedDate || !selectedService ? (
                  <p className="py-5 text-center text-xs text-muted-foreground">Choose a package and date first.</p>
                ) : availableHours.length === 0 ? (
                  <p className="py-5 text-center text-xs text-muted-foreground">No times available for this date.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {availableHours.map(({ time, available }) => {
                      const date = new Date(time);
                      const timeValue = date.toTimeString().split(' ')[0];
                      return (
                        <Button
                          key={time}
                          type="button"
                          size="sm"
                          variant={selectedTime === timeValue ? 'default' : 'outline'}
                          disabled={!available}
                          onClick={() => setSelectedTime(timeValue)}
                          className="h-8 px-2 text-xs"
                        >
                          {formatTime(date)}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Payment method</Label>
              <RadioGroup value={paymentMethod} onValueChange={(value: 'mpesa' | 'pod') => setPaymentMethod(value)} className="grid grid-cols-2 gap-2">
                <Label htmlFor="mpesa" className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${paymentMethod === 'mpesa' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="mpesa" id="mpesa" /><CreditCard className="h-4 w-4" />M-Pesa
                </Label>
                <Label htmlFor="pod" className={`flex cursor-pointer items-center gap-2 rounded-md border p-3 text-sm ${paymentMethod === 'pod' ? 'border-primary bg-primary/5' : 'border-border'}`}>
                  <RadioGroupItem value="pod" id="pod" /><ShieldCheck className="h-4 w-4" />Pay on delivery
                </Label>
              </RadioGroup>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-border pt-3">
            <Button variant="outline" size="sm" onClick={() => setNewBookingOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={() => void handleCreateBooking()} disabled={creating || !selectedDate || !selectedTime || !selectedService || !selectedPackage || !recipientName.trim() || !recipientPhone.trim()}>
              {creating ? 'Saving…' : 'Create booking'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment status */}
      <Dialog open={isPaymentPending} onOpenChange={setIsPaymentPending}>
        <DialogContent className="max-w-sm">
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
            <h3 className="text-sm font-semibold">Waiting for payment</h3>
            <p className="max-w-xs text-xs text-muted-foreground">Complete the payment to confirm this booking. This window will update when a payment result is received.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking details */}
      <Dialog open={bookingDetailsOpen} onOpenChange={setBookingDetailsOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Booking details</DialogTitle></DialogHeader>
          {loadingBookingDetails ? (
            <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
          ) : selectedBookingDetails ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-md border border-border p-3 sm:grid-cols-3">
                <div><Label className="text-[11px] text-muted-foreground">Customer</Label><p className="mt-0.5 text-sm font-medium">{selectedBookingDetails.customerName}</p></div>
                <div><Label className="text-[11px] text-muted-foreground">Phone</Label><p className="mt-0.5 text-sm">{selectedBookingDetails.customerPhone || '—'}</p></div>
                <div><Label className="text-[11px] text-muted-foreground">Package</Label><p className="mt-0.5 text-sm font-medium">{selectedBookingDetails.service}</p></div>
                <div><Label className="text-[11px] text-muted-foreground">Date</Label><p className="mt-0.5 text-sm">{formatDate(selectedBookingDetails.date)}</p></div>
                <div><Label className="text-[11px] text-muted-foreground">Time</Label><p className="mt-0.5 text-sm">{selectedBookingDetails.time}</p></div>
                <div><Label className="text-[11px] text-muted-foreground">Status</Label><div className="mt-1"><Badge variant="outline" className={`capitalize ${getStatusClass(selectedBookingDetails.status)}`}>{selectedBookingDetails.status}</Badge></div></div>
              </div>

              {bookingPayments.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5"><h3 className="text-sm font-semibold">Payments</h3><span className="text-xs text-muted-foreground">{bookingPayments.length} records</span></div>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {bookingPayments.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <div><p className="font-medium tabular-nums">KSh {payment.amount?.toLocaleString() || '0'}</p><p className="text-xs text-muted-foreground">{new Date(payment.createdAt).toLocaleDateString()}</p></div>
                        <Badge variant={payment.status === 'success' ? 'default' : 'secondary'} className="capitalize">{payment.status}</Badge>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="h-3.5 w-3.5" />Add-ons</h3><span className="text-xs text-muted-foreground">{bookingAddons.length} items</span></div>
                {bookingAddons.length === 0 ? <p className="py-2 text-xs text-muted-foreground">No add-ons recorded.</p> : (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {bookingAddons.map((addon: any) => (
                      <div key={addon.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate">{addon.name}{addon.quantity > 1 ? ` ×${addon.quantity}` : ''}</span>
                        <span className="flex shrink-0 items-center gap-2"><Badge variant={addon.status === 'pending' ? 'secondary' : 'default'} className="text-[10px] capitalize">{addon.status}</Badge><span className="text-xs font-medium tabular-nums">{addon.totalPrice > 0 ? `KSh ${addon.totalPrice.toLocaleString()}` : 'Quoted'}</span></span>
                      </div>
                    ))}
                    {addonsTotal > 0 && <div className="flex justify-between px-3 py-2 text-xs font-semibold"><span>Add-ons total</span><span className="tabular-nums">KSh {addonsTotal.toLocaleString()}</span></div>}
                  </div>
                )}
              </section>

              <div className="grid gap-4 sm:grid-cols-2">
                <section className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5"><h3 className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-3.5 w-3.5" />Reminders</h3><span className="text-xs text-muted-foreground">{bookingReminders.length}</span></div>
                  {bookingReminders.length === 0 ? <p className="py-1 text-xs text-muted-foreground">No reminders scheduled.</p> : bookingReminders.map((reminder) => (
                    <div key={reminder.id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                      <div className="min-w-0"><p className="font-medium">{reminder.type} reminder</p><p className="text-muted-foreground">{new Date(reminder.scheduledFor).toLocaleString()}</p></div>
                      {reminder.status === 'pending' ? <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[11px]" onClick={() => void handleSendReminder(reminder.id)}><Send className="mr-1 h-3 w-3" />Send</Button> : <Badge variant="secondary" className="text-[10px]">{reminder.status}</Badge>}
                    </div>
                  ))}
                </section>
                <section className="space-y-2">
                  <div className="flex items-center justify-between border-b border-border pb-1.5"><h3 className="flex items-center gap-2 text-sm font-semibold"><MessageCircle className="h-3.5 w-3.5" />Follow-ups</h3><span className="text-xs text-muted-foreground">{bookingFollowups.length}</span></div>
                  {bookingFollowups.length === 0 ? <p className="py-1 text-xs text-muted-foreground">No follow-ups scheduled.</p> : bookingFollowups.map((followup) => (
                    <div key={followup.id} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-xs last:border-0">
                      <div className="min-w-0"><p className="font-medium capitalize">{followup.type} follow-up</p><p className="text-muted-foreground">{new Date(followup.scheduledFor).toLocaleString()}</p></div>
                      {followup.status === 'pending' ? <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-[11px]" onClick={() => void handleSendFollowup(followup.id)}><Send className="mr-1 h-3 w-3" />Send</Button> : <Badge variant="secondary" className="text-[10px]">{followup.status}</Badge>}
                    </div>
                  ))}
                </section>
              </div>

              {invoices[selectedBookingDetails.id] && (
                <section className="flex flex-wrap items-center justify-between gap-3 border-y border-border py-2">
                  <div><p className="text-sm font-medium">Invoice #{invoices[selectedBookingDetails.id].invoiceNumber}</p><p className="text-xs text-muted-foreground">Total: KSh {invoices[selectedBookingDetails.id].total?.toLocaleString()}</p></div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => window.open(invoicesApi.downloadInvoice(invoices[selectedBookingDetails.id].id), '_blank')}><Download className="mr-1.5 h-3.5 w-3.5" />Download</Button>
                    <Button size="sm" className="h-8" onClick={() => void handleSendInvoice(invoices[selectedBookingDetails.id].id, selectedBookingDetails.customerName)} disabled={invoices[selectedBookingDetails.id].status === 'sent'}><Send className="mr-1.5 h-3.5 w-3.5" />{invoices[selectedBookingDetails.id].status === 'sent' ? 'Sent' : 'Send'}</Button>
                  </div>
                </section>
              )}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <Button size="sm" variant="outline" onClick={() => { setEditingBooking(selectedBookingDetails); setRescheduleDate(selectedBookingDetails.date); setRescheduleTime(selectedBookingDetails.timeValue); setRescheduleService(selectedBookingDetails.service); setBookingDetailsOpen(false); setEditDialogOpen(true); }}>
                  <Edit className="mr-1.5 h-3.5 w-3.5" />Edit / reschedule
                </Button>
                <Button size="sm" variant="outline" onClick={() => { void fetchCustomerHistory(selectedBookingDetails); setBookingDetailsOpen(false); }}>
                  <History className="mr-1.5 h-3.5 w-3.5" />Customer history
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit booking */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Edit booking</DialogTitle></DialogHeader>
          {editingBooking && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div><p className="text-sm font-medium">{editingBooking.customerName}</p><p className="text-xs text-muted-foreground">Currently {formatDate(editingBooking.date)} at {editingBooking.time}</p></div>
                <Badge variant="outline" className={`capitalize ${getStatusClass(editingBooking.status)}`}>{editingBooking.status}</Badge>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Package</Label>
                <Select value={rescheduleService} onValueChange={setRescheduleService}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Select package" /></SelectTrigger>
                  <SelectContent>{packages.map((pkg) => <SelectItem key={pkg.id} value={pkg.name}>{pkg.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New date</Label>
                <div className="rounded-md border border-border p-2">
                  <Calendar
                    mode="single"
                    selected={rescheduleDate}
                    onSelect={(date) => { setRescheduleDate(date); setRescheduleTime(''); }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0)) || date.getDay() === 1}
                    className="mx-auto w-full p-1"
                    classNames={{
                      months: 'w-full', month: 'w-full space-y-2', caption: 'flex justify-center pt-1 relative items-center text-sm',
                      head_row: 'flex w-full', head_cell: 'flex-1 text-muted-foreground text-[11px] font-normal',
                      row: 'flex w-full mt-1', cell: 'flex-1 h-8 p-0 text-center text-xs', day: 'h-8 w-full p-0 text-xs',
                    }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between"><Label className="text-xs">New time</Label>{loadingRescheduleHours && <span className="text-xs text-muted-foreground">Loading times…</span>}</div>
                {!rescheduleDate ? <p className="rounded-md border border-dashed border-border py-5 text-center text-xs text-muted-foreground">Select a date first.</p> : loadingRescheduleHours ? <div className="py-5 text-center"><div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" /></div> : rescheduleAvailableHours.length === 0 ? <p className="rounded-md border border-dashed border-border py-5 text-center text-xs text-muted-foreground">No available times for this date.</p> : (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {rescheduleAvailableHours.map(({ time, available }) => {
                      const date = new Date(time);
                      const value = date.toTimeString().split(' ')[0];
                      return <Button key={time} size="sm" variant={rescheduleTime === value ? 'default' : 'outline'} disabled={!available} onClick={() => setRescheduleTime(value)} className="h-8 px-1 text-xs">{formatTime(date)}</Button>;
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Button size="sm" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={() => void handleRescheduleBooking()} disabled={savingBooking || !rescheduleDate || !rescheduleTime}>{savingBooking ? 'Saving…' : 'Save changes'}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Customer history */}
      <Dialog open={customerContextOpen} onOpenChange={setCustomerContextOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="text-base">Customer history</DialogTitle></DialogHeader>
          {loadingCustomerHistory ? (
            <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-2 border-muted border-t-primary" /></div>
          ) : customerHistory ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="grid flex-1 grid-cols-2 gap-x-5 gap-y-2">
                  <div><Label className="text-[11px] text-muted-foreground">Customer</Label><p className="mt-0.5 text-sm font-medium">{customerHistory.customer?.name || '—'}</p></div>
                  <div><Label className="text-[11px] text-muted-foreground">Phone</Label><p className="mt-0.5 text-sm">{customerHistory.customer?.phone || '—'}</p></div>
                  <div><Label className="text-[11px] text-muted-foreground">Bookings</Label><p className="mt-0.5 text-sm font-semibold tabular-nums">{customerHistory.totalBookings}</p></div>
                  <div><Label className="text-[11px] text-muted-foreground">Total spent</Label><p className="mt-0.5 text-sm font-semibold tabular-nums">KSh {customerHistory.totalSpent.toLocaleString()}</p></div>
                </div>
                {selectedCustomerId && <Button size="sm" variant="outline" className="h-8" onClick={() => { navigate(`/customers/${selectedCustomerId}`); setCustomerContextOpen(false); }}><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Full profile</Button>}
              </div>
              <section className="space-y-2">
                <div className="flex items-center justify-between border-b border-border pb-1.5"><h3 className="text-sm font-semibold">Previous bookings</h3><span className="text-xs text-muted-foreground">{customerHistory.bookings.length} records</span></div>
                {customerHistory.bookings.length === 0 ? <p className="py-5 text-center text-xs text-muted-foreground">No previous bookings.</p> : (
                  <div className="divide-y divide-border rounded-md border border-border">
                    {customerHistory.bookings.slice(0, 10).map((booking: any) => (
                      <button
                        key={booking.id}
                        type="button"
                        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/40"
                        onClick={() => {
                          void fetchBookingDetails({
                            id: booking.id,
                            customerName: booking.customer?.name || 'Unknown',
                            customerPhone: booking.customer?.phone || '',
                            service: booking.service,
                            date: new Date(booking.dateTime),
                            time: formatTime(new Date(booking.dateTime)),
                            timeValue: `${String(new Date(booking.dateTime).getHours()).padStart(2, '0')}:${String(new Date(booking.dateTime).getMinutes()).padStart(2, '0')}`,
                            status: booking.status,
                            googleEventId: booking.googleEventId,
                          });
                          setCustomerContextOpen(false);
                        }}
                      >
                        <span className="min-w-0"><span className="block truncate text-sm font-medium">{booking.service}</span><span className="block text-xs text-muted-foreground">{formatDate(new Date(booking.dateTime))} · {formatTime(new Date(booking.dateTime))}</span></span>
                        <span className="flex shrink-0 items-center gap-2"><Badge variant="outline" className={`capitalize text-[10px] ${getStatusClass(booking.status)}`}>{booking.status}</Badge><ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /></span>
                      </button>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getBookingDuration(booking: Booking): number {
  return booking.durationMinutes || 120;
}
