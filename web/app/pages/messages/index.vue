<script setup lang="ts">
// Inbox. ?to=<username>[&copy=<id>] opens (or starts) the conversation with that collector.
definePageMeta({ auth: true });
useSeoMeta({ title: "Messages", robots: "noindex, nofollow" });

const route = useRoute();
const error = ref("");
if (typeof route.query.to === "string") {
  try {
    const { id } = await $fetch<{ id: string }>("/api/messages/conversations", {
      method: "POST",
      body: { to: route.query.to, itemId: typeof route.query.copy === "string" ? route.query.copy : undefined },
      headers: useRequestHeaders(["cookie"]),
    });
    await navigateTo(`/messages/${id}`, { replace: true });
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Could not open the conversation";
  }
}
</script>

<template>
  <div class="page pad messages-page">
    <p v-if="error" class="form-error" role="alert" style="margin-top: 20px">{{ error }}</p>
    <div class="messages-layout">
      <ConversationList />
      <div class="messages-empty">
        <UiIcon name="chat" style="width: 40px; height: 40px" />
        <span>Pick a conversation</span>
      </div>
    </div>
  </div>
</template>
