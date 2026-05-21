import { useLocation, useNavigate } from "react-router-dom";
import type { Role } from "@/lib/types";

export function useRole() {
  const location = useLocation();
  const navigate = useNavigate();
  const role: Role = location.pathname.startsWith("/teacher") ? "teacher" : "student";

  const setRole = (r: Role) => {
    navigate(r === "teacher" ? "/teacher" : "/student");
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return { role, setRole };
}
