import { api } from '../../../api'

export async function register({ username, email, password }) {
    return (await api.post('/api/auth/register', { username, email, password })).data
}
export async function login({ email, password }) {
    return (await api.post('/api/auth/login', { email, password })).data
}
export async function logout() {
    return (await api.get('/api/auth/logout')).data
}
export async function getMe() {
    return (await api.get('/api/auth/get-me')).data
}
