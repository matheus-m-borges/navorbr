import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
const db = supabase as any;

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string;
  role: "admin" | "vendedor";
  isPlatformAdmin?: boolean;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase.auth.getUser();
      const authUser = data.user;
      if (!authUser) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const [{ data: profile }, { data: memberships }, { data: platformAdminRow }] = await Promise.all([
        db.from("profiles" as never).select("full_name, email").eq("id", authUser.id).maybeSingle(),
        db.from("account_members" as never).select("role").eq("user_id", authUser.id),
        db.from("platform_admins" as never).select("user_id").eq("user_id", authUser.id).maybeSingle(),
      ]);
      const isPlatformAdmin = !!platformAdminRow;
      const p = profile as { full_name: string | null; email: string | null } | null;
      const membershipRows = (memberships ?? []) as { role: string }[];
      const role =
        isPlatformAdmin || membershipRows.some((membership) => ["owner", "admin"].includes(membership.role))
          ? "admin"
          : "vendedor";
      if (active) {
        setUser({
          id: authUser.id,
          email: p?.email ?? authUser.email ?? null,
          name: p?.full_name ?? authUser.email?.split("@")[0] ?? "Usuário",
          role,
          isPlatformAdmin: !!isPlatformAdmin,
        } as CurrentUser);
        setLoading(false);
      }
    }

    void load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") void load();
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
}
