/**
 * TruMark Mobile API Client
 *
 * Constructs all HTTP requests to the dynamically saved backend URL.
 */
import axios from 'axios';
import { getSavedBackendUrl } from './discovery';

/**
 * Returns an Axios instance pre-configured with the saved backend URL.
 * Call this once at startup and store the instance, or call on each request.
 */
export async function createApiClient() {
  const baseURL = await getSavedBackendUrl();
  if (!baseURL) throw new Error('No backend URL configured. Select a school first.');

  return axios.create({
    baseURL: `${baseURL}/api`,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });
}
