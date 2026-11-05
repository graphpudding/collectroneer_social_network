<script setup lang="ts">
// Shown only when the server has Google keys.
// "top": above the email form with "or with email" under it; "bottom": after it, "or" above.
const props = withDefaults(defineProps<{ label: string; next: string; place?: "top" | "bottom" }>(), { place: "top" });
const { data: config } = await useAuthConfig();
const busy = ref(false);

async function go() {
  busy.value = true;
  await authClient.signIn.social({ provider: "google", callbackURL: props.next });
}
</script>

<template>
  <template v-if="config.google">
    <div v-if="place === 'bottom'" class="divider">OR</div>
    <button type="button" class="btn btn--plain btn--block" :disabled="busy" @click="go">{{ label }}</button>
    <div v-if="place === 'top'" class="divider">OR WITH EMAIL</div>
  </template>
</template>
