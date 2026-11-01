"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useTranslations } from "next-intl";

import { createClient } from "@/lib/supabase/client";
import {
  CONVERSATION_SELECT,
  matchesContactFilters,
  normalizeConversations,
} from "@/lib/inbox/conversations";
import type { InboxFilter } from "@/lib/inbox/inbox-filters";
import { cn } from "@/lib/utils";
import type { Contact, Conversation, ConversationStatus, Tag } from "@/types";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

type ReceiveOnlyFilter = "all" | "unread" | "open" | "pending" | "closed";
type ReceiveOnlyContact = Contact & { wa_profile_name?: string | null };

interface ConversationListProps {
  activeConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
  conversations: Conversation[];
  onConversationsLoaded: (conversations: Conversation[]) => void;
  resyncToken?: number;
  initialFilter?: InboxFilter;
}

const STATUS_COLORS: Record<ConversationStatus, string> = {
  open: "bg-primary",
  pending: "bg-amber-500",
  closed: "bg-muted-foreground",
};

function normalizeFilter(filter: InboxFilter | undefined): ReceiveOnlyFilter {
  return filter === "unread" ||
    filter === "open" ||
    filter === "pending" ||
    filter === "closed"
    ? filter
    : "all";
}

function passesReceiveOnlyFilter(
  conversation: Conversation,
  filter: ReceiveOnlyFilter,
): boolean {
  switch (filter) {
    case "unread":
      return (conversation.unread_count ?? 0) > 0;
    case "open":
    case "pending":
    case "closed":
      return conversation.status === filter;
    default:
      return true;
  }
}

