<script setup lang="ts">
import { usernameProblem } from "#shared/account";

// Username input with the live "available / taken" check against the server.
const model = defineModel<string>({ required: true });
const emit = defineEmits<{ ok: [boolean] }>();

const status = ref<{ ok: boolean; text: string } | null>(null);
let timer: ReturnType<typeof setTimeout> | undefined;

watch(model, (raw) => {
  const name = raw.trim().toLowerCase();
  clearTimeout(timer);
  emit("ok", false);
  if (!name) return (status.value = null);
  const local = usernameProblem(name);
  if (local) return (status.value = { ok: false, text: local });
  status.value = { ok: false, text: "Checking…" };
  timer = setTimeout(async () => {
    const r = await $fetch<{ available: boolean; problem: string | null }>("/api/username-available", { query: { u: name } });
    if (name !== model.value.trim().toLowerCase()) return;
    status.value = r.available
      ? { ok: true, text: `Available. Your public address: /u/${name}` }
      : { ok: false, text: r.problem ?? "Not available" };
    emit("ok", r.available);
  }, 350);
}, { immediate: true });
</script>

<template>
  <label class="field">
    <span class="field__label">Username</span>
    <input
      v-model="model"
      class="input"
      :class="{ 'input--error': status && !status.ok && status.text !== 'Checking…' }"
      autocomplete="username"
      autocapitalize="none"
      spellcheck="false"
      required
      maxlength="30"
      placeholder="annanovak"
    />
    <span v-if="status" class="field__hint" :class="status.ok ? 'field__hint--ok' : status.text === 'Checking…' ? '' : 'field__hint--error'">
      {{ status.text }}
    </span>
    <span v-else class="field__hint">Lowercase letters, digits, dot, dash or underscore. No real name needed.</span>
  </label>
</template>
