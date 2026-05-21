import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/layout/AppShell";
import Home from "@/routes/student/Home";
import Journey from "@/routes/student/Journey";
import Songs from "@/routes/student/Songs";
import Foundations from "@/routes/student/Foundations";
import TunerRoute from "@/routes/student/Tuner";
import SongDetail from "@/routes/student/SongDetail";
import Today from "@/routes/teacher/Today";
import MyStudents from "@/routes/teacher/MyStudents";
import Recordings from "@/routes/teacher/Recordings";
import AdminDashboard from "@/routes/admin/Dashboard";
import FinanceLayout from "@/routes/admin/Finance/Layout";
import FinanceOverview from "@/routes/admin/Finance/Overview";
import FinancePayments from "@/routes/admin/Finance/Payments";
import FinancePayouts from "@/routes/admin/Finance/Payouts";
import Login from "@/pages/Login";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const Gate = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "var(--ink-soft)" }}>Loading…</div>;
  if (!user) return <Login />;
  return <>{children}</>;
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
                <Route path="/" element={<Navigate to="/student" replace />} />
                <Route path="/student" element={<Home />} />
                <Route path="/student/journey" element={<Journey />} />
                <Route path="/student/songs" element={<Songs />} />
                <Route path="/student/foundations" element={<Foundations />} />
                <Route path="/student/tuner" element={<TunerRoute />} />
                <Route path="/student/song/:id" element={<SongDetail />} />
                <Route path="/teacher" element={<Navigate to="/teacher/today" replace />} />
                <Route path="/teacher/today" element={<Today />} />
                <Route path="/teacher/students" element={<MyStudents />} />
                <Route path="/teacher/recordings" element={<Recordings />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/finance" element={<FinanceLayout />}>
                  <Route index element={<FinanceOverview />} />
                  <Route path="payments" element={<FinancePayments />} />
                  <Route path="payouts" element={<FinancePayouts />} />
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
