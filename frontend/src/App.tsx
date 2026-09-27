import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { Toaster } from "sonner"
import { AuthProvider } from "#providers/auth-context"
import { ThemeProvider } from "#providers/theme-provider"
import { ProtectedRoute } from "#routes/ProtectedRoute"
import AppLayout from "#components/layout/AppLayout"
import LoginPage from "#pages/LoginPage"
import VerifyPage from "#pages/VerifyPage"
import DashboardPage from "#pages/DashboardPage"
import CoursesPage from "#pages/CoursesPage"
import StudentsPage from "#pages/StudentsPage"
import StudentDetailPage from "#pages/StudentDetailPage"
import AttendancePage from "#pages/AttendancePage"
import FeesPage from "#pages/FeesPage"
import UsersPage from "#pages/UsersPage"
import CertificatesPage from "#pages/CertificatesPage"

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify" element={<VerifyPage />} />
              <Route path="/verify/:credentialId" element={<VerifyPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                  <Route path="/dashboard" element={<DashboardPage />} />

                  <Route element={<ProtectedRoute requireModule="courses" />}>
                    <Route path="/courses" element={<CoursesPage />} />
                  </Route>

                  <Route element={<ProtectedRoute requireModule="students" />}>
                    <Route path="/students" element={<StudentsPage />} />
                    <Route path="/students/:id" element={<StudentDetailPage />} />
                  </Route>

                  <Route element={<ProtectedRoute requireModule="attendance" />}>
                    <Route path="/attendance" element={<AttendancePage />} />
                  </Route>

                  <Route element={<ProtectedRoute requireModule="certificates" />}>
                    <Route path="/certificates" element={<CertificatesPage />} />
                  </Route>

                  <Route element={<ProtectedRoute ownerOnly />}>
                    <Route path="/fees" element={<FeesPage />} />
                    <Route path="/users" element={<UsersPage />} />
                  </Route>
                </Route>
              </Route>

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  )
}

export default App
