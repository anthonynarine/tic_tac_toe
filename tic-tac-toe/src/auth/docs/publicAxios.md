# `publicAxios.js`

## Purpose

Creates an Axios client intended for **public / non-auth** requests.

Even if your backend uses cookies in production, the naming is about **not attaching an Authorization header**.

Typical uses:

- login
- refresh token
- registration
- password reset
- “public read” endpoints (if you have any)

## Behavior

- `baseURL` comes from environment variables:
  - `REACT_APP_API_BASE_URL`
  - `REACT_APP_API_URL`
  - `REACT_APP_DEV_URL`
- `withCredentials: true`

### Why `withCredentials: true`?

It allows cookie-based auth flows in production without breaking dev setups.
If you are purely token-based and never use cookies, it’s still usually harmless.

## Note

If your project already has a single canonical config module (`src/config.js`),
you can import the base URL from there for consistency.

