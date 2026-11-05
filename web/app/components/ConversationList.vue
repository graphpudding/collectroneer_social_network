<script setup lang="ts">
import { userDisplayName } from "#shared/account";
import type { ConversationSummary } from "#shared/chat";

// Conversations, newest first; refreshes on chat events. ?archived shows the archive.
const props = defineProps<{ activeId?: string }>();
const route = useRoute();
const archived = computed(() => route.query.archived === "1");
const { data, refresh } = await useFetch<ConversationSummary[]>("/api/messages/conversations", {
  key: "conversations",
  query: computed(() => (archived.value ? { archived: "1" } : {})),
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
onChatEvent((e) => { if (e.type !== "typing") void refresh(); });

function when(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
defineExpose({ refresh });
</script>

<template>
  <div class="conv-list">
    <div class="conv-list__head">
      <span class="title" style="font-size: 18px">{{ archived ? "Archive" : "Messages" }}</span>
      <NuxtLink :to="archived ? '/messages' : { path: '/messages', query: { archived: '1' } }" class="link-quiet">
        {{ archived ? "Back to inbox" : "Archive" }}
      </NuxtLink>
    </div>
    <NuxtLink
      v-for="c in data"
      :key="c.id"
      :to="{ path: `/messages/${c.id}`, query: archived ? { archived: '1' } : {} }"
      class="conv"
      :class="{ 'conv--active': c.id === props.activeId, 'conv--unread': c.unread }"
    >
      <span class="avatar" style="width: 44px; height: 44px; border: var(--border)">
        <img v-if="c.other.image" :src="c.other.image" alt="" /><template v-else>{{ (c.other.username ?? "?")[0] }}</template>
      </span>
      <span class="conv__body">
        <span class="conv__top">
          <b class="conv__name">{{ userDisplayName(c.other) }}</b>
          <span v-if="c.last" class="mono muted conv__time">{{ when(c.last.at) }}</span>
        </span>
        <span class="conv__preview">{{ c.last?.mine ? "You: " : "" }}{{ c.last?.preview }}</span>
      </span>
      <span v-if="c.unread" class="badge-count" style="margin: 0">{{ c.unread }}</span>
    </NuxtLink>
    <p v-if="!data.length" class="form-note" style="padding: 20px">
      {{ archived ? "Nothing archived." : "No conversations yet. Message a collector from their profile or copy." }}
    </p>
  </div>
</template>
