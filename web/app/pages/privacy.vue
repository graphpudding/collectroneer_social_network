<script setup lang="ts">
useSeoMeta({ title: "Privacy", description: "What Collectors Note stores about you and why." });
const { operator } = useSiteInfo();
</script>

<template>
  <div class="page pad prose legal">
    <span class="kicker">▸ Legal</span>
    <h1 class="display" style="font-size: clamp(36px, 5vw, 56px)">Privacy</h1>
    <p class="updated">Last updated 31 October 2026</p>

    <p>
      This page says what we store, why, and what you can do about it. The service is run by
      {{ operator ?? "its operator (details to be published here)" }}, who is responsible for your data.
    </p>

    <h2 class="title">What we store</h2>
    <ul>
      <li><b>Account:</b> email address, password (only as a secure hash), username, and if you add them: display name, bio, city, profile picture. If you sign in with Google we get your name, email and picture from Google; your Google name is not shown publicly.</li>
      <li><b>Sessions:</b> a sign-in cookie, plus the IP address and browser of each session, to keep you signed in and to spot misuse.</li>
      <li><b>Your collection:</b> copies, wishlist, notes, serial numbers, photos. Photos are re-encoded when uploaded and all embedded metadata (including GPS location) is removed.</li>
      <li><b>Messages</b> you send and receive, including photos in them.</li>
      <li><b>Reports, blocks and catalog suggestions</b> you make, and moderators’ decisions about them.</li>
    </ul>
    <p>We don’t sell your data, we don’t show ads, and we don’t use analytics or tracking cookies.</p>

    <h2 class="title">Who sees what</h2>
    <ul>
      <li>Your username, profile, wishlist and copies marked “Everyone” are public, unless your account is closed. A copy appears only once it has an approved photo. Serial numbers you hide are never shown.</li>
      <li>Your email address is never shown to other users.</li>
      <li>Messages are stored on our servers, not end-to-end encrypted. Moderators read a message only when it is reported to them.</li>
      <li>Moderators see photos waiting for review and the content of reports.</li>
    </ul>

    <h2 class="title">Services we use</h2>
    <ul>
      <li><b>Cloudflare</b> sits in front of the site and stores uploaded photos (R2).</li>
      <li><b>Google</b>, if you choose to sign in with Google. Fonts on the site are also loaded from Google Fonts, which sees your IP address.</li>
      <li><b>Wikimedia Commons</b> serves some catalog photos directly, so it sees your IP address when you view them.</li>
    </ul>

    <h2 class="title">Legal basis and how long</h2>
    <p>
      We process your data to provide the service you signed up for (your account, collection, messages) and, for
      session data and moderation records, in our legitimate interest in keeping the service safe. We keep it while
      your account exists. When you delete your account we delete your profile, collection, photos and messages straight away.
    </p>

    <h2 class="title">Your rights</h2>
    <p>
      In <NuxtLink to="/settings" class="u-link">settings</NuxtLink> you can correct your profile, download all your data
      as a file, close your account to the public, or delete it. You can also ask us for access, correction, deletion or
      to stop processing, and complain to your data protection authority. Write to <ContactLine />.
    </p>
  </div>
</template>
