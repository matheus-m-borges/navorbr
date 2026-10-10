import { useState } from "react";
import { formatDateTime } from "@/lib/crm";
import { useQuery } from "@tanstack/react-query";
import { crmDb } from "@/hooks/useCrm";
import { useCurrentUser } from "@/hooks/useSession";
import { History, Lock } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  GhostButton,
  GlassCard,
  Modal,
  PrimaryButton,
  Field,
  TextInput,
} from "./ui";

interface Props {
  entityType: string;
  entityId: string;
  className?: string;
  label?: string;
}

export function AuditHistoryButton({ entityType, entityId, className, label = "Histórico" }: Props) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [authMode, setAuthMode] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [authorizing, setAuthorizing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isAdmin = user?.role === "admin";
  const isAuthorized = isAdmin || authorized;

  const { data: history = [], isLoading } = useQuery({
    queryKey: ["audit-history", entityType, entityId],
    queryFn: async () => {
      const { data } = await crmDb
        .from("audit_logs")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: open && isAuthorized,
  });

  const handleOpen = () => {
    if (isAdmin) {
      setOpen(true);
    } else {
      setAuthMode(true);
    }
  };

  const handleAuthorize = async () => {
    if (!adminPassword.trim()) {
      setErrorMsg("A senha é obrigatória.");
      return;
    }
    setAuthorizing(true);
    setErrorMsg("");

    try {
      // Get the primary admin's email or any admin email
      const { data: admins } = await crmDb
        .from("profiles")
        .select("email")
        .eq("is_primary_admin", true)
        .limit(1)
        .maybeSingle();

      if (!admins?.email) {
        throw new Error("Nenhum administrador principal configurado.");
      }

      // Create an ephemeral client so it doesn't change the current user session
      const ephemClient = createClient(
        import.meta.env["VITE_SUPABASE_URL"],
        import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"],
        { auth: { persistSession: false, autoRefreshToken: false } }
      );

      const { data, error } = await ephemClient.auth.signInWithPassword({
        email: admins.email,
        password: adminPassword,
      });

      if (error || !data.user) {
        throw new Error("Senha incorreta.");
      }

      setAuthorized(true);
      setAuthMode(false);
      setOpen(true);
      setAdminPassword("");
    } catch (err: any) {
      setErrorMsg(err.message || "Falha na autorização.");
    } finally {
      setAuthorizing(false);
    }
  };

  return (
    <>
      <GhostButton onClick={handleOpen} className={className}>
        <History className="size-4 mr-2" />
        {label}
      </GhostButton>

      <Modal open={authMode} onClose={() => setAuthMode(false)} title="Autorização de Administrador">
        <div className="w-full relative pb-4">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-foreground p-3 text-background shadow-xl">
            <Lock className="size-6" />
          </div>
          <div className="mt-4 text-center">
            <p className="mt-1 text-xs text-muted-foreground">
              Você está logado como vendedor. Peça ao administrador para digitar a senha de acesso para visualizar o histórico.
            </p>
          </div>
          <div className="mt-6 space-y-4">
            <Field label="Senha do Administrador">
              <TextInput
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuthorize()}
              />
            </Field>
            {errorMsg && <p className="text-xs text-rose text-center">{errorMsg}</p>}
            <PrimaryButton className="w-full" disabled={authorizing} onClick={handleAuthorize}>
              {authorizing ? "Verificando..." : "Autorizar Acesso"}
            </PrimaryButton>
          </div>
        </div>
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Histórico de Alterações">
        <div className="w-full">
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-2">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum histórico registrado.</p>
            ) : (
              history.map((log: any) => (
                <div key={log.id} className="border-l-2 border-brand/50 pl-4 py-1 relative">
                  <div className="absolute -left-[5px] top-2 size-2 rounded-full bg-brand" />
                  <p className="text-sm text-card-foreground font-medium">
                    {log.action}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {log.description}
                  </p>
                  <div className="flex gap-2 text-[10px] mt-2 font-semibold text-muted-foreground/80 uppercase tracking-wide">
                    <span>{formatDateTime(log.created_at)}</span>
                    <span>•</span>
                    <span>{log.user_name || "Sistema"}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
