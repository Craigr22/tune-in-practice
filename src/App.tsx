import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/layout/AppShell";
import Home from "@/routes/student/Home";
import Journey from "@/routes/student/Journey";

import TunerRoute from "@/routes/student/Tuner";
import SongDetail from "@/routes/student/SongDetail";
import MyClasses from "@/routes/teacher/MyClasses";
import ClassDetail from "@/routes/teacher/ClassDetail";
import Schedule from "@/routes/teacher/Schedule";


import AdminPeople from "@/routes/admin/People";
import AdminSchedule from "@/routes/admin/Schedule";
import AdminCoursework from "@/routes/admin/Coursework";
import FinanceLayout from "@/routes/admin/Finance/Layout";
import FinanceOverview from "@/routes/admin/Finance/Overview";
import FinancePayments from "@/routes/admin/Finance/Payments";
import FinancePayouts from "@/routes/admin/Finance/Payouts";
import FinanceExpenses from "@/routes/admin/Finance/Expenses";
import FinancePnL from "@/routes/admin/Finance/PnL";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const Gate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>Loading…</div>;
  if (!user) return <Login />;
  return <>{children}</>;
};

/** Send each signed-in user to their own home instead of always the student page. */
const RoleHome = () => {
  const { role } = useAuth();
  if (role === "admin") return <Navigate to="/admin/schedule" replace />;
  if (role === "teacher") return <Navigate to="/teacher/classes" replace />;
  if (role === "student") return <Navigate to="/student" replace />;
  // Signed in, but no role assigned yet — say so rather than showing an empty
  // student page that looks broken.
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-xl font-semibold" style={{ color: "var(--ink)" }}>Your account isn’t set up yet</h1>
      <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
        An admin needs to give your account a role before you can use the portal. Please check back shortly.
      </p>
    </div>
  );
};

/** Keep each role inside its own area. Admins may go anywhere. */
const RequireRole = ({ role: need, children }: { role: "teacher" | "admin"; children: React.ReactNode }) => {
  const { role } = useAuth();
  if (role === "admin" || role === need) return <>{children}</>;
  return <Navigate to="/" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Gate>
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<RoleHome />} />
                <Route path="/student" element={<Home />} />
                <Route path="/student/journey" element={<Journey />} />
                
                <Route path="/student/tuner" element={<TunerRoute />} />
                <Route path="/student/song/:id" element={<SongDetail />} />
                <Route path="/teacher" element={<Navigate to="/teacher/classes" replace />} />
                <Route path="/teacher/classes" element={<RequireRole role="teacher"><MyClasses /></RequireRole>} />
                <Route path="/teacher/class/:batchId" element={<RequireRole role="teacher"><ClassDetail /></RequireRole>} />
                <Route path="/teacher/schedule" element={<RequireRole role="teacher"><Schedule /></RequireRole>} />
                {/* Legacy teacher routes */}
                <Route path="/teacher/today" element={<Navigate to="/teacher/classes" replace />} />
                <Route path="/teacher/students" element={<Navigate to="/teacher/classes" replace />} />

                
                <Route path="/admin" element={<Navigate to="/admin/schedule" replace />} />
                <Route path="/admin/people" element={<AdminPeople />} />
                <Route path="/admin/people/:tab" element={<AdminPeople />} />
                <Route path="/admin/schedule" element={<AdminSchedule />} />
                <Route path="/admin/coursework" element={<AdminCoursework />} />
                {/* Legacy routes → consolidated People page */}
                <Route path="/admin/students" element={<Navigate to="/admin/people/students" replace />} />
                <Route path="/admin/teachers" element={<Navigate to="/admin/people/teachers" replace />} />
                <Route path="/admin/users" element={<Navigate to="/admin/people/access" replace />} />
                <Route path="/admin/finance" element={<RequireRole role="admin"><FinanceLayout /></RequireRole>}>
                  <Route index element={<FinanceOverview />} />
                  <Route path="payments" element={<FinancePayments />} />
                  <Route path="payouts" element={<FinancePayouts />} />
                  <Route path="expenses" element={<FinanceExpenses />} />
                  <Route path="pnl" element={<FinancePnL />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Gate>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
