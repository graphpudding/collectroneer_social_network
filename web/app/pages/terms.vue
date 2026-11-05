<script setup lang="ts">
useSeoMeta({ title: "Terms of use", description: "The rules for using Collectors Note." });
const { operator } = useSiteInfo();
</script>

<template>
  <div class="page pad prose legal">
    <span class="kicker">▸ Legal</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">Terms of use</h1>
    <p class="updated">Last updated 31 October 2026</p>

    <p>
      Collectors Note is a catalog of collectible models and a place for collectors to keep their collections and
      find each other. It is run by {{ operator ?? "its operator (details to be published here)" }}. By creating an
      account you agree to these terms.
    </p>

    <h2 class="title">Your account</h2>
    <ul>
      <li>You must be at least 16 years old.</li>
      <li>One account per person. Use an email address you can read; keep your password to yourself.</li>
      <li>Your username is public. You don’t have to use your real name.</li>
      <li>You can close your account to the public in settings, download your data, or delete the account at any time.</li>
    </ul>

    <h2 class="title">No deals on Collectors Note</h2>
    <p>
      Marking a copy “for trade” or “for sale” only tells other collectors you’re open to it. We don’t handle money,
      shipping or disputes and we are not a party to any deal. Anything you agree with another user is between the
      two of you, at your own risk. Be careful with prepayment to people you don’t know.
    </p>

    <h2 class="title">What you post</h2>
    <ul>
      <li>
        <b>Photos of your copies</b> stay yours. You give us a worldwide, non-exclusive, free licence to store, resize and
        show them on Collectors Note while they are up. Delete a photo, a copy or your account and we remove the photo;
        copies in caches may take a short while to expire. Photos must follow the <NuxtLink to="/photo-rules" class="u-link">photo rules</NuxtLink>.
      </li>
      <li>
        <b>Catalog contributions</b> (corrections, new models, sources) are published under
        <a href="https://creativecommons.org/licenses/by-sa/4.0/" class="u-link" rel="license noopener" target="_blank">CC BY-SA 4.0</a>,
        like most of the catalog’s data, so others can reuse them with credit.
      </li>
      <li><b>Messages</b> are for the people in the conversation. Don’t publish someone else’s messages without their consent.</li>
    </ul>

    <h2 class="title">Not allowed</h2>
    <ul>
      <li>Spam, scams, fake listings, or pretending to be someone else.</li>
      <li>Harassment, hate, threats, or sexual content.</li>
      <li>Offering stolen or illegal items.</li>
      <li>Photos you didn’t take, AI-generated or heavily edited photos of “your” copy.</li>
      <li>Collecting data from the site in bulk, or anything that puts unusual load on it.</li>
    </ul>
    <p>
      Moderators can hide content, reject photos and suspend accounts that break these rules. Use “Report” on a
      profile, copy, photo or message to flag a problem.
    </p>

    <h2 class="title">The catalog</h2>
    <p>
      Catalog data is gathered from open sources and from users, then checked as well as we can; it may still contain
      mistakes. It is provided as is. Each model page lists its sources and their licences; see
      <NuxtLink to="/about/sources" class="u-link">data sources &amp; licenses</NuxtLink>.
    </p>

    <h2 class="title">Liability and changes</h2>
    <p>
      We work to keep Collectors Note available and your data safe, but we can’t promise it will always be up or free of
      errors. To the extent the law allows, we aren’t liable for losses from using it or from dealings between users.
      We may change these terms; if a change matters, we’ll say so on the site before it applies.
    </p>

    <h2 class="title">Contact</h2>
    <p>Questions about these terms: <ContactLine />.</p>
  </div>
</template>
