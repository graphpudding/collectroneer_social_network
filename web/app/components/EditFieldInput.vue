<script setup lang="ts">
import type { EditableField } from "#shared/edits";

// The right control for one catalog field.
// The value starts as emptyValue(field) (shared/edits.ts), set by whoever adds the field.
defineProps<{ field: EditableField }>();
const model = defineModel<any>();

const toggle = (v: string) => {
  const list: string[] = model.value ?? [];
  model.value = list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
};
</script>

<template>
  <input v-if="field.kind === 'year'" v-model.number="model" class="input mono" type="number" min="1839" :max="new Date().getFullYear()" placeholder="1971" />
  <input v-else-if="field.kind === 'text' || field.kind === 'alias'" v-model="model" class="input" :maxlength="field.max" />
  <select v-else-if="field.kind === 'enum'" v-model="model" class="input">
    <option value="" disabled>Pick one</option>
    <option v-for="(label, key) in field.options" :key="key" :value="key">{{ label }}</option>
  </select>
  <div v-else-if="field.kind === 'enum[]'" class="chips-row">
    <button v-for="(label, key) in field.options" :key="key" type="button" class="chip" :aria-pressed="(model ?? []).includes(key)" @click="toggle(String(key))">{{ label }}</button>
  </div>
  <div v-else-if="field.kind === 'production'" style="display: flex; flex-direction: column; gap: 8px">
    <div class="settings__row">
      <input v-model="model.value" class="input mono" type="number" min="1" placeholder="Units made, e.g. 816000" />
      <select v-model="model.basis" class="input"><option value="stated">Exact figure</option><option value="estimate">About (estimate)</option></select>
    </div>
    <span class="field__hint">Or a range, if sources give one:</span>
    <div class="settings__row">
      <input v-model="model.min" class="input mono" type="number" min="1" placeholder="From" />
      <input v-model="model.max" class="input mono" type="number" min="1" placeholder="To" />
    </div>
  </div>
  <div v-else-if="field.kind === 'speeds'" class="settings__row">
    <input v-model="model.slowest" class="input mono" placeholder="Slowest: 1 or 1/30" />
    <input v-model="model.fastest" class="input mono" placeholder="Fastest: 1/1000" />
    <label class="switch" style="font-size: 14px"><input v-model="model.bulb" type="checkbox" /><span class="switch__track" aria-hidden="true" />Has B (bulb)</label>
  </div>
</template>
