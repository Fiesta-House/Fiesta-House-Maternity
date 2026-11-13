
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCustomers, getCustomerActivitySummary, Customer } from '../api/customers';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ChevronRight, X, Users, RefreshCw } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/PageHeader';

type PlatformType = 'all' | 'whatsapp' | 'messenger' | 'instagram' | 'other';
type ActivitySegment = 'all' | 'online' | 'today' | 'yesterday';
type AiFilter = 'all' | 'active' | 'paused';

const platformMap: Record<string, { label: string; color: string }> = {
  whatsapp: {
    label: 'WhatsApp',
    color: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-900',
  },
  messenger: {
    label: 'Messenger',
    color: 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900',
  },
  instagram: {
    label: 'Instagram',
    color: 'text-pink-700 bg-pink-50 border-pink-200 dark:text-pink-400 dark:bg-pink-950/30 dark:border-pink-900',
  },
  other: {
    label: 'Other',
    color: 'text-muted-foreground bg-muted border-border',
  },
};

const normalizePlatform = (customer: Customer) => {
  let key = (customer.platform || '').toLowerCase();

  if (!platformMap[key] || key === 'other' || !key) {
    const email = (customer.email || '').toLowerCase();
    if (email.includes('@whatsapp.local')) key = 'whatsapp';
    else if (email.includes('@messenger.local')) key = 'messenger';
    else if (email.includes('@instagram.local')) key = 'instagram';
    else if (customer.instagramId || customer.instagramUsername) key = 'instagram';
    else key = 'other';
  }

  return key;
};

