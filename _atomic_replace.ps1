$file = 'src/api/admin-actions.ts'
$lines = [System.IO.File]::ReadAllLines((Resolve-Path $file).Path)
$output = New-Object System.Collections.Generic.List[string]
$i = 0
$replaced = 0
while ($i -lt $lines.Count) {
    $line = $lines[$i]
    if ($line -match 'export const grantOverride = createServerFn') {
        while ($i -lt $lines.Count -and $lines[$i] -notmatch '^\}\);$') { $i++ }
        $i++
        $output.Add('export const grantOverride = createServerFn({ method: "POST" })')
        $output.Add('.middleware([requireSupabaseAuth])')
        $output.Add('.inputValidator((d: { accountId: string; capabilityId: string; reason: string }) => d)')
        $output.Add('.handler(async ({ data, context }) => {')
        $output.Add('await requirePlatformAdmin(context.userId);')
        $output.Add('const { accountId, capabilityId, reason } = data;')
        $output.Add('// Atomic RPC: override + audit in single transaction')
        $output.Add('const { error } = await serviceSupabase.rpc("upsert_entitlement_override_with_audit", {')
        $output.Add('p_account_id: accountId,')
        $output.Add('p_capability_id: capabilityId,')
        $output.Add('p_granted: true,')
        $output.Add('p_reason: reason,')
        $output.Add('p_changed_by: context.userId,')
        $output.Add('});')
        $output.Add('if (error) throw new Error(`ATOMIC_OVERRIDE_GRANT_FAILURE: ${error.message}`);')
        $output.Add('return { success: true };')
        $output.Add('});')
        $replaced++
        continue
    }
    if ($line -match 'export const denyOverride = createServerFn') {
        while ($i -lt $lines.Count -and $lines[$i] -notmatch '^\}\);$') { $i++ }
        $i++
        $output.Add('export const denyOverride = createServerFn({ method: "POST" })')
        $output.Add('.middleware([requireSupabaseAuth])')
        $output.Add('.inputValidator((d: { accountId: string; capabilityId: string; reason: string }) => d)')
        $output.Add('.handler(async ({ data, context }) => {')
        $output.Add('await requirePlatformAdmin(context.userId);')
        $output.Add('const { accountId, capabilityId, reason } = data;')
        $output.Add('// Atomic RPC: override + audit in single transaction')
        $output.Add('const { error } = await serviceSupabase.rpc("upsert_entitlement_override_with_audit", {')
        $output.Add('p_account_id: accountId,')
        $output.Add('p_capability_id: capabilityId,')
        $output.Add('p_granted: false,')
        $output.Add('p_reason: reason,')
        $output.Add('p_changed_by: context.userId,')
        $output.Add('});')
        $output.Add('if (error) throw new Error(`ATOMIC_OVERRIDE_DENY_FAILURE: ${error.message}`);')
        $output.Add('return { success: true };')
        $output.Add('});')
        $replaced++
        continue
    }
    if ($line -match 'export const removeOverride = createServerFn') {
        while ($i -lt $lines.Count -and $lines[$i] -notmatch '^\}\);$') { $i++ }
        $i++
        $output.Add('export const removeOverride = createServerFn({ method: "POST" })')
        $output.Add('.middleware([requireSupabaseAuth])')
        $output.Add('.inputValidator((d: { accountId: string; capabilityId: string }) => d)')
        $output.Add('.handler(async ({ data, context }) => {')
        $output.Add('await requirePlatformAdmin(context.userId);')
        $output.Add('const { accountId, capabilityId } = data;')
        $output.Add('// Atomic RPC: delete + audit in single transaction')
        $output.Add('const { error } = await serviceSupabase.rpc("remove_entitlement_override_with_audit", {')
        $output.Add('p_account_id: accountId,')
        $output.Add('p_capability_id: capabilityId,')
        $output.Add('p_reason: "override_removed",')
        $output.Add('p_changed_by: context.userId,')
        $output.Add('});')
        $output.Add('if (error) throw new Error(`ATOMIC_OVERRIDE_REMOVE_FAILURE: ${error.message}`);')
        $output.Add('return { success: true };')
        $output.Add('});')
        $replaced++
        continue
    }
    $output.Add($line)
    $i++
}
if ($replaced -gt 0) {
    [System.IO.File]::WriteAllLines((Resolve-Path $file).Path, $output.ToArray())
    Write-Output "REPLACED_$replaced"
} else {
    Write-Output "NO_MATCH_FOUND"
}
