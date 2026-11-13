import { NavLink } from '@/components/NavLink';
import { useUIStore } from '@/state/uiStore';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import {
  LayoutDashboard,
  Calendar,
  MessageSquare,
  Phone,
  BookOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Package,
  Users,
  X,
  AlertTriangle,
  Activity,
  FileText,
  Brain,
  ListChecks,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Bookings', href: '/bookings', icon: Calendar },
  { name: 'Customers', href: '/customers', icon: Users },
  { name: 'WhatsApp', href: '/whatsapp', icon: Phone },
  { name: 'Message Templates', href: '/whatsapp/templates', icon: FileText },
  { name: 'AI Models', href: '/AIModelMonitoringPage', icon: FileText },
  { name: 'Messenger', href: '/messenger', icon: MessageSquare },
  { name: 'Instagram', href: '/instagram', icon: Instagram },
  { name: 'Packages', href: '/packages', icon: Package },
  { name: 'Knowledge Base', href: '/knowledge-base', icon: BookOpen },
  { name: 'RAG Insights', href: '/rag-insights', icon: Brain },
  { name: 'AI Instructions', href: '/ai-instructions', icon: ListChecks },
  { name: 'Escalations', href: '/escalations', icon: AlertTriangle },
  { name: 'System Status', href: '/system-status', icon: Activity },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const {
    sidebarCollapsed,
    mobileMenuOpen,
    toggleSidebar,
    setMobileMenuOpen,
    setSidebarCollapsed,
  } = useUIStore();
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (isDesktop) {
      setMobileMenuOpen(false);
    } else {
      setSidebarCollapsed(true);
    }
  }, [isDesktop, setSidebarCollapsed, setMobileMenuOpen]);

  const handleLinkClick = () => {
    if (isDesktop) {
      setSidebarCollapsed(true);
    } else {
      setMobileMenuOpen(false);
    }
  };

  const showSidebar = isDesktop || mobileMenuOpen;
  // The mobile drawer is always expanded; desktop uses the persisted collapse state.
  const showLabels = !isDesktop || !sidebarCollapsed;

  return (
    <>
      {!isDesktop && mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation menu"
          className="fixed inset-0 z-30 bg-black/35"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside
        aria-label="Main navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card transition-[width,transform] duration-200 ease-out',
          isDesktop ? (sidebarCollapsed ? 'w-[4.25rem]' : 'w-60') : 'w-64',
          !isDesktop && (showSidebar ? 'translate-x-0 shadow-2xl' : '-translate-x-full')
        )}
      >
        <div className="flex h-14 shrink-0 items-center border-b border-border px-3">
          {showLabels ? (
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <LayoutDashboard className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight text-foreground">Admin Panel</p>
                <p className="text-[10px] leading-4 text-muted-foreground">Fiesta House</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <LayoutDashboard className="h-4 w-4" />
            </div>
          )}

          {isDesktop ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className={cn('ml-auto h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground', sidebarCollapsed && 'hidden')}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(false)}
              className="ml-auto h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {isDesktop && sidebarCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="absolute right-0 top-3 translate-x-1/2 h-7 w-7 rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3 scrollbar-custom">
          <p className={cn('mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground', !showLabels && 'sr-only')}>
            Workspace
          </p>
          <div className="space-y-0.5">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === '/'}
                onClick={handleLinkClick}
                title={!showLabels ? item.name : undefined}
                className={cn(
                  'group flex min-h-9 items-center gap-3 rounded-md px-2.5 text-[13px] font-medium text-muted-foreground outline-none transition-colors',
                  'hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                  !showLabels && 'justify-center px-0'
                )}
                activeClassName="!bg-primary/10 !text-primary font-semibold [&>svg]:text-primary"
              >
                <item.icon className="h-[17px] w-[17px] shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                {showLabels && <span className="min-w-0 truncate">{item.name}</span>}
              </NavLink>
            ))}
          </div>
        </nav>

        {showLabels && (
          <div className="shrink-0 border-t border-border px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">Fiesta House Maternity</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/70">© {new Date().getFullYear()} · Admin</p>
          </div>
        )}
      </aside>
    </>
  );
}