const getInitials = (name?: string | null) => {
  if (!name?.trim()) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getActivityDate = (customer: Customer): Date | null => {
  const value = customer.lastActivityAt || customer.updatedAt;
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const Customers = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<PlatformType>('all');
  const [aiFilter, setAiFilter] = useState<AiFilter>('all');
  const [segment, setSegment] = useState<ActivitySegment>('online');

  const {
    data: customers,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['customers', segment],
    queryFn: () => getCustomers({ segment }),
  });

  const { data: activitySummary } = useQuery({
    queryKey: ['customers-activity-summary'],
    queryFn: getCustomerActivitySummary,
  });

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];

    const search = searchTerm.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch = !search ||
        (customer.name || '').toLowerCase().includes(search) ||
        (customer.instagramUsername || '').toLowerCase().includes(search) ||
        (customer.instagramProfileName || '').toLowerCase().includes(search) ||
        (customer.phone || '').toLowerCase().includes(search) ||
        (customer.email || '').toLowerCase().includes(search);

      const matchesPlatform =
        platformFilter === 'all' || normalizePlatform(customer) === platformFilter;

      const matchesAiFilter =
        aiFilter === 'all' ||
        (aiFilter === 'active' && customer.aiEnabled) ||
        (aiFilter === 'paused' && !customer.aiEnabled);

      return matchesSearch && matchesPlatform && matchesAiFilter;
    });
  }, [customers, searchTerm, platformFilter, aiFilter]);

  const clearFilters = () => {
    setSearchTerm('');
    setPlatformFilter('all');
    setAiFilter('all');
    setSegment('online');
  };

  const hasFilters = Boolean(
    searchTerm || platformFilter !== 'all' || aiFilter !== 'all',
  );

  const segmentButtons: Array<{
    key: ActivitySegment;
    label: string;
    count?: number;
  }> = [
    { key: 'online', label: 'Online', count: activitySummary?.onlineNow },
    { key: 'today', label: 'Today', count: activitySummary?.activeToday },
    { key: 'yesterday', label: 'Yesterday', count: activitySummary?.activeYesterday },
    { key: 'all', label: 'All customers', count: activitySummary?.totalCustomers },
  ];

  if (error) {
    return (
      <div className="mx-auto max-w-6xl space-y-3">
        <PageHeader
          title="Customers"
          description="Customer records and recent conversations"
        />
        <div className="flex flex-col items-center justify-center rounded-md border border-destructive/30 px-4 py-10 text-center">
          <Users className="mb-2 h-7 w-7 text-destructive" />
          <h3 className="text-sm font-medium">Unable to load customers</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 h-8"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <PageHeader
        title="Customers"
        description="Customer records and recent conversations"
      />

      <div className="flex flex-col gap-2 rounded-md border bg-card px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          {segmentButtons.map((item) => (
            <Button
              key={item.key}
              type="button"
              size="sm"
              variant={segment === item.key ? 'secondary' : 'ghost'}
              className={cn(
                'h-7 px-2.5 text-xs font-medium',
                segment === item.key && 'bg-muted text-foreground shadow-none',
              )}
              onClick={() => setSegment(item.key)}
            >
              {item.label}
              <span className="ml-1 tabular-nums text-muted-foreground">
                {item.count ?? '—'}
              </span>
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-2 text-xs text-muted-foreground sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <span>
            New today{' '}
            <strong className="ml-1 font-semibold tabular-nums text-foreground">
              {activitySummary?.newToday ?? '—'}
            </strong>
          </span>
          <span>
            AI paused{' '}
            <strong className="ml-1 font-semibold tabular-nums text-foreground">
              {activitySummary?.pausedAi ?? '—'}
            </strong>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, Instagram username, phone or email"
            className="h-9 pl-8 pr-8 text-sm"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-sm text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <Select
          value={platformFilter}
          onValueChange={(value) => setPlatformFilter(value as PlatformType)}
        >
          <SelectTrigger className="h-9 w-full text-sm sm:w-[145px]">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All platforms</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="messenger">Messenger</SelectItem>
            <SelectItem value="instagram">Instagram</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={aiFilter}
          onValueChange={(value) => setAiFilter(value as AiFilter)}
        >
          <SelectTrigger className="h-9 w-full text-sm sm:w-[130px]">
            <SelectValue placeholder="AI status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All AI statuses</SelectItem>
            <SelectItem value="active">AI active</SelectItem>
            <SelectItem value="paused">AI paused</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-md border bg-card">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <div className="text-sm font-medium">Customer list</div>
          <div className="text-xs tabular-nums text-muted-foreground">
            {isLoading ? 'Loading…' : `${filteredCustomers.length} shown`}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-0 divide-y">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-3 py-3">
                <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-36 max-w-full" />
                  <Skeleton className="h-3 w-52 max-w-full" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
            <Users className="mb-2 h-7 w-7 text-muted-foreground/60" />
            <h3 className="text-sm font-medium">No customers found</h3>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {hasFilters
                ? 'Try changing your search or filters.'
                : segment === 'online'
                  ? 'There are no customers currently shown as online.'
                  : 'Customers will appear here when they contact the studio.'}
            </p>
            {hasFilters && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8"
                onClick={clearFilters}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="h-9 hover:bg-transparent">
                  <TableHead className="pl-3 text-xs font-medium">Customer</TableHead>
                  <TableHead className="text-xs font-medium">Contact / latest message</TableHead>
                  <TableHead className="text-xs font-medium">Platform</TableHead>
                  <TableHead className="text-xs font-medium">Last active</TableHead>
                  <TableHead className="text-xs font-medium">AI</TableHead>
                  <TableHead className="w-8 pr-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.map((customer) => {
                  const platform = normalizePlatform(customer);
                  const activityDate = getActivityDate(customer);

                  const isInstagram = platform === 'instagram';
                  const displayName = isInstagram
                    ? customer.instagramProfileName?.trim() ||
                      customer.name?.trim() ||
                      'Instagram User'
                    : customer.name?.trim() || 'Unknown customer';

                  const username = customer.instagramUsername?.trim()
                    ? `@${customer.instagramUsername.trim().replace(/^@/, '')}`
                    : null;

                  return (
                    <TableRow
                      key={customer.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open ${displayName}${username ? ` ${username}` : ''} details`}
                      className="h-[58px] cursor-pointer outline-none hover:bg-muted/40 focus-visible:bg-muted/50"
                      onClick={() => navigate(`/customers/${customer.id}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          navigate(`/customers/${customer.id}`);
                        }
                      }}
                    >
                      <TableCell className="py-2 pl-3">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            {isInstagram && customer.instagramProfilePic && (
                              <AvatarImage
                                src={customer.instagramProfilePic}
                                alt={displayName}
                              />
                            )}
                            <AvatarFallback className="bg-muted text-[11px] font-medium text-foreground">
                              {getInitials(displayName)}
                            </AvatarFallback>
                          </Avatar>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {displayName}
                            </div>
                            {isInstagram && username && (
                              <div className="truncate text-[11px] text-muted-foreground">
                                {username}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="max-w-[290px] py-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="truncate text-xs text-foreground">
                            {customer.phone || customer.email || 'No contact details'}
                          </div>
                          {customer.lastMessagePreview ? (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {customer.lastMessagePreview}
                            </div>
                          ) : customer.phone && customer.email ? (
                            <div className="truncate text-[11px] text-muted-foreground">
                              {customer.email}
                            </div>
                          ) : null}
                        </div>
                      </TableCell>

                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={cn('whitespace-nowrap text-[11px] font-medium', platformMap[platform].color)}
                        >
                          {platformMap[platform].label}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-2">
                        {activityDate ? (
                          <div className="space-y-0.5" title={format(activityDate, 'MMM d, yyyy h:mm a')}>
                            <div className="text-xs text-foreground">
                              {formatDistanceToNow(activityDate, { addSuffix: true })}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {format(activityDate, 'MMM d, h:mm a')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>

                      <TableCell className="py-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[11px] font-medium',
                            customer.aiEnabled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400'
                              : 'border-border bg-muted text-muted-foreground',
                          )}
                        >
                          {customer.aiEnabled ? 'Active' : 'Paused'}
                        </Badge>
                      </TableCell>

                      <TableCell className="py-2 pr-3 text-right">
                        <ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/60" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Customers;
