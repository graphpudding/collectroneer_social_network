<script setup lang="ts">
import { BIO_MAX, CITY_MAX, NAME_MAX, profilePath, type Me } from "#shared/account";

definePageMeta({ auth: true });
useSeoMeta({ title: "Settings", robots: "noindex, follow" });

const me = useMe() as Ref<Me>;
const profile = reactive({
  username: me.value.username ?? "",
  name: me.value.name === me.value.username ? "" : me.value.name,
  bio: me.value.bio ?? "",
  city: me.value.city ?? "",
  isPrivate: me.value.isPrivate,
});
const usernameOk = ref(true);
const saved = ref("");
const error = ref("");
const busy = ref(false);
const usernameChanged = computed(() => profile.username.trim().toLowerCase() !== me.value.username);

async function saveProfile() {
  if (busy.value || (usernameChanged.value && !usernameOk.value)) return;
  busy.value = true;
  error.value = saved.value = "";
  try {
    me.value = await $fetch<Me>("/api/me", {
      method: "PATCH",
      body: { ...profile, username: usernameChanged.value ? profile.username : undefined, name: profile.name || profile.username },
    });
    saved.value = "Saved";
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Could not save. Try again.";
  } finally {
    busy.value = false;
  }
}

const pw = reactive({ current: "", next: "", message: "", ok: false });
async function changePassword() {
  pw.message = "";
  if (pw.next.length < 8) return (pw.message = "At least 8 characters");
  const { error: e } = await authClient.changePassword({ currentPassword: pw.current, newPassword: pw.next, revokeOtherSessions: true });
  pw.ok = !e;
  pw.message = e ? authErrorText(e) : "Password changed. Other devices were signed out.";
  if (!e) pw.current = pw.next = "";
}

const avatarInput = ref<HTMLInputElement>();
const avatarError = ref("");
async function uploadAvatar(file?: File) {
  avatarError.value = "";
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) return (avatarError.value = "Up to 20 MB");
  const data = new FormData();
  data.append("file", file);
  try {
    me.value = await $fetch<Me>("/api/me/avatar", { method: "POST", body: data });
  } catch (e: any) {
    avatarError.value = e?.data?.statusMessage ?? "Could not upload. Try another photo.";
  }
}
async function removeAvatar() {
  me.value = await $fetch<Me>("/api/me/avatar", { method: "DELETE" });
}

async function signOut() {
  await authClient.signOut();
  useMe().value = null;
  await navigateTo("/");
}

