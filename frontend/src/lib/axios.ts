import axios from 'axios';

const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 10000,
});

// 401 去重
let isRedirecting = false;

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isRedirecting) {
      isRedirecting = true;
      // Clear auth state and redirect to login
      window.location.href = '/login';
      setTimeout(() => { isRedirecting = false; }, 2000);
    }
    return Promise.reject(error);
  }
);

export default http;
