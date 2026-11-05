<script setup lang="ts">
import { SECTIONS } from "#shared/catalog";

// One category for now: the home page is its catalog.
await navigateTo(`/${SECTIONS[0]!.path}`, { redirectCode: 302 });
</script>

<template><div /></template>
