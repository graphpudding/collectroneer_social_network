<script setup lang="ts">
useSeoMeta({ title: "Data sources & licenses", description: "Where the Collectors Note catalog comes from and under which licences." });
</script>

<template>
  <div class="page pad prose legal">
    <span class="kicker">▸ About</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">Data sources &amp; licenses</h1>
    <p>
      Every model page lists the sources of its facts, numbered, with a link to the exact page or revision used.
      Here is the overview.
    </p>
    <table class="scale-table">
      <thead><tr><th>Source</th><th>What we take</th><th>Licence</th></tr></thead>
      <tbody>
        <tr>
          <td><a href="https://camera-wiki.org" class="u-link" target="_blank" rel="noopener">Camera-wiki</a></td>
          <td>Facts about models (maker, years, type, film, lens, shutter…), each linked to the article revision. Article text is not copied; Camera-wiki photos are not used.</td>
          <td><a href="https://www.gnu.org/licenses/fdl-1.3.html" class="u-link" target="_blank" rel="noopener">GFDL 1.3</a></td>
        </tr>
        <tr>
          <td><a href="https://www.wikidata.org" class="u-link" target="_blank" rel="noopener">Wikidata</a></td>
          <td>Identifiers, names in other languages, dates.</td>
          <td>CC0</td>
        </tr>
        <tr>
          <td><a href="https://www.wikipedia.org" class="u-link" target="_blank" rel="noopener">Wikipedia</a></td>
          <td>Facts and short quotes backing production figures.</td>
          <td><a href="https://creativecommons.org/licenses/by-sa/4.0/" class="u-link" target="_blank" rel="noopener">CC BY-SA 4.0</a></td>
        </tr>
        <tr>
          <td><a href="https://commons.wikimedia.org" class="u-link" target="_blank" rel="noopener">Wikimedia Commons</a></td>
          <td>Model photos.</td>
          <td>Per file; author and licence are shown under each photo.</td>
        </tr>
        <tr>
          <td>Canon Camera Museum, zenitcamera.com</td>
          <td>Specifications and factory production figures, cited on the model page.</td>
          <td>Facts with attribution</td>
        </tr>
        <tr>
          <td>Collectors Note users</td>
          <td>Corrections, new models, sources. Every change is reviewed.</td>
          <td><a href="https://creativecommons.org/licenses/by-sa/4.0/" class="u-link" target="_blank" rel="noopener">CC BY-SA 4.0</a></td>
        </tr>
      </tbody>
    </table>
    <h2 class="title">How facts are extracted</h2>
    <p>
      Structured fields are read directly. Where a fact only appears in an article’s text, an AI model extracts it, and
      we keep the value only if the exact sentence it came from is found in that article. The model never fills a field
      from its own knowledge.
    </p>
    <h2 class="title">Photos of copies</h2>
    <p>Photos of users’ copies belong to their owners and are not covered by the licences above.</p>
    <h2 class="title">Corrections and takedown</h2>
    <p>
      Spotted a mistake? Use “Suggest an edit” on the model page. If you believe something here infringes your rights,
      write to <ContactLine /> and we’ll look at it promptly.
    </p>
  </div>
</template>
