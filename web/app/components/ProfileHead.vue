<script setup lang="ts">
import { userDisplayName } from "#shared/account";

// Avatar, @username, name and bio; actions go in the default slot.
defineProps<{ user: { username: string | null; name: string; image: string | null; bio?: string | null; city?: string | null }; kicker?: string }>();
</script>

<template>
  <div class="profile-head">
    <div class="profile-avatar">
      <span class="avatar"><img v-if="user.image" :src="user.image" alt="" /><template v-else>{{ (user.username ?? "?")[0] }}</template></span>
    </div>
    <div class="profile-head__info">
      <span class="kicker">▸ @{{ user.username }}<template v-if="user.city"> · {{ user.city }}</template><template v-if="kicker"> · {{ kicker }}</template></span>
      <h1 class="profile-head__name">{{ userDisplayName(user) }}</h1>
      <slot name="bio"><p v-if="user.bio" class="profile-head__bio">{{ user.bio }}</p></slot>
    </div>
    <div class="profile-head__actions"><slot /></div>
  </div>
</template>
