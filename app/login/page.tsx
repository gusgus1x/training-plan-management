import { redirect } from "next/navigation";
import { getServerSessionUser } from "../lib/auth/server-session";

// AuthGate (rendered in the root layout) is what actually shows LoginPage —
// this route only needs to exist so the URL bar has somewhere to point.
// Authenticated visitors who land here directly get bounced home.
export default async function LoginRoute() {
  const user = await getServerSessionUser();
  if (user) {
    redirect("/");
  }
  return null;
}
