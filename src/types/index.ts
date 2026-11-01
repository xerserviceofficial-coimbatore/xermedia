import type { AccountRole } from "@/lib/auth/roles";
import type { InteractiveMessagePayload } from "@/lib/whatsapp/interactive";

export type {
  InteractiveMessagePayload,
  InteractiveButtonsPayload,
  InteractiveListPayload,
  InteractiveButton,
  InteractiveListRow,
  InteractiveListSection,
} from "@/lib/whatsapp/interactive";

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  role: string;
  beta_features?: string[];
  account_id?: string;
  account_role?: AccountRole;
  created_at: string;
}

export interface Account {
  id: string;
  name: string;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface AccountMember {
  user_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  role: AccountRole;
  joined_at: string;
}

export interface AccountInvitation {
  id: string;
  account_id: string;
  role: Exclude<AccountRole, "owner">;
  created_by_user_id: string | null;
  label: string | null;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
}

export interface Contact {
  id: string;
  user_id: string;
  account_id: string;
  phone: string;
  phone_normalized?: string;
  wa_user_id?: string | null;
  wa_parent_user_id?: string | null;
  wa_username?: string | null;
  /** WhatsApp profile display name from Meta. Never overwrites saved/imported name. */
  wa_profile_name?: string | null;
  name?: string;
  email?: string;
  company?: string;
  avatar_url?: string;
  whatsapp_opted_in_at?: string | null;
  whatsapp_opted_out_at?: string | null;
  whatsapp_consent_source?: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export interface Tag {
  id: string;
  user_id: string;
  account_id?: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
}

export interface CustomField {
  id: string;
  user_id: string;
  account_id: string;
  field_name: string;
  field_type: string;
  field_options?: Record<string, unknown>;
  created_at: string;
}

export interface ContactCustomValue {
  id: string;
  contact_id: string;
  custom_field_id: string;
  value?: string;
}

export interface ContactNote {
  id: string;
  contact_id: string;
  user_id: string;
  note_text: string;
  created_at: string;
}

export type ConversationStatus = 'open' | 'pending' | 'closed';

export interface Conversation {
  id: string;
  user_id: string;
  account_id?: string;
  contact_id: string;
  status: ConversationStatus;
  assigned_agent_id?: string;
  last_message_text?: string;
  last_message_at?: string;
  unread_count: number;
  first_inbound_at?: string | null;
  last_inbound_at?: string | null;
  last_reply_at?: string | null;
  closed_at?: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
  ai_autoreply_disabled?: boolean;
  ai_reply_count?: number;
  ai_handoff_summary?: string | null;
}

export type NotificationType = 'conversation_assigned';

export interface Notification {
  id: string;
  account_id: string;
  user_id: string;
  type: NotificationType;
  conversation_id?: string;
  contact_id?: string;
  actor_user_id?: string;
  title: string;
  body?: string;
  read_at?: string;
  created_at: string;
}

export type SenderType = 'customer' | 'agent' | 'bot';
export type ContentType =
  | 'text'
  | 'image'
  | 'document'
  | 'audio'
  | 'video'
  | 'location'
  | 'template'
  | 'interactive';
export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id?: string;
  content_type: ContentType;
  content_text?: string;
  media_url?: string;
  media_type?: string | null;
  template_name?: string;
  message_id?: string;
  status: MessageStatus;
  created_at: string;
  reply_to_message_id?: string;
  interactive_reply_id?: string;
  interactive_payload?: InteractiveMessagePayload | null;
  ai_generated?: boolean;
  error_code?: number | null;
  error_title?: string | null;
  error_details?: string | null;
}

export interface MessageReaction {
  id: string;
  message_id: string;
  sender_type: SenderType;
  sender_id?: string | null;
  emoji: string;
  created_at: string;
  updated_at?: string;
}

export interface WhatsAppConfig {
  id: string;
  user_id: string;
  account_id?: string;
  phone_number_id: string;
  waba_id?: string;
  access_token: string;
  verify_token?: string;
  status: string;
  connected_at?: string;
  registered_at?: string;
  subscribed_apps_at?: string;
  last_registration_error?: string;
  mirror_inbound_media?: boolean;
}

export interface MessageTemplate {
  id: string;
  user_id: string;
  account_id?: string;
  name: string;
  category: string;
  language: string;
  status: string;
  content: string;
  components?: unknown;
  meta_template_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
}

export interface QuickReply {
  id: string;
  account_id?: string;
  user_id: string;
  shortcut: string;
  body: string;
  created_at: string;
  updated_at?: string;
}
