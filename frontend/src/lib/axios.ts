import axios from 'axios';
import type { AxiosError } from 'axios';

const http = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  timeout: 10000,
});

/**
 * Callback registered by the auth store.
 * Called on 401 to clear user state so guards redirect via React Router.
 */
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

/**
 * 401 interceptor:
 * - During initAuth the store's catch block already handles 401 (sets user=null).
 *   The registered handler skips clearing when user is already null.
 * - After initialization, if a request gets 401 (session expired / password changed),
 *   we clear the user so AuthGuard redirects via React Router (no full-page reload).
 *
 * We NEVER use window.location.href — guards handle all navigation.
 */
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    return Promise.reject(error);
  }
);

export default http;
