import { useQuery } from "@tanstack/react-query";
import {
  getPortalBrands,
  getPortalCollections,
  getPortalHome,
  getPortalOrders,
  getPortalSession,
} from "@/lib/portal.functions";

export function usePortalSession() {
  return useQuery({ queryKey: ["portal", "session"], queryFn: () => getPortalSession() });
}

export function usePortalHome() {
  return useQuery({ queryKey: ["portal", "home"], queryFn: () => getPortalHome() });
}

export function usePortalBrands() {
  return useQuery({ queryKey: ["portal", "brands"], queryFn: () => getPortalBrands() });
}

export function usePortalCollections() {
  return useQuery({ queryKey: ["portal", "collections"], queryFn: () => getPortalCollections() });
}

export function usePortalOrders() {
  return useQuery({ queryKey: ["portal", "orders"], queryFn: () => getPortalOrders() });
}
