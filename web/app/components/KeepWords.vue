<script setup lang="ts">
// Model names wrap between words only: "Canon F-1N" never breaks inside "F-1N".
const props = defineProps<{ text: string }>();
const words = computed(() => props.text.split(/\s+/).filter(Boolean));
</script>

<template>
  <template v-for="(w, i) in words" :key="i"><span class="keep">{{ w }}</span>{{ i < words.length - 1 ? " " : "" }}</template>
</template>
