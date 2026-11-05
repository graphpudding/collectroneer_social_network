<script setup lang="ts">
import { PHOTO_REJECT_REASONS, type PendingPhoto } from "#shared/admin";

definePageMeta({ auth: true, role: "moderator" });
useSeoMeta({ title: "Photo queue", robots: "noindex, nofollow" });

const { data: photos, refresh } = await useFetch<PendingPhoto[]>("/api/admin/photos", {
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
const selected = ref<Set<string>>(new Set());
const reason = ref<string>(PHOTO_REJECT_REASONS[0]);
const custom = ref("");
const busy = ref(false);
const preview = ref<PendingPhoto | null>(null);

function toggle(id: string) {
  const s = new Set(selected.value);
  s.has(id) ? s.delete(id) : s.add(id);
  selected.value = s;
}
const allSelected = computed(() => photos.value.length > 0 && selected.value.size === photos.value.length);
const selectAll = () => (selected.value = allSelected.value ? new Set() : new Set(photos.value.map((p) => p.id)));

async function review(action: "approve" | "reject", ids = [...selected.value]) {
  if (!ids.length) return;
  busy.value = true;
  try {
    await $fetch("/api/admin/photos/review", { method: "POST", body: { ids, action, reason: custom.value.trim() || reason.value } });
    selected.value = new Set();
    preview.value = null;
    await Promise.all([refresh(), refreshNuxtData("admin-stats")]);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page pad admin">
    <AdminNav />
    <div class="admin-bar">
      <label class="agree" style="font-size: 14px"><input type="checkbox" :checked="allSelected" @change="selectAll" /><span class="check__box" aria-hidden="true" />Select all</label>
      <span class="mono muted" style="font-size: 12px">{{ selected.size }} selected · {{ photos.length }} waiting{{ photos.length === 60 ? "+" : "" }}</span>
      <div class="admin-bar__actions">
        <button type="button" class="btn btn--sm btn--primary" :disabled="!selected.size || busy" @click="review('approve')">Approve</button>
        <select v-model="reason" class="input" style="height: 40px; width: auto" aria-label="Reject reason">
          <option v-for="r in PHOTO_REJECT_REASONS" :key="r">{{ r }}</option>
        </select>
        <input v-model="custom" class="input" style="height: 40px; width: 200px" placeholder="or your own reason" />
        <button type="button" class="btn btn--sm" :disabled="!selected.size || busy" @click="review('reject')">Reject</button>
      </div>
    </div>
    <div v-if="photos.length" class="admin-photos">
      <div v-for="p in photos" :key="p.id" class="print admin-photo" :class="{ 'photo-tile--cover': selected.has(p.id) }">
        <button type="button" class="print__photo" style="border: 0; padding: 0; cursor: zoom-in; width: 100%" @click="preview = p">
          <img :src="p.thumbUrl" alt="" loading="lazy" />
        </button>
        <label class="agree admin-photo__check"><input type="checkbox" :checked="selected.has(p.id)" @change="toggle(p.id)" /><span class="check__box" aria-hidden="true" /></label>
        <div class="admin-photo__meta">
          <NuxtLink :to="p.modelPath" class="u-link" target="_blank">{{ p.model }}</NuxtLink>
          <NuxtLink :to="`/u/${p.owner.username}`" class="mono muted" target="_blank">@{{ p.owner.username }}</NuxtLink>
        </div>
      </div>
    </div>
    <div v-else class="state" style="margin-block: 24px 64px"><span class="state__title">Queue is empty</span></div>

    <div v-if="preview" class="sheet-backdrop" @click="preview = null" />
    <div v-if="preview" class="admin-preview" role="dialog" aria-label="Photo">
      <img :src="preview.fullUrl" alt="" />
      <div class="admin-bar">
        <span>{{ preview.model }} · @{{ preview.owner.username }} · {{ preview.width }}×{{ preview.height }}</span>
        <div class="admin-bar__actions">
          <button type="button" class="btn btn--sm btn--primary" :disabled="busy" @click="review('approve', [preview.id])">Approve</button>
          <button type="button" class="btn btn--sm" :disabled="busy" @click="review('reject', [preview.id])">Reject: {{ custom.trim() || reason }}</button>
          <button type="button" class="icon-btn" aria-label="Close" @click="preview = null"><UiIcon name="close" /></button>
        </div>
      </div>
    </div>
  </div>
</template>
