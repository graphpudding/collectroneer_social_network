<script setup lang="ts">
definePageMeta({ guestOnly: true });
useSeoMeta({ title: "Log in", robots: "noindex, follow" });

const next = nextPath("/");
const form = reactive({ login: "", password: "" });
const showPassword = ref(false);
const error = ref("");
const forgot = ref(false);
const busy = ref(false);

// One field for email or username.
async function submit() {
  if (!form.login || !form.password || busy.value) return;
  busy.value = true;
  error.value = "";
  const login = form.login.trim();
  const { error: e } = login.includes("@")
    ? await authClient.signIn.email({ email: login, password: form.password })
    : await authClient.signIn.username({ username: login.toLowerCase(), password: form.password });
  busy.value = false;
  if (e) return (error.value = authErrorText(e));
  await loadMe(true);
  await navigateTo(next);
}
</script>

<template>
  <div class="page pad auth-page auth-page--single">
    <form class="auth-card" novalidate @submit.prevent="submit">
      <span class="kicker">▸ Welcome back</span>
      <h1 class="auth-card__title" style="font-size: 36px">Log in</h1>
      <label class="field">
        <span class="field__label">Email or username</span>
        <input v-model="form.login" class="input" autocomplete="username" autocapitalize="none" spellcheck="false" required />
      </label>
      <label class="field">
        <span class="field__label">Password <a href="#" @click.prevent="forgot = !forgot">Forgot?</a></span>
        <span class="input-wrap">
          <input
            v-model="form.password"
            class="input"
            :class="{ 'input--error': error }"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
          />
          <button type="button" class="input-wrap__btn" @click="showPassword = !showPassword">{{ showPassword ? "HIDE" : "SHOW" }}</button>
        </span>
        <span v-if="error" class="field__hint field__hint--error" role="alert">{{ error }}</span>
      </label>
      <p v-if="forgot" class="form-note">
        Password reset by email is coming soon. Until then, write to us from the address you signed up with
        and we’ll help: <NuxtLink to="/contact" class="u-link">contact</NuxtLink>.
      </p>
      <button type="submit" class="btn btn--primary btn--action" :disabled="busy">Log in</button>
      <GoogleButton label="Log in with Google" :next="next" place="bottom" />
      <p class="auth-switch">New here? <NuxtLink :to="{ path: '/signup', query: $route.query }">Create account</NuxtLink></p>
    </form>
  </div>
</template>
