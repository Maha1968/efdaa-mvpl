"use server";

import { isAdminUser } from "@/lib/auth/admin";
import { createServiceClient } from "@/lib/supabase/admin";
import { loadDemoData, resetDemoData, type ChainSeedReport } from "@/lib/demo/seed";
import { revalidatePath } from "next/cache";

export type DemoActionResult =
  | {
      ok: true;
      action: "load";
      reports: ChainSeedReport[];
      assistCodes: string[];
    }
  | { ok: true; action: "reset"; message: string }
  | { ok: false; error: string };

export async function loadDemoDataAction(): Promise<DemoActionResult> {
  if (!(await isAdminUser())) {
    return { ok: false, error: "Not authorized." };
  }

  try {
    const admin = createServiceClient();
    const { reports, assistCodes } = await loadDemoData(admin);
    revalidatePath("/admin");
    revalidatePath("/admin/network");
    revalidatePath("/admin/assist");
    revalidatePath("/admin/purchase-view");
    revalidatePath("/admin/purchases");
    return { ok: true, action: "load", reports, assistCodes };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to load demo data.",
    };
  }
}

export async function resetDemoDataAction(): Promise<DemoActionResult> {
  if (!(await isAdminUser())) {
    return { ok: false, error: "Not authorized." };
  }

  try {
    const admin = createServiceClient();
    await resetDemoData(admin);
    revalidatePath("/admin");
    revalidatePath("/admin/network");
    revalidatePath("/admin/assist");
    revalidatePath("/admin/purchase-view");
    revalidatePath("/admin/purchases");
    return {
      ok: true,
      action: "reset",
      message: "Demo data removed. Real (non-demo) rows were left untouched.",
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to reset demo data.",
    };
  }
}
