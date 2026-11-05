<script setup lang="ts">
import type { NuxtError } from "#app";

const props = defineProps<{ error: NuxtError }>();
const notFound = computed(() => props.error.statusCode === 404);
useHead({ title: notFound.value ? "Not found" : "Error" });
</script>

<template>
  <SiteHeader />
  <main class="page pad error-page">
    <div class="state">
      <span class="kicker">▸ {{ notFound ? "404" : "Error" }}</span>
      <span class="state__title">{{ notFound ? "Page not found" : "Something went wrong" }}</span>
      <span class="muted">{{ notFound ? "This model may have been removed or merged into another one." : error.statusMessage }}</span>
      <div class="state__actions">
        <button type="button" class="btn btn--sm" @click="clearError({ redirect: '/' })">Back to the catalog</button>
      </div>
    </div>
  </main>
  <SiteFooter />
</template>
