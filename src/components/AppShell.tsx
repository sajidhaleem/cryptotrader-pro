import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Mobile: top bar + scrollable content stacked vertically */}
      <div className="flex flex-col h-screen bg-[#09090f] md:hidden">
        <MobileNav />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>

      {/* Desktop: fixed sidebar + scrollable content side by side */}
      <div className="hidden md:flex h-screen bg-[#09090f] overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
      </div>
    </>
  );
}
