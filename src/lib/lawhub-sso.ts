import { createClientOnlyFn } from "@tanstack/react-start";
import { launchLawHubSso as launchLawHubSsoClient } from "./lawhub-sso.client";

export const launchLawHubSso = createClientOnlyFn(
  (returnPath?: string) => launchLawHubSsoClient(returnPath),
);
