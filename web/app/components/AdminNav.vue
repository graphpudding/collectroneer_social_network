<script setup lang="ts">
// Admin sections with queue counts.
const me = useMe();
const { data: stats } = await useFetch<{ photos: number; reports: number; edits: number }>("/api/admin/stats", {
  key: "admin-stats",
  headers: useRequestHeaders(["cookie"]),
  default: () => ({ photos: 0, reports: 0, edits: 0 }),
});
const links = computed(() => [
  { to: "/admin/photos", label: "Photos", n: stats.value.photos },
  { to: "/admin/reports", label: "Reports", n: stats.value.reports },
  { to: "/admin/edits", label: "Edits", n: stats.value.edits },
  ...(me.value?.role === "admin" ? [{ to: "/admin/users", label: "Users" }, { to: "/admin/rarity", label: "Rarity" }] : []),
]);
defineExpose({ refresh: () => refreshNuxtData("admin-stats") });
</script>

<template>
  <div class="admin-head">
    <span class="kicker">▸ Admin</span>
    <nav class="tabs" aria-label="Admin">
      <NuxtLink v-for="l in links" :key="l.to" :to="l.to" class="tabs__tab" :aria-current="$route.path === l.to ? 'page' : undefined">
        {{ l.label }}<span v-if="'n' in l" class="tabs__count" :class="{ 'tabs__count--hot': l.n }">{{ l.n }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>
