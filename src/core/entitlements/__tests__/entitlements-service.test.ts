 // =============================================================================
 // CADEIRA 4.6 — ENTITLEMENTS ENGINE UNIT TESTS
 // Validates capability resolution, overrides, addons, and fail-closed behavior.
 // =============================================================================

 import { describe, it, expect, vi, beforeEach } from 'vitest';
 import type { AccountEntitlements, ResolvedCapability } from '../types';

 // Mock supabaseAdmin before importing service
 vi.mock('@/integrations/supabase/client.server', () => ({
   supabaseAdmin: {
     rpc: vi.fn(),
     from: vi.fn(() => ({
       select: vi.fn().mockReturnThis(),
       eq: vi.fn().mockReturnThis(),
       in: vi.fn().mockReturnThis(),
       or: vi.fn().mockReturnThis(),
       maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
     })),
   },
 }));

 import { resolveAccountEntitlements, hasCapability, getActiveAddons, getUsageLimits } from '../entitlements-service.server';
 import { supabaseAdmin } from '@/integrations/supabase/client.server';

 const MOCK_ACCOUNT_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

 describe('Entitlements Engine Service', () => {
   beforeEach(() => {
     vi.clearAllMocks();
   });

   describe('resolveAccountEntitlements', () => {
     it('resolves capabilities from plan modules correctly', async () => {
       const mockCapabilities = [
         { capability_key: 'crm.clients.view', capability_name: 'View Clients', granted: true, source: 'plan_module' },
         { capability_key: 'crm.orders.create', capability_name: 'Create Orders', granted: true, source: 'plan_module' },
       ];
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: mockCapabilities, error: null } as any);

       const result = await resolveAccountEntitlements(MOCK_ACCOUNT_ID);

       expect(result.accountId).toBe(MOCK_ACCOUNT_ID);
       expect(result.capabilities).toHaveLength(2);
       expect(result.capabilities[0].key).toBe('crm.clients.view');
       expect(result.capabilities[0].granted).toBe(true);
       expect(result.capabilities[0].source).toBe('plan_module');
       expect(result.resolvedAt).toBeDefined();
     });

     it('handles override denying a capability', async () => {
       const mockCapabilities = [
         { capability_key: 'crm.clients.view', capability_name: 'View Clients', granted: false, source: 'override' },
       ];
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: mockCapabilities, error: null } as any);

       const result = await resolveAccountEntitlements(MOCK_ACCOUNT_ID);
       expect(result.capabilities[0].granted).toBe(false);
       expect(result.capabilities[0].source).toBe('override');
     });

     it('throws on RPC failure (fail-closed)', async () => {
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: null, error: { message: 'connection lost' } } as any);

       await expect(resolveAccountEntitlements(MOCK_ACCOUNT_ID)).rejects.toThrow('ENTITLEMENTS_RPC_FAILURE');
     });

     it('throws on invalid response schema', async () => {
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: 'not-an-array', error: null } as any);

       await expect(resolveAccountEntitlements(MOCK_ACCOUNT_ID)).rejects.toThrow('invalid response schema');
     });
   });

   describe('hasCapability', () => {
     it('returns true when capability is granted', async () => {
       const mockCapabilities = [
         { capability_key: 'crm.clients.view', capability_name: 'View Clients', granted: true, source: 'plan_module' },
       ];
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: mockCapabilities, error: null } as any);

       const result = await hasCapability(MOCK_ACCOUNT_ID, 'crm.clients.view');
       expect(result).toBe(true);
     });

     it('returns false when capability is not present', async () => {
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: [], error: null } as any);

       const result = await hasCapability(MOCK_ACCOUNT_ID, 'nonexistent.cap');
       expect(result).toBe(false);
     });

     it('returns false when capability is explicitly denied', async () => {
       const mockCapabilities = [
         { capability_key: 'crm.clients.view', capability_name: 'View Clients', granted: false, source: 'override' },
       ];
       vi.mocked(supabaseAdmin.rpc).mockResolvedValue({ data: mockCapabilities, error: null } as any);

       const result = await hasCapability(MOCK_ACCOUNT_ID, 'crm.clients.view');
       expect(result).toBe(false);
     });
   });

   describe('getActiveAddons', () => {
     it('returns active addons with correct structure', async () => {
       const mockAddons = [
         { addon_id: 'add-1', activated_at: '2026-10-01T00:00:00Z', expires_at: null, is_active: true, plan_addons: { key: 'extra_users', name: 'Extra Users Pack' } },
       ];
       const mockChain = {
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         or: vi.fn().mockResolvedValue({ data: mockAddons, error: null }),
       };
       vi.mocked(supabaseAdmin.from).mockReturnValue(mockChain as any);

       const result = await getActiveAddons(MOCK_ACCOUNT_ID);
       expect(result).toHaveLength(1);
       expect(result[0].key).toBe('extra_users');
       expect(result[0].expiresAt).toBeNull();
     });

     it('throws on query failure', async () => {
       const mockChain = {
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         or: vi.fn().mockResolvedValue({ data: null, error: { message: 'db error' } }),
       };
       vi.mocked(supabaseAdmin.from).mockReturnValue(mockChain as any);

       await expect(getActiveAddons(MOCK_ACCOUNT_ID)).rejects.toThrow('ADDONS_QUERY_FAILURE');
     });
   });

   describe('getUsageLimits', () => {
     it('returns empty array when no active subscription exists', async () => {
       const mockSubChain = {
         select: vi.fn().mockReturnThis(),
         eq: vi.fn().mockReturnThis(),
         in: vi.fn().mockReturnThis(),
         maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
       };
       vi.mocked(supabaseAdmin.from).mockReturnValue(mockSubChain as any);

       const result = await getUsageLimits(MOCK_ACCOUNT_ID);
       expect(result).toEqual([]);
     });

     it('returns limits for active subscription plan', async () => {
       const mockPlanId = 'plan-uuid-123';
       const mockLimits = [
         { limit_key: 'max_clients', limit_value: 500, unit: 'units', description: 'Maximum clients' },
       ];

       let callCount = 0;
       vi.mocked(supabaseAdmin.from).mockImplementation(() => {
         callCount++;
         if (callCount === 1) {
           // subscriptions query
           return {
             select: vi.fn().mockReturnThis(),
             eq: vi.fn().mockReturnThis(),
             in: vi.fn().mockReturnThis(),
             maybeSingle: vi.fn().mockResolvedValue({ data: { plan_id: mockPlanId }, error: null }),
           } as any;
         }
         // plan_usage_limits query
         return {
           select: vi.fn().mockReturnThis(),
           eq: vi.fn().mockResolvedValue({ data: mockLimits, error: null }),
         } as any;
       });

       const result = await getUsageLimits(MOCK_ACCOUNT_ID);
       expect(result).toHaveLength(1);
       expect(result[0].limitKey).toBe('max_clients');
       expect(result[0].limitValue).toBe(500);
     });
   });
 });
