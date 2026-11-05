<script setup lang="ts">
import { profilePath, type Me } from "#shared/account";
import type { CollectionItem, WishlistItem } from "#shared/collection";

definePageMeta({ auth: true });
useSeoMeta({ title: "My collection", robots: "noindex, follow" });

const me = useMe() as Ref<Me>;
const route = useRoute();
const tab = computed(() => (route.query.tab === "wishlist" ? "wishlist" : "collection"));

const { data, refresh } = await useFetch<{ copies: CollectionItem[]; wishlist: WishlistItem[] }>("/api/collection", {
  headers: useRequestHeaders(["cookie"]),
  default: () => ({ copies: [], wishlist: [] }),
});
const copies = computed(() => data.value.copies);
const summary = computed(() => {
  const c = copies.value;
  const pub = c.filter((x) => x.visibility === "public").length;
  return [`${c.length} ${c.length === 1 ? "copy" : "copies"}`, pub && `${pub} public`, c.length - pub && `${c.length - pub} only me`]
    .filter(Boolean).join(" · ");
});

async function unwant(item: WishlistItem) {
  await $fetch(`/api/wishlist/${item.catalogId}`, { method: "DELETE" });
  await refresh();
}
</script>

<template>
  <div class="page pad">
    <ProfileHead :user="me" kicker="This is your page">
      <template #bio>
        <p v-if="me.bio" class="profile-head__bio">{{ me.bio }}</p>
        <p v-else class="profile-head__bio">No bio yet. <NuxtLink to="/settings" class="u-link">Add one</NuxtLink></p>
      </template>
      <NuxtLink to="/settings" class="btn">Edit profile</NuxtLink>
      <NuxtLink to="/collection/add" class="btn btn--primary">+ Add to collection</NuxtLink>
    </ProfileHead>

    <nav class="tabs" aria-label="Collection">
      <NuxtLink to="/collection" class="tabs__tab" :aria-current="tab === 'collection' ? 'page' : undefined">
        Collection <span class="tabs__count">{{ copies.length }}</span>
      </NuxtLink>
      <NuxtLink :to="{ query: { tab: 'wishlist' } }" class="tabs__tab" :aria-current="tab === 'wishlist' ? 'page' : undefined">
        Wishlist <span class="tabs__count">{{ data.wishlist.length }}</span>
      </NuxtLink>
    </nav>

    <template v-if="tab === 'collection'">
      <div class="list-meta">
        <span>{{ summary }}</span>
        <span v-if="me.isPrivate" class="list-meta__warn">· Closed account: nobody else sees these</span>
        <span style="margin-left: auto">Recently added first</span>
      </div>
      <div class="copy-grid">
        <NuxtLink to="/collection/add" class="add-tile">
          <span class="add-tile__plus">+</span>
          <span class="add-tile__title">Add to collection</span>
          <span class="form-note">Pick a model from the catalog</span>
        </NuxtLink>
        <CopyCard v-for="c in copies" :key="c.id" :copy="c" :to="`/collection/${c.id}`" :cover="c.photos[0]?.thumbUrl" />
      </div>
    </template>

    <template v-else>
      <div class="list-meta"><span>Models you’re hunting for. Owners who list one for trade or sale will show up on the model page.</span></div>
      <div v-if="data.wishlist.length" class="copy-grid">
        <div v-for="w in data.wishlist" :key="w.id" style="display: flex; flex-direction: column; gap: 8px">
          <CatalogTile :card="w.model" :category="w.model.category" />
          <button type="button" class="link-danger" style="align-self: flex-start; font-size: 13px" @click="unwant(w)">Remove from wishlist</button>
        </div>
      </div>
      <div v-else class="state" style="margin-block: 24px 64px">
        <span class="state__title">Nothing on your wishlist</span>
        <p class="form-note">Find a model in the catalog and press “I want this”.</p>
        <div class="state__actions"><NuxtLink to="/cameras" class="btn btn--sm">Browse cameras</NuxtLink></div>
      </div>
    </template>
    <p v-if="me.username" class="form-note" style="padding-bottom: 48px">
      Public page: <NuxtLink :to="profilePath(me.username)" class="u-link">/u/{{ me.username }}</NuxtLink>
    </p>
  </div>
</template>
