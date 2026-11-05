<script setup lang="ts">
// Line icons from the design (24px grid, 1.8 stroke).
defineProps<{ name: "search" | "close" | "back" | "share" | "user" | "chat" | "image" | "send" }>();
</script>

<template>
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <template v-if="name === 'search'"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></template>
    <path v-else-if="name === 'close'" d="M18 6 6 18M6 6l12 12" />
    <path v-else-if="name === 'back'" d="m15 18-6-6 6-6" />
    <path v-else-if="name === 'share'" d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
    <template v-else-if="name === 'user'"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></template>
    <path v-else-if="name === 'chat'" d="M4 5h16v11H9l-5 4z" />
    <template v-else-if="name === 'image'"><rect x="3" y="5" width="18" height="14" /><circle cx="9" cy="10" r="2" /><path d="m21 16-5-5-9 8" /></template>
    <path v-else-if="name === 'send'" d="M4 12 20 4l-4 16-4-7zM12 13l8-9" />
  </svg>
</template>
