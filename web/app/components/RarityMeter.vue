<script setup lang="ts">
import type { Rarity } from "#shared/rarity";

const props = defineProps<{ rarity: Rarity }>();
const rated = computed(() => props.rarity.index != null);
const level = computed(() => (rated.value ? props.rarity.levels[props.rarity.index!] : null));
const n = computed(() => props.rarity.levels.length);
// Pointer sits in the middle of its level's segment.
const pointer = computed(() => `${((props.rarity.index ?? 0) + 0.5) / n.value * 100}%`);
const basisText = computed(() => {
  const b = props.rarity.basis;
  if (!b) return "";
  const num = b.production.toLocaleString("en-US");
  return b.kind === "stated" ? num : b.kind === "estimate" ? `≈ ${num}` : `≈ ${num} (middle of a range)`;
});
</script>

<template>
  <div class="rarity">
    <div class="rarity__head">
      <span class="label">Rarity</span>
      <span class="rarity__level">{{ level?.label ?? "Not rated" }}</span>
      <span v-if="rated" class="rarity__score">{{ rarity.index! + 1 }} / {{ n }}</span>
    </div>
    <div class="rarity__scale" :class="{ 'rarity__scale--off': !rated }" aria-hidden="true">
      <div class="rarity__ticks"><span v-for="t in 20" :key="t" :class="{ long: (t - 1) % 4 === 0 }" /></div>
      <span v-if="rated" class="rarity__pointer" :style="{ left: pointer }" />
    </div>
    <div v-if="rated" class="rarity__labels" :style="{ gridTemplateColumns: `repeat(${n}, 1fr)` }" aria-hidden="true">
      <span v-for="(l, i) in rarity.levels" :key="l.key" :class="{ on: i === rarity.index }">{{ l.label }}</span>
    </div>
    <p class="rarity__note">
      <template v-if="rated">Based on {{ basisText }} made.</template>
      <template v-else>Not enough data yet: no production figure.</template>
      <NuxtLink to="/about/rarity" class="u-link">How it’s rated</NuxtLink>
    </p>
  </div>
</template>
