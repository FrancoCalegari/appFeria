import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getFairState } from "@/lib/db";
import AdminDashboard from "@/components/AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "ADMIN") {
    redirect("/cms/mi-puesto");
  }

  const state = getFairState(true);
  return <AdminDashboard initialState={state} currentUser={user} />;
}

