import * as React from "react"
import { api, setAccessToken } from "#lib/api-client"
import { refreshAccessToken } from "#lib/api-client"
import type { AuthUser, PermissionModule } from "#lib/types"

interface LoginResponse {
  accessToken: string
  user: AuthUser
}

interface AuthContextValue {
  user: AuthUser | null
  status: "loading" | "authenticated" | "unauthenticated"
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  can: (module: PermissionModule, action?: "view" | "edit") => boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [status, setStatus] = React.useState<AuthContextValue["status"]>("loading")

  React.useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      const token = await refreshAccessToken()
      if (!token) {
        if (!cancelled) setStatus("unauthenticated")
        return
      }
      try {
        const me = await api.get<AuthUser>("/auth/me")
        if (!cancelled) {
          setUser(me)
          setStatus("authenticated")
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null)
          setStatus("unauthenticated")
        }
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = React.useCallback(async (email: string, password: string) => {
    const data = await api.post<LoginResponse>("/auth/login", { email, password })
    setAccessToken(data.accessToken)
    setUser(data.user)
    setStatus("authenticated")
  }, [])

  const logout = React.useCallback(async () => {
    try {
      await api.post("/auth/logout")
    } finally {
      setAccessToken(null)
      setUser(null)
      setStatus("unauthenticated")
    }
  }, [])

  const can = React.useCallback(
    (module: PermissionModule, action: "view" | "edit" = "view") => {
      if (!user) return false
      if (user.role === "owner") return true
      return Boolean(user.permissions?.[module]?.[action])
    },
    [user]
  )

  const value = React.useMemo(
    () => ({ user, status, login, logout, can }),
    [user, status, login, logout, can]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
