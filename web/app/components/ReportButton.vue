<script setup lang="ts">
import { REPORT_REASONS, type ReportReason, type ReportTarget } from "#shared/admin";

// "Report" link with a small dialog. Signed-out users are sent to log in first.
const props = defineProps<{ targetType: ReportTarget; targetId: string; label?: string }>();
const me = useMe();
const route = useRoute();
const open = ref(false);
const reason = ref<ReportReason | "">("");
const details = ref("");
const state = ref<"idle" | "sending" | "sent">("idle");
const error = ref("");

function start() {
  if (!me.value) return navigateTo({ path: "/login", query: { next: route.fullPath } });
  open.value = true;
}
async function send() {
  if (!reason.value) return;
  state.value = "sending";
  error.value = "";
  try {
    await $fetch("/api/reports", { method: "POST", body: { targetType: props.targetType, targetId: props.targetId, reason: reason.value, details: details.value } });
    state.value = "sent";
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Could not send";
    state.value = "idle";
  }
}
</script>

<template>
  <button type="button" class="link-quiet" @click="start">{{ label ?? "Report" }}</button>
  <template v-if="open">
    <div class="sheet-backdrop" @click="open = false" />
    <div class="dialog auth-card" role="dialog" aria-label="Report">
      <template v-if="state === 'sent'">
        <h2 class="auth-card__title">Thanks</h2>
        <p class="form-note">A moderator will look at it. We don’t tell the other person who reported them.</p>
        <button type="button" class="btn" @click="open = false">Close</button>
      </template>
      <form v-else novalidate style="display: contents" @submit.prevent="send">
        <h2 class="auth-card__title">Report</h2>
        <div class="field">
          <span class="field__label">What’s wrong</span>
          <label v-for="(text, key) in REPORT_REASONS" :key="key" class="agree" style="font-size: 15px">
            <input v-model="reason" type="radio" :value="key" name="reason" /><span class="check__box" aria-hidden="true" />{{ text }}
          </label>
        </div>
        <label class="field">
          <span class="field__label">Details · optional</span>
          <textarea v-model="details" class="textarea" maxlength="1000" />
        </label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="settings__actions">
          <button type="submit" class="btn btn--primary" :disabled="!reason || state === 'sending'">Send report</button>
          <button type="button" class="btn" @click="open = false">Cancel</button>
        </div>
      </form>
    </div>
  </template>
</template>
