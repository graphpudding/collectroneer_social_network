<script setup lang="ts">
// "write to <email>" when an address is configured, otherwise the contact page.
const { contactEmail } = useSiteInfo();
</script>

<template>
  <a v-if="contactEmail" :href="`mailto:${contactEmail}`" class="u-link">{{ contactEmail }}</a>
  <NuxtLink v-else to="/contact" class="u-link">our contact page</NuxtLink>
</template>
