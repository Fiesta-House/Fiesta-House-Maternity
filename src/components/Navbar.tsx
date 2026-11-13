import { useAuthStore } from '@/state/authStore';
import { useUIStore } from '@/state/uiStore';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun, LogOut, User, Bell, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '@/config';
import { apiFetch } from '@/api/apiFetch';
import { io, Socket } from 'socket.io-client';
import { toast } from '@/components/ui/sonner';

type NotificationPayload = {
  type?: string;
  title?: string;
  message?: string;
};

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme, setMobileMenuOpen } = useUIStore();
  const isDesktop = useIsDesktop();

  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const isSocketConnectedRef = useRef(false);
  const fetchUnreadCountRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let isMounted = true;

    const fetchUnreadCount = async () => {
      try {
        const response = await apiFetch(`${API_BASE_URL}/api/notifications/unread-count`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          setUnreadCount(typeof data?.count === 'number' ? data.count : 0);
        }
      } catch (error: any) {
        // The backend may be unavailable while the dashboard is still being used.
        if (
          error?.message &&
          !error.message.includes('Failed to fetch') &&
          !error.message.includes('ERR_CONNECTION_REFUSED')
        ) {
          console.error('Failed to fetch unread count:', error);
        }
      }
    };

    fetchUnreadCountRef.current = fetchUnreadCount;
    void fetchUnreadCount();

    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
      auth: { token: useAuthStore.getState().token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      isSocketConnectedRef.current = true;
      socket.emit('join', { platform: 'admin' });
      void fetchUnreadCountRef.current();
    });

    socket.on('disconnect', () => {
      isSocketConnectedRef.current = false;
    });

    socket.on('connect_error', (error) => {
      if (error.message.includes('xhr poll error') || error.message.includes('websocket error')) {
        return;
      }
      console.error('Navbar: WebSocket connection error:', error);
    });

    socket.on('notificationCountUpdate', (payload?: { count?: number }) => {
      if (typeof payload?.count === 'number') {
        setUnreadCount(payload.count);
      } else {
        void fetchUnreadCountRef.current();
      }
    });

    socket.on('newNotification', (notification: NotificationPayload) => {
      setUnreadCount((prev) => prev + 1);

      const title = notification?.title || 'New notification';
      const description = notification?.message;

      if (notification?.type === 'escalation') {
        toast.warning(title, { description });
      } else {
        toast(title, { description });
      }
    });

    // Poll only while the socket is disconnected and the tab is visible.
    const interval = window.setInterval(() => {
      if (!isSocketConnectedRef.current && document.visibilityState === 'visible') {
        void fetchUnreadCountRef.current();
      }
    }, 120000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isSocketConnectedRef.current) {
        void fetchUnreadCountRef.current();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      isSocketConnectedRef.current = false;
      socket.removeAllListeners();
      socket.disconnect();
      if (socketRef.current === socket) {
        socketRef.current = null;
      }
    };
  }, []);

  const initials =
    user?.name
      ?.trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'AU';

  return (
    <header
      className={cn(
        'sticky top-0 z-30 h-14 w-full border-b border-border bg-background/95 supports-[backdrop-filter]:bg-background/85 backdrop-blur',
        'transition-colors'
      )}
    >
      <div className="flex h-full items-center justify-between gap-3 px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          {!isDesktop && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(true)}
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Open navigation menu"
            >
              <Menu className="h-[18px] w-[18px]" />
            </Button>
          )}

          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
              Fiesta House
            </h2>
            <p className="hidden text-[11px] leading-4 text-muted-foreground sm:block">
              Business administration
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
          >
            <Link to="/notifications">
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-0.5 -top-0.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full border-2 border-background px-1 text-[9px] font-semibold leading-none"
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Badge>
              )}
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? (
              <Moon className="h-[18px] w-[18px]" />
            ) : (
              <Sun className="h-[18px] w-[18px]" />
            )}
          </Button>

          <div className="mx-1 h-6 w-px bg-border" />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-9 gap-2 rounded-md px-1.5 pl-1.5 hover:bg-muted"
                aria-label="Open user menu"
              >
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden max-w-32 truncate text-xs font-medium text-foreground sm:block">
                  {user?.name || 'Account'}
                </span>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" sideOffset={8} className="w-56">
              <DropdownMenuLabel className="font-normal">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-medium text-foreground">
                    {user?.name || 'Admin'}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user?.email || ''}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled className="gap-2 text-muted-foreground">
                <User className="h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
