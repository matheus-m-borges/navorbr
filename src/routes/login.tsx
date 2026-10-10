import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => search,
  beforeLoad: ({ location }) => {
    const search = location.searchStr || "";
    const params = new URLSearchParams(search);
    const token = params.get("token") || params.get("invite_token");
    if (token) {
      throw redirect({ to: `/primeiro-acesso?token=${encodeURIComponent(token)}` as any });
    }
    throw redirect({ to: `/auth${search}` as any });
  },
  component: () => (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white font-sans">
      <div className="text-center space-y-3">
        <div className="size-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-300 font-medium">Redirecionando para o acesso do LawHub...</p>
      </div>
    </div>
  ),
});
