<script setup lang="ts">
// Block / unblock a user. A blocked user can't message you; you stop seeing each other's copies in owner lists.
const props = defineProps<{ username: string }>();
const emit = defineEmits<{ change: [boolean] }>();
const me = useMe();
const { data: rows, refresh } = await useFetch<{ username: string }[]>("/api/blocks", {
  key: `block-${props.username}`,
  query: { username: props.username },
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
  immediate: !!me.value,
});
const blocked = computed(() => rows.value.length > 0);

async function toggle() {
  if (!blocked.value && !confirm(`Block @${props.username}? They won’t be able to message you.`)) return;
  await $fetch(`/api/blocks/${props.username}`, { method: blocked.value ? "DELETE" : "PUT" });
  await refresh();
  emit("change", blocked.value);
}
</script>

<template>
  <button v-if="me" type="button" class="link-quiet" @click="toggle">{{ blocked ? "Unblock" : "Block" }}</button>
</template>
