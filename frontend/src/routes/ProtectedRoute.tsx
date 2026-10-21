import { Navigate, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "#providers/auth-context"
import type { PermissionModule } from "#lib/types"

export function ProtectedRoute({
  ownerOnly = false,
  requireModule,
}: {
  ownerOnly?: boolean
  requireModule?: PermissionModule
}) {
  const { status, user, can } = useAuth()
  const location = useLocation()

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    )
  }

  if (status === "unauthenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (ownerOnly && user.role !== "owner") {
    return <Navigate to="/dashboard" replace />
  }

  if (requireModule && !can(requireModule, "view")) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
