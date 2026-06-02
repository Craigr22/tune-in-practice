import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import AppShell from "@/components/layout/AppShell";
import Home from "@/routes/student/Home";
import Journey from "@/routes/student/Journey";

import Foundations from "@/routes/student/Foundations";
import TunerRoute from "@/routes/student/Tuner";
import SongDetail from "@/routes/student/SongDetail";
import Today from "@/routes/teacher/Today";
import MyStudents from "@/routes/teacher/MyStudents";
import Schedule from "@/routes/teacher/Schedule";


import AdminPeople from "@/routes/admin/People";
import AdminSchedule from "@/routes/admin/Schedule";
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
                
                <Route path="/student/foundations" element={<Foundations />} />
                <Route path="/student/tuner" element={<TunerRoute />} />
                <Route path="/student/song/:id" element={<SongDetail />} />
                <Route path="/teacher" element={<Navigate to="/teacher/today" replace />} />
                <Route path="/teacher/today" element={<Today />} />
                <Route path="/teacher/students" element={<MyStudents />} />
                <Route path="/teacher/schedule" element={<Schedule />} />

                
                <Route path="/admin" element={<Navigate to="/admin/schedule" replace />} />
                <Route path="/admin/people" element={<AdminPeople />} />
                <Route path="/admin/people/:tab" element={<AdminPeople />} />
                <Route path="/admin/schedule" element={<AdminSchedule />} />
                {/* Legacy routes → consolidated People page */}
                <Route path="/admin/students" element={<Navigate to="/admin/people/students" replace />} />
                <Route path="/admin/teachers" element={<Navigate to="/admin/people/teachers" replace />} />
                <Route path="/admin/users" element={<Navigate to="/admin/people/access" replace />} />
                <Route path="/admin/finance" element={<FinanceLayout />}>
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
