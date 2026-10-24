param(
  [int]$Port = 4173
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "MediTrace frontend running at http://localhost:$Port"
Write-Host "Press Ctrl+C to stop."

function Get-ContentType([string]$Path) {
  switch -Regex ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    '\.html' { return 'text/html; charset=utf-8' }
    '\.js' { return 'text/javascript; charset=utf-8' }
    '\.css' { return 'text/css; charset=utf-8' }
    '\.json' { return 'application/json; charset=utf-8' }
    default { return 'application/octet-stream' }
  }
}

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $relative = $context.Request.Url.AbsolutePath.TrimStart('/') -replace '/', '\\'
    if ([string]::IsNullOrWhiteSpace($relative)) { $relative = 'index.html' }
    $candidate = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
    $rootWithSlash = $root.TrimEnd('\') + '\'

    if ($candidate.StartsWith($rootWithSlash, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path $candidate -PathType Leaf)) {
      $bytes = [System.IO.File]::ReadAllBytes($candidate)
      $context.Response.StatusCode = 200
      $context.Response.ContentType = Get-ContentType $candidate
      if ($context.Request.HttpMethod -ne 'HEAD') {
        $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        $context.Response.OutputStream.Flush()
      }
    } else {
      $context.Response.StatusCode = 404
    }
    $context.Response.Close()
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
