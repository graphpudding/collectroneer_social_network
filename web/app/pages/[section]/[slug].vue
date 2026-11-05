<script setup lang="ts">
import {
  displayName,
  entryPath,
  licenseUrl,
  numberFromSlug,
  sectionByPath,
  thumbnail,
  years,
  type CatalogCard,
  type CatalogDetail,
  type CatalogEntry,
  type SerialRange,
} from "#shared/catalog";
import { cameraTypeLabel, keyFacts, specGroups } from "#shared/film-cameras";
import { sourceList, sourceNames, sourceNo } from "#shared/sources";

definePageMeta({ ownMobileHeader: true });

const route = useRoute();
const section = sectionByPath(String(route.params.section));
const number = numberFromSlug(String(route.params.slug));
if (!section || !number) throw createError({ statusCode: 404, statusMessage: "Not found", fatal: true });

const { data, error } = await useFetch<{ found: CatalogDetail } | { mergedInto: CatalogEntry }>(
  `/api/catalog/${section.category}/${number}`,
);
if (error.value || !data.value) {
  throw createError({ statusCode: error.value?.statusCode ?? 500, statusMessage: "Not found", fatal: true });
}
// Merged records and outdated slugs both land on the one canonical URL.
if ("mergedInto" in data.value) {
  await navigateTo(entryPath(data.value.mergedInto), { redirectCode: 301 });
}
const detail = computed(() => ("found" in data.value! ? data.value.found : null));
const entry = computed(() => detail.value!.entry);
const canonical = computed(() => entryPath(entry.value));
if (detail.value && route.path !== canonical.value) {
  await navigateTo(canonical.value, { redirectCode: 301 });
}

