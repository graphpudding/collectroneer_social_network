<script setup lang="ts">
// A photo on a film-frame mat; never cropped. Without a photo, a camera outline stands in.
defineProps<{ src?: string | null; alt: string; big?: boolean; emptyLabel?: string; eager?: boolean }>();
</script>

<template>
  <div class="frame" :class="{ 'frame--big': big }">
    <div class="frame__window">
      <img v-if="src" :src="src" :alt="alt" :loading="eager ? 'eager' : 'lazy'" />
      <template v-else>
        <svg viewBox="0 0 72 48" aria-hidden="true">
          <path d="M6 16h18l4-8h16l4 8h18v26H6z" /><circle cx="36" cy="29" r="10" /><circle cx="36" cy="29" r="5" /><path d="M10 12h6" />
        </svg>
        <span>{{ emptyLabel ?? "NO PHOTO YET" }}</span>
      </template>
    </div>
  </div>
</template>
