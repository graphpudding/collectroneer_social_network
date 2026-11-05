<script setup lang="ts">
useSeoMeta({ title: "Contact" });
const { contactEmail } = useSiteInfo();
</script>

<template>
  <div class="page pad prose legal">
    <span class="kicker">▸ Contact</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">Contact</h1>
    <p v-if="contactEmail">Write to <a :href="`mailto:${contactEmail}`" class="u-link">{{ contactEmail }}</a>. We usually reply within a few days.</p>
    <p v-else>A contact address is coming soon.</p>
    <ul>
      <li>A wrong fact in the catalog: “Suggest an edit” on the model page is the fastest way.</li>
      <li>A problem with a user, copy, photo or message: use “Report” next to it.</li>
      <li>Your account and data: everything is in <NuxtLink to="/settings" class="u-link">settings</NuxtLink>, including export and deletion.</li>
    </ul>
  </div>
</template>
