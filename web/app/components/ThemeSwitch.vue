<script setup lang="ts">
import type { ThemeChoice } from "~/composables/useTheme";

// Light / Dark / Auto (follows the system). The <html data-theme> attribute is set in app.vue.
const theme = useTheme();
const options: { id: ThemeChoice; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "auto", label: "Auto" },
];
</script>

<template>
  <div class="theme-switch" role="group" aria-label="Theme">
    <button v-for="o in options" :key="o.id" type="button" :aria-pressed="theme === o.id" @click="theme = o.id">{{ o.label }}</button>
  </div>
</template>
