<script setup lang="ts">
import { displayName, entryPath, thumbnail, years, type CatalogCard } from "#shared/catalog";
import { keyFacts } from "#shared/film-cameras";

const props = defineProps<{ card: CatalogCard; category: string }>();
const meta = computed(() => [...keyFacts(props.card.attributes), years(props.card)].filter(Boolean).join(" · "));
</script>

<template>
  <NuxtLink :to="entryPath({ ...card, category })" class="tile">
    <PhotoFrame :src="thumbnail(card.image_url, 500)" :alt="displayName(card)" />
    <div class="tile__body">
      <div class="tile__top">
        <span class="tile__maker">{{ card.maker }}</span>
        <span v-if="card.variant_of_name" class="badge">Variant of {{ card.variant_of_name }}</span>
      </div>
      <span class="tile__name"><KeepWords :text="card.name" /></span>
      <span v-if="meta" class="tile__meta">{{ meta }}</span>
    </div>
  </NuxtLink>
</template>
