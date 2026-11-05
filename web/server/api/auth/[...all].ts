// Better Auth's endpoints: sign up/in/out, Google callback, sessions.
export default defineEventHandler((event) => auth.handler(toWebRequest(event)));
