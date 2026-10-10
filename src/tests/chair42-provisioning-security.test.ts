import { describe, it, expect } from "vitest";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

describe("Cadeira 4.2 — Provisioning Security", () => {
  it("reserve_account_slug RPC exists and is callable", async () => {
    const { error } = await (supabaseAdmin as any).rpc("reserve_account_slug", {
      p_product_id: "00000000-0000-0000-0000-000000000000",
      p_slug: "test-slug-chair42",
    });
    expect(error?.message).not.toContain("function reserve_account_slug does not exist");
  });

  it("confirm_account_slug RPC exists and is restricted to service_role", async () => {
    const { error } = await (supabaseAdmin as any).rpc("confirm_account_slug", {
      p_account_id: "00000000-0000-0000-0000-000000000000",
      p_product_id: "00000000-0000-0000-0000-000000000000",
      p_slug: "test-slug-chair42",
    });
    expect(error?.message).not.toContain("permission denied");
  });

  it("update_beta_period RPC exists and is restricted to service_role", async () => {
    const { error } = await (supabaseAdmin as any).rpc("update_beta_period", {
      p_subscription_id: "00000000-0000-0000-0000-000000000000",
      p_action: "start_beta",
      p_params: { beta_ends_at: new Date().toISOString() },
    });
    expect(error?.message).not.toContain("permission denied");
  });

  it("get_provisioning_dashboard RPC exists and is restricted to service_role", async () => {
    const { error } = await (supabaseAdmin as any).rpc("get_provisioning_dashboard");
    expect(error?.message).not.toContain("permission denied");
  });

  it("provisioning_records table is inaccessible to authenticated users", async () => {
    const { error } = await (supabaseAdmin as any).from("provisioning_records").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("account_slugs table exists with RLS", async () => {
    const { error } = await (supabaseAdmin as any).from("account_slugs").select("id").limit(1);
    expect(error).toBeNull();
  });

  it("reserved word slug is rejected by reserve_account_slug", async () => {
    const { data, error } = await (supabaseAdmin as any).rpc("reserve_account_slug", {
      p_product_id: "00000000-0000-0000-0000-000000000000",
      p_slug: "admin",
    });
    expect(error).toBeNull();
    expect(data?.available).toBe(false);
    expect(data?.reason).toBe("RESERVED_WORD");
  });

  it("invalid slug format is rejected", async () => {
    const { data, error } = await (supabaseAdmin as any).rpc("reserve_account_slug", {
      p_product_id: "00000000-0000-0000-0000-000000000000",
      p_slug: "../../etc/passwd",
    });
    expect(error).toBeNull();
    expect(data?.available).toBe(false);
  });
});
