<script setup lang="ts">
definePageMeta({ guestOnly: true });
useSeoMeta({ title: "Create account", robots: "noindex, follow" });

const next = nextPath("/");
const form = reactive({ email: "", username: "", password: "", agree: false });
const usernameOk = ref(false);
const showPassword = ref(false);
const error = ref("");
const busy = ref(false);

const passwordShort = computed(() => form.password.length > 0 && form.password.length < 8);
const canSubmit = computed(() => form.email && usernameOk.value && form.password.length >= 8 && form.agree && !busy.value);

async function submit() {
  if (!canSubmit.value) return;
  busy.value = true;
  error.value = "";
  const username = form.username.trim().toLowerCase();
  const { error: e } = await authClient.signUp.email({
    email: form.email.trim(),
    password: form.password,
    name: username,
    username,
  });
  busy.value = false;
  if (e) return (error.value = authErrorText(e));
  await loadMe(true);
  await navigateTo(next);
}
</script>

<template>
  <div class="page pad auth-page">
    <div class="auth-hero">
      <span class="kicker">▸ Join</span>
      <h1 class="auth-hero__title">Your collection, on the record.</h1>
      <p class="auth-hero__lead">Log every piece you own, list what you’re hunting for, and find the people who have it.</p>
    </div>
    <form class="auth-card" novalidate @submit.prevent="submit">
      <h2 class="auth-card__title">Create account</h2>
      <GoogleButton label="Continue with Google" :next="next" />
      <label class="field">
        <span class="field__label">Email</span>
        <input v-model="form.email" class="input" type="email" autocomplete="email" required placeholder="you@example.com" />
        <span class="field__hint">Never shown to anyone.</span>
      </label>
      <UsernameField v-model="form.username" @ok="usernameOk = $event" />
      <label class="field">
        <span class="field__label">Password</span>
        <span class="input-wrap">
          <input
            v-model="form.password"
            class="input"
            :class="{ 'input--error': passwordShort }"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="new-password"
            required
            minlength="8"
          />
          <button type="button" class="input-wrap__btn" @click="showPassword = !showPassword">{{ showPassword ? "HIDE" : "SHOW" }}</button>
        </span>
        <span class="field__hint" :class="{ 'field__hint--error': passwordShort }">At least 8 characters</span>
      </label>
      <label class="agree">
        <input v-model="form.agree" type="checkbox" />
        <span class="check__box" aria-hidden="true" />
        <span>
          I agree to the <NuxtLink to="/terms" class="u-link">terms</NuxtLink> and the
          <NuxtLink to="/photo-rules" class="u-link">photo rules</NuxtLink>: only my own photos, no AI, no filters.
        </span>
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <button type="submit" class="btn btn--primary btn--action" :disabled="!canSubmit">Create account</button>
      <p class="auth-switch">Have an account? <NuxtLink :to="{ path: '/login', query: $route.query }">Log in</NuxtLink></p>
    </form>
  </div>
</template>
