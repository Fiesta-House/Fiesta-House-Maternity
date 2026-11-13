import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useUIStore } from '@/state/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Instagram as InstagramIcon,
  MessageSquare,
  Search,
  Send,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { API_BASE_URL } from '@/config';
import { io, Socket } from 'socket.io-client';
import {
  getInstagramMessages,
  getInstagramConversations,
  sendInstagramMessage,
  InstagramSettings,
  InstagramMessage,
  InstagramConversation,
} from '@/api/instagram';
import { useToast } from '@/hooks/use-toast';

const POLL_INTERVAL = 3000;

const getMessageList = (response: any): InstagramMessage[] => {
  const list = response?.data?.messages ?? response?.messages ?? response?.data ?? [];
  return Array.isArray(list) ? list : [];
};

const getConversationList = (response: any): InstagramConversation[] => {
  const list = response?.data?.conversations ?? response?.conversations ?? [];
  return Array.isArray(list) ? list : [];
};

const isValidDate = (value?: string | Date | null) => {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
};

const formatTime = (value?: string | Date | null) => {
  if (!isValidDate(value)) return '';
  return new Date(value as string | Date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getInitial = (name?: string | null) => name?.trim()?.charAt(0)?.toUpperCase() || '?';

export default function Instagram() {
  const setSidebarCollapsed = useUIStore((s) => s.setSidebarCollapsed);
  const { toast } = useToast();

  const [settings, setSettings] = useState<InstagramSettings>({
    businessAccountId: '',
    accessToken: '',
    verifyToken: '',
    webhookUrl: '',
  });
  const [messages, setMessages] = useState<InstagramMessage[]>([]);
  const [conversations, setConversations] = useState<InstagramConversation[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const socketRef = useRef<Socket | null>(null);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedCustomerIdRef = useRef('');

  // Keep the socket listener pointed at the currently selected conversation
  // without reconnecting the socket every time the user changes chats.
  selectedCustomerIdRef.current = selectedCustomerId;

  useEffect(() => {
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem('instagram-settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings((current) => ({ ...current, ...parsed }));
      }
    } catch (error) {
      console.warn('Unable to read saved Instagram settings:', error);
    }
  }, []);

  const loadConversations = useCallback(async (showInitialLoading = false) => {
    if (showInitialLoading) setIsLoadingConversations(true);
    try {
      const response = await getInstagramConversations();
      setConversations(getConversationList(response));
    } catch (error) {
      console.error('Failed to load Instagram conversations:', error);
      if (showInitialLoading) {
        toast({
          title: 'Could not load conversations',
          description: 'Please try again in a moment.',
          variant: 'destructive',
        });
      }
    } finally {
      if (showInitialLoading) setIsLoadingConversations(false);
    }
  }, [toast]);

  const loadMessages = useCallback(async (customerId: string, showLoading = false) => {
    if (!customerId) return;
    if (showLoading) setIsLoadingMessages(true);
    try {
      const response = await getInstagramMessages({ customerId });
      const nextMessages = getMessageList(response);
      if (selectedCustomerIdRef.current !== customerId) return;
      setMessages(nextMessages);

      const lastMessage = nextMessages[nextMessages.length - 1];
      if (lastMessage?.direction === 'inbound' && isValidDate(lastMessage.timestamp)) {
        const messageTime = new Date(lastMessage.timestamp).getTime();
        const hasLaterReply = nextMessages.some((message) =>
          message.direction === 'outbound' &&
          isValidDate(message.timestamp) &&
          new Date(message.timestamp).getTime() > messageTime
        );
        setIsTyping(Date.now() - messageTime < 30000 && !hasLaterReply);
      } else {
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Failed to load Instagram messages:', error);
    } finally {
      if (showLoading && selectedCustomerIdRef.current === customerId) {
        setIsLoadingMessages(false);
      }
    }
  }, []);

  // Socket connection is created once. Polling remains as a fallback if socket
  // events are temporarily unavailable.
  useEffect(() => {
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join', { platform: 'instagram' });
    });

    socket.on('newMessage', (data: any) => {
      if (data?.platform !== 'instagram' || !data.customerId) return;
      if (data.customerId !== selectedCustomerIdRef.current) return;

      const incoming: InstagramMessage = {
        id: String(data.id ?? `${Date.now()}`),
        from: data.from ?? '',
        to: data.to ?? '',
        content: data.content ?? '',
        timestamp: data.timestamp ?? new Date().toISOString(),
        direction: data.direction,
        customerId: data.customerId,
      };

      setMessages((current) => {
        if (current.some((message) => message.id === incoming.id)) return current;
        return [...current, incoming];
      });
    });

    socket.on('conversationUpdate', (data: any) => {
      if (data?.platform !== 'instagram') return;
      const next = data?.conversations;
      if (Array.isArray(next)) setConversations(next);
    });

    socket.on('connect_error', (error) => {
      console.warn('Instagram live connection unavailable; polling will continue:', error.message);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    void loadConversations(true);
    const interval = window.setInterval(() => {
      void loadConversations(false);
    }, POLL_INTERVAL);
    return () => window.clearInterval(interval);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setMessages([]);
      setIsTyping(false);
      setIsLoadingMessages(false);
      return;
    }

    setMessages([]);
    setIsTyping(false);
    setAutoScroll(true);
    setShowScrollDown(false);
    void loadMessages(selectedCustomerId, true);

    const interval = window.setInterval(() => {
      void loadMessages(selectedCustomerId, false);
    }, POLL_INTERVAL);

    return () => window.clearInterval(interval);
  }, [selectedCustomerId, loadMessages]);

  useEffect(() => {
    const element = chatScrollRef.current;
    if (!element || !autoScroll) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, selectedCustomerId, autoScroll, isTyping]);

  const handleChatScroll = useCallback(() => {
    const element = chatScrollRef.current;
    if (!element) return;
    const atBottom = element.scrollHeight - element.scrollTop - element.clientHeight < 120;
    setShowScrollDown(!atBottom);
    setAutoScroll(atBottom);
  }, []);

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      (conversation.customerName || '').toLowerCase().includes(query) ||
      (conversation.instagramId || '').toLowerCase().includes(query) ||
      (conversation.latestMessage || '').toLowerCase().includes(query)
    );
  }, [conversations, searchTerm]);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.customerId === selectedCustomerId),
    [conversations, selectedCustomerId]
  );

  const handleSelectConversation = (conversation: InstagramConversation) => {
    setSelectedRecipient(conversation.instagramId || '');
    setSelectedCustomerId(conversation.customerId);
  };

  const handleBackToConversations = () => {
    setSelectedCustomerId('');
    setSelectedRecipient('');
    setMessages([]);
  };

  const handleSendMessage = async () => {
    const content = newMessage.trim();
    if (!content || !selectedRecipient || isSending) return;

    const recipient = selectedRecipient;
    const customerId = selectedCustomerId;
    setIsSending(true);
    setNewMessage('');

    try {
      await sendInstagramMessage(recipient, content);

      // Reload the persisted message so the chat uses the server's message ID
      // and does not duplicate it when the socket event arrives.
      try {
        const response = await getInstagramMessages({ customerId });
        if (selectedCustomerIdRef.current === customerId) {
          setMessages(getMessageList(response));
        }
      } catch (reloadError) {
        console.warn('Message sent, but the conversation could not be refreshed:', reloadError);
        if (selectedCustomerIdRef.current === customerId) {
          const fallbackMessage: InstagramMessage = {
            id: `local-${Date.now()}`,
            from: settings.businessAccountId || '',
            to: recipient,
            content,
            timestamp: new Date().toISOString(),
            direction: 'outbound',
            customerId,
          };
          setMessages((current) => [...current, fallbackMessage]);
        }
      }

      if (selectedCustomerIdRef.current === customerId) setAutoScroll(true);
      toast({
        title: 'Message sent',
        description: 'Your Instagram message has been sent successfully.',
      });
    } catch (error: any) {
      if (selectedCustomerIdRef.current === customerId) {
        setNewMessage(content);
      }
      toast({
        title: 'Failed to send message',
        description: error?.response?.data?.message || error?.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-7rem)] min-h-[480px] w-full overflow-hidden rounded-lg border border-border bg-background">
      {/* Conversation list */}
      <aside
        className={cn(
          'w-full shrink-0 flex-col border-r border-border bg-background md:flex md:w-[280px] lg:w-[310px]',
          selectedCustomerId ? 'hidden' : 'flex'
        )}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
          <div className="flex items-center gap-2">
            <InstagramIcon className="h-4 w-4 text-pink-600" />
            <h1 className="text-sm font-semibold">Instagram messages</h1>
          </div>
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
            {conversations.length}
          </Badge>
        </div>

        <div className="border-b border-border p-2.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search conversations"
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isLoadingConversations && conversations.length === 0 ? (
            <div className="space-y-3 p-3">
              {[0, 1, 2, 3, 4].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
                    <div className="h-2.5 w-full animate-pulse rounded bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <MessageSquare className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
              <p className="text-xs font-medium text-foreground">
                {searchTerm ? 'No matching conversations' : 'No conversations yet'}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {searchTerm ? 'Try another name or message.' : 'New Instagram messages will appear here.'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conversation) => {
              const isActive = selectedCustomerId === conversation.customerId;
              const displayName = conversation.customerName || 'Unknown customer';
              return (
                <button
                  type="button"
                  key={conversation.customerId}
                  onClick={() => handleSelectConversation(conversation)}
                  className={cn(
                    'flex min-h-[66px] w-full items-center gap-2.5 border-b border-border/70 px-3 py-2 text-left transition-colors',
                    isActive ? 'bg-muted' : 'hover:bg-muted/60'
                  )}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-pink-100 text-xs font-medium text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                      {getInitial(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-foreground">{displayName}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {formatTime(conversation.latestTimestamp)}
                      </span>
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-muted-foreground">
                        {conversation.latestMessage || 'No message preview'}
                      </span>
                      {conversation.unreadCount > 0 && (
                        <span className="shrink-0 rounded-full bg-pink-600 px-1.5 py-0.5 text-[9px] font-semibold leading-none text-white">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Chat panel */}
      <section className={cn('min-w-0 flex-1 flex-col bg-background', selectedCustomerId ? 'flex' : 'hidden md:flex')}>
        {selectedCustomerId ? (
          <>
            <header className="flex h-[54px] shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 md:hidden"
                  onClick={handleBackToConversations}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-pink-100 text-xs text-pink-700 dark:bg-pink-950 dark:text-pink-300">
                    {getInitial(activeConversation?.customerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground">
                    {activeConversation?.customerName || 'Unknown customer'}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    Instagram ID: {selectedRecipient || activeConversation?.instagramId || 'Unavailable'}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="shrink-0 gap-1 border-pink-200 text-[10px] font-normal text-pink-700 dark:border-pink-900 dark:text-pink-300">
                <InstagramIcon className="h-3 w-3" /> Instagram
              </Badge>
            </header>

            <div className="relative min-h-0 flex-1 bg-muted/20">
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="absolute inset-0 overflow-y-auto px-3 py-3 sm:px-5"
              >
                {isLoadingMessages && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-xs font-medium text-foreground">No messages yet</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">Send a message to start the conversation.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5 pb-3">
                    {messages.map((message) => {
                      const outbound = message.direction === 'outbound';
                      return (
                        <div key={message.id} className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
                          <div
                            className={cn(
                              'max-w-[82%] rounded-xl px-3 py-2 sm:max-w-[72%]',
                              outbound
                                ? 'rounded-br-sm bg-pink-600 text-white'
                                : 'rounded-bl-sm border border-border bg-background text-foreground'
                            )}
                          >
                            <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
                            <p className={cn('mt-1 text-right text-[9px]', outbound ? 'text-white/70' : 'text-muted-foreground')}>
                              {formatTime(message.timestamp)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {isTyping && (
                      <div className="flex justify-start">
                        <div className="rounded-xl rounded-bl-sm border border-border bg-background px-3 py-2">
                          <div className="flex items-center gap-1.5">
                            <span className="flex gap-0.5">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:100ms]" />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:200ms]" />
                            </span>
                            <span className="text-[10px] text-muted-foreground">AI is typing...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {showScrollDown && (
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-3 right-3 z-10 h-8 w-8 rounded-full border border-border shadow-sm"
                  onClick={() => {
                    if (chatScrollRef.current) {
                      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
                    }
                    setAutoScroll(true);
                    setShowScrollDown(false);
                  }}
                  aria-label="Scroll to latest message"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
              )}
            </div>

            <form
              className="flex shrink-0 items-end gap-2 border-t border-border bg-background p-2.5"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSendMessage();
              }}
            >
              <Textarea
                value={newMessage}
                onChange={(event) => setNewMessage(event.target.value)}
                placeholder="Write a message..."
                rows={1}
                disabled={isSending}
                className="max-h-28 min-h-9 flex-1 resize-none rounded-lg px-3 py-2 text-xs shadow-none focus-visible:ring-1"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    void handleSendMessage();
                  }
                }}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!newMessage.trim() || isSending}
                className="h-9 w-9 shrink-0 bg-pink-600 text-white hover:bg-pink-700"
                aria-label="Send Instagram message"
              >
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-pink-50 text-pink-600 dark:bg-pink-950/50 dark:text-pink-300">
              <InstagramIcon className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-foreground">Instagram messages</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              Select a conversation to view messages and reply.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
