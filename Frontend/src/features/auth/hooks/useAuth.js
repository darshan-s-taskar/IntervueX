import { useContext } from 'react'
import { AuthContext } from '../auth.state'
import { login, register, logout } from '../services/auth.api'
import { requestError } from '../../../api'

export const useAuth = () => {
    const { user, setUser, loading, setLoading, error, setError } = useContext(AuthContext)
    const authenticate = async (action, fields) => {
        setError('')
        setLoading(true)
        try {
            const data = await action(fields)
            setUser(data.user)
            return true
        } catch (err) {
            setError(requestError(err))
            return false
        } finally {
            setLoading(false)
        }
    }
    const handleLogout = async () => {
        setError('')
        try {
            await logout()
            setUser(null)
        } catch (err) {
            setError(requestError(err))
        }
    }
    return {
        user, loading, error, handleLogout,
        handleLogin: fields => authenticate(login, fields),
        handleRegister: fields => authenticate(register, fields),
    }
}
