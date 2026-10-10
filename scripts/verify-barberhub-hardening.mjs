import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";

const migrationPath = new URL(
  "../supabase/migrations/20261005080000_barberhub_critical_security_hardening.sql",
  import.meta.url,
);
const sql = await readFile(migrationPath, "utf8");

const checks = [
  [
    "anon cannot create an arbitrary invite",
    /REVOKE ALL ON FUNCTION barberhub\.create_user_invite[\s\S]*FROM PUBLIC, anon, authenticated/,
  ],
  ["ordinary users cannot create privileged invites", /invite_role_not_allowed/],
  [
    "authorized tenant admins can create allowed invites",
    /barberhub\.can_manage_users\(p_tenant_id\)/,
  ],
  ["expired invites fail", /v_invite\.expires_at < clock_timestamp\(\)/],
  ["consumed invites cannot be reused", /status = 'ACCEPTED'/],
  ["concurrent acceptance is serialized", /FOR UPDATE;/],
  ["tenant A cannot assign a role in tenant B", /target_role\.tenant_id = p_tenant_id/],
  ["users cannot promote themselves", /p_target_user_id IS DISTINCT FROM auth\.uid\(\)::text/],
  [
    "authenticated policies are not unrestricted",
    /CREATE POLICY bh_user_invites_ins[\s\S]*WITH CHECK \(false\)/,
  ],
  [
    "direct tenant policies require membership",
    /USING \(barberhub\.is_tenant_member\(tenant_id\)\)/,
  ],
  [
    "direct tenant writes require the canonical helper",
    /WITH CHECK \(barberhub\.can_write_resource/,
  ],
  [
    "old JWT tenant fallback is absent from this migration",
    (source) => !/auth\.jwt\(\)/.test(source),
  ],
  ["barber roles have bounded agenda access", /has_role\(p_tenant_id, 'BARBEIRO'\)/],
  [
    "permission catalog is read-only for tenants",
    /REVOKE ALL ON barberhub\.permissions FROM authenticated/,
  ],
  ["financial resources require admin or finance capability", /finance\.manage/],
];

for (const [name, pattern] of checks) {
  if (typeof pattern === "function") assert.equal(pattern(sql), true, name);
  else if (pattern instanceof RegExp) assert.match(sql, pattern, name);
  else assert.equal(pattern.test(sql), true, name);
}

assert.match(sql, /CREATE OR REPLACE FUNCTION barberhub\.is_tenant_member/);
assert.match(sql, /CREATE OR REPLACE FUNCTION barberhub\.has_permission/);
assert.match(sql, /CREATE OR REPLACE FUNCTION barberhub\.can_assign_role/);
assert.match(sql, /token_hash/);
assert.match(sql, /GRANT EXECUTE ON FUNCTION barberhub\.accept_user_invite.*TO anon/);
assert.match(sql, /CREATE POLICY bh_user_roles_ins/);
assert.match(sql, /CREATE POLICY bh_role_permissions_ins/);

const policyBlocks = [
  ...sql.matchAll(/CREATE POLICY[\s\S]*?(?=\nCREATE POLICY|\nDO \$\$|\n--|$)/g),
].map(([block]) => block);
assert.equal(
  policyBlocks.some((block) => /TO authenticated/.test(block) && /USING \(true\)/.test(block)),
  false,
  "authenticated policies must not use unrestricted USING (true)",
);
assert.equal(
  policyBlocks.some((block) => /TO authenticated/.test(block) && /WITH CHECK \(true\)/.test(block)),
  false,
  "authenticated policies must not use unrestricted WITH CHECK (true)",
);

console.log("BarberHub hardening structural checks passed.");
