$file = 'src/api/admin-actions.ts'
$content = [System.IO.File]::ReadAllText((Resolve-Path $file).Path)
$replacements = Get-Content '_replacements.json' -Raw | ConvertFrom-Json
$count = 0
foreach ($r in $replacements) {
  if ($content.Contains($r.old)) {
    $content = $content.Replace($r.old, $r.new)
    $count++
  }
}
if ($count -gt 0) {
  [System.IO.File]::WriteAllText((Resolve-Path $file).Path, $content)
  Write-Output "REPLACED_$count"
} else {
  Write-Output "NO_MATCH_FOUND"
}
