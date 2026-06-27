import Sidebar from "@/components/Sidebar";
import MobileHeader from "@/components/MobileHeader";
import MobileNav from "@/components/MobileNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobile layout: sticky header top + scrollable main + fixed bottom nav */}
      <div className="flex flex-col h-[100dvh] bg-[#09090f] md:hidden overflow-hidden">
        <MobileHeader />
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="pb-20">{children}</div>
        </main>
        <MobileNav />
      </div>

      {/* Desktop layout: fixed sidebar + scrollable main */}
      <div className="hidden md:flex h-screen bg-[#09090f] overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
    </>
  );
}
