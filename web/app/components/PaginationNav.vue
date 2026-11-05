<script setup lang="ts">
import { pageNumbers } from "#shared/catalog";

// Page links: ‹ 1 … 4 5 6 … 232 ›. Plain links, so they work without JavaScript and for crawlers.
const props = defineProps<{ page: number; pages: number }>();
const route = useRoute();
const to = (p: number) => ({ query: { ...route.query, page: p === 1 ? undefined : String(p) } });
const items = computed(() => pageNumbers(props.page, props.pages));
</script>

<template>
  <nav v-if="pages > 1" class="pagination" aria-label="Pages">
    <NuxtLink v-if="page > 1" :to="to(page - 1)" class="pagination__step" rel="prev" aria-label="Previous page">‹ Prev</NuxtLink>
    <span v-else class="pagination__step pagination__step--off" aria-hidden="true">‹ Prev</span>
    <template v-for="(p, i) in items" :key="p ?? `gap-${i}`">
      <span v-if="p === null" class="pagination__gap" aria-hidden="true">…</span>
      <NuxtLink v-else :to="to(p)" class="pagination__page" :aria-current="p === page ? 'page' : undefined" :aria-label="`Page ${p}`">{{ p }}</NuxtLink>
    </template>
    <NuxtLink v-if="page < pages" :to="to(page + 1)" class="pagination__step" rel="next" aria-label="Next page">Next ›</NuxtLink>
    <span v-else class="pagination__step pagination__step--off" aria-hidden="true">Next ›</span>
  </nav>
</template>
