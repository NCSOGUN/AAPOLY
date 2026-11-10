import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AdminSidebar } from "@/components/admin/sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The login page is a child of this layout but should be unstyled.
  // We detect this via session: if no session, children is the login page (middleware
  // has already redirected non-login pages).
  const session = await auth();

  if (!session) {
    // Children here is the login page; just render it without the chrome.
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
