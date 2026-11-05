<script setup lang="ts">
import { displayName } from "#shared/catalog";
import { EDITABLE_FIELDS, NEW_MODEL_REQUIRED, cleanChanges, emptyValue, fieldByPath, valueText, type CatalogEditRow } from "#shared/edits";
import type { ModelCard } from "#shared/collection";

// Suggest a correction (?model=), a duplicate (?model=&kind=merge) or a new model (no model).
definePageMeta({ auth: true });
useSeoMeta({ title: "Suggest a change", robots: "noindex, follow" });

const route = useRoute();
const model = ref<ModelCard | null>(typeof route.query.model === "string" ? await fetchModelCard(route.query.model) : null);
const kind = ref<"edit" | "new_model" | "merge">(model.value ? (route.query.kind === "merge" ? "merge" : "edit") : "new_model");

// Changes as a list of { path, value } rows; new models start with maker and name.
const row = (path: string) => ({ path, value: emptyValue(fieldByPath(path)!) as any });
const rows = ref<{ path: string; value: any }[]>(kind.value === "new_model" ? NEW_MODEL_REQUIRED.map(row) : []);
const addPath = ref("");
const available = computed(() => EDITABLE_FIELDS.filter((f) => !rows.value.some((r) => r.path === f.path)));
function addRow() {
  if (!addPath.value) return;
  rows.value.push(row(addPath.value));
  addPath.value = "";
}
const currentValue = (path: string) => {
  const m = model.value as any;
  if (!m) return null;
  return path.startsWith("attributes.") ? m.attributes?.[path.slice(11)] : m[path];
};

const mergeInto = ref<ModelCard | null>(null);
const picking = ref(false);
const source = ref("");
const note = ref("");
const error = ref("");
const sent = ref(false);
const busy = ref(false);

function changesObject() {
  const raw = Object.fromEntries(rows.value.map((r) => [r.path, r.value]));
  return cleanChanges(raw); // same checks as the server; throws a readable message
}

async function submit() {
  error.value = "";
  busy.value = true;
  try {
    const body =
      kind.value === "merge"
        ? { kind: "merge", catalogId: model.value!.id, changes: { into: mergeInto.value?.id }, source: source.value, note: note.value }
        : { kind: kind.value, catalogId: model.value?.id, changes: changesObject(), source: source.value, note: note.value };
    if (kind.value === "merge" && !mergeInto.value) throw new Error("Pick the model it duplicates");
    await $fetch("/api/edits", { method: "POST", body });
    sent.value = true;
    await refreshMine();
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.message ?? "Could not send";
  } finally {
    busy.value = false;
  }
}

const { data: mine, refresh: refreshMine } = await useFetch<CatalogEditRow[]>("/api/edits/mine", {
  headers: useRequestHeaders(["cookie"]),
  default: () => [],
});
const STATUS: Record<string, string> = { proposed: "Waiting for review", approved: "Approved", rejected: "Not accepted" };
</script>

