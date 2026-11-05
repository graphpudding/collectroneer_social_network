<script setup lang="ts">
import { fieldByPath, valueText, type CatalogEditRow } from "#shared/edits";

definePageMeta({ auth: true, role: "moderator" });
useSeoMeta({ title: "Catalog edits", robots: "noindex, nofollow" });

const route = useRoute();
const view = computed(() => (route.query.view === "closed" ? "closed" : "proposed"));
const { data: edits, refresh } = await useFetch<CatalogEditRow[]>("/api/admin/edits", {
  query: computed(() => ({ status: view.value })),
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
const notes = reactive<Record<string, string>>({});
const error = ref("");
async function review(e: CatalogEditRow, action: "approve" | "reject") {
  error.value = "";
  try {
    await $fetch(`/api/admin/edits/${e.id}`, { method: "POST", body: { action, note: notes[e.id] } });
    await Promise.all([refresh(), refreshNuxtData("admin-stats")]);
  } catch (err: any) {
    error.value = err?.data?.statusMessage ?? "Failed";
  }
}
const title = (e: CatalogEditRow) =>
  e.kind === "new_model" ? `New model: ${e.changes.maker} ${e.changes.name}` : e.kind === "merge" ? `Duplicate: ${e.catalogName}` : `Edit: ${e.catalogName}`;
const isUrl = (s: string) => /^https?:\/\//.test(s);
</script>

<template>
  <div class="page pad admin">
    <AdminNav />
    <div class="admin-bar">
      <div class="chips-row">
        <NuxtLink :to="{ query: {} }" class="chip" :aria-pressed="view === 'proposed'">Waiting</NuxtLink>
        <NuxtLink :to="{ query: { view: 'closed' } }" class="chip" :aria-pressed="view === 'closed'">Reviewed</NuxtLink>
      </div>
      <p v-if="error" class="field__hint field__hint--error">{{ error }}</p>
    </div>
    <div v-if="edits.length" class="admin-list">
      <article v-for="e in edits" :key="e.id" class="admin-card">
        <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline">
          <b>{{ title(e) }}</b>
          <NuxtLink v-if="e.catalogPath" :to="e.catalogPath" target="_blank" class="u-link">open</NuxtLink>
          <span class="mono muted" style="margin-left: auto; font-size: 12px">{{ new Date(e.createdAt).toLocaleString("en-GB") }} · @{{ e.author ?? "deleted" }}</span>
        </div>
        <table v-if="e.kind !== 'merge'" class="admin-table">
          <thead><tr><th>Field</th><th v-if="e.kind === 'edit'">Now</th><th>Suggested</th></tr></thead>
          <tbody>
            <tr v-for="(v, path) in e.changes" :key="path">
              <td>{{ fieldByPath(String(path))?.label ?? path }}</td>
              <td v-if="e.kind === 'edit'" class="muted">{{ valueText(String(path), e.current[path]) }}</td>
              <td><b>{{ valueText(String(path), v) }}</b></td>
            </tr>
          </tbody>
        </table>
        <p v-else class="form-note">
          Same camera as <NuxtLink v-if="e.mergeInto" :to="e.mergeInto.path" target="_blank" class="u-link">{{ e.mergeInto.name }}</NuxtLink>.
          Approving retires {{ e.catalogName }} and moves its copies.
        </p>
        <p class="form-note">Source: <a v-if="isUrl(e.source)" :href="e.source" target="_blank" rel="noopener" class="u-link">{{ e.source }}</a><template v-else>{{ e.source }}</template></p>
        <p v-if="e.note" class="form-note">Note: {{ e.note }}</p>
        <template v-if="e.status === 'proposed'">
          <input v-model="notes[e.id]" class="input" style="height: 40px" placeholder="Note to the author (optional)" />
          <div class="settings__actions">
            <button type="button" class="btn btn--sm btn--primary" @click="review(e, 'approve')">Approve</button>
            <button type="button" class="btn btn--sm" @click="review(e, 'reject')">Reject</button>
          </div>
        </template>
        <p v-else class="form-note">{{ e.status }}{{ e.reviewNote ? ` · ${e.reviewNote}` : "" }}<NuxtLink v-if="e.resultPath" :to="e.resultPath" class="u-link"> · open the new model</NuxtLink></p>
      </article>
    </div>
    <div v-else class="state" style="margin-block: 8px 64px"><span class="state__title">Nothing {{ view === "proposed" ? "waiting" : "reviewed yet" }}</span></div>
  </div>
</template>
