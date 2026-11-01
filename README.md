# XerMedia

XerMedia is the receive-only WhatsApp inbox used by XerService.

It is intentionally designed for staff to **receive, read, search and organise incoming WhatsApp messages and files** without sending replies from XerMedia.

## Product surface

XerMedia keeps only the features required for the receive-only workflow:

- **Dashboard** — contacts, conversations and unread counts.
- **Inbox** — incoming WhatsApp messages and attachments.
- **Contacts** — saved/imported contacts, search, fields and tags.
- **Recent Activity** — recent inbound message and contact activity.
- **Settings**
  - Inbox
  - Fields & tags
  - Team members
  - API keys

## Receive-only rules

XerMedia does not provide outbound WhatsApp messaging. The following CRM features are intentionally removed:

- replies and reply composer
- emoji/reaction sending
- WhatsApp templates
- broadcasts
- automations
- flows
- AI replies / AI agents
- pipelines and deals
- quick replies
- public account signup

Team members can still be added through administrator invitations.

## Contact identity

A saved/imported contact name is kept separate from the WhatsApp profile name supplied by Meta.

Example:

```text
Vishva
WhatsApp: Vp
```

Incoming WhatsApp identity updates must not overwrite the saved contact name.

## Data retention

Incoming message records and mirrored inbound WhatsApp media are retained for **3 days** and then automatically cleaned up by the XerMedia Supabase retention job.

Contacts, fields, tags, team membership and API keys are not part of the 3-day message cleanup.

## WhatsApp webhook architecture

Meta's WhatsApp webhook is received by the XerService webhook endpoint. XerService keeps its existing printing/file workflow and forwards the signed webhook payload to XerMedia's receive-only webhook route.

XerMedia verifies the Meta signature, resolves the WhatsApp account and contact, stores the inbound message/media, and updates the conversation. It does not dispatch outbound replies, broadcasts, automations, flows, templates or AI agents.

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase Postgres, Auth and Storage
- Netlify
- Meta WhatsApp Cloud API

## Development

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Useful checks before deployment:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Production

Production is deployed from the `main` branch to Netlify.

The receive-only safety flags remain enabled in production:

```text
XERMEDIA_RECEIVE_ONLY=true
NEXT_PUBLIC_XERMEDIA_RECEIVE_ONLY=true
```
