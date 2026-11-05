<script setup lang="ts">
import { displayName, thumbnail, years } from "#shared/catalog";
import { keyFacts } from "#shared/film-cameras";
import {
  CONDITIONS, CONDITION_LABELS, COPY_STATUSES, LIMITS, STATUS_LABELS, VISIBILITIES, VISIBILITY_LABELS, serialFit,
  type CollectionItem, type CopyFields, type ModelCard,
} from "#shared/collection";

// Step 2 of adding a copy, and the same screen for editing one.
const props = defineProps<{ model: ModelCard; copy?: CollectionItem }>();
const emit = defineEmits<{ change: [] }>();

const form = reactive<CopyFields>({
  status: props.copy?.status ?? "owned",
  edition: props.copy?.edition ?? "",
  serialNumber: props.copy?.serialNumber ?? "",
  hideSerial: props.copy?.hideSerial ?? false,
  condition: props.copy?.condition ?? null,
  acquired: props.copy?.acquired ?? "",
  note: props.copy?.note ?? "",
  visibility: props.copy?.visibility ?? "public",
});
const error = ref("");
const busy = ref(false);
const photos = ref(props.copy?.photos ?? []);
const photosPanel = ref<{ flush: (id: string) => Promise<void>; hasPending: () => boolean }>();

const modelMeta = computed(() => [...keyFacts(props.model.attributes), years(props.model)].filter(Boolean).join(" · "));
const fit = computed(() => serialFit(props.model.attributes, form.serialNumber));

async function save() {
  busy.value = true;
  error.value = "";
  try {
    const body = { ...form, catalogId: props.model.id };
    const saved = props.copy
      ? await $fetch<CollectionItem>(`/api/collection/${props.copy.id}`, { method: "PATCH", body })
      : await $fetch<CollectionItem>("/api/collection", { method: "POST", body });
    // Photos picked before the copy existed upload now; stay on the page if one fails.
    await photosPanel.value?.flush(saved.id);
    if (photosPanel.value?.hasPending()) {
      error.value = "Saved, but some photos didn’t upload. Remove or retry them.";
      if (!props.copy) await navigateTo(`/collection/${saved.id}`);
      return;
    }
    await navigateTo("/collection");
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? "Could not save. Try again.";
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!props.copy || !confirm(`Remove this ${displayName(props.model)} from your collection?`)) return;
  await $fetch(`/api/collection/${props.copy.id}`, { method: "DELETE" });
  await navigateTo("/collection");
}
</script>

<template>
  <form novalidate @submit.prevent="save">
    <div class="editor">
      <CopyPhotos ref="photosPanel" v-model="photos" :item-id="copy?.id" />

      <div class="editor__form">
        <div class="model-chip">
          <PhotoFrame :src="thumbnail(model.image_url, 330)" :alt="displayName(model)" empty-label="" />
          <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px">
            <span class="label" style="font-size: 11px">Model</span>
            <span class="copy__model" style="font-size: 20px">{{ displayName(model) }}</span>
            <span class="muted" style="font-size: 13px">{{ modelMeta }}</span>
          </div>
          <button type="button" class="u-link" style="background: none; border: 0; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer" @click="emit('change')">Change</button>
        </div>

        <label class="field">
          <span class="field__label">Finish, version, kit</span>
          <input v-model="form.edition" class="input" :maxlength="LIMITS.edition" placeholder="Chrome · Photomic DP-1 · 50mm f/1.4" />
        </label>

        <div class="field">
          <label class="field__label" for="serial">Serial number</label>
          <input id="serial" v-model="form.serialNumber" class="input mono" :maxlength="LIMITS.serial" style="font-size: 16px; font-weight: 600" />
          <span v-if="fit?.fits" class="field__hint field__hint--ok">Fits a known range ({{ fit.range!.year ?? `${fit.range!.from}–${fit.range!.to}` }})</span>
          <span v-else-if="fit && !fit.fits" class="field__hint">Outside the serial ranges we know. Double-check it, or it may be a rare one.</span>
          <label class="switch" style="padding-top: 4px; font-size: 14px">
            <input v-model="form.hideSerial" type="checkbox" />
            <span class="switch__track" aria-hidden="true" />
            Hide serial on my public page
          </label>
        </div>

        <div class="field">
          <span class="field__label">Condition</span>
          <div class="seg" role="group" aria-label="Condition" style="grid-template-columns: repeat(3, 1fr)">
            <button
              v-for="c in CONDITIONS"
              :key="c"
              type="button"
              :aria-pressed="form.condition === c"
              @click="form.condition = form.condition === c ? null : c"
            >{{ CONDITION_LABELS[c] }}</button>
          </div>
        </div>

        <div class="field">
          <span class="field__label">Status</span>
          <div class="chips-row" role="group" aria-label="Status">
            <button
              v-for="s in COPY_STATUSES"
              :key="s"
              type="button"
              class="status"
              :class="form.status === s ? `status--${s}` : ''"
              :aria-pressed="form.status === s"
              @click="form.status = s"
            >{{ STATUS_LABELS[s] }}</button>
          </div>
          <span v-if="form.status === 'for_sale' || form.status === 'for_trade'" class="field__hint">
            Collectors looking for this model will see it and can message you. Deals happen between you, not on Collectors Note.
          </span>
        </div>

        <label class="field">
          <span class="field__label">Acquired · optional</span>
          <input v-model="form.acquired" class="input" :maxlength="LIMITS.acquired" placeholder="2011 · Hamburg flea market" />
        </label>

        <label class="field">
          <span class="field__label">Note · optional</span>
          <textarea v-model="form.note" class="textarea" :maxlength="LIMITS.note" placeholder="Meter works, light brassing on the prism." />
        </label>

        <div class="field">
          <span class="field__label">Who can see this copy</span>
          <div class="seg" role="group" aria-label="Visibility" style="grid-template-columns: repeat(2, 1fr)">
            <button v-for="v in VISIBILITIES" :key="v" type="button" :aria-pressed="form.visibility === v" @click="form.visibility = v">
              {{ VISIBILITY_LABELS[v] }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <p v-if="error" class="form-error" role="alert" style="margin-top: 24px">{{ error }}</p>
    <div class="editor-foot">
      <button v-if="copy" type="button" class="link-danger" @click="remove">Remove from collection</button>
      <span class="editor-foot__note">Photos go public after review, usually within a day.</span>
      <button type="submit" class="btn btn--primary" :disabled="busy">{{ copy ? "Save changes" : "Add to my collection" }}</button>
    </div>
  </form>
</template>
