'use client';

import { useCallback, useEffect, useState } from 'react';
import { Building2, Check, Copy, Loader2, Mail, Phone, Plus, Save, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

import { addContactTag, deleteContactTag } from '@/lib/contacts/tag-api';
import { createClient } from '@/lib/supabase/client';
import { contactHandle } from '@/lib/whatsapp/wa-identity';
import { parseInternationalPhone } from '@/lib/whatsapp/phone-utils';
import { useAuth } from '@/hooks/use-auth';
import type { Contact, ContactNote, CustomField, Tag } from '@/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({ open, onOpenChange, contactId, onUpdated }: ContactDetailViewProps) {
  const t = useTranslations('Contacts.detailView');
  const { accountId } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [savingDetails, setSavingDetails] = useState(false);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [savingCustom, setSavingCustom] = useState(false);
  const [loadingCustom, setLoadingCustom] = useState(false);

  const fetchContact = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);
    const { data } = await createClient().from('contacts').select('*').eq('id', contactId).single();
    if (data) {
      setContact(data as Contact);
      setEditName(data.name ?? '');
      setEditPhone(data.phone ?? '');
      setEditEmail(data.email ?? '');
      setEditCompany(data.company ?? '');
    }
    setLoading(false);
  }, [contactId]);

  const fetchTags = useCallback(async () => {
    if (!contactId) return;
    const supabase = createClient();
    const [tagsRes, contactTagsRes] = await Promise.all([
      supabase.from('tags').select('*').order('name'),
      supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
    ]);
    if (tagsRes.data) setAllTags(tagsRes.data as Tag[]);
    if (contactTagsRes.data) setContactTagIds(contactTagsRes.data.map((row) => row.tag_id));
  }, [contactId]);

  const fetchNotes = useCallback(async () => {
    if (!contactId) return;
    setLoadingNotes(true);
    const { data } = await createClient()
      .from('contact_notes')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false });
    setNotes((data ?? []) as ContactNote[]);
    setLoadingNotes(false);
  }, [contactId]);

  const fetchCustomFields = useCallback(async () => {
    if (!contactId) return;
    setLoadingCustom(true);
    const supabase = createClient();
    const [fieldsRes, valuesRes] = await Promise.all([
      supabase.from('custom_fields').select('*').order('field_name'),
      supabase.from('contact_custom_values').select('*').eq('contact_id', contactId),
    ]);
    setCustomFields((fieldsRes.data ?? []) as CustomField[]);
    const map: Record<string, string> = {};
    for (const row of valuesRes.data ?? []) map[row.custom_field_id] = row.value ?? '';
    setCustomValues(map);
    setLoadingCustom(false);
  }, [contactId]);

  useEffect(() => {
    if (!open || !contactId) return;
    void fetchContact();
    void fetchTags();
    void fetchNotes();
    void fetchCustomFields();
  }, [open, contactId, fetchContact, fetchTags, fetchNotes, fetchCustomFields]);

  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contactHandle(contact));
    setCopiedPhone(true);
    window.setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function saveDetails() {
    if (!contactId || !editPhone.trim()) {
      toast.error(t('toastPhoneRequired'));
      return;
    }
    const phoneChanged = editPhone.trim() !== (contact?.phone ?? '');
    if (phoneChanged && !parseInternationalPhone(editPhone)) {
      toast.error(t('toastPhoneNeedsCountryCode'));
      return;
    }
    setSavingDetails(true);
    const { error } = await createClient()
      .from('contacts')
      .update({
        name: editName.trim() || null,
        phone: editPhone.trim(),
        email: editEmail.trim() || null,
        company: editCompany.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', contactId);
    if (error) toast.error(t('toastUpdateFailed'));
    else {
      toast.success(t('toastUpdated'));
      await fetchContact();
      onUpdated();
    }
    setSavingDetails(false);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);
    try {
      if (contactTagIds.includes(tagId)) {
        await deleteContactTag(contactId, tagId);
        setContactTagIds((current) => current.filter((id) => id !== tagId));
      } else {
        await addContactTag(contactId, tagId);
        setContactTagIds((current) => [...current, tagId]);
      }
      onUpdated();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('toastUpdateFailed'));
    }
    setSavingTags(false);
  }

  async function addNote() {
    if (!contactId || !newNote.trim() || !accountId) return;
    setSavingNote(true);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      toast.error(t('toastNotAuthenticated'));
      setSavingNote(false);
      return;
    }
    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      account_id: accountId,
      user_id: session.user.id,
      note_text: newNote.trim(),
    });
    if (error) toast.error(t('toastNoteAddFailed'));
    else {
      setNewNote('');
      await fetchNotes();
      toast.success(t('toastNoteAdded'));
    }
    setSavingNote(false);
  }

  async function deleteNote(noteId: string) {
    const { error } = await createClient().from('contact_notes').delete().eq('id', noteId);
    if (error) toast.error(t('toastNoteDeleteFailed'));
    else {
      setNotes((current) => current.filter((note) => note.id !== noteId));
      toast.success(t('toastNoteDeleted'));
    }
  }

  async function saveCustomFields() {
    if (!contactId) return;
    setSavingCustom(true);
    try {
      const supabase = createClient();
      await supabase.from('contact_custom_values').delete().eq('contact_id', contactId);
      const rows = Object.entries(customValues)
        .filter(([, value]) => value.trim())
        .map(([fieldId, value]) => ({ contact_id: contactId, custom_field_id: fieldId, value: value.trim() }));
      if (rows.length) {
        const { error } = await supabase.from('contact_custom_values').insert(rows);
        if (error) throw error;
      }
      toast.success(t('toastCustomFieldsSaved'));
    } catch {
      toast.error(t('toastCustomFieldsFailed'));
    }
    setSavingCustom(false);
  }

  const displayName = contact?.name || t('unnamed');
  const initials = displayName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full border-border bg-popover p-0 text-popover-foreground sm:max-w-lg">
        {loading || !contact ? (
          <div className="flex h-full items-center justify-center"><Loader2 className="size-6 animate-spin text-primary" /></div>
        ) : (
          <div className="flex h-full flex-col">
            <SheetHeader className="border-b border-border/50 p-4">
              <div className="flex items-center gap-3">
                <Avatar className="size-12 border border-border bg-muted"><AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">{initials}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-popover-foreground">{displayName}</SheetTitle>
                  <SheetDescription className="mt-0.5 text-xs text-muted-foreground">{t('contactDetailsDesc')}</SheetDescription>
                  <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <button onClick={copyPhone} className="flex items-center gap-1 transition-colors hover:text-primary">
                      <Phone className="size-3" />{contactHandle(contact)}{copiedPhone ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
                    </button>
                    {contact.email ? <span className="flex items-center gap-1"><Mail className="size-3" />{contact.email}</span> : null}
                    {contact.company ? <span className="flex items-center gap-1"><Building2 className="size-3" />{contact.company}</span> : null}
                  </div>
                </div>
              </div>
            </SheetHeader>

            <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
              <TabsList className="mx-4 mt-3 border-b border-border bg-muted/50">
                <TabsTrigger value="details">{t('tabs.details')}</TabsTrigger>
                <TabsTrigger value="tags">{t('tabs.tags')}</TabsTrigger>
                <TabsTrigger value="notes">{t('tabs.notes')}</TabsTrigger>
                <TabsTrigger value="custom">{t('tabs.custom')}</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-y-auto px-4 py-3">
                <div className="space-y-3">
                  <Field label={t('name')}><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></Field>
                  <Field label={t('phone')}><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></Field>
                  <Field label={t('email')}><Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} /></Field>
                  <Field label={t('company')}><Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} /></Field>
                  <Button onClick={saveDetails} disabled={savingDetails} className="w-full">
                    {savingDetails ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{t('saveChangesBtn')}
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="tags" className="flex-1 overflow-y-auto px-4 py-3">
                <p className="mb-3 text-xs text-muted-foreground">{t('tagsTab.clickTagDesc')}</p>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => {
                    const selected = contactTagIds.includes(tag.id);
                    return <button key={tag.id} onClick={() => void toggleTag(tag.id)} disabled={savingTags} className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${selected ? 'ring-2 ring-primary' : 'opacity-60'}`} style={{ backgroundColor: `${tag.color}20`, color: tag.color }}>{selected ? <Check className="mr-1 size-3" /> : null}{tag.name}</button>;
                  })}
                  {allTags.length === 0 ? <p className="text-sm text-muted-foreground">{t('tagsTab.noTagsAvailable')}</p> : null}
                </div>
              </TabsContent>

              <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col px-4 py-3">
                <div className="mb-3 space-y-2">
                  <Textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} placeholder={t('notesTab.placeholder')} className="min-h-[60px]" />
                  <Button onClick={() => void addNote()} disabled={!newNote.trim() || savingNote} size="sm">{savingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}{t('notesTab.save')}</Button>
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto">
                  {loadingNotes ? <Loader2 className="mx-auto mt-8 size-5 animate-spin" /> : notes.map((note) => <div key={note.id} className="group rounded-lg border border-border/50 bg-muted/50 p-3"><div className="flex items-start justify-between gap-2"><p className="flex-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.note_text}</p><button onClick={() => void deleteNote(note.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="size-3.5" /></button></div></div>)}
                  {!loadingNotes && notes.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('notesTab.noNotes')}</p> : null}
                </div>
              </TabsContent>

              <TabsContent value="custom" className="flex-1 overflow-y-auto px-4 py-3">
                {loadingCustom ? <Loader2 className="mx-auto mt-8 size-5 animate-spin" /> : customFields.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{t('noCustomFields')}</p> : <div className="space-y-3">{customFields.map((field) => <Field key={field.id} label={field.field_name}><Input value={customValues[field.id] ?? ''} onChange={(e) => setCustomValues((current) => ({ ...current, [field.id]: e.target.value }))} /></Field>)}<Button onClick={() => void saveCustomFields()} disabled={savingCustom} className="w-full">{savingCustom ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}{t('saveCustomFieldsBtn')}</Button></div>}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
