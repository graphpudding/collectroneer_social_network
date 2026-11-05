<script setup lang="ts">
import { REPORT_REASONS, type ReportRow } from "#shared/admin";

definePageMeta({ auth: true, role: "moderator" });
useSeoMeta({ title: "Reports", robots: "noindex, nofollow" });

const me = useMe();
const route = useRoute();
const view = computed(() => (route.query.view === "closed" ? "closed" : "open"));
const { data: reports, refresh } = await useFetch<ReportRow[]>("/api/admin/reports", {
  query: computed(() => ({ status: view.value })),
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
const notes = reactive<Record<string, string>>({});
const error = ref("");

async function close(r: ReportRow, status: "resolved" | "dismissed") {
  error.value = "";
  try {
    await $fetch(`/api/admin/reports/${r.id}`, { method: "POST", body: { status, resolution: notes[r.id] } });
    await Promise.all([refresh(), refreshNuxtData("admin-stats")]);
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Failed";
  }
}
async function ban(r: ReportRow) {
  if (!r.targetUser || !confirm(`Ban @${r.targetUser.username}? They are signed out and can't log in.`)) return;
  await $fetch(`/api/admin/users/${r.targetUser.id}`, { method: "POST", body: { banned: true, banReason: notes[r.id] || REPORT_REASONS[r.reason] } });
  await close(r, "resolved");
}
async function rejectPhoto(r: ReportRow) {
  await $fetch("/api/admin/photos/review", { method: "POST", body: { ids: [r.targetId], action: "reject", reason: notes[r.id] || REPORT_REASONS[r.reason] } });
  await close(r, "resolved");
}
const when = (d: string) => new Date(d).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
</script>

<template>
  <div class="page pad admin">
    <AdminNav />
    <div class="admin-bar">
      <div class="chips-row">
        <NuxtLink :to="{ query: {} }" class="chip" :aria-pressed="view === 'open'">Open</NuxtLink>
        <NuxtLink :to="{ query: { view: 'closed' } }" class="chip" :aria-pressed="view === 'closed'">Closed</NuxtLink>
      </div>
      <p v-if="error" class="field__hint field__hint--error">{{ error }}</p>
    </div>
    <div v-if="reports.length" class="admin-list">
      <article v-for="r in reports" :key="r.id" class="admin-card">
        <div style="display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: baseline">
          <b>{{ REPORT_REASONS[r.reason] }}</b>
          <span class="tag">{{ r.targetType }}</span>
          <NuxtLink v-if="r.link" :to="r.link" target="_blank" class="u-link">{{ r.link }}</NuxtLink>
          <span v-if="r.targetUser?.banned" class="status status--for_sale">banned</span>
          <span class="mono muted" style="margin-left: auto; font-size: 12px">{{ when(r.createdAt) }} · by @{{ r.reporter ?? "deleted" }}</span>
        </div>
        <p v-if="r.details" style="margin: 0; white-space: pre-line">{{ r.details }}</p>
        <template v-if="r.status === 'open'">
          <input v-model="notes[r.id]" class="input" style="height: 40px" placeholder="Note (optional, kept in the log)" />
          <div class="settings__actions">
            <button type="button" class="btn btn--sm" @click="close(r, 'dismissed')">Dismiss</button>
            <button type="button" class="btn btn--sm" @click="close(r, 'resolved')">Resolved</button>
            <button v-if="r.targetType === 'photo'" type="button" class="btn btn--sm" @click="rejectPhoto(r)">Reject photo</button>
            <button v-if="me?.role === 'admin' && r.targetUser && !r.targetUser.banned" type="button" class="btn btn--sm btn--primary" @click="ban(r)">Ban user</button>
          </div>
        </template>
        <p v-else class="form-note">{{ r.status }}{{ r.resolution ? ` · ${r.resolution}` : "" }}</p>
      </article>
    </div>
    <div v-else class="state" style="margin-block: 8px 64px"><span class="state__title">No {{ view }} reports</span></div>
  </div>
</template>
