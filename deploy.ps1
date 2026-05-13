# 部署脚本 - PowerShell版本
# 需要在PowerShell中运行

$headers = @{
    "Authorization" = "token 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"
    "Content-Type" = "application/json"
}

$body = @{
    message = "初始化留言板数据"
    content = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("[]"))
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "https://api.github.com/repos/bayinbrook/bayinbrook.github.io/contents/messages.json" -Method PUT -Headers $headers -Body $body

Write-Host "messages.json 创建成功!"
Write-Host "SHA: $($response.content.sha)"
