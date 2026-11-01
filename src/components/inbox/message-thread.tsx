"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, PanelRightClose, PanelRightOpen, RefreshCw } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";

import { createClient } from "@/lib/supabase/client";
import type { Contact, Conversation, ConversationStatus, Message } from "@/types";
import { Button } from "@/components/ui/button";
import { MessageBubble } from "./message-bubble";

const MESSAGE_LIMIT = 500;
const DOODLE_BG_CLASSES = "bg-background bg-[url('/inbox-doodle.svg')] bg-repeat";

type ReceiveOnlyContact = Contact & {
  wa_profile_name?: string | null;
};

interface MessageThreadProps {
  conversation: Conversation | null;
  contact: Contact | null;
  messages: Message[];
  onMessagesLoaded: (messages: Message[], conversationId: string) => void;
  onOlderMessagesLoaded?: (messages: Message[]) => void;
  onNewMessage: (message: Message) => void;
  onUpdateMessage: (id: string, updates: Partial<Message>) => void;
  onStatusChange: (conversationId: string, status: ConversationStatus) => void;
  onAssignChange: (
    conversationId: string,
    assignedAgentId: string | null,
  ) => void;
  onBack?: () => void;
  resyncToken?: number;
  onRefresh?: () => void;
  contactPanelOpen?: boolean;
  onToggleContactPanel?: () => void;
}

function formatDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "MMMM d, yyyy");
}

function groupMessagesByDate(messages: Message[]) {
  const groups: { date: string; messages: Message[] }[] = [];
  let currentDate = "";

  for (const message of messages) {
    const day = format(new Date(message.created_at), "yyyy-MM-dd");
    if (day !== currentDate) {
      currentDate = day;
      groups.push({ date: message.created_at, messages: [message] });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }

  return groups;
}

export function MessageThread(props: MessageThreadProps) {
  const {
    conversation,
    contact,
    messages,
    onMessagesLoaded,
    onBack,
    resyncToken = 0,
    onRefresh,
    contactPanelOpen,
    onToggleContactPanel,
  } = props;

  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onMessagesLoaded);

  useEffect(() => {
    callbackRef.current = onMessagesLoaded;
  }, [onMessagesLoaded]);

  const fetchMessages = useCallback(async () => {
    if (!conversation) return;
    setLoading(true);
    const { data, error } = await createClient()
      .from("messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true })
      .limit(MESSAGE_LIMIT);

    if (!error) {
      callbackRef.current((data as Message[]) ?? [], conversation.id);
    } else {
      console.error("Failed to fetch messages:", error);
    }
    setLoading(false);
  }, [conversation]);

  useEffect(() => {
    // The async fetch performs the state updates after the awaited Supabase call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMessages();
  }, [fetchMessages, resyncToken]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages.length, conversation?.id]);

  const groups = useMemo(() => groupMessagesByDate(messages), [messages]);
  const receiveOnlyContact = contact as ReceiveOnlyContact | null;
  const savedName =
    receiveOnlyContact?.name?.trim() ||
    receiveOnlyContact?.phone ||
    "Unknown contact";
  const whatsappName = receiveOnlyContact?.wa_profile_name?.trim();
  const secondaryName =
    whatsappName && whatsappName !== savedName
      ? `WhatsApp: ${whatsappName}`
      : receiveOnlyContact?.wa_username
        ? `@${receiveOnlyContact.wa_username}`
        : receiveOnlyContact?.phone || "";

  const handleRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    if (onRefresh) onRefresh();
    void fetchMessages().finally(() => {
      window.setTimeout(() => setIsRefreshing(false), 300);
    });
  };

  if (!conversation || !contact) {
    return (
      <div
        className={`flex h-full flex-1 items-center justify-center ${DOODLE_BG_CLASSES}`}
      >
        <div className="rounded-xl border border-border bg-card/90 px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">Select a conversation</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Incoming WhatsApp messages will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-4">
        {onBack ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="lg:hidden"
            aria-label="Back to conversations"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        ) : null}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{savedName}</p>
          {secondaryName ? (
            <p className="truncate text-xs text-muted-foreground">{secondaryName}</p>
          ) : null}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          aria-label="Refresh messages"
        >
          <RefreshCw
            className={`h-4 w-4 ${isRefreshing || loading ? "animate-spin" : ""}`}
          />
        </Button>

        {onToggleContactPanel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onToggleContactPanel}
            className="hidden lg:inline-flex"
            aria-label={contactPanelOpen ? "Hide contact details" : "Show contact details"}
          >
            {contactPanelOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </Button>
        ) : null}
      </div>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto ${DOODLE_BG_CLASSES}`}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 sm:p-6">
          {groups.map((group) => (
            <div key={group.date} className="space-y-3">
              <div className="flex justify-center">
                <span className="rounded-full border border-border bg-card/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm">
                  {formatDateSeparator(group.date)}
                </span>
              </div>
              {group.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ))}

          {!loading && messages.length === 0 ? (
            <div className="mt-16 rounded-xl border border-border bg-card/90 p-6 text-center text-sm text-muted-foreground">
              No messages in this conversation.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
