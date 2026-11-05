<script setup lang="ts">
import { userDisplayName, type PublicProfile } from "#shared/account";
import { STATUS_LABELS, type PublicCopy, type WishlistItem } from "#shared/collection";

const route = useRoute();
const username = computed(() => String(route.params.username).toLowerCase());
const me = useMe();
const isMe = computed(() => me.value?.username === username.value);

const { data: profile, error } = await useFetch<PublicProfile>(() => `/api/users/${username.value}`);
if (error.value || !profile.value) throw createError({ statusCode: 404, statusMessage: "No such collector", fatal: true });

const tab = computed(() => (route.query.tab === "wishlist" ? "wishlist" : "collection"));
const status = computed(() => (typeof route.query.status === "string" ? route.query.status : "all"));
const { data: copies } = await useFetch<PublicCopy[]>(() => `/api/users/${username.value}/copies`, { default: () => [] });
const { data: wishlist } = await useFetch<WishlistItem[]>(() => `/api/users/${username.value}/wishlist`, { default: () => [] });
const shown = computed(() => (status.value === "all" ? copies.value : copies.value.filter((c) => c.status === status.value)));
const chips = computed(() => [
  { id: "all", label: "All", n: copies.value.length },
  ...(["owned", "for_trade", "for_sale"] as const).map((s) => ({ id: s, label: STATUS_LABELS[s], n: profile.value!.counts.byStatus[s] ?? 0 })),
]);

const name = computed(() => userDisplayName(profile.value!));
useSeoMeta({
  title: () => `${name.value} (@${username.value})`,
  description: () => `${name.value}’s camera collection on Collectors Note.`,
  robots: () => (profile.value?.closed ? "noindex, follow" : "index, follow"),
});
</script>

<template>
  <div class="page pad">
    <ProfileHead :user="profile!" :kicker="isMe ? 'This is how others see your page' : undefined">
      <template v-if="isMe">
        <NuxtLink to="/collection" class="btn">My collection</NuxtLink>
      </template>
      <template v-else>
        <NuxtLink v-if="!profile!.closed" :to="{ path: '/messages', query: { to: username } }" class="btn btn--primary">Message</NuxtLink>
        <div class="quiet-actions" style="width: 100%">
          <BlockButton :username="username" />
          <ReportButton target-type="user" :target-id="username" label="Report profile" />
        </div>
      </template>
    </ProfileHead>

    <div v-if="profile!.closed" class="state" style="margin-block: 8px 64px">
      <span class="state__title">This account is closed</span>
      <p class="form-note">@{{ username }} keeps their collection private.</p>
    </div>

    <template v-else>
      <nav class="tabs" aria-label="Profile">
        <NuxtLink :to="{ query: {} }" class="tabs__tab" :aria-current="tab === 'collection' ? 'page' : undefined">
          Collection <span class="tabs__count">{{ copies.length }}</span>
        </NuxtLink>
        <NuxtLink :to="{ query: { tab: 'wishlist' } }" class="tabs__tab" :aria-current="tab === 'wishlist' ? 'page' : undefined">
          Wishlist <span class="tabs__count">{{ wishlist.length }}</span>
        </NuxtLink>
      </nav>

      <template v-if="tab === 'collection'">
        <div class="list-meta" style="text-transform: none; letter-spacing: 0">
          <div class="chips-row">
            <NuxtLink
              v-for="c in chips"
              :key="c.id"
              :to="{ query: c.id === 'all' ? {} : { status: c.id } }"
              class="chip"
              :aria-pressed="status === c.id"
            >{{ c.label }}<span class="chip__count">{{ c.n }}</span></NuxtLink>
          </div>
        </div>
        <div v-if="shown.length" class="copy-grid">
          <CopyCard v-for="c in shown" :key="c.id" :copy="c" :to="`/u/${username}/c/${c.id}`" :cover="c.photos[0]?.thumbUrl" />
        </div>
        <div v-else class="state" style="margin-block: 24px 64px">
          <span class="state__title">Nothing here yet</span>
          <p class="form-note">
            <template v-if="isMe">Copies show up here once they have an approved photo and are visible to everyone.</template>
            <template v-else>No public copies{{ status !== "all" ? " with this status" : "" }}.</template>
          </p>
        </div>
      </template>

      <template v-else>
        <div v-if="wishlist.length" class="copy-grid">
          <CatalogTile v-for="w in wishlist" :key="w.id" :card="w.model" :category="w.model.category" />
        </div>
        <div v-else class="state" style="margin-block: 24px 64px">
          <span class="state__title">Wishlist is empty</span>
        </div>
      </template>
    </template>
  </div>
</template>
