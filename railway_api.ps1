$t = (Get-Content "$PSScriptRoot\.railway_token").Trim()
$env:PATH = "C:\Users\moham\AppData\Local\pnpm\nodejs\24.14.0;" + $env:PATH
$env:RAILWAY_API_TOKEN = $t
$projectId = "84f0ca38-a175-48a2-a078-77ad353bf937"
$envId = "779d319c-730a-43a3-a329-a31b47cce6c5"
$frontendId = (Get-Content "$PSScriptRoot\railway_frontend_id.txt").Trim()
& railway up --detach --path-as-root --project $projectId --service $frontendId --environment $envId "$PSScriptRoot\heartsync\frontend" 2>&1
