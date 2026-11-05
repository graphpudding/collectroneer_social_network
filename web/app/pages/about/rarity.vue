<script setup lang="ts">
import { sectionByCategory } from "#shared/catalog";
import type { RarityLevel } from "#shared/rarity";

const { data: scales } = await useFetch<{ category: string; levels: RarityLevel[]; method_version: number }[]>("/api/rarity");

const range = (levels: RarityLevel[], i: number) => {
  const n = (x: number) => x.toLocaleString("en-US");
  const min = levels[i]!.min_production;
  const above = levels[i - 1]?.min_production;
  if (above == null) return `${n(min)} or more`;
  if (min === 0) return `fewer than ${n(above)}`;
  return `${n(min)} – ${n(above - 1)}`;
};

useSeoMeta({ title: "How rarity is rated", description: "How Collectors Note rates the rarity of a model." });
</script>

<template>
  <div class="page pad prose">
    <span class="kicker">▸ About</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">How rarity is rated</h1>
    <p>
      Rarity says how hard a model is to come by. For now it rests on one number: how many were made,
      as stated by the sources linked on each model page. When a source gives a range, we rate by its middle.
      A variant is rated on its own production, never its base model’s: a special edition can be far rarer.
    </p>
    <p>Without a production figure a model stays <b>Not rated</b>. If you know one, suggest an edit with a source.</p>
    <p class="muted">
      Production is not survival: cheap cameras were thrown away, expensive ones kept. Once collections open,
      how often a model turns up among collectors here will move its rating by up to one level.
    </p>

    <section v-for="s in scales ?? []" :key="s.category" style="display: flex; flex-direction: column; gap: 12px; padding-top: 8px">
      <h2 class="title">{{ sectionByCategory(s.category)?.title ?? s.category }}</h2>
      <table class="scale-table">
        <thead><tr><th>Level</th><th>Made</th></tr></thead>
        <tbody>
          <tr v-for="(l, i) in s.levels" :key="l.key"><td>{{ l.label }}</td><td>{{ range(s.levels, i) }}</td></tr>
        </tbody>
      </table>
      <span class="caption">Method v{{ s.method_version }}</span>
    </section>
  </div>
</template>
