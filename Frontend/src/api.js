import axios from 'axios'

export const api = axios.create({
    // Production always uses Vercel's same-origin /api proxy, including cookie auth.
    baseURL: import.meta.env.PROD ? '' : (import.meta.env.VITE_API_BASE_URL || ''),
    withCredentials: true,
})

export function requestError(error) {
    return error.response?.data?.message || 'Unable to reach the server. Check that the backend is running.'
}
