<script setup lang="ts">
import { MAX_PHOTOS, type CopyPhoto } from "#shared/collection";

// Photos of a copy. With an itemId uploads go straight to the server; without one (a copy
// being added) files wait in a queue and flush(newId) uploads them after the copy is saved.
const props = defineProps<{ itemId?: string }>();
const photos = defineModel<CopyPhoto[]>({ default: () => [] });

type Pending = { key: string; file: File; preview: string; progress: number; error: string };
const pending = ref<Pending[]>([]);
const error = ref("");
const dragId = ref<string | null>(null);
const input = ref<HTMLInputElement>();
const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 20 * 1024 * 1024;

const count = computed(() => photos.value.length + pending.value.length);

function add(files: FileList | File[]) {
  error.value = "";
  for (const file of Array.from(files)) {
    if (count.value >= MAX_PHOTOS) return void (error.value = `Up to ${MAX_PHOTOS} photos per copy`);
    if (!ACCEPT.split(",").includes(file.type)) { error.value = "Use JPG, PNG or WebP photos"; continue; }
    if (file.size > MAX_BYTES) { error.value = "Up to 20 MB per photo"; continue; }
    pending.value.push({ key: `${file.name}-${file.size}-${Math.random()}`, file, preview: URL.createObjectURL(file), progress: 0, error: "" });
  }
  if (props.itemId) void flush(props.itemId);
}

function upload(itemId: string, p: Pending) {
  return new Promise<CopyPhoto[]>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/api/collection/${itemId}/photos`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) p.progress = Math.round((e.loaded / e.total) * 100); };
    xhr.onload = () => {
      const body = (() => { try { return JSON.parse(xhr.responseText); } catch { return null; } })();
      xhr.status < 300 ? resolve(body) : reject(new Error(body?.statusMessage ?? "Upload failed"));
    };
    xhr.onerror = () => reject(new Error("Upload failed. Check your connection."));
    const data = new FormData();
    data.append("file", p.file);
    xhr.send(data);
  });
}

let flushing: Promise<void> | null = null;
/** Uploads queued files one by one; failed ones stay with their error. */
async function flush(itemId: string) {
  if (flushing) return flushing;
  flushing = (async () => {
    for (const p of [...pending.value]) {
      if (p.error) continue;
      try {
        photos.value = await upload(itemId, p);
        URL.revokeObjectURL(p.preview);
        pending.value = pending.value.filter((x) => x !== p);
      } catch (e: any) {
        p.error = e.message;
      }
    }
  })();
  await flushing;
  flushing = null;
}
defineExpose({ flush, hasPending: () => pending.value.length > 0 });

function dropPending(p: Pending) {
  URL.revokeObjectURL(p.preview);
  pending.value = pending.value.filter((x) => x !== p);
}

async function remove(photo: CopyPhoto) {
  if (!props.itemId) return;
  photos.value = await $fetch<CopyPhoto[]>(`/api/collection/${props.itemId}/photos/${photo.id}`, { method: "DELETE" });
}

async function reorder(ids: string[]) {
  if (!props.itemId) return;
  const before = photos.value;
  photos.value = ids.map((id) => before.find((p) => p.id === id)!);
  try {
    photos.value = await $fetch<CopyPhoto[]>(`/api/collection/${props.itemId}/photos/order`, { method: "PUT", body: { ids } });
  } catch {
    photos.value = before;
  }
}
const makeCover = (photo: CopyPhoto) => reorder([photo.id, ...photos.value.filter((p) => p !== photo).map((p) => p.id)]);

function onDrop(target: CopyPhoto) {
  const from = dragId.value;
  dragId.value = null;
  if (!from || from === target.id) return;
  const ids = photos.value.map((p) => p.id).filter((id) => id !== from);
  ids.splice(ids.indexOf(target.id), 0, from);
  void reorder(ids);
}

function label(p: CopyPhoto, i: number) {
  if (p.status === "rejected") return `REJECTED${p.rejectReason ? ` · ${p.rejectReason.toUpperCase()}` : ""}`;
  return [i === 0 && "★ COVER", p.status === "pending" && "IN REVIEW"].filter(Boolean).join(" · ");
}

onBeforeUnmount(() => pending.value.forEach((p) => URL.revokeObjectURL(p.preview)));
</script>

<template>
  <div style="display: flex; flex-direction: column; gap: 18px">
    <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px">
      <h2 class="title">Photos</h2>
      <span class="mono muted" style="font-size: 12px">{{ count }} / {{ MAX_PHOTOS }}<template v-if="photos.length > 1"> · DRAG TO REORDER</template></span>
    </div>
    <div class="photo-grid">
      <div
        v-for="(p, i) in photos"
        :key="p.id"
        class="print photo-tile"
        :class="{ 'photo-tile--cover': i === 0, 'photo-tile--rejected': p.status === 'rejected', 'photo-tile--drag': dragId === p.id }"
        :draggable="!!itemId"
        @dragstart="dragId = p.id"
        @dragend="dragId = null"
        @dragover.prevent
        @drop.prevent="onDrop(p)"
      >
        <div class="print__photo"><img :src="p.thumbUrl" alt="" loading="lazy" /></div>
        <span class="photo-tile__label" :class="{ 'photo-tile__label--hot': i === 0 || p.status === 'rejected' }">{{ label(p, i) }}</span>
        <button v-if="i > 0" type="button" class="photo-tile__cover" @click="makeCover(p)">Make cover</button>
        <button type="button" class="photo-tile__remove" aria-label="Remove photo" @click="remove(p)">✕</button>
      </div>
      <div v-for="p in pending" :key="p.key" class="print photo-tile" :class="{ 'photo-tile--rejected': p.error }">
        <div class="print__photo" style="opacity: .5"><img :src="p.preview" alt="" /></div>
        <div v-if="!p.error && itemId" class="photo-tile__bar"><span :style="{ width: `${p.progress}%` }" /></div>
        <span class="photo-tile__label" :class="{ 'photo-tile__label--hot': p.error }">
          {{ p.error ? p.error.toUpperCase() : itemId ? `UPLOADING ${p.progress}%` : "UPLOADS WHEN SAVED" }}
        </span>
        <button type="button" class="photo-tile__remove" aria-label="Remove photo" @click="dropPending(p)">✕</button>
      </div>
      <button
        v-if="count < MAX_PHOTOS"
        type="button"
        class="add-tile photo-drop"
        @click="input?.click()"
        @dragover.prevent
        @drop.prevent="add(($event as DragEvent).dataTransfer?.files ?? [])"
      >
        <span class="add-tile__plus">+</span>
        <span style="font-size: 14px; font-weight: 700">Drop photos or browse</span>
        <span class="mono" style="font-size: 10px; color: var(--ink-muted)">JPG, PNG, WEBP · UP TO 20 MB</span>
      </button>
    </div>
    <input ref="input" type="file" :accept="ACCEPT" multiple hidden @change="add(($event.target as HTMLInputElement).files ?? []); ($event.target as HTMLInputElement).value = ''" />
    <p v-if="error" class="field__hint field__hint--error">{{ error }}</p>
    <div class="photo-rules">
      <b>PHOTO RULES</b>
      <span>Only photos you took of this copy. No AI generation or upscaling, no beauty or colour filters, no heavy retouching. Every photo is checked before it’s public.</span>
    </div>
  </div>
</template>
