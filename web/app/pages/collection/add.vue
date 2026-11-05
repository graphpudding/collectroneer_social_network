<script setup lang="ts">
import type { ModelCard } from "#shared/collection";

// Add a copy: pick a model (step 1), then describe the copy (step 2). ?model= skips step 1.
definePageMeta({ auth: true });
useSeoMeta({ title: "Add to collection", robots: "noindex, follow" });

const route = useRoute();
const model = ref<ModelCard | null>(null);
if (typeof route.query.model === "string") model.value = await fetchModelCard(route.query.model);

function pick(card: ModelCard) {
  model.value = card;
  navigateTo({ query: { model: card.id } }, { replace: true });
}
function change() {
  model.value = null;
  navigateTo({ query: {} }, { replace: true });
}
</script>

<template>
  <div class="page pad">
    <div class="flow-bar">
      <button v-if="model" type="button" class="flow-bar__back" @click="change"><UiIcon name="back" /> BACK</button>
      <NuxtLink v-else to="/collection" class="flow-bar__back"><UiIcon name="close" /> CANCEL</NuxtLink>
      <span class="flow-bar__title">Add to collection</span>
      <div class="steps">
        <span :aria-current="model ? undefined : 'step'">1 · MODEL</span>
        <span :aria-current="model ? 'step' : undefined">2 · YOUR COPY</span>
      </div>
    </div>
    <CopyEditor v-if="model" :key="model.id" :model="model" @change="change" />
    <ModelPicker v-else @pick="pick" />
  </div>
</template>
