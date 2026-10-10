import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/(navor-lawhub)")({
  ssr: false,
  component: LawHubLayout,
});

function LawHubLayout() {
  return <Outlet />;
}
