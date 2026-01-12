// # Filename: src/components/auth/authAxios.js


import axios from "axios";
import config from "../../config";

// Step 1: Authenticated axios instance
// IMPORTANT: config.apiBaseUrl already ends with /api
// So use relative paths in calls: "users/profile/" not "/users/profile/"
const authAxios = axios.create({
  baseURL: config.apiBaseUrl,
  withCredentials: true,
});

export default authAxios;
