import { NavLink, Outlet } from "react-router-dom";

export default function FinanceLayout() {
  const tab = (to: string, label: string, end = false) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `px-3 py-2 text-sm rounded-md ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`
      }
    >
      {label}
    </NavLink>
  );
  return (
    <div>
      <div className="border-b px-6 py-3 flex gap-2">
        {tab("/admin/finance", "Overview", true)}
        {tab("/admin/finance/payments", "Payments")}
        {tab("/admin/finance/payouts", "Payouts")}
      </div>
      <Outlet />
    </div>
  );
}
