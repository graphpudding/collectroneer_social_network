<script setup lang="ts">
import { SECTIONS, SITE_NAME } from "#shared/catalog";

// Searching from any page lands on the catalog with ?q=.
const route = useRoute();
const section = computed(() => SECTIONS.find((s) => route.path.startsWith(`/${s.path}`)) ?? SECTIONS[0]!);
const q = ref(typeof route.query.q === "string" ? route.query.q : "");
watch(() => route.query.q, (v) => (q.value = typeof v === "string" ? v : ""));
const searchOpen = ref(false);
const me = useMe();
const unread = useUnread();
const menu = ref<HTMLDetailsElement>();
const closeMenu = () => menu.value?.removeAttribute("open");
watch(() => route.fullPath, closeMenu);
async function signOut() {
  await authClient.signOut();
  me.value = null;
  await navigateTo("/");
}
const accountPath = computed(() => (me.value ? "/collection" : { path: "/login", query: { next: route.fullPath } }));

function submit() {
  searchOpen.value = false;
  const query = { ...(route.path === `/${section.value.path}` ? route.query : {}), q: q.value.trim() || undefined, limit: undefined };
  navigateTo({ path: `/${section.value.path}`, query });
}
</script>

<template>
  <header class="site-header">
    <div class="page pad site-header__bar">
      <NuxtLink to="/" class="logo" :aria-label="SITE_NAME">
        <span class="logo__stripes" aria-hidden="true"><span /><span /><span /></span>
        <span class="logo__name">{{ SITE_NAME }}</span>
      </NuxtLink>
      <div class="site-header__desktop">
        <NuxtLink v-for="s in SECTIONS" :key="s.path" :to="`/${s.path}`" class="section-pill">{{ s.path.toUpperCase() }}</NuxtLink>
        <form class="header-search" role="search" @submit.prevent="submit">
          <UiIcon name="search" />
          <input v-model="q" type="search" name="q" :placeholder="`Search ${section.path}: Zenit E, Зенит, F1N…`" aria-label="Search the catalog" autocomplete="off" />
        </form>
        <template v-if="me">
          <NuxtLink to="/messages" class="icon-btn" :aria-label="unread ? `Messages, ${unread} unread` : 'Messages'">
            <UiIcon name="chat" /><span v-if="unread" class="badge-dot" />
          </NuxtLink>
          <details ref="menu" class="account-menu">
            <summary class="account-pill" :aria-label="`Account: @${me.username}`">
              <span class="avatar"><img v-if="me.image" :src="me.image" alt="" /><template v-else>{{ (me.username ?? "?")[0] }}</template></span>
              @{{ me.username }}
            </summary>
            <nav class="account-menu__list" @click="closeMenu">
              <NuxtLink to="/collection">My collection</NuxtLink>
              <NuxtLink to="/messages">Messages<span v-if="unread" class="badge-count">{{ unread }}</span></NuxtLink>
              <NuxtLink v-if="me.username" :to="`/u/${me.username}`">Public page</NuxtLink>
              <NuxtLink to="/settings">Settings</NuxtLink>
              <NuxtLink v-if="me.role === 'admin' || me.role === 'moderator'" to="/admin">Admin</NuxtLink>
              <button type="button" @click="signOut">Sign out</button>
            </nav>
          </details>
        </template>
        <template v-else>
          <NuxtLink :to="{ path: '/login', query: { next: route.fullPath } }" class="section-pill">LOG IN</NuxtLink>
          <NuxtLink to="/signup" class="btn btn--primary btn--sm">Join</NuxtLink>
        </template>
      </div>
      <div class="site-header__mobile">
        <button class="icon-btn" type="button" :aria-expanded="searchOpen" aria-label="Search" @click="searchOpen = !searchOpen">
          <UiIcon :name="searchOpen ? 'close' : 'search'" />
        </button>
        <NuxtLink v-if="me" to="/messages" class="icon-btn" :aria-label="unread ? `Messages, ${unread} unread` : 'Messages'">
          <UiIcon name="chat" /><span v-if="unread" class="badge-dot" />
        </NuxtLink>
        <NuxtLink :to="accountPath" class="icon-btn" :aria-label="me ? 'Account' : 'Log in'"><UiIcon name="user" /></NuxtLink>
      </div>
    </div>
    <div v-if="searchOpen" class="page pad site-header__drop">
      <form class="header-search" role="search" @submit.prevent="submit">
        <UiIcon name="search" />
        <input v-model="q" type="search" name="q" placeholder="Any spelling: Zenit E, Зенит, F1N…" aria-label="Search the catalog" autocomplete="off" autofocus />
      </form>
    </div>
  </header>
</template>
