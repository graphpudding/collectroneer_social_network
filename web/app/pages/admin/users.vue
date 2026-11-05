<script setup lang="ts">
import type { AdminUser, Role } from "#shared/admin";

definePageMeta({ auth: true, role: "admin" });
useSeoMeta({ title: "Users", robots: "noindex, nofollow" });

const me = useMe();
const q = ref("");
const query = ref("");
let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, (v) => { clearTimeout(timer); timer = setTimeout(() => (query.value = v.trim()), 300); });
const { data: users, refresh } = await useFetch<AdminUser[]>("/api/admin/users", {
  query: computed(() => ({ q: query.value })),
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
const error = ref("");

async function update(u: AdminUser, body: { role?: Role; banned?: boolean; banReason?: string }) {
  error.value = "";
  try {
    await $fetch(`/api/admin/users/${u.id}`, { method: "POST", body });
    await refresh();
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Failed";
  }
}
function toggleBan(u: AdminUser) {
  if (u.banned) return update(u, { banned: false });
  const reason = prompt(`Ban @${u.username}? Reason (kept in the log):`);
  if (reason !== null) update(u, { banned: true, banReason: reason });
}
</script>

<template>
  <div class="page pad admin">
    <AdminNav />
    <div class="admin-bar">
      <input v-model="q" class="input" style="max-width: 360px" type="search" placeholder="Username or email" aria-label="Find users" />
      <p v-if="error" class="field__hint field__hint--error">{{ error }}</p>
    </div>
    <div style="overflow-x: auto">
      <table class="admin-table">
        <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Copies</th><th>Reports</th><th>Joined</th><th /></tr></thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td>
              <NuxtLink v-if="u.username" :to="`/u/${u.username}`" class="u-link" target="_blank">@{{ u.username }}</NuxtLink>
              <span v-else class="muted">no username</span>
              <span v-if="u.isPrivate" class="tag" style="margin-left: 6px">closed</span>
              <div v-if="u.banned" class="field__hint field__hint--error">Banned{{ u.banReason ? `: ${u.banReason}` : "" }}</div>
            </td>
            <td class="mono" style="font-size: 12px">{{ u.email }}</td>
            <td>
              <select :value="u.role" class="input" style="height: 36px; width: auto" :disabled="u.id === me?.id" @change="update(u, { role: ($event.target as HTMLSelectElement).value as Role })">
                <option value="user">user</option><option value="moderator">moderator</option><option value="admin">admin</option>
              </select>
            </td>
            <td>{{ u.copies }}</td>
            <td>{{ u.reports }}</td>
            <td class="mono" style="font-size: 12px">{{ new Date(u.createdAt).toLocaleDateString("en-GB") }}</td>
            <td><button v-if="u.id !== me?.id" type="button" class="btn btn--sm" @click="toggleBan(u)">{{ u.banned ? "Unban" : "Ban" }}</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
