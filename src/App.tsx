import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppShell from "@/components/layout/AppShell";
import Home from "@/routes/student/Home";
import Foundations from "@/routes/student/Foundations";
import TunerRoute from "@/routes/student/Tuner";
import SongDetail from "@/routes/student/SongDetail";
import MyClass from "@/routes/teacher/MyClass";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Navigate to="/student" replace />} />
            <Route path="/student" element={<Home />} />
            <Route path="/student/foundations" element={<Foundations />} />
            <Route path="/student/tuner" element={<TunerRoute />} />
            <Route path="/student/song/:id" element={<SongDetail />} />
            <Route path="/teacher" element={<MyClass />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
