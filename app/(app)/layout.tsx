import { Sidebar } from "@/components/layout/sidebar";
import { WalletReadinessPanel } from "@/components/wallet/wallet-readiness-panel";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="ml-[220px] flex-1 min-h-screen">
        <div className="mx-auto max-w-[1200px] px-8 py-6">
          <WalletReadinessPanel />
          {children}
        </div>
      </main>
    </div>
  );
}