export function ConversationList({
  activeConversationId,
  onSelect,
  conversations,
  onConversationsLoaded,
  resyncToken = 0,
  initialFilter = "all",
}: ConversationListProps) {
  const t = useTranslations("Inbox.conversationList");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ReceiveOnlyFilter>(() =>
    normalizeFilter(initialFilter),
  );
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);

  const onConversationsLoadedRef = useRef(onConversationsLoaded);
  useEffect(() => {
    onConversationsLoadedRef.current = onConversationsLoaded;
  });

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select(CONVERSATION_SELECT)
        .order("last_message_at", { ascending: false });

      if (cancelled) return;
      if (error) {
        console.error("Failed to fetch conversations:", error.message);
        setLoading(false);
        return;
      }

      onConversationsLoadedRef.current(normalizeConversations(data ?? []));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [resyncToken]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    void (async () => {
      const { data } = await supabase.from("tags").select("*").order("name");
      if (!cancelled && data) setTags(data as Tag[]);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = useMemo(
    () => [
      { label: t("filterAll"), value: "all" as const },
      { label: t("filterUnread"), value: "unread" as const },
      { label: t("filterOpen"), value: "open" as const },
      { label: t("filterPending"), value: "pending" as const },
      { label: t("filterClosed"), value: "closed" as const },
    ],
    [t],
  );

  const companies = useMemo(() => {
    const values = new Set<string>();
    for (const conversation of conversations) {
      const company = conversation.contact?.company?.trim();
      if (company) values.add(company);
    }
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [conversations]);

  const tagsById = useMemo(() => {
    const map = new Map<string, Tag>();
    for (const tag of tags) map.set(tag.id, tag);
    return map;
  }, [tags]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return conversations.filter((conversation) => {
      if (!passesReceiveOnlyFilter(conversation, filter)) return false;

      if (
        (selectedTagIds.length > 0 || selectedCompany !== null) &&
        !matchesContactFilters(conversation, {
          tagIds: selectedTagIds,
          company: selectedCompany,
        })
      ) {
        return false;
      }

      if (!query) return true;

      const contact = conversation.contact as ReceiveOnlyContact | undefined;
      const searchable = [
        contact?.name,
        contact?.wa_profile_name,
        contact?.wa_username,
        contact?.phone,
        conversation.last_message_text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    conversations,
    filter,
    search,
    selectedTagIds,
    selectedCompany,
  ]);

  const toggleTag = useCallback((id: string) => {
    setSelectedTagIds((current) =>
      current.includes(id)
        ? current.filter((tagId) => tagId !== id)
        : [...current, id],
    );
  }, []);

  const clearContactFilters = () => {
    setSelectedTagIds([]);
    setSelectedCompany(null);
  };

  const activeFilter = filterOptions.find((option) => option.value === filter);
  const hasContactFilters = selectedTagIds.length > 0 || selectedCompany !== null;

  return (
    <div className="flex h-full w-full flex-col border-r border-border bg-card lg:w-80">
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-border bg-muted pl-9 text-sm text-foreground"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              {activeFilter?.label ?? t("filterAll")}
              <ChevronDown className="h-3 w-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {filterOptions.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setFilter(option.value)}
                  className={cn(filter === option.value && "text-primary")}
                >
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {tags.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted",
                  selectedTagIds.length > 0
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("tags")}
                {selectedTagIds.length > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {selectedTagIds.length}
                  </span>
                ) : null}
                <ChevronDown className="h-3 w-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 w-56">
                {tags.map((tag) => (
                  <DropdownMenuCheckboxItem
                    key={tag.id}
                    checked={selectedTagIds.includes(tag.id)}
                    onCheckedChange={() => toggleTag(tag.id)}
                  >
                    <span
                      className="mr-2 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="truncate">{tag.name}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}

          {companies.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  "inline-flex h-7 max-w-40 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted",
                  selectedCompany
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span className="truncate">{selectedCompany ?? t("company")}</span>
                <ChevronDown className="h-3 w-3 shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-64 w-56">
                <DropdownMenuItem onClick={() => setSelectedCompany(null)}>
                  {t("allCompanies")}
                </DropdownMenuItem>
                {companies.map((company) => (
                  <DropdownMenuItem
                    key={company}
                    onClick={() => setSelectedCompany(company)}
                    className={cn(selectedCompany === company && "text-primary")}
                  >
                    <span className="truncate">{company}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {hasContactFilters ? (
          <div className="flex flex-wrap items-center gap-1">
            {selectedTagIds.map((id) => {
              const tag = tagsById.get(id);
              return (
                <button
                  type="button"
                  key={id}
                  onClick={() => toggleTag(id)}
                  className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: tag?.color ?? "currentColor" }}
                  />
                  {tag?.name ?? t("tags")}
                  <X className="h-3 w-3" />
                </button>
              );
            })}
            {selectedCompany ? (
              <button
                type="button"
                onClick={() => setSelectedCompany(null)}
                className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground"
              >
                {selectedCompany}
                <X className="h-3 w-3" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={clearContactFilters}
              className="px-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              {t("clearAll")}
            </button>
          </div>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">{t("noConversations")}</p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filtered.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
}: {
  conversation: Conversation;
  isActive: boolean;
  onSelect: (conversation: Conversation) => void;
}) {
  const contact = conversation.contact as ReceiveOnlyContact | undefined;
  const savedName = contact?.name?.trim() || contact?.phone || "Unknown contact";
  const whatsappName = contact?.wa_profile_name?.trim();
  const secondary =
    whatsappName && whatsappName !== savedName
      ? `WhatsApp: ${whatsappName}`
      : contact?.wa_username
        ? `@${contact.wa_username}`
        : contact?.phone || "";

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation)}
      className={cn(
        "w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted/50",
        isActive && "bg-primary/5",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full",
            STATUS_COLORS[conversation.status],
          )}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {savedName}
              </p>
              {secondary ? (
                <p className="truncate text-[11px] text-muted-foreground">
                  {secondary}
                </p>
              ) : null}
            </div>
            {conversation.last_message_at ? (
              <span className="shrink-0 text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(conversation.last_message_at), {
                  addSuffix: false,
                })}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {conversation.last_message_text || "Incoming message"}
            </p>
            {(conversation.unread_count ?? 0) > 0 ? (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {conversation.unread_count! > 99 ? "99+" : conversation.unread_count}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
