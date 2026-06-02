import { Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminStudents from "./Students";
import AdminTeachers from "./Teachers";
import AdminUsers from "./Users";

const TABS = [
  { value: "students", label: "Students" },
  { value: "teachers", label: "Teachers" },
  { value: "access", label: "Access" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

export default function AdminPeople() {
  const { role } = useAuth();
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  if (role !== "admin") return <Navigate to="/" replace />;

  const active = (tab ?? "students") as TabValue;
  if (!TABS.some((t) => t.value === active)) return <Navigate to="/admin/people/students" replace />;

  return (
    <div>
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="flex rounded-md border overflow-hidden w-fit">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => navigate(`/admin/people/${t.value}`)}
              className={`px-4 py-1.5 text-sm ${active === t.value ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {active === "students" && <AdminStudents />}
      {active === "teachers" && <AdminTeachers />}
      {active === "access" && <AdminUsers />}
    </div>
  );
}
