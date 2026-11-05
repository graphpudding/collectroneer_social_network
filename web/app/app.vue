<script setup lang="ts">
import { SITE_NAME } from "#shared/catalog";

const theme = useTheme();
useHead({
  titleTemplate: (t) => (t ? `${t} · ${SITE_NAME}` : SITE_NAME),
  // "auto" leaves the attribute off, and the CSS follows prefers-color-scheme.
  htmlAttrs: { "data-theme": () => (theme.value === "auto" ? undefined : theme.value) },
});
const route = useRoute();
</script>

<template>
  <!-- Model pages on phones swap the site header for their own back bar (design 4a). -->
  <SiteHeader :class="{ 'hide-mobile': route.meta.ownMobileHeader }" />
  <main>
    <NuxtPage />
  </main>
  <SiteFooter />
</template>
