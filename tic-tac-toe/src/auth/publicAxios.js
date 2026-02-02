// # Filename: src/api/publicAxios.js


import axios from "axios";

import config from "../config";

// Step 1: Create a public axios instance using the SAME API base URL as the app
// This ensures Recruiter Demo Mode never accidentally hits localhost:3000.
const publicAxios = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
});

export default publicAxios;
