import { DemoPresentationView } from "@/components/demo-presentation";
import { loadDemoPresentation } from "@/lib/demo/presentation";
import { createServiceClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DemoPage() {
  let data;
  try {
    const admin = createServiceClient();
    data = await loadDemoPresentation(admin);
  } catch {
    data = {
      stats: {
        chainsTracked: 0,
        purchasesAttributed: 0,
        rewardsPaid: 0,
      },
      chains: [],
      loaded: false,
    };
  }

  return <DemoPresentationView data={data} />;
}
