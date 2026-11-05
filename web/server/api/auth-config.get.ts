// Which sign-in buttons to show.
export default defineEventHandler(() => ({
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
}));
