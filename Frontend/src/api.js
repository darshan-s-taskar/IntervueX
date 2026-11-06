import axios from 'axios'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    withCredentials: true,
})

export function requestError(error) {
    return error.response?.data?.message || 'Unable to reach the server. Check that the backend is running.'
}
