<script setup lang="ts">
import { userDisplayName } from "#shared/account";
import { STATUS_LABELS } from "#shared/collection";
import { MESSAGE_MAX, type ChatMessage, type ConversationDetail } from "#shared/chat";

// One conversation: live updates, read receipts, typing, photos, edit and delete.
const props = defineProps<{ id: string }>();
const me = useMe();

const { data } = await useFetch<ConversationDetail>(() => `/api/messages/conversations/${props.id}`, {
  key: `thread-${props.id}`,
  headers: useRequestHeaders(["cookie"]),
});
if (!data.value) throw createError({ statusCode: 404, statusMessage: "Not found", fatal: true });
const d = computed(() => data.value!);
// Live state starts from the first load and is then kept up to date by events.
const messages = ref<ChatMessage[]>(d.value.messages);
const hasMore = ref(d.value.hasMore);
const otherReadAt = ref(d.value.otherReadAt);
const blocked = ref(d.value.blocked);

const scroller = ref<HTMLElement>();
const atBottom = ref(true);
function scrollDown(smooth = false) {
  nextTick(() => scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: smooth ? "smooth" : "auto" }));
}
function onScroll() {
  const el = scroller.value!;
  atBottom.value = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
}

async function markRead() {
  if (document.visibilityState !== "visible") return;
  await $fetch(`/api/messages/conversations/${props.id}/read`, { method: "POST" }).catch(() => {});
  void refreshUnread();
}

async function fetchNewer() {
  const last = messages.value.at(-1)?.id;
  const r = await $fetch<ConversationDetail>(`/api/messages/conversations/${props.id}`, { query: last ? { after: last } : {} });
  if (r.messages.length) messages.value = [...messages.value, ...r.messages];
  otherReadAt.value = r.otherReadAt;
  blocked.value = r.blocked;
}

async function loadOlder() {
  const first = messages.value[0]?.id;
  if (!first) return;
  const el = scroller.value!;
  const before = el.scrollHeight;
  const r = await $fetch<ConversationDetail>(`/api/messages/conversations/${props.id}`, { query: { before: first } });
  messages.value = [...r.messages, ...messages.value];
  hasMore.value = r.hasMore;
  nextTick(() => (el.scrollTop = el.scrollHeight - before));
}

const typing = ref(false);
let typingTimer: ReturnType<typeof setTimeout> | undefined;
onChatEvent(async (e) => {
  if (e.conversationId !== props.id) return;
  if (e.type === "typing") {
    typing.value = true;
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => (typing.value = false), 4000);
    return;
  }
  if (e.type === "message") {
    typing.value = false;
    const stick = atBottom.value || e.from === me.value?.id;
    await fetchNewer();
    if (stick) scrollDown(true);
    if (e.from !== me.value?.id) await markRead();
  } else if (e.type === "update") {
    // An edit or a delete somewhere in the visible window.
    const r = await $fetch<ConversationDetail>(`/api/messages/conversations/${props.id}`, { query: { after: "00000000-0000-0000-0000-000000000000" } });
    const byId = new Map(r.messages.map((m) => [m.id, m]));
    messages.value = messages.value.map((m) => byId.get(m.id) ?? m);
  } else if (e.type === "read") {
    await fetchNewer();
  }
});

onMounted(() => {
  scrollDown();
  void markRead();
  document.addEventListener("visibilitychange", markRead);
});
onBeforeUnmount(() => document.removeEventListener("visibilitychange", markRead));

// Composer
const text = ref("");
const sending = ref(false);
const error = ref("");
const fileInput = ref<HTMLInputElement>();
let lastTyping = 0;
function onInput() {
  const now = Date.now();
  if (now - lastTyping > 3000 && text.value.trim()) {
    lastTyping = now;
    void $fetch(`/api/messages/conversations/${props.id}/typing`, { method: "POST" }).catch(() => {});
  }
}
async function send() {
  const body = text.value.trim();
  if (!body || sending.value) return;
  sending.value = true;
  error.value = "";
  try {
    await $fetch(`/api/messages/conversations/${props.id}/messages`, { method: "POST", body: { body } });
    text.value = "";
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Not sent. Try again.";
  } finally {
    sending.value = false;
  }
}
function onKey(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    void send();
  }
}
async function sendPhoto(file?: File) {
  if (!file) return;
  error.value = "";
  if (file.size > 20 * 1024 * 1024) return void (error.value = "Up to 20 MB");
  const form = new FormData();
  form.append("file", file);
  sending.value = true;
  try {
    await $fetch(`/api/messages/conversations/${props.id}/attachments`, { method: "POST", body: form });
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Photo not sent";
  } finally {
    sending.value = false;
  }
}

// Own messages: edit and delete
const editing = ref<string | null>(null);
const editText = ref("");
function startEdit(m: ChatMessage) {
  editing.value = m.id;
  editText.value = m.body ?? "";
}
async function saveEdit(m: ChatMessage) {
  if (!editText.value.trim()) return;
  await $fetch(`/api/messages/m/${m.id}`, { method: "PATCH", body: { body: editText.value } });
  editing.value = null;
}
async function remove(m: ChatMessage) {
  if (!confirm("Delete this message for both of you?")) return;
  await $fetch(`/api/messages/m/${m.id}`, { method: "DELETE" });
}

async function setArchived(archived: boolean) {
  await $fetch(`/api/messages/conversations/${props.id}/archive`, { method: "POST", body: { archived } });
  await navigateTo(archived ? "/messages" : `/messages/${props.id}`);
}

