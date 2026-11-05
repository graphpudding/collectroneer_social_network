<script setup lang="ts">
import { displayName } from "#shared/catalog";
import type { CollectionItem, ModelCard } from "#shared/collection";

definePageMeta({ auth: true });

const route = useRoute();
const { data: copy, error } = await useFetch<CollectionItem>(`/api/collection/${route.params.id}`, {
  headers: useRequestHeaders(["cookie"]),
});
if (error.value || !copy.value) throw createError({ statusCode: 404, statusMessage: "Not found", fatal: true });
useSeoMeta({ title: () => `Edit ${displayName(copy.value!.model)}`, robots: "noindex, follow" });

// "Change" swaps the model in place, then the editor comes back with the new one.
const model = ref<ModelCard>(copy.value.model);
const picking = ref(false);
function pick(card: ModelCard) {
  model.value = card;
  picking.value = false;
}
</script>

<template>
  <div class="page pad">
    <div class="flow-bar">
      <NuxtLink to="/collection" class="flow-bar__back"><UiIcon name="back" /> BACK</NuxtLink>
      <span class="flow-bar__title">Edit copy</span>
    </div>
    <ModelPicker v-if="picking" @pick="pick" />
    <CopyEditor v-else :key="model.id" :model="model" :copy="copy!" @change="picking = true" />
  </div>
</template>
