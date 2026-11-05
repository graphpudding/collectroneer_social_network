<script setup lang="ts">
import { PAGE_SIZE, sectionByPath, type CatalogList } from "#shared/catalog";
import { facetLabel } from "#shared/film-cameras";

const route = useRoute();
const router = useRouter();
const section = sectionByPath(String(route.params.section));
if (!section) throw createError({ statusCode: 404, statusMessage: "Not found", fatal: true });

// All state lives in the URL: shareable, survives reload, rendered on the server.
const values = (v: unknown) => (Array.isArray(v) ? v : [v]).filter((x): x is string => typeof x === "string" && !!x);
const first = (v: unknown) => values(v)[0] ?? "";

const q = computed(() => first(route.query.q));
const sort = computed(() => (first(route.query.sort) === "year" ? "year" : "az"));
const page = computed(() => Math.max(Math.floor(Number(first(route.query.page))) || 1, 1));
const selected = computed(() =>
  Object.fromEntries(section.filters.map((f) => [f.key, values(route.query[f.key])])),
);

const { data, status, error, refresh } = await useFetch<CatalogList>(`/api/catalog/${section.category}`, {
  query: computed(() => ({ q: q.value || undefined, sort: sort.value, page: page.value, ...selected.value })),
});

function setQuery(patch: Record<string, string | string[] | undefined>) {
  // Any change to search, sort or filters starts again from page 1.
  const query = { ...route.query, ...patch, page: undefined, limit: undefined };
  router.replace({ query: Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== "")) });
}

function toggle(key: string, value: string) {
  const cur = selected.value[key] ?? [];
  setQuery({ [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] });
}

const resetFilters = () => setQuery(Object.fromEntries(section.filters.map((f) => [f.key, undefined])));

const applied = computed(() =>
  section.filters.flatMap((f) => (selected.value[f.key] ?? []).map((v) => ({ key: f.key, value: v, label: facetLabel(f.key, v) }))),
);

// Lists longer than LONG_LIST (makers) collapse to the SHORT_LIST most common values.
const LONG_LIST = 15;
const SHORT_LIST = 10;
const expanded = ref<Record<string, boolean>>({});
const find = ref<Record<string, string>>({});
const toggleExpanded = (key: string) => (expanded.value = { ...expanded.value, [key]: !expanded.value[key] });

// Selected values stay listed even when the other filters leave them at zero.
const groups = computed(() =>
  section.filters.map((f) => {
    const counts = new Map((data.value?.facets[f.key] ?? []).map((o) => [o.value, o.count]));
    for (const v of selected.value[f.key] ?? []) if (!counts.has(v)) counts.set(v, 0);
    const options = [...counts]
      .map(([value, count]) => ({ value, count, label: facetLabel(f.key, value), on: (selected.value[f.key] ?? []).includes(value) }))
      .sort((a, b) => a.label.localeCompare(b.label, "en", { numeric: true }));
    const long = options.length > LONG_LIST;
    const open = long && !!expanded.value[f.key];
    const needle = (find.value[f.key] ?? "").trim().toLowerCase();
    const top = new Set([...options].sort((a, b) => b.count - a.count).slice(0, SHORT_LIST).map((o) => o.value));
    const shown = !long
      ? options
      : open
        ? options.filter((o) => o.on || !needle || o.label.toLowerCase().includes(needle))
        : options.filter((o) => o.on || top.has(o.value));
    return { ...f, options, shown, long, open };
  }).filter((g) => g.options.length),
);

const total = computed(() => data.value?.total ?? 0);
const countLabel = computed(() => `${total.value} ${total.value === 1 ? "camera" : "cameras"}`);
const pages = computed(() => Math.max(Math.ceil(total.value / PAGE_SIZE), 1));
// Back to the top of the list on a new page (the route stays the same, so Nuxt doesn't scroll).
const listTop = ref<HTMLElement>();
// An old link past the last page: back to the first one.
if (page.value > 1 && data.value && !data.value.items.length) {
  await navigateTo({ query: { ...route.query, page: undefined } }, { replace: true });
}
const rangeLabel = computed(() => {
  const from = (page.value - 1) * PAGE_SIZE + 1;
  return total.value > PAGE_SIZE ? `${from}–${Math.min(from + PAGE_SIZE - 1, total.value)} of ${total.value.toLocaleString("en-US")}` : "";
});
watch(page, () => listTop.value?.scrollIntoView({ block: "start" }));
const sheetOpen = ref(false);

