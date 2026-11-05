<script setup lang="ts">
// First Google sign-in: the account exists but has no public username yet.
definePageMeta({ auth: true });
useSeoMeta({ title: "Pick a username", robots: "noindex, follow" });

const me = useMe();
if (me.value?.username) await navigateTo(nextPath("/"));

const username = ref("");
const ok = ref(false);
const error = ref("");
const busy = ref(false);

async function submit() {
  if (!ok.value || busy.value) return;
  busy.value = true;
  error.value = "";
  try {
    await $fetch("/api/me", { method: "PATCH", body: { username: username.value, name: "" } }); // the Google name stays private
    await loadMe(true);
    await navigateTo(nextPath("/"));
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Could not save. Try again.";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="page pad auth-page auth-page--single">
    <form class="auth-card" novalidate @submit.prevent="submit">
      <span class="kicker">▸ One more step</span>
      <h1 class="auth-card__title" style="font-size: 36px">Pick a username</h1>
      <p class="form-note">It’s your public address and how collectors see you. Your Google name and email stay private.</p>
      <UsernameField v-model="username" @ok="ok = $event" />
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn--primary btn--action" :disabled="!ok || busy">Continue</button>
    </form>
  </div>
</template>