<template>
  <div class="page pad settings">
    <div class="entry-title">
      <span class="kicker">▸ Catalog</span>
      <h1 class="display" style="font-size: clamp(32px, 5vw, 52px)">
        {{ kind === "new_model" ? "Suggest a new model" : kind === "merge" ? "Report a duplicate" : "Suggest an edit" }}
      </h1>
      <p v-if="model" class="form-note">For <NuxtLink :to="`/cameras/x-${model.id.split(':')[1]}`" class="u-link">{{ displayName(model) }}</NuxtLink>. A moderator checks every change before it goes live.</p>
      <p v-else class="form-note">Add a camera the catalog doesn’t have yet. A moderator checks it first; then you can add your copy.</p>
    </div>

    <div v-if="sent" class="state">
      <span class="state__title">Thank you</span>
      <p class="form-note">Your suggestion is in the queue. You’ll see its status below.</p>
      <div class="state__actions">
        <NuxtLink v-if="model" :to="`/cameras/x-${model.id.split(':')[1]}`" class="btn btn--sm">Back to the model</NuxtLink>
        <NuxtLink to="/cameras" class="btn btn--sm">Catalog</NuxtLink>
      </div>
    </div>

    <form v-else class="settings__section" novalidate @submit.prevent="submit">
      <div v-if="model" class="chips-row">
        <button type="button" class="chip" :aria-pressed="kind === 'edit'" @click="kind = 'edit'">Fix or add details</button>
        <button type="button" class="chip" :aria-pressed="kind === 'merge'" @click="kind = 'merge'">It’s a duplicate</button>
      </div>

      <template v-if="kind === 'merge'">
        <p class="form-note">The same camera is in the catalog twice. Pick the other record; copies move there.</p>
        <div v-if="mergeInto" class="model-chip">
          <span style="flex: 1"><span class="label" style="font-size: 11px">Duplicate of</span><br /><b>{{ displayName(mergeInto) }}</b></span>
          <button type="button" class="link-quiet" @click="picking = true">Change</button>
        </div>
        <button v-else-if="!picking" type="button" class="btn btn--sm" @click="picking = true">Pick the model</button>
        <ModelPicker v-if="picking" @pick="(m) => { mergeInto = m; picking = false; }" />
      </template>

      <template v-else>
        <div v-for="(r, i) in rows" :key="r.path" class="field">
          <span class="field__label">
            {{ fieldByPath(r.path)!.label }}
            <button v-if="kind === 'edit' || !NEW_MODEL_REQUIRED.includes(r.path)" type="button" class="link-quiet" @click="rows.splice(i, 1)">Remove</button>
          </span>
          <span v-if="kind === 'edit'" class="field__hint">Now: {{ valueText(r.path, currentValue(r.path)) }}</span>
          <EditFieldInput v-model="r.value" :field="fieldByPath(r.path)!" />
        </div>
        <div class="settings__actions">
          <select v-model="addPath" class="input" style="width: auto; height: 40px" aria-label="Field to change">
            <option value="">{{ rows.length ? "Another field…" : "Pick a field to change…" }}</option>
            <option v-for="f in available" :key="f.path" :value="f.path">{{ f.label }}</option>
          </select>
          <button type="button" class="btn btn--sm" :disabled="!addPath" @click="addRow">Add</button>
        </div>
      </template>

      <label class="field">
        <span class="field__label">Source</span>
        <input v-model="source" class="input" maxlength="500" placeholder="A link, a book and page, or “my own copy”" />
        <span class="field__hint">Where the facts come from. Without one we can’t accept the change.</span>
      </label>
      <label class="field">
        <span class="field__label">Note for the moderator · optional</span>
        <textarea v-model="note" class="textarea" maxlength="1000" />
      </label>
      <p v-if="error" class="form-error" role="alert">{{ error }}</p>
      <div class="settings__actions">
        <button type="submit" class="btn btn--primary" :disabled="busy">Send suggestion</button>
      </div>
    </form>

    <section v-if="mine.length" class="settings__section">
      <h2 class="title">Your suggestions</h2>
      <div v-for="m in mine" :key="m.id" class="admin-card">
        <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: baseline">
          <b>{{ m.kind === "new_model" ? `New: ${m.changes.maker} ${m.changes.name}` : m.catalogName }}</b>
          <span class="tag">{{ STATUS[m.status] }}</span>
          <span class="mono muted" style="font-size: 12px; margin-left: auto">{{ new Date(m.createdAt).toLocaleDateString("en-GB") }}</span>
        </div>
        <span v-if="m.kind === 'merge'" class="form-note">Duplicate of {{ m.mergeInto?.name }}</span>
        <span v-for="(v, path) in (m.kind === 'edit' ? m.changes : {})" :key="path" class="form-note">{{ fieldByPath(String(path))?.label }}: {{ valueText(String(path), v) }}</span>
        <span v-if="m.reviewNote" class="form-note">Moderator: {{ m.reviewNote }}</span>
        <NuxtLink v-if="m.resultPath" :to="m.resultPath" class="u-link">Open the new model</NuxtLink>
      </div>
    </section>
  </div>
</template>
