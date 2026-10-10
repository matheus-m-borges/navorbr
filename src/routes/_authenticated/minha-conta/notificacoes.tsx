import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/minha-conta/notificacoes")({
  component: NotificationsPage,
  loader: async () => {
    const data = await serverGetNotifications();
    return { notifications: data };
  },
});

const serverGetNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("notifications")
      .select("id, title, body, severity, route_key, entity_id, product_id, created_at, read_at, archived_at")
      .eq("user_id", context.userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);
    return data ?? [];
  });

const serverMarkRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((d: { notificationId: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.notificationId)
      .eq("user_id", context.userId)
      .is("read_at", null);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

function NotificationsPage() {
  const { notifications } = Route.useLoaderData();
  const [items, setItems] = useState(notifications);

  const markRead = async (id: string) => {
    const res = await serverMarkRead({ data: { notificationId: id } });
    if (res.ok) {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    }
  };

  const getSeverityColor = (s: string) => {
    switch (s) {
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      case "error": return "bg-orange-100 text-orange-800 border-orange-200";
      case "warning": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default: return "bg-blue-50 text-blue-800 border-blue-200";
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-6">Notificações</h1>
      {items.length === 0 ? (
        <div className="text-center py-12 text-gray-500 border rounded-lg bg-gray-50">
          Nenhuma notificação recente.
        </div>
      ) : (
        items.map((n) => (
          <div
            key={n.id}
            className={`p-4 rounded-lg border transition-all ${
              n.read_at ? "bg-white border-gray-200 opacity-75" : "bg-white border-l-4 border-l-blue-600 shadow-sm"
            }`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium uppercase tracking-wide ${getSeverityColor(n.severity)}`}>
                    {n.severity}
                  </span>
                  {!n.read_at && <span className="w-2 h-2 rounded-full bg-blue-600" />}
                </div>
                <h3 className={`font-semibold truncate ${!n.read_at ? "text-gray-900" : "text-gray-600"}`}>{n.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{n.body}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              {!n.read_at && (
                <button
                  onClick={() => markRead(n.id)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium whitespace-nowrap px-2 py-1 rounded hover:bg-blue-50"
                >
                  Marcar como lida
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
