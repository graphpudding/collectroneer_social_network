<script setup lang="ts">
useSeoMeta({ title: "About", description: "Collectors Note: a catalog of film cameras and the people who collect them." });
const { operator } = useSiteInfo();
</script>

<template>
  <div class="page pad prose legal">
    <span class="kicker">▸ About</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">About Collectors Note</h1>
    <p>
      Collectors Note is a catalog of collectible models and the collections built around it. It starts with film
      cameras: thousands of models with specifications, production figures and rarity, each fact linked to its source.
    </p>
    <p>
      Log every camera you own, list the ones you’re hunting for, and find the collectors who have them. When someone
      marks a copy for trade or sale, people looking for that model can message them. Deals happen between collectors;
      Collectors Note never takes a cut or handles money.
    </p>
    <h2 class="title">How it works</h2>
    <ul>
      <li>The catalog comes from open sources: Camera-wiki, Wikidata, Wikipedia and Wikimedia Commons. <NuxtLink to="/about/sources" class="u-link">More about the data.</NuxtLink></li>
      <li>Collectors fix and extend it. Every suggestion is checked by a moderator.</li>
      <li>Rarity is our own rating, explained on <NuxtLink to="/about/rarity" class="u-link">How rarity is rated</NuxtLink>.</li>
      <li>Photos of copies are their owners’ own, and reviewed before they’re public.</li>
    </ul>
    <h2 class="title">Coming next</h2>
    <p>Following collectors, a feed of new additions, and frames shot on the cameras in your collection.</p>
    <p v-if="operator" class="muted">Collectors Note is run by {{ operator }}.</p>
    <p>Get in touch: <ContactLine />.</p>
  </div>
</template>
