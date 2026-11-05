<script setup lang="ts">
import { PHOTO_REJECT_REASONS } from "#shared/admin";

useSeoMeta({ title: "Photo rules", description: "What photos of a copy can go on Collectors Note." });
</script>

<template>
  <div class="page pad prose legal">
    <span class="kicker">▸ Rules</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">Photo rules</h1>
    <p>
      Photos are what make a copy real for other collectors: condition, finish, the scratch on the top plate. So they
      have to show <b>your</b> copy as it is.
    </p>
    <ul>
      <li>Only photos you took yourself, of this copy.</li>
      <li>No AI generation or AI upscaling, no beauty or colour filters, no heavy retouching. Cropping, straightening and plain exposure fixes are fine.</li>
      <li>No people’s faces, documents or anything private in the frame.</li>
      <li>JPG, PNG or WebP, up to 20 MB, up to 12 photos per copy. The first one is the cover.</li>
    </ul>
    <p>
      Every photo is checked by a moderator before it goes public, usually within a day. Until a copy has an approved
      photo it is visible only to you. Location and camera data are removed from every photo when you upload it.
    </p>
    <h2 class="title">Why a photo may be rejected</h2>
    <ul>
      <li v-for="r in PHOTO_REJECT_REASONS" :key="r">{{ r }}</li>
    </ul>
    <p>You’ll see the reason next to the photo in your editor. Take another and upload it.</p>
  </div>
</template>