const { data: blocks, refresh: refreshBlocks } = await useFetch<{ username: string }[]>("/api/blocks", {
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
async function unblock(username: string) {
  await $fetch(`/api/blocks/${username}`, { method: "DELETE" });
  await refreshBlocks();
}

const confirmDelete = ref("");
const deleteError = ref("");
async function deleteAccount() {
  deleteError.value = "";
  try {
    await $fetch("/api/me", { method: "DELETE", body: { confirm: confirmDelete.value } });
    useMe().value = null;
    await navigateTo("/");
  } catch (e: any) {
    deleteError.value = e?.data?.statusMessage ?? "Could not delete. Try again.";
  }
}
</script>

<template>
  <div class="page pad settings">
    <div class="entry-title">
      <span class="kicker">▸ Account</span>
      <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">Settings</h1>
      <NuxtLink v-if="me.username" :to="profilePath(me.username)" class="u-link">Your public page: /u/{{ me.username }}</NuxtLink>
    </div>

    <form class="settings__section" novalidate @submit.prevent="saveProfile">
      <h2 class="title">Profile</h2>
      <div style="display: flex; align-items: center; gap: 20px; flex-wrap: wrap">
        <div class="profile-avatar" style="width: 96px; height: 96px">
          <span class="avatar"><img v-if="me.image" :src="me.image" alt="" /><template v-else>{{ (me.username ?? "?")[0] }}</template></span>
        </div>
        <div class="settings__actions">
          <button type="button" class="btn btn--sm" @click="avatarInput?.click()">{{ me.image ? "Change picture" : "Upload picture" }}</button>
          <button v-if="me.image" type="button" class="link-danger" @click="removeAvatar">Remove</button>
          <input ref="avatarInput" type="file" accept="image/jpeg,image/png,image/webp" hidden @change="uploadAvatar(($event.target as HTMLInputElement).files?.[0])" />
        </div>
        <p v-if="avatarError" class="field__hint field__hint--error" style="width: 100%">{{ avatarError }}</p>
      </div>
      <UsernameField v-if="usernameChanged" v-model="profile.username" @ok="usernameOk = $event" />
      <label v-else class="field">
        <span class="field__label">Username</span>
        <input v-model="profile.username" class="input" autocapitalize="none" spellcheck="false" maxlength="30" />
        <span class="field__hint">Changing it changes your public address.</span>
      </label>
      <div class="settings__row">
        <label class="field">
          <span class="field__label">Display name · optional</span>
          <input v-model="profile.name" class="input" :maxlength="NAME_MAX" placeholder="Shown instead of your username" />
        </label>
        <label class="field">
          <span class="field__label">City · optional</span>
          <input v-model="profile.city" class="input" :maxlength="CITY_MAX" placeholder="Only if you want it public" />
        </label>
      </div>
      <label class="field">
        <span class="field__label">Bio · optional <span>{{ profile.bio.length }} / {{ BIO_MAX }}</span></span>
        <textarea v-model="profile.bio" class="textarea" :maxlength="BIO_MAX" placeholder="What you collect, what you’re hunting for" />
      </label>
      <label class="switch">
        <input v-model="profile.isPrivate" type="checkbox" />
        <span class="switch__track" aria-hidden="true" />
        <span>
          <b>Closed account.</b>
          <span class="muted"> Your page and copies are hidden from everyone else; you won’t show up as an owner.</span>
        </span>
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="settings__actions">
        <button type="submit" class="btn btn--primary" :disabled="busy">Save profile</button>
        <span v-if="saved" class="muted">{{ saved }}</span>
      </div>
    </form>

    <section class="settings__section">
      <h2 class="title">Appearance</h2>
      <p class="form-note">Paper by day, darkroom by night. Auto follows your device.</p>
      <ThemeSwitch class="theme-switch--light" />
    </section>

    <section class="settings__section">
      <h2 class="title">Sign-in</h2>
      <div class="field">
        <span class="field__label">Email</span>
        <span>{{ me.email }}</span>
        <span class="field__hint">Email confirmation and password reset by email are coming soon.</span>
      </div>
      <form v-if="me.hasPassword" class="settings__row" novalidate @submit.prevent="changePassword">
        <label class="field">
          <span class="field__label">Current password</span>
          <input v-model="pw.current" class="input" type="password" autocomplete="current-password" />
        </label>
        <label class="field">
          <span class="field__label">New password</span>
          <input v-model="pw.next" class="input" type="password" autocomplete="new-password" minlength="8" />
        </label>
        <div class="settings__actions">
          <button type="submit" class="btn btn--sm">Change password</button>
          <span v-if="pw.message" :class="pw.ok ? 'muted' : 'field__hint--error'">{{ pw.message }}</span>
        </div>
      </form>
      <p v-else class="form-note">You sign in with Google.</p>
      <div class="settings__actions">
        <button type="button" class="btn btn--sm" @click="signOut">Sign out</button>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="title">Blocked</h2>
      <p v-if="!blocks.length" class="form-note">You haven’t blocked anyone.</p>
      <div v-for="b in blocks" :key="b.username" class="settings__actions">
        <NuxtLink :to="`/u/${b.username}`" class="u-link">@{{ b.username }}</NuxtLink>
        <button type="button" class="link-quiet" @click="unblock(b.username)">Unblock</button>
      </div>
    </section>

    <section class="settings__section">
      <h2 class="title">Your data</h2>
      <p class="form-note">Download everything we store about you as a JSON file.</p>
      <div class="settings__actions"><a class="btn btn--sm" href="/api/me/export" download>Download my data</a></div>
      <div class="danger-zone">
        <b>Delete account</b>
        <p class="form-note">
          Removes your profile, collection, photos and messages for good. Type <b>{{ me.username }}</b> to confirm.
        </p>
        <input v-model="confirmDelete" class="input" autocapitalize="none" spellcheck="false" :placeholder="me.username ?? ''" />
        <p v-if="deleteError" class="field__hint field__hint--error">{{ deleteError }}</p>
        <div class="settings__actions">
          <button type="button" class="btn btn--sm" :disabled="confirmDelete.trim().toLowerCase() !== me.username" @click="deleteAccount">
            Delete my account
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
