import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  return (
    <div className="flex h-screen bg-[#09090f] overflow-hidden">
      <Sidebar user={session.user ?? {}} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
