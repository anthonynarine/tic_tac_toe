import axios from "axios";
import config from "../../config";

const authAxios = axios.create({
    baseURL: config.apiBaseUrl,
    withCredentials: true,
});

export default authAxios;
