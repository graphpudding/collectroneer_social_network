<script setup lang="ts">
import { displayName } from "#shared/catalog";
import { CONDITION_LABELS, STATUS_LABELS, VISIBILITY_LABELS, type CollectionItem, type PublicCopy } from "#shared/collection";

// A copy as a print: the owner's photo with a white border, status in the corner.
const props = defineProps<{ copy: CollectionItem | PublicCopy; to: string; cover?: string | null }>();
// The owner's own card: shows visibility, hidden serials and an edit mark.
const own = computed(() => ("visibility" in props.copy ? props.copy : null));
const serial = computed(() => {
  if (own.value) return own.value.serialNumber ? `No. ${own.value.serialNumber}${own.value.hideSerial ? " (hidden)" : ""}` : "No serial yet";
  return props.copy.serialNumber ? `No. ${props.copy.serialNumber}` : null;
});
const line = computed(() => [serial.value, props.copy.condition && CONDITION_LABELS[props.copy.condition]].filter(Boolean).join(" · "));
</script>

<template>
  <NuxtLink :to="to" class="copy">
    <div class="print">
      <div v-if="cover" class="print__photo"><img :src="cover" :alt="displayName(copy.model)" loading="lazy" /></div>
      <div v-else class="print__photo print__photo--empty">
        <template v-if="own">+ Add photos<small>NOT PUBLIC UNTIL IT HAS ONE</small></template>
        <template v-else>No photo</template>
      </div>
      <span v-if="own" class="print__vis">{{ VISIBILITY_LABELS[own.visibility].toUpperCase() }}</span>
      <span v-else class="print__vis">{{ copy.photos.length }} {{ copy.photos.length === 1 ? "PHOTO" : "PHOTOS" }}</span>
      <span class="print__status status" :class="`status--${copy.status}`">{{ STATUS_LABELS[copy.status] }}</span>
      <span v-if="own" class="print__edit" aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      </span>
    </div>
    <div style="display: flex; flex-direction: column; gap: 4px">
      <span class="copy__model">{{ displayName(copy.model) }}</span>
      <span v-if="copy.edition" class="copy__edition">{{ copy.edition }}</span>
      <span v-if="line" class="copy__line">{{ line }}</span>
    </div>
  </NuxtLink>
</template>