useSeoMeta({
  title: section.title,
  description: `Catalog of ${section.title.toLowerCase()}: makers, years, specifications and who owns them.`,
  robots: computed(() => (q.value || applied.value.length ? "noindex, follow" : "index, follow")),
});
// Plain catalog pages are indexable on their own URL; searches and filters are not.
useHead({
  link: computed(() => {
    const base = `/${section.path}`;
    const at = (p: number) => (p === 1 ? base : `${base}?page=${p}`);
    return [
      { rel: "canonical" as const, href: at(page.value) },
      ...(page.value > 1 ? [{ rel: "prev" as const, href: at(page.value - 1) }] : []),
      ...(page.value < pages.value ? [{ rel: "next" as const, href: at(page.value + 1) }] : []),
    ];
  }),
});
</script>

<template>
  <div class="page">
    <div class="catalog-head pad">
      <div class="entry-title">
        <span class="kicker">▸ Catalog</span>
        <h1 class="display display--l">{{ section.title }}</h1>
      </div>
      <div class="catalog-head__meta">
        <span class="mono" style="font-size: 14px; font-weight: 600; letter-spacing: 0.04em" aria-live="polite">{{ countLabel.toUpperCase() }}</span>
        <div v-if="!q" class="segmented" role="group" aria-label="Sort">
          <button type="button" :aria-pressed="sort === 'az'" @click="setQuery({ sort: undefined })">A–Z</button>
          <button type="button" :aria-pressed="sort === 'year'" @click="setQuery({ sort: 'year' })">YEAR</button>
        </div>
      </div>
    </div>

    <div class="catalog-body">
      <aside class="catalog-sidebar" aria-label="Filters">
        <div class="filter-head">
          <span class="title" style="font-size: 16px; font-stretch: 125%">Filters</span>
          <button v-if="applied.length" type="button" class="u-link" style="font-size: 13px" @click="resetFilters">Reset</button>
        </div>
        <fieldset v-for="g in groups" :key="g.key" class="filter-group">
          <legend class="label" style="font-size: 11px">{{ g.label }}</legend>
          <input
            v-if="g.open"
            v-model="find[g.key]"
            type="search"
            class="filter-find"
            :placeholder="`Find ${g.label.toLowerCase()}`"
            :aria-label="`Find ${g.label.toLowerCase()}`"
          />
          <div :class="{ 'filter-scroll': g.open }">
            <label v-for="o in g.shown" :key="o.value" class="check" :class="{ 'check--empty': !o.count && !o.on }">
              <input type="checkbox" :checked="o.on" @change="toggle(g.key, o.value)" />
              <span class="check__box" aria-hidden="true" />
              <span class="check__label">{{ o.label }}</span>
              <span class="check__count">{{ o.count }}</span>
            </label>
          </div>
          <button v-if="g.long" type="button" class="u-link filter-more" @click="toggleExpanded(g.key)">
            {{ g.open ? "Show fewer" : `Show all ${g.options.length}` }}
          </button>
        </fieldset>
      </aside>

      <div ref="listTop" class="catalog-main pad">
        <div class="catalog-toolbar">
          <button type="button" class="filters-btn" @click="sheetOpen = true">
            FILTERS<span v-if="applied.length" class="filters-btn__n">{{ applied.length }}</span>
          </button>
          <button v-for="a in applied" :key="a.key + a.value" type="button" class="chip chip--applied" style="flex: none; height: 36px" @click="toggle(a.key, a.value)">
            {{ a.label }}<UiIcon name="close" />
          </button>
        </div>
        <div class="catalog-count">
          <span aria-hidden="true">{{ countLabel.toUpperCase() }}</span>
          <button v-if="!q" type="button" class="sort-toggle" @click="setQuery({ sort: sort === 'az' ? 'year' : undefined })">
            SORT: {{ sort === "az" ? "A–Z" : "YEAR" }} ↓
          </button>
        </div>

        <div v-if="q || applied.length" class="applied" :class="{ 'hide-mobile': !q }">
          <button v-if="q" type="button" class="chip chip--applied" @click="setQuery({ q: undefined })">“{{ q }}”<UiIcon name="close" /></button>
          <button v-for="a in applied" :key="a.key + a.value" type="button" class="chip chip--applied hide-mobile" @click="toggle(a.key, a.value)">
            {{ a.label }}<UiIcon name="close" />
          </button>
        </div>

        <div v-if="error" class="state">
          <span class="kicker">▸ Error</span>
          <span class="state__title">Couldn’t load the catalog</span>
          <span class="muted">Check your connection and try again.</span>
          <div class="state__actions"><button type="button" class="btn btn--sm" @click="() => refresh()">Try again</button></div>
        </div>

        <div v-else-if="!data && status === 'pending'" class="grid" aria-busy="true">
          <div v-for="n in 8" :key="n" class="skeleton">
            <div class="frame"><div class="frame__window" /></div>
            <div class="skeleton__lines"><span /><span /><span /></div>
          </div>
        </div>

        <template v-else-if="data">
          <div v-if="data.items.length" class="grid" :class="{ 'grid--dim': status === 'pending' }">
            <CatalogTile v-for="card in data.items" :key="card.id" :card="card" :category="section.category" />
          </div>
          <div v-else class="state">
            <span class="kicker">▸ 0 results</span>
            <span class="state__title">Nothing found</span>
            <span class="muted" style="max-width: 320px">
              No {{ section.path }}{{ q ? ` for “${q}”` : "" }}{{ applied.length ? " with these filters" : "" }}.
            </span>
            <div class="state__actions">
              <button v-if="applied.length" type="button" class="btn btn--sm" @click="resetFilters">Reset filters</button>
              <button v-if="q" type="button" class="btn btn--sm" @click="setQuery({ q: undefined })">Clear search</button>
            </div>
          </div>

          <PaginationNav :page="page" :pages="pages" />
          <p v-if="rangeLabel" class="pagination__range mono">{{ rangeLabel }}</p>
        </template>
      </div>
    </div>

    <template v-if="sheetOpen">
      <div class="sheet-backdrop" @click="sheetOpen = false" />
      <div class="sheet" role="dialog" aria-modal="true" aria-label="Filters">
        <div class="sheet__head">
          <span class="display">Filters</span>
          <div style="display: flex; gap: 16px; align-items: center">
            <button v-if="applied.length" type="button" class="u-link" @click="resetFilters">Reset</button>
            <button type="button" class="icon-btn" aria-label="Close" @click="sheetOpen = false"><UiIcon name="close" /></button>
          </div>
        </div>
        <div class="sheet__body">
          <div v-for="g in groups" :key="g.key" style="display: flex; flex-direction: column; gap: 8px">
            <span class="label" style="font-size: 11px">{{ g.label }}</span>
            <input
              v-if="g.open"
              v-model="find[g.key]"
              type="search"
              class="filter-find"
              :placeholder="`Find ${g.label.toLowerCase()}`"
              :aria-label="`Find ${g.label.toLowerCase()}`"
            />
            <div class="sheet__chips">
              <button
                v-for="o in g.shown"
                :key="o.value"
                type="button"
                class="chip"
                :class="{ 'chip--empty': !o.count && !o.on }"
                :aria-pressed="o.on"
                @click="toggle(g.key, o.value)"
              >
                {{ o.label }}<span class="chip__count">{{ o.count }}</span>
              </button>
            </div>
            <button v-if="g.long" type="button" class="u-link filter-more" @click="toggleExpanded(g.key)">
              {{ g.open ? "Show fewer" : `Show all ${g.options.length}` }}
            </button>
          </div>
        </div>
        <div class="sheet__foot">
          <button type="button" class="btn btn--primary" @click="sheetOpen = false">Show {{ countLabel }}</button>
        </div>
      </div>
    </template>
  </div>
</template>