const mine = (m: ChatMessage) => m.senderId === me.value?.id;
const lastMine = computed(() => [...messages.value].reverse().find((m) => mine(m) && !m.deleted));
const seen = computed(() => !!(lastMine.value && otherReadAt.value && otherReadAt.value >= lastMine.value.createdAt));
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long" });
const showDay = (i: number) => i === 0 || day(messages.value[i - 1]!.createdAt) !== day(messages.value[i]!.createdAt);
</script>

<template>
  <section class="thread" aria-label="Conversation">
    <header class="thread__head">
      <NuxtLink to="/messages" class="icon-btn thread__back" aria-label="All conversations"><UiIcon name="back" /></NuxtLink>
      <NuxtLink :to="`/u/${d.other.username}`" class="avatar" style="width: 40px; height: 40px; border: var(--border)">
        <img v-if="d.other.image" :src="d.other.image" alt="" /><template v-else>{{ (d.other.username ?? "?")[0] }}</template>
      </NuxtLink>
      <NuxtLink :to="`/u/${d.other.username}`" style="color: var(--ink); min-width: 0; display: flex; flex-direction: column">
        <b>{{ userDisplayName(d.other) }}</b>
        <span class="mono muted" style="font-size: 12px">{{ typing ? "typing…" : `@${d.other.username}` }}</span>
      </NuxtLink>
      <details class="account-menu" style="margin-left: auto">
        <summary class="icon-btn" aria-label="More">⋯</summary>
        <div class="account-menu__list">
          <button type="button" @click="setArchived(!d.archived)">{{ d.archived ? "Unarchive" : "Archive" }}</button>
          <BlockButton v-if="d.other.username" :username="d.other.username" @change="fetchNewer()" />
          <ReportButton v-if="d.other.username" target-type="user" :target-id="d.other.username" label="Report user" />
        </div>
      </details>
    </header>

    <NuxtLink v-if="d.item" :to="d.item.path ?? '#'" class="thread__about">
      <span class="print owners__thumb" style="width: 52px"><span class="print__photo"><img v-if="d.item.thumbUrl" :src="d.item.thumbUrl" alt="" /></span></span>
      <span style="display: flex; flex-direction: column; gap: 2px; min-width: 0">
        <span class="label" style="font-size: 10px">About</span>
        <b>{{ d.item.model }}</b>
        <span class="mono muted" style="font-size: 12px">@{{ d.item.owner }} · {{ STATUS_LABELS[d.item.status] }}</span>
      </span>
    </NuxtLink>

    <div ref="scroller" class="thread__scroll" @scroll="onScroll">
      <button v-if="hasMore" type="button" class="link-quiet" style="align-self: center" @click="loadOlder">Load earlier messages</button>
      <template v-for="(m, i) in messages" :key="m.id">
        <div v-if="showDay(i)" class="thread__day mono">{{ day(m.createdAt) }}</div>
        <div class="msg" :class="{ 'msg--mine': mine(m), 'msg--deleted': m.deleted }">
          <div class="msg__bubble">
            <template v-if="m.deleted">Message deleted</template>
            <template v-else>
              <a v-if="m.attachment" :href="m.attachment.fullUrl" target="_blank" rel="noopener" class="msg__photo">
                <img :src="m.attachment.thumbUrl" alt="Photo" loading="lazy" />
              </a>
              <NuxtLink v-if="m.item" :to="m.item.path ?? '#'" class="msg__item">
                <b>{{ m.item.model }}</b><span class="mono" style="font-size: 12px">@{{ m.item.owner }} · {{ STATUS_LABELS[m.item.status] }}</span>
              </NuxtLink>
              <form v-if="editing === m.id" class="msg__edit" @submit.prevent="saveEdit(m)">
                <textarea v-model="editText" class="textarea" :maxlength="MESSAGE_MAX" style="min-height: 60px" @keydown.esc="editing = null" />
                <span class="quiet-actions"><button type="submit" class="link-quiet">Save</button><button type="button" class="link-quiet" @click="editing = null">Cancel</button></span>
              </form>
              <span v-else-if="m.body" class="msg__text">{{ m.body }}</span>
            </template>
          </div>
          <div class="msg__meta mono">
            {{ time(m.createdAt) }}<template v-if="m.editedAt"> · edited</template>
            <template v-if="!m.deleted && editing !== m.id">
              <template v-if="mine(m)">
                <button v-if="m.body" type="button" class="link-quiet" @click="startEdit(m)">Edit</button>
                <button type="button" class="link-quiet" @click="remove(m)">Delete</button>
              </template>
              <ReportButton v-else target-type="message" :target-id="m.id" />
            </template>
            <template v-if="m === lastMine && seen"> · Seen</template>
          </div>
        </div>
      </template>
    </div>

    <div v-if="blocked" class="thread__blocked">
      {{ blocked === "me" ? "You blocked this user. Unblock them to write." : "You can’t reply to this conversation." }}
    </div>
    <form v-else class="composer" @submit.prevent="send">
      <button type="button" class="icon-btn" aria-label="Send a photo" :disabled="sending" @click="fileInput?.click()"><UiIcon name="image" /></button>
      <input ref="fileInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="sendPhoto(($event.target as HTMLInputElement).files?.[0]); ($event.target as HTMLInputElement).value = ''" />
      <textarea
        v-model="text"
        class="textarea composer__input"
        rows="1"
        :maxlength="MESSAGE_MAX"
        placeholder="Write a message"
        aria-label="Message"
        @input="onInput"
        @keydown="onKey"
      />
      <button type="submit" class="btn btn--primary btn--sm" :disabled="!text.trim() || sending" aria-label="Send"><UiIcon name="send" /></button>
    </form>
    <p v-if="error" class="field__hint field__hint--error" style="padding: 0 16px 10px">{{ error }}</p>
  </section>
</template>