const title = computed(() => displayName(entry.value));
const facts = computed(() =>
  [...keyFacts(entry.value.attributes), years(entry.value), entry.value.country].filter((x): x is string => !!x),
);
const alsoKnownAs = computed(() => {
  const seen = new Set([title.value.toLowerCase(), entry.value.name.toLowerCase()]);
  return [...Object.values(entry.value.labels), ...entry.value.aliases].filter((n) => {
    const key = n.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
});

const sources = computed(() => sourceList(entry.value));
const srcNo = (field: string) => sourceNo(entry.value, sources.value, field);
const groups = computed(() => specGroups(entry.value));
const specCount = computed(() => groups.value.reduce((n, g) => n + g.rows.length, 0));

const production = computed(() => entry.value.production_count);
const productionText = computed(() => {
  const p = production.value;
  if (!p) return null;
  const n = (x: number) => x.toLocaleString("en-US");
  if (p.value != null) return n(p.value);
  if (p.min != null && p.max != null) return `${n(p.min)}–${n(p.max)}`;
  if (p.min != null) return `${n(p.min)}+`;
  return null;
});
const productionTag = computed(() => {
  const p = production.value;
  if (p?.value == null && p?.min != null) return "RANGE";
  return p?.basis === "estimate" || p?.basis === "estimated" ? "ESTIMATE" : "STATED";
});
const sourceTitle = (url: string) => {
  const s = sources.value.find((x) => x.url === url);
  return s ? `${s.name} — ${s.detail}` : new URL(url).hostname;
};

const serialRanges = computed(() => (entry.value.attributes.serial_ranges as SerialRange[] | undefined) ?? []);
const groupSpaced = (n: number | string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const serialYears = computed(() => {
  const ys = serialRanges.value.map((s) => s.year).filter((y): y is number => !!y);
  return ys.length ? `${Math.min(...ys)}–${Math.max(...ys)}` : years(entry.value);
});

// Family: the base model, this model and its variants, in production order.
const family = computed(() => {
  const d = detail.value!;
  const base = d.variantOf[0];
  const self: CatalogCard = { ...entry.value, variant_of_name: base?.name ?? null };
  const members = [...(base ? [base] : []), self, ...d.variants];
  return members.length > 1 ? members : [];
});
const familyMeta = (c: CatalogCard) => {
  if (c.id === entry.value.id) return "This model";
  if (c.id === detail.value!.variantOf[0]?.id) return `Base model${years(c) ? ` · ${years(c)}` : ""}`;
  return `Variant${c.year_start ? ` · ${c.year_start}` : ""}`;
};

const image = computed(() => thumbnail(entry.value.image_url, 960));
const imagePage = computed(
  () => entry.value.source_urls.find((u) => u.startsWith("https://commons.wikimedia.org/wiki/File:")) ?? entry.value.image_url,
);
const isSparse = computed(() => !productionText.value && !serialRanges.value.length);

async function share() {
  const url = location.href;
  if (navigator.share) await navigator.share({ title: title.value, url }).catch(() => {});
  else await navigator.clipboard?.writeText(url);
}

useSeoMeta({
  title: () => `${title.value}${years(entry.value) ? ` (${years(entry.value)})` : ""}`,
  description: () => `${title.value}: ${facts.value.join(" · ")}. Specifications, production numbers, variants and owners.`,
  ogTitle: () => title.value,
  ogImage: () => image.value ?? undefined,
  ogType: "website",
});
useHead({ link: [{ rel: "canonical", href: () => canonical.value }] });
</script>

<template>
  <article v-if="detail" class="page">
    <div class="mobile-nav">
      <NuxtLink :to="`/${section.path}`" class="back"><UiIcon name="back" />{{ section.path.toUpperCase() }}</NuxtLink>
      <button type="button" class="icon-btn" aria-label="Share" @click="share"><UiIcon name="share" /></button>
    </div>
    <nav class="crumbs pad" aria-label="Breadcrumbs">
      <NuxtLink :to="`/${section.path}`">{{ section.path }}</NuxtLink><span aria-hidden="true">/</span>
      <NuxtLink :to="{ path: `/${section.path}`, query: { maker: entry.maker } }">{{ entry.maker }}</NuxtLink><span aria-hidden="true">/</span>
      <span aria-current="page">{{ entry.name }}</span>
    </nav>

    <div class="entry-top pad-desktop">
      <figure class="entry-photo" style="margin: 0">
        <PhotoFrame
          :src="image"
          :alt="title"
          big
          eager
          :empty-label="`${cameraTypeLabel(entry.attributes)?.toUpperCase() ?? 'CAMERA'} · NO PHOTO YET`"
        />
        <figcaption v-if="image" class="caption">
          Photo: <a :href="imagePage ?? undefined" rel="noopener" target="_blank">{{ entry.image_author ?? "unknown author" }}</a> ·
          <a v-if="licenseUrl(entry.image_license)" :href="licenseUrl(entry.image_license)!" rel="license noopener" target="_blank">{{ entry.image_license }}</a>
          <template v-else>{{ entry.image_license }}</template>
          <template v-if="imagePage?.includes('commons.wikimedia.org')"> · Wikimedia Commons</template>
        </figcaption>
      </figure>

      <div class="entry-info pad-mobile">
        <div class="entry-title">
          <span class="kicker">▸ {{ entry.maker }}</span>
          <h1 class="display display--xl"><KeepWords :text="title" /></h1>
          <div v-if="facts.length" class="facts">
            <span v-for="f in facts" :key="f" class="fact">{{ f }}</span>
          </div>
          <span v-if="detail.variantOf.length" class="badge" style="align-self: flex-start; font-size: 14px; padding: 4px 10px">
            Variant of
            <NuxtLink :to="entryPath({ ...detail.variantOf[0]!, category: entry.category })">{{ displayName(detail.variantOf[0]!) }}</NuxtLink>
          </span>
          <p v-if="alsoKnownAs.length" class="aka">Also known as {{ alsoKnownAs.join(", ") }}</p>
        </div>

        <ModelActions :catalog-id="entry.id" style="display: flex; flex-direction: column; gap: 10px" />

        <RarityMeter v-if="detail.rarity" :rarity="detail.rarity" />

        <div v-if="productionText" class="production">
          <div class="production__head">
            <span class="label">Production</span>
            <span class="tag">{{ productionTag }}</span>
          </div>
          <div class="production__figure">
            <span class="production__n">{{ productionTag === "ESTIMATE" ? "≈ " : "" }}{{ productionText }}</span>
            <span class="production__sub">made<template v-if="years(entry)"> · {{ years(entry) }}</template></span>
          </div>
          <details v-if="production?.source">
            <summary><span class="when-closed">Show source</span><span class="when-open">Hide source</span></summary>
            <blockquote v-if="production.source.quote">“{{ production.source.quote }}”</blockquote>
            <a :href="production.source.url" rel="noopener" target="_blank">{{ sourceTitle(production.source.url) }} ↗</a>
          </details>
        </div>
      </div>
    </div>

    <div class="entry-lower pad">
      <div class="accordion">
        <details v-if="groups.length" open>
          <summary>
            <span class="accordion__no">01</span>
            <span class="accordion__titles">
              <span class="accordion__title">Specifications</span>
              <span class="accordion__summary">{{ specCount }} {{ specCount === 1 ? "detail" : "details" }}</span>
            </span>
            <span class="accordion__sign" aria-hidden="true" />
          </summary>
          <div class="accordion__panel">
            <div class="specs">
              <div v-for="g in groups" :key="g.title" class="specs__group">
                <span class="label">{{ g.title }}</span>
                <dl v-for="r in g.rows" :key="r.label" class="spec">
                  <dt>{{ r.label }}</dt>
                  <dd>
                    <NuxtLink v-if="r.filter" :to="{ path: `/${section.path}`, query: { [r.filter.key]: r.filter.value } }">{{ r.value }}</NuxtLink>
                    <template v-else>{{ r.value }}</template>
                    <sup v-if="srcNo(r.field)">{{ srcNo(r.field) }}</sup>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </details>

        <details v-if="serialRanges.length">
          <summary>
            <span class="accordion__no">0{{ groups.length ? 2 : 1 }}</span>
            <span class="accordion__titles">
              <span class="accordion__title">Serial numbers</span>
              <span class="accordion__summary">{{ serialRanges.length }} {{ serialRanges.length === 1 ? "range" : "ranges" }}<template v-if="serialYears"> · {{ serialYears }}</template></span>
            </span>
            <span class="accordion__sign" aria-hidden="true" />
          </summary>
          <div class="accordion__panel serials">
            <div v-for="(s, i) in serialRanges" :key="i" class="serial">
              <span class="serial__range">{{ groupSpaced(s.from) }} – {{ groupSpaced(s.to) }}</span>
              <span class="serial__years">{{ s.year ?? "" }}</span>
              <span v-if="s.variant">{{ s.variant }}</span>
            </div>
          </div>
        </details>

        <details>
          <summary>
            <span class="accordion__no">0{{ 1 + (groups.length ? 1 : 0) + (serialRanges.length ? 1 : 0) }}</span>
            <span class="accordion__titles">
              <span class="accordion__title">Sources &amp; licenses</span>
              <span class="accordion__summary">{{ sourceNames(sources) }}</span>
            </span>
            <span class="accordion__sign" aria-hidden="true" />
          </summary>
          <div class="accordion__panel">
            <ol class="sources">
              <li v-for="s in sources" :key="s.url">
                <span class="src-no">{{ s.no }}</span>
                <a :href="s.url" rel="noopener" target="_blank">{{ s.name }} — {{ s.detail }}</a>
                <template v-if="s.license"> · {{ s.license }}</template>
              </li>
              <li v-if="entry.image_url" class="muted">Photo: {{ entry.image_author ?? "unknown author" }} · {{ entry.image_license }}</li>
              <li class="muted">Catalog record: {{ entry.data_license }}</li>
            </ol>
          </div>
        </details>
      </div>

      <div class="side">
        <ModelOwners :catalog-id="entry.id" />
        <section v-if="family.length" class="family">
          <h2 class="title">Family</h2>
          <div class="family__list">
            <NuxtLink
              v-for="c in family"
              :key="c.id"
              :to="entryPath({ ...c, category: entry.category })"
              class="family__item"
              :aria-current="c.id === entry.id ? 'page' : undefined"
            >
              <PhotoFrame :src="thumbnail(c.image_url, 330)" :alt="displayName(c)" empty-label="" />
              <span class="family__name"><KeepWords :text="displayName(c)" /></span>
              <span class="family__meta">{{ familyMeta(c) }}</span>
            </NuxtLink>
          </div>
        </section>
        <div class="edit-box">
          <span class="edit-box__title">{{ isSparse ? "Know more about this camera?" : "Know this camera well?" }}</span>
          <p v-if="isSparse">No production figure or serial ranges yet. Edits will be checked by moderators.</p>
          <p v-else>Spotted a wrong fact or a missing serial range? Edits will be checked by moderators.</p>
          <span class="quiet-actions">
            <NuxtLink :to="{ path: '/suggest', query: { model: entry.id } }" class="u-link" style="font-weight: 600">Suggest an edit</NuxtLink>
            <NuxtLink :to="{ path: '/suggest', query: { model: entry.id, kind: 'merge' } }" class="link-quiet">Report a duplicate</NuxtLink>
          </span>
        </div>
      </div>
    </div>
  </article>
</template>
