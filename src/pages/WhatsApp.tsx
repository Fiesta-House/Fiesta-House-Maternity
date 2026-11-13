import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useUIStore } from '@/state/uiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, Search, Send, Bot, ArrowLeft, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getWhatsAppSettings,
  sendWhatsAppMessage,
  getWhatsAppMessages,
  getWhatsAppConversations,
  toggleCustomerAi,
  WhatsAppMessage,
  WhatsAppConversation,
} from '@/api/whatsapp';
import { useToast } from '@/hooks/use-toast';

const POLL_INTERVAL = 3000;

const isValidDate = (value?: string | Date | null) => {
  if (!value) return false;
  return !Number.isNaN(new Date(value).getTime());
};

const formatPhoneNumber = (number: string) => {
  let digits = number.replace(/[^\d+]/g, '');
  const hasPlus = digits.startsWith('+');
  if (hasPlus) digits = digits.slice(1);

  if (digits.length === 12 && digits.startsWith('254')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  if (!hasPlus && digits.length > 0) return `+${digits}`;
  return number;
};

const formatMessageTime = (value?: string | Date | null) => {
  if (!isValidDate(value)) return '';
  return new Date(value!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatConversationTime = (value?: string | Date | null) => {
  if (!isValidDate(value)) return '';
  const date = new Date(value!);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  return sameDay
    ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

type ConversationWithAi = WhatsAppConversation & { aiEnabled?: boolean };

export default function WhatsApp() {
  const setSidebarCollapsed = useUIStore((state) => state.setSidebarCollapsed);
  const { toast } = useToast();

  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [customerAiEnabled, setCustomerAiEnabled] = useState<boolean | null>(null);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  const loadConversations = useCallback(async () => {
    try {
      const response = await getWhatsAppConversations();
      const result = response.data?.conversations;
      setConversations(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadSettings = async () => {
      try {
        const response = await getWhatsAppSettings();
        if (active && response.data?.phoneNumberId) {
          setPhoneNumberId(response.data.phoneNumberId);
        }
      } catch (error) {
        console.error('Failed to load WhatsApp settings:', error);
      }
    };

    loadConversations();
    loadSettings();

    const pollInterval = window.setInterval(loadConversations, POLL_INTERVAL);
    return () => {
      active = false;
      window.clearInterval(pollInterval);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedCustomerId) {
      setMessages([]);
      setIsTyping(false);
      setIsLoadingMessages(false);
      return;
    }

    let active = true;
    let firstLoad = true;

    const loadConversationMessages = async () => {
      try {
        if (firstLoad) setIsLoadingMessages(true);
        const response = await getWhatsAppMessages(selectedCustomerId);
        const result = response?.data?.messages || response?.messages || [];
        const safeMessages = Array.isArray(result) ? result : [];

        if (!active) return;
        setMessages(safeMessages);

        const lastMessage = safeMessages[safeMessages.length - 1];
        if (lastMessage?.direction === 'inbound' && isValidDate(lastMessage.timestamp)) {
          const messageTime = new Date(lastMessage.timestamp).getTime();
          const hasLaterReply = safeMessages.some((message) =>
            message.direction === 'outbound' &&
            isValidDate(message.timestamp) &&
            new Date(message.timestamp).getTime() > messageTime
          );
          setIsTyping(Date.now() - messageTime < 30000 && !hasLaterReply);
        } else {
          setIsTyping(false);
        }
      } catch (error) {
        if (active) console.error('Failed to load conversation messages:', error);
      } finally {
        if (active && firstLoad) setIsLoadingMessages(false);
        firstLoad = false;
      }
    };

    loadConversationMessages();
    const messagePollInterval = window.setInterval(loadConversationMessages, POLL_INTERVAL);

    return () => {
      active = false;
      window.clearInterval(messagePollInterval);
    };
  }, [selectedCustomerId]);

  useEffect(() => {
    const element = chatScrollRef.current;
    if (!element || !autoScroll) return;
    element.scrollTop = element.scrollHeight;
  }, [messages, selectedCustomerId, isTyping, autoScroll]);

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

    return conversations.filter((conversation) => {
      const name = conversation.customerName || '';
      const phone = conversation.phone || '';
      const preview = conversation.latestMessage || '';
      return [name, phone, preview].some((value) => value.toLowerCase().includes(query));
    });
  }, [conversations, searchTerm]);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.customerId === selectedCustomerId),
    [conversations, selectedCustomerId]
  );

  const handleSelectConversation = (conversation: WhatsAppConversation) => {
    setSelectedRecipient(conversation.phone || conversation.customerId);
    setSelectedCustomerId(conversation.customerId);
    const aiEnabled = (conversation as ConversationWithAi).aiEnabled;
    setCustomerAiEnabled(typeof aiEnabled === 'boolean' ? aiEnabled : null);
    setAutoScroll(true);
    setShowScrollDown(false);
  };

  const handleSendMessage = async () => {
    const messageContent = newMessage.trim();
    if (!messageContent || !selectedRecipient.trim() || isSending) return;

    setIsSending(true);
    setNewMessage('');

    try {
      await sendWhatsAppMessage({
        to: selectedRecipient,
        message: messageContent,
        customerId: selectedCustomerId || undefined,
      });

      if (selectedCustomerId) {
        try {
          const response = await getWhatsAppMessages(selectedCustomerId);
          const result = response?.data?.messages || response?.messages || [];
          setMessages(Array.isArray(result) ? result : []);
          setAutoScroll(true);
        } catch (error) {
          console.error('Failed to reload messages after send:', error);
          const fallbackMessage: WhatsAppMessage = {
            id: Date.now().toString(),
            from: phoneNumberId,
            to: selectedRecipient,
            content: messageContent,
            timestamp: new Date().toISOString(),
            direction: 'outbound',
            customerId: selectedCustomerId,
          };
          setMessages((previous) => [...previous, fallbackMessage]);
        }
      }

      toast({
        title: 'Message sent',
        description: 'Your message has been sent successfully.',
      });
      loadConversations();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      setNewMessage(messageContent);
      toast({
        title: 'Failed to send message',
        description: error.response?.data?.message || error.message || 'There was an error sending your message. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleAi = async () => {
    if (!selectedCustomerId) return;
    try {
      const result = await toggleCustomerAi(selectedCustomerId, !(customerAiEnabled ?? false));
      setCustomerAiEnabled(result.aiEnabled);
      toast({
        title: 'AI status updated',
        description: `AI is now ${result.aiEnabled ? 'enabled' : 'disabled'} for this customer.`,
      });
      loadConversations();
    } catch (error) {
      console.error('Failed to toggle AI:', error);
      toast({
        title: 'Failed to toggle AI',
        description: 'There was an error toggling AI for this customer.',
        variant: 'destructive',
      });
    }
  };

  const handleScrollToBottom = () => {
    const element = chatScrollRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' });
    setAutoScroll(true);
    setShowScrollDown(false);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] min-h-[520px] w-full flex-col overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-foreground">WhatsApp</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Customer conversations <span className="mx-1">·</span> {conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}
          </p>
        </div>
        {phoneNumberId && (
          <div className="hidden min-w-0 items-center gap-2 rounded-md border border-border px-2.5 py-1.5 sm:flex">
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">Business Phone ID</span>
            <span className="max-w-[220px] truncate font-mono text-[11px] font-medium text-foreground">{phoneNumberId}</span>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Conversation list */}
        <aside className={cn(
          'w-full shrink-0 flex-col border-r border-border bg-muted/10 md:flex md:w-[270px] lg:w-[300px]',
          selectedCustomerId ? 'hidden' : 'flex'
        )}>
          <div className="shrink-0 space-y-2 border-b border-border p-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-foreground">Chats</h2>
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
                {conversations.length}
              </Badge>
            </div>
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
            {filteredConversations.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <MessageSquare className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
                <p className="text-xs font-medium text-foreground">
                  {searchTerm ? 'No matching conversations' : 'No conversations yet'}
                </p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {searchTerm ? 'Try a different name or number.' : 'Customer chats will appear here.'}
                </p>
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const isActive = selectedCustomerId === conversation.customerId;
                const displayName = conversation.customerName || 'Unknown customer';
                const displayPhone = conversation.phone ? formatPhoneNumber(conversation.phone) : '';
                const initials = displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

                return (
                  <button
                    key={conversation.customerId}
                    type="button"
                    onClick={() => handleSelectConversation(conversation)}
                    className={cn(
                      'flex w-full items-start gap-2.5 border-b border-border/70 px-3 py-3 text-left transition-colors',
                      isActive ? 'bg-accent' : 'hover:bg-muted/60'
                    )}
                  >
                    <Avatar className="mt-0.5 h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-[#25d366]/15 text-[10px] font-semibold text-[#168b45]">
                        {initials || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-foreground">{displayName}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatConversationTime(conversation.latestTimestamp)}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                        {displayPhone || 'Phone number unavailable'}
                      </span>
                      <span className="mt-1 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-muted-foreground">
                          {conversation.latestMessage || 'No message preview'}
                        </span>
                        {conversation.unreadCount > 0 && (
                          <span className="flex h-[17px] min-w-[17px] shrink-0 items-center justify-center rounded-full bg-[#25d366] px-1 text-[9px] font-semibold text-white">
                            {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
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

        {/* Active conversation */}
        <section className={cn(
          'min-w-0 flex-1 flex-col',
          selectedCustomerId ? 'flex' : 'hidden md:flex'
        )}>
          {selectedCustomerId ? (
            <>
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 md:hidden"
                    onClick={() => {
                      setSelectedCustomerId('');
                      setSelectedRecipient('');
                    }}
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-muted text-xs font-medium">
                      {(selectedConversation?.customerName || '?').trim().charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">
                      {selectedConversation?.customerName || 'Unknown customer'}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {selectedRecipient ? formatPhoneNumber(selectedRecipient) : 'Phone number unavailable'}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {customerAiEnabled !== null && (
                    <Badge variant={customerAiEnabled ? 'default' : 'secondary'} className="hidden h-5 text-[10px] sm:inline-flex">
                      AI {customerAiEnabled ? 'Active' : 'Paused'}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleToggleAi}
                    className="h-7 gap-1.5 px-2 text-[11px]"
                  >
                    <Bot className="h-3.5 w-3.5" />
                    {customerAiEnabled ? 'Disable AI' : 'Enable AI'}
                  </Button>
                </div>
              </div>

              <div className="relative min-h-0 flex-1 bg-muted/10">
                <div
                  ref={chatScrollRef}
                  onScroll={handleChatScroll}
                  className="absolute inset-0 overflow-y-auto px-3 py-4 sm:px-5"
                >
                  {isLoadingMessages ? (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      Loading messages…
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <MessageSquare className="mb-2 h-7 w-7 text-muted-foreground/40" />
                      <p className="text-xs font-medium text-foreground">No messages in this conversation</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">Send a message to start the conversation.</p>
                    </div>
                  ) : (
                    <div className="mx-auto flex max-w-4xl flex-col gap-2">
                      {messages.map((message) => {
                        const outbound = message.direction === 'outbound';
                        return (
                          <div key={message.id} className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
                            <div className={cn(
                              'max-w-[84%] rounded-xl px-3 py-2 shadow-sm sm:max-w-[72%]',
                              outbound
                                ? 'rounded-br-sm bg-primary/10 text-foreground'
                                : 'rounded-bl-sm border border-border bg-background text-foreground'
                            )}>
                              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed">{message.content}</p>
                              <p className="mt-1 text-right text-[9px] text-muted-foreground">
                                {formatMessageTime(message.timestamp)}
                                <span className="ml-1.5">{outbound ? 'Sent' : 'Received'}</span>
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="rounded-xl rounded-bl-sm border border-border bg-background px-3 py-2 text-[10px] text-muted-foreground">
                            <span className="mr-1.5 inline-flex gap-0.5 align-middle">
                              <span className="h-1 w-1 animate-bounce rounded-full bg-current" />
                              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:100ms]" />
                              <span className="h-1 w-1 animate-bounce rounded-full bg-current [animation-delay:200ms]" />
                            </span>
                            AI is typing
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {showScrollDown && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    onClick={handleScrollToBottom}
                    className="absolute bottom-3 right-4 z-10 h-8 w-8 rounded-full border border-border shadow-sm"
                    aria-label="Scroll to latest message"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="shrink-0 border-t border-border bg-background p-2.5">
                <div className="mx-auto flex max-w-4xl items-end gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(event) => setNewMessage(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Write a message…"
                    rows={1}
                    className="max-h-28 min-h-9 flex-1 resize-y rounded-lg px-3 py-2 text-xs"
                  />
                  <Button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || !selectedRecipient || isSending}
                    size="icon"
                    className="h-9 w-9 shrink-0 bg-[#25d366] text-white hover:bg-[#1ebc59]"
                    aria-label="Send message"
                  >
                    {isSending ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="mx-auto mt-1 max-w-4xl text-[9px] text-muted-foreground">
                  Enter to send · Shift + Enter for a new line
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <MessageSquare className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Select a conversation</p>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                Choose a customer from the chat list to view messages and reply.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
