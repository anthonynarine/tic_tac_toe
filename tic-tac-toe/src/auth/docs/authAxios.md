# `authAxios.js`

## Purpose

Creates an Axios client for **authenticated** requests.

This file currently configures:

- `baseURL` from your shared `config.apiBaseUrl`
- `withCredentials: true`

## How Auth Gets Applied

Typically, `authAxios` should be paired with a request interceptor that:

1. Calls `ensureFreshAccessToken()` (optional but recommended)
2. Reads `access_token` from `tokenStore`
3. Sets `Authorization: Bearer <access_token>` on the request

This keeps token logic centralized and avoids copy/paste headers across the codebase.

## Why keep a separate instance?

Using separate instances makes it easy to:

- avoid infinite loops (refresh calls should use `publicAxios`, not `authAxios`)
- apply auth interceptors only where needed
- set different defaults (timeouts, retry logic, etc.)

