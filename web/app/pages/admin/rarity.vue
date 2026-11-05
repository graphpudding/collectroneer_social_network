<script setup lang="ts">
import { sectionByCategory } from "#shared/catalog";
import type { RarityLevel } from "#shared/rarity";

definePageMeta({ auth: true, role: "admin" });
useSeoMeta({ title: "Rarity thresholds", robots: "noindex, nofollow" });

type Scale = { category: string; levels: RarityLevel[]; methodVersion: number; updatedAt: string; updatedBy: string | null };
const { data: scales, refresh } = await useFetch<Scale[]>("/api/admin/rarity", { headers: useRequestHeaders(["cookie"]), default: () => [] });
const drafts = reactive<Record<string, RarityLevel[]>>({});
watchEffect(() => { for (const s of scales.value) drafts[s.category] ??= s.levels.map((l) => ({ ...l })); });
const messages = reactive<Record<string, { ok: boolean; text: string }>>({});

async function save(category: string) {
  try {
    await $fetch(`/api/admin/rarity/${category}`, { method: "PUT", body: { levels: drafts[category] } });
    messages[category] = { ok: true, text: "Saved. Model pages use the new thresholds now." };
    await refresh();
  } catch (e: any) {
    messages[category] = { ok: false, text: e?.data?.statusMessage ?? "Could not save" };
  }
}
</script>

<template>
  <div class="page pad admin">
    <AdminNav />
    <p class="form-note" style="padding-top: 20px; max-width: 720px">
      Levels go from most common to rarest. A model gets the first level whose “made at least” is below its production
      (a range counts by its middle). The public method page, <NuxtLink to="/about/rarity" class="u-link">How rarity is rated</NuxtLink>, shows these numbers.
    </p>
    <section v-for="s in scales" :key="s.category" class="settings__section" style="max-width: 720px">
      <h2 class="title">{{ sectionByCategory(s.category)?.title ?? s.category }}</h2>
      <span class="mono muted" style="font-size: 12px">Version {{ s.methodVersion }} · updated {{ new Date(s.updatedAt).toLocaleDateString("en-GB") }}{{ s.updatedBy ? ` by @${s.updatedBy}` : "" }}</span>
      <table class="admin-table">
        <thead><tr><th>Level</th><th>Made at least</th><th /></tr></thead>
        <tbody>
          <tr v-for="(l, i) in drafts[s.category]" :key="i">
            <td><input v-model="l.label" class="input" style="height: 40px" maxlength="30" /></td>
            <td><input v-model.number="l.min_production" class="input mono" style="height: 40px" type="number" min="0" step="1" /></td>
            <td><button type="button" class="link-danger" :disabled="drafts[s.category]!.length <= 2" @click="drafts[s.category]!.splice(i, 1)">Remove</button></td>
          </tr>
        </tbody>
      </table>
      <div class="settings__actions">
        <button type="button" class="btn btn--sm" @click="drafts[s.category]!.push({ key: '', label: 'New level', min_production: 0 })">+ Level</button>
        <button type="button" class="btn btn--sm btn--primary" @click="save(s.category)">Save thresholds</button>
        <span v-if="messages[s.category]" :class="messages[s.category]!.ok ? 'muted' : 'field__hint--error'">{{ messages[s.category]!.text }}</span>
      </div>
    </section>
  </div>
</template>
