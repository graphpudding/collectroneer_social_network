<script setup lang="ts">
import { SITE_NAME } from "#shared/catalog";
</script>

<template>
  <footer class="site-footer">
    <div class="page pad site-footer__inner">
      <nav class="site-footer__links" aria-label="Site">
        <NuxtLink to="/about">About</NuxtLink>
        <NuxtLink to="/about/sources">Data sources &amp; licenses</NuxtLink>
        <NuxtLink to="/terms">Terms</NuxtLink>
        <NuxtLink to="/privacy">Privacy</NuxtLink>
        <NuxtLink to="/photo-rules">Photo rules</NuxtLink>
        <NuxtLink to="/contact">Contact</NuxtLink>
      </nav>
      <ThemeSwitch />
      <span class="site-footer__brand">{{ SITE_NAME.toUpperCase() }}</span>
    </div>
  </footer>
</template>
