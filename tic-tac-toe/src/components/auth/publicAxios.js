// # Filename: src/api/publicAxios.js
// ✅ New Code

import axios from "axios";

// Step 1: Resolve backend base URL
// NOTE: If your src/config.js already exports an API base URL, swap this to import from there.
const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  process.env.REACT_APP_API_URL ||
  "";

// Step 2: Create a public axios instance
// withCredentials helps cookie-based prod setups while not breaking dev.
const publicAxios = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export default publicAxios;
