<script setup lang="ts">
import { userDisplayName } from "#shared/account";
import { CONDITION_LABELS, STATUS_LABELS, type ModelOwners } from "#shared/collection";

// "Who has it": counts for the model and its variants, then the public copies, trades first.
const props = defineProps<{ catalogId: string }>();
const { data } = await useFetch<ModelOwners>(`/api/collection/owners/${props.catalogId}`, {
  key: `owners-${props.catalogId}`,
  default: () => ({ owners: 0, wanted: 0, copies: [] }),
});
const counts = computed(() => {
  const { owners, wanted } = data.value;
  return [
    owners && `Owned by ${owners} ${owners === 1 ? "collector" : "collectors"}`,
    wanted && `wanted by ${wanted}`,
  ].filter(Boolean).join(" · ");
});
</script>

<template>
  <section class="owners">
    <div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap">
      <h2 class="title">Collectors</h2>
      <span v-if="counts" class="mono muted" style="font-size: 12px">{{ counts }}</span>
    </div>
    <div v-if="data.copies.length" class="owners__list">
      <NuxtLink v-for="c in data.copies" :key="c.id" :to="`/u/${c.owner.username}/c/${c.id}`" class="owners__item">
        <span class="print owners__thumb"><span class="print__photo"><img v-if="c.photos[0]" :src="c.photos[0].thumbUrl" alt="" loading="lazy" /></span></span>
        <span style="display: flex; flex-direction: column; gap: 3px; min-width: 0">
          <b class="owners__name">{{ userDisplayName(c.owner) }}</b>
          <span class="mono muted" style="font-size: 12px">{{ [c.edition, c.condition && CONDITION_LABELS[c.condition]].filter(Boolean).join(" · ") || `@${c.owner.username}` }}</span>
        </span>
        <span class="status" :class="`status--${c.status}`" style="margin-left: auto">{{ STATUS_LABELS[c.status] }}</span>
      </NuxtLink>
    </div>
    <p v-else class="form-note">
      {{ data.owners ? "Nobody shows their copy publicly yet." : "Be the first to add it to a collection." }}
    </p>
  </section>
</template>
