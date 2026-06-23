import Sidebar from "@/components/Sidebar";

export default function WalletLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-[#09090f] overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
