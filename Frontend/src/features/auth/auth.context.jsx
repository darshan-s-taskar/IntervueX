import { useEffect, useState } from 'react'
import { AuthContext } from './auth.state'
import { getMe } from './services/auth.api'

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    useEffect(() => {
        let active = true
        getMe().then(data => { if (active) setUser(data.user) })
            .catch(() => { if (active) setUser(null) })
            .finally(() => { if (active) setLoading(false) })
        return () => { active = false }
    }, [])
    return (
        <AuthContext.Provider value={{ user, setUser, loading, setLoading, error, setError }}>
            {children}
        </AuthContext.Provider>
    )
}
