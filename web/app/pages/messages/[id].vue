<script setup lang="ts">
definePageMeta({ auth: true, ownMobileHeader: true });
useSeoMeta({ title: "Messages", robots: "noindex, nofollow" });
const route = useRoute();
const id = computed(() => String(route.params.id));
</script>

<template>
  <div class="page pad messages-page">
    <div class="messages-layout messages-layout--thread">
      <ConversationList :active-id="id" />
      <ChatThread :id="id" :key="id" />
    </div>
  </div>
</template>
