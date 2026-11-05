<script setup lang="ts">
import type { MyModelState } from "#shared/collection";

// "I own this / I want this" with what the signed-in user already has of the model.
const props = defineProps<{ catalogId: string }>();
const me = useMe();
const route = useRoute();

const { data: state, refresh } = await useFetch<MyModelState>(`/api/collection/model/${props.catalogId}`, {
  key: `my-model-${props.catalogId}`,
  headers: useRequestHeaders(["cookie"]),
  default: () => ({ copies: [], wanted: false }),
  watch: [() => me.value?.id],
});

const addPath = computed(() => ({ path: "/collection/add", query: { model: props.catalogId } }));
const login = (next: string) => navigateTo({ path: "/login", query: { next } });
const owned = computed(() => state.value.copies.length);
const busy = ref(false);

function own() {
  if (!me.value) return login(`/collection/add?model=${props.catalogId}`);
  navigateTo(addPath.value);
}

async function toggleWant() {
  if (!me.value) return login(route.fullPath);
  busy.value = true;
  try {
    await $fetch(`/api/wishlist/${props.catalogId}`, { method: state.value.wanted ? "DELETE" : "PUT" });
    await refresh();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <div class="actions">
      <button type="button" class="btn btn--primary btn--action" @click="own">
        {{ owned ? "Add another" : "I own this" }}
      </button>
      <button type="button" class="btn btn--action" :class="{ 'btn--dark': state.wanted }" :disabled="busy" :aria-pressed="state.wanted" @click="toggleWant">
        {{ state.wanted ? "✓ On my wishlist" : "I want this" }}
      </button>
    </div>
    <span class="actions-note">
      <template v-if="owned">
        You own {{ owned === 1 ? "a copy" : `${owned} copies` }} ·
        <NuxtLink :to="owned === 1 ? `/collection/${state.copies[0]!.id}` : '/collection'" class="u-link">{{ owned === 1 ? "Edit it" : "See them" }}</NuxtLink>
      </template>
      <template v-else-if="!me">Log in to add it to your collection or wishlist</template>
      <template v-else-if="state.wanted">On your wishlist. We’ll show who has one.</template>
      <template v-else>Add your copy or put it on your wishlist</template>
    </span>
  </div>
</template>
