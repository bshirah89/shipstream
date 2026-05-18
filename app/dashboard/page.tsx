import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Dashboard } from "@/components/Dashboard";

// This is a Server Component — it runs on the server and can safely call
// getSession() which reads the httpOnly cookie via next/headers
export default function DashboardPage() {
  // Double-check session even though middleware already verified the JWT.
  // Defense in depth: middleware only checks token existence/validity, not
  // whether the user still exists in the database. Could be extended to do so.
  const session = getSession();

  if (!session) {
    redirect("/");
  }

  return <Dashboard userEmail={session.email} />;
}
