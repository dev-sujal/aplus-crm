import * as React from "react"
import { NavLink, Outlet } from "react-router-dom"
import {
  Award,
  BookOpen,
  CalendarCheck,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  X,
} from "lucide-react"
import { cn } from "cn"
import { useAuth } from "#providers/auth-context"
import { useTheme } from "#providers/theme-provider"
import { Button } from "#components/ui/button"

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: false, module: null },
  { to: "/courses", label: "Courses", icon: BookOpen, ownerOnly: false, module: "courses" as const },
  { to: "/students", label: "Students", icon: Users, ownerOnly: false, module: "students" as const },
  {
    to: "/attendance",
    label: "Attendance",
    icon: CalendarCheck,
    ownerOnly: false,
    module: "attendance" as const,
  },
  {
    to: "/certificates",
    label: "Certificates",
    icon: Award,
    ownerOnly: false,
    module: "certificates" as const,
  },
  { to: "/fees", label: "Fees", icon: IndianRupee, ownerOnly: true, module: null },
  { to: "/users", label: "Users", icon: ShieldCheck, ownerOnly: true, module: null },
]

export default function AppLayout() {
  const { user, logout, can } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const visibleNavItems = navItems.filter((item) => {
    if (item.ownerOnly) return user?.role === "owner"
    if (item.module) return user?.role === "owner" || can(item.module, "view")
    return true
  })

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — fixed on desktop, drawer on mobile */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <span className="text-sm font-semibold">A+ Coaching CRM</span>
          <button className="md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur">
          <button
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="size-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <div className="hidden text-right text-xs leading-tight sm:block">
              <div className="font-medium">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-muted-foreground capitalize">{user?.role}</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => logout()}>
              <LogOut className="size-3.5" />
              Log out
            </Button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
