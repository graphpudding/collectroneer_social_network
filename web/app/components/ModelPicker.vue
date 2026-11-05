<script setup lang="ts">
import { displayName, thumbnail, years, type CatalogCard, type CatalogList } from "#shared/catalog";
import { keyFacts } from "#shared/film-cameras";
import type { ModelCard } from "#shared/collection";

// Step 1 of adding a copy: find the model in the catalog.
const emit = defineEmits<{ pick: [ModelCard] }>();
const q = ref("");
const results = ref<CatalogCard[]>([]);
const total = ref(0);
const loading = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(q, (value) => {
  clearTimeout(timer);
  const query = value.trim();
  if (query.length < 2) return void (results.value = [], (total.value = 0));
  loading.value = true;
  timer = setTimeout(async () => {
    const r = await $fetch<CatalogList>("/api/catalog/film_cameras", { query: { q: query, limit: 12 } });
    if (query !== q.value.trim()) return;
    results.value = r.items;
    total.value = r.total;
    loading.value = false;
  }, 250);
});

const meta = (c: CatalogCard) =>
  c.variant_of_name
    ? [`Variant of ${c.variant_of_name}`, years(c)].filter(Boolean).join(" · ")
    : [...keyFacts(c.attributes), years(c), c.country].filter(Boolean).join(" · ");
</script>

<template>
  <div class="picker">
    <h1 class="picker__title">Which camera is it?</h1>
    <label class="picker__search">
      <UiIcon name="search" />
      <input v-model="q" type="search" placeholder="Maker and model: Nikon F2, Zenit E…" aria-label="Search the catalog" autocomplete="off" autofocus />
    </label>
    <template v-if="q.trim().length >= 2">
      <span class="label" style="font-size: 12px">{{ loading ? "Searching…" : `${total} ${total === 1 ? "model" : "models"} in the catalog` }}</span>
      <div v-if="results.length" class="picker__list">
        <div v-for="c in results" :key="c.id" class="picker__row">
          <div class="picker__thumb"><PhotoFrame :src="thumbnail(c.image_url, 330)" :alt="displayName(c)" empty-label="" /></div>
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px">
            <span class="picker__name">{{ displayName(c) }}</span>
            <span class="picker__meta">{{ meta(c) }}</span>
          </div>
          <button type="button" class="btn btn--sm" @click="emit('pick', { ...c, category: 'film_cameras' })">Select</button>
        </div>
      </div>
    </template>
    <p class="form-note">
      Not in the catalog? <NuxtLink to="/suggest" class="u-link">Suggest a new model</NuxtLink>.
      Once it’s approved you can add your copy.
    </p>
  </div>
</template>
