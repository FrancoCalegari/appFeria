import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getFairState } from "@/lib/db";
import VendorDashboard from "@/components/VendorDashboard";

export const dynamic = "force-dynamic";

export default async function VendorPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }

  const state = getFairState(false);
  return <VendorDashboard initialState={state} currentUser={user} />;
}

