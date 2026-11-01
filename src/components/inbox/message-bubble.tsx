"use client";

import { MapPin } from "lucide-react";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import type { Message } from "@/types";
import {
  MediaAudioBubble,
  MediaDocumentBubble,
  MediaImageBubble,
  MediaUnavailable,
  MediaVideoBubble,
} from "./message-media";

interface MessageBubbleProps {
  message: Message;
  onOpenMedia?: (messageId: string) => void;
}

export function MessageBubble({ message, onOpenMedia }: MessageBubbleProps) {
  const t = useTranslations("Inbox.messageBubble");
  const isCustomer = message.sender_type === "customer";

  const openMedia =
    onOpenMedia && (message.content_type === "image" || message.content_type === "video")
      ? () => onOpenMedia(message.id)
      : undefined;

  return (
    <div
      className={cn(
        "flex w-full",
        isCustomer ? "justify-start" : "justify-end",
      )}
    >
      <div
        className={cn(
          "max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[76%]",
          isCustomer
            ? "rounded-bl-md border border-border bg-card text-foreground"
            : "rounded-br-md bg-primary text-primary-foreground",
        )}
      >
        <MessageContent message={message} onOpenMedia={openMedia} t={t} />
        <p
          className={cn(
            "mt-1.5 text-right text-[10px]",
            isCustomer ? "text-muted-foreground" : "text-primary-foreground/70",
          )}
        >
          {format(new Date(message.created_at), "dd MMM, h:mm a")}
        </p>
      </div>
    </div>
  );
}

function MessageContent({
  message,
  onOpenMedia,
  t,
}: {
  message: Message;
  onOpenMedia?: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const text = message.content_text?.trim() || "";

  switch (message.content_type) {
    case "image":
      return message.media_url ? (
        <div className="space-y-2">
          <MediaImageBubble message={message} onOpen={onOpenMedia} t={t} />
          {text ? <p className="whitespace-pre-wrap break-words text-sm">{text}</p> : null}
        </div>
      ) : (
        <MediaUnavailable label={t("photo")} t={t} />
      );

    case "video":
      return message.media_url ? (
        <div className="space-y-2">
          <MediaVideoBubble message={message} onOpen={onOpenMedia} t={t} />
          {text ? <p className="whitespace-pre-wrap break-words text-sm">{text}</p> : null}
        </div>
      ) : (
        <MediaUnavailable label={t("video")} t={t} />
      );

    case "audio":
      return message.media_url ? (
        <MediaAudioBubble message={message} t={t} />
      ) : (
        <MediaUnavailable label={t("audio")} t={t} />
      );

    case "document":
      return message.media_url ? (
        <MediaDocumentBubble message={message} t={t} />
      ) : (
        <MediaUnavailable label={t("document")} t={t} />
      );

    case "location":
      return (
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="whitespace-pre-wrap break-words">
            {text || t("location")}
          </p>
        </div>
      );

    case "text":
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          {text || t("message")}
        </p>
      );

    default:
      return (
        <p className="whitespace-pre-wrap break-words text-sm">
          {text || `Received ${message.content_type}`}
        </p>
      );
  }
}
