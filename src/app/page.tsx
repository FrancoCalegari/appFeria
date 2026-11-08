import { getFairState } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import FairMap from "@/components/FairMap";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const state = getFairState(false);
  const user = await getSessionUser();

  return <FairMap initialState={state} currentUser={user} />;
}

