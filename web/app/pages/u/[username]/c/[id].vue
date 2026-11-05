<script setup lang="ts">
import { userDisplayName } from "#shared/account";
import { displayName, entryPath, thumbnail, years } from "#shared/catalog";
import { cameraTypeLabel } from "#shared/film-cameras";
import { CONDITIONS, CONDITION_LABELS, STATUS_LABELS, serialFit, type PublicCopy } from "#shared/collection";

const route = useRoute();
const username = String(route.params.username).toLowerCase();
const { data: copy, error } = await useFetch<PublicCopy>(`/api/users/${username}/copies/${route.params.id}`);
if (error.value || !copy.value) throw createError({ statusCode: 404, statusMessage: "Not found", fatal: true });
const c = computed(() => copy.value!);
const me = useMe();
const isMine = computed(() => me.value?.username === username);

const current = ref(0);
const photo = computed(() => c.value.photos[current.value]);
const fit = computed(() => serialFit(c.value.model.attributes, c.value.serialNumber));
const conditionIndex = computed(() => (c.value.condition ? CONDITIONS.indexOf(c.value.condition) : -1));
const modelLine = computed(() => [displayName(c.value.model), cameraTypeLabel(c.value.model.attributes), years(c.value.model)].filter(Boolean).join(" · "));
const messageLabel = computed(() =>
  c.value.status === "for_trade" ? "Message about trade" : c.value.status === "for_sale" ? "Message about it" : "Message",
);

const title = computed(() => `${displayName(c.value.model)} · ${userDisplayName(c.value.owner)}`);
useSeoMeta({
  title,
  description: () => `${userDisplayName(c.value.owner)}’s ${displayName(c.value.model)}${c.value.edition ? `, ${c.value.edition}` : ""}.`,
  ogImage: () => photo.value?.fullUrl,
});
</script>

<template>
  <div class="page pad">
    <nav class="crumbs" aria-label="Breadcrumbs" style="padding-top: 22px">
      <NuxtLink :to="`/u/${username}`">{{ userDisplayName(c.owner) }}</NuxtLink><span>/</span>
      <NuxtLink :to="`/u/${username}`">Collection</NuxtLink><span>/</span>
      <span aria-current="page">{{ displayName(c.model) }}</span>
    </nav>
    <div class="copy-page">
      <div style="display: flex; flex-direction: column; gap: 16px">
        <div class="print copy-page__main">
          <div class="copy-page__photo"><img v-if="photo" :src="photo.fullUrl" :alt="displayName(c.model)" /></div>
          <span class="print__vis" style="left: 18px; bottom: 16px; font-size: 12px">{{ current + 1 }} / {{ c.photos.length }} · photo by @{{ username }}</span>
          <a v-if="photo" :href="photo.fullUrl" target="_blank" rel="noopener" class="copy-page__full mono">⤢ FULL SIZE</a>
        </div>
        <div v-if="c.photos.length > 1" class="copy-page__thumbs">
          <button
            v-for="(p, i) in c.photos"
            :key="p.id"
            type="button"
            class="print copy-page__thumb"
            :class="{ 'photo-tile--cover': i === current }"
            :aria-label="`Photo ${i + 1}`"
            @click="current = i"
          ><span class="print__photo"><img :src="p.thumbUrl" alt="" loading="lazy" /></span></button>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 22px">
        <div style="display: flex; flex-direction: column; gap: 10px">
          <span class="tag" style="align-self: flex-start">OWNER’S COPY</span>
          <h1 class="display" style="font-size: clamp(40px, 6vw, 76px); line-height: .88; margin: 0"><KeepWords :text="displayName(c.model)" /></h1>
          <span v-if="c.edition" style="font-size: 18px; font-weight: 600; color: var(--ink-muted)">{{ c.edition }}</span>
        </div>

        <NuxtLink :to="entryPath(c.model)" class="model-chip" style="color: var(--ink)">
          <PhotoFrame :src="thumbnail(c.model.image_url, 330)" :alt="displayName(c.model)" empty-label="" />
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
            <span class="label" style="font-size: 11px">In the catalog</span>
            <span style="font-size: 16px; font-weight: 700">{{ modelLine }}</span>
            <span class="muted" style="font-size: 13px">Specs, production, rarity</span>
          </div>
          <UiIcon name="back" style="transform: rotate(180deg)" />
        </NuxtLink>

        <dl class="copy-facts">
          <div><dt>Status</dt><dd><span class="status" :class="`status--${c.status}`" style="font-size: 14px; padding: 3px 10px">{{ STATUS_LABELS[c.status] }}</span></dd></div>
          <div v-if="c.serialNumber">
            <dt>Serial</dt>
            <dd>
              <span class="mono" style="font-size: 17px; font-weight: 600">No. {{ c.serialNumber }}</span>
              <span v-if="fit?.fits" class="field__hint field__hint--ok">Fits a known range ({{ fit.range!.year ?? `${fit.range!.from}–${fit.range!.to}` }})</span>
            </dd>
          </div>
          <div v-if="c.condition">
            <dt>Condition</dt>
            <dd>
              <b style="font-size: 16px">{{ CONDITION_LABELS[c.condition] }}</b>
              <span class="cond-scale" aria-hidden="true"><span v-for="(k, i) in CONDITIONS" :key="k" :class="{ on: i <= conditionIndex }" /></span>
            </dd>
          </div>
          <div v-if="c.acquired"><dt>Acquired</dt><dd style="font-weight: 600">{{ c.acquired }}</dd></div>
        </dl>

        <div v-if="c.note" style="display: flex; flex-direction: column; gap: 6px">
          <span class="label" style="font-size: 11px">Owner’s note</span>
          <p style="font-size: 17px; line-height: 1.6; margin: 0; white-space: pre-line">{{ c.note }}</p>
        </div>

        <div class="model-chip owner-card">
          <NuxtLink :to="`/u/${username}`" class="avatar" style="width: 52px; height: 52px; border: var(--border)">
            <img v-if="c.owner.image" :src="c.owner.image" alt="" /><template v-else>{{ username[0] }}</template>
          </NuxtLink>
          <NuxtLink :to="`/u/${username}`" style="flex: 1; min-width: 0; color: var(--ink); display: flex; flex-direction: column; gap: 2px">
            <b style="font-size: 16px">{{ userDisplayName(c.owner) }}</b>
            <span class="mono muted" style="font-size: 12px">@{{ username }}</span>
          </NuxtLink>
          <NuxtLink v-if="isMine" :to="`/collection/${c.id}`" class="btn btn--sm">Edit</NuxtLink>
          <NuxtLink v-else :to="{ path: '/messages', query: { to: username, copy: c.id } }" class="btn btn--primary btn--sm">{{ messageLabel }}</NuxtLink>
        </div>
        <div v-if="!isMine" class="quiet-actions">
          <ReportButton target-type="copy" :target-id="c.id" label="Report this copy" />
          <ReportButton v-if="photo" target-type="photo" :target-id="photo.id" label="Report this photo" />
        </div>
      </div>
    </div>
  </div>
</template>
