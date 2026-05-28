Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$PROJECT_PATH = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_URL      = "http://localhost:3000/recepcao"
$PORT         = 3000

$BG     = [System.Drawing.Color]::FromArgb(10,  10,  14)
$CARD   = [System.Drawing.Color]::FromArgb(20,  14,  31)
$ACCENT = [System.Drawing.Color]::FromArgb(168, 85,  247)
$GREEN  = [System.Drawing.Color]::FromArgb(34,  197, 94)
$RED    = [System.Drawing.Color]::FromArgb(239, 68,  68)
$YELLOW = [System.Drawing.Color]::FromArgb(250, 204, 21)
$WHITE  = [System.Drawing.Color]::White
$GRAY   = [System.Drawing.Color]::FromArgb(115, 115, 135)

$form                  = New-Object System.Windows.Forms.Form
$form.Text             = "Carrasco Fit - Launcher"
$form.Size             = New-Object System.Drawing.Size(480, 520)
$form.StartPosition    = "CenterScreen"
$form.BackColor        = $BG
$form.FormBorderStyle  = "FixedSingle"
$form.MaximizeBox      = $false
$form.Font             = New-Object System.Drawing.Font("Segoe UI", 9)

$pnlLogo              = New-Object System.Windows.Forms.Panel
$pnlLogo.Size         = New-Object System.Drawing.Size(480, 110)
$pnlLogo.Location     = New-Object System.Drawing.Point(0, 0)
$pnlLogo.BackColor    = $CARD
$form.Controls.Add($pnlLogo)

$lblBadge             = New-Object System.Windows.Forms.Label
$lblBadge.Text        = "CF"
$lblBadge.Size        = New-Object System.Drawing.Size(54, 54)
$lblBadge.Location    = New-Object System.Drawing.Point(30, 28)
$lblBadge.BackColor   = [System.Drawing.Color]::FromArgb(220, 38, 38)
$lblBadge.ForeColor   = $WHITE
$lblBadge.Font        = New-Object System.Drawing.Font("Segoe UI", 16, [System.Drawing.FontStyle]::Bold)
$lblBadge.TextAlign   = "MiddleCenter"
$pnlLogo.Controls.Add($lblBadge)

$lblNome              = New-Object System.Windows.Forms.Label
$lblNome.Text         = "CARRASCO FIT"
$lblNome.Location     = New-Object System.Drawing.Point(96, 22)
$lblNome.Size         = New-Object System.Drawing.Size(340, 36)
$lblNome.ForeColor    = $WHITE
$lblNome.Font         = New-Object System.Drawing.Font("Segoe UI", 20, [System.Drawing.FontStyle]::Bold)
$pnlLogo.Controls.Add($lblNome)

$lblSub               = New-Object System.Windows.Forms.Label
$lblSub.Text          = "Sistema de Controle de Acesso"
$lblSub.Location      = New-Object System.Drawing.Point(97, 62)
$lblSub.Size          = New-Object System.Drawing.Size(340, 22)
$lblSub.ForeColor     = $GRAY
$lblSub.Font          = New-Object System.Drawing.Font("Segoe UI", 9)
$pnlLogo.Controls.Add($lblSub)

$sep              = New-Object System.Windows.Forms.Panel
$sep.Size         = New-Object System.Drawing.Size(480, 2)
$sep.Location     = New-Object System.Drawing.Point(0, 110)
$sep.BackColor    = $ACCENT
$form.Controls.Add($sep)

$lstLog               = New-Object System.Windows.Forms.ListBox
$lstLog.Size          = New-Object System.Drawing.Size(420, 200)
$lstLog.Location      = New-Object System.Drawing.Point(30, 130)
$lstLog.BackColor     = $CARD
$lstLog.ForeColor     = $GREEN
$lstLog.BorderStyle   = "FixedSingle"
$lstLog.Font          = New-Object System.Drawing.Font("Consolas", 9)
$lstLog.SelectionMode = "None"
$form.Controls.Add($lstLog)

$pnlStatus            = New-Object System.Windows.Forms.Panel
$pnlStatus.Size       = New-Object System.Drawing.Size(420, 50)
$pnlStatus.Location   = New-Object System.Drawing.Point(30, 345)
$pnlStatus.BackColor  = $CARD
$form.Controls.Add($pnlStatus)

$lblDot               = New-Object System.Windows.Forms.Label
$lblDot.Text          = "o"
$lblDot.Size          = New-Object System.Drawing.Size(30, 50)
$lblDot.Location      = New-Object System.Drawing.Point(14, 0)
$lblDot.ForeColor     = $YELLOW
$lblDot.Font          = New-Object System.Drawing.Font("Segoe UI", 18)
$lblDot.TextAlign     = "MiddleLeft"
$pnlStatus.Controls.Add($lblDot)

$lblStatus            = New-Object System.Windows.Forms.Label
$lblStatus.Text       = "Aguardando..."
$lblStatus.Size       = New-Object System.Drawing.Size(360, 50)
$lblStatus.Location   = New-Object System.Drawing.Point(46, 0)
$lblStatus.ForeColor  = $YELLOW
$lblStatus.Font       = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$lblStatus.TextAlign  = "MiddleLeft"
$pnlStatus.Controls.Add($lblStatus)

$progress             = New-Object System.Windows.Forms.ProgressBar
$progress.Size        = New-Object System.Drawing.Size(420, 14)
$progress.Location    = New-Object System.Drawing.Point(30, 408)
$progress.Style       = "Marquee"
$progress.MarqueeAnimationSpeed = 30
$progress.Visible     = $false
$form.Controls.Add($progress)

$btnStart             = New-Object System.Windows.Forms.Button
$btnStart.Text        = "INICIAR SISTEMA"
$btnStart.Size        = New-Object System.Drawing.Size(420, 52)
$btnStart.Location    = New-Object System.Drawing.Point(30, 432)
$btnStart.BackColor   = $ACCENT
$btnStart.ForeColor   = $WHITE
$btnStart.FlatStyle   = "Flat"
$btnStart.FlatAppearance.BorderSize = 0
$btnStart.Font        = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$btnStart.Cursor      = "Hand"
$form.Controls.Add($btnStart)

function Add-Log($msg) {
    $time = Get-Date -Format "HH:mm:ss"
    $lstLog.Items.Add("[$time]  $msg")
    $lstLog.TopIndex = $lstLog.Items.Count - 1
    $form.Refresh()
}

function Set-Status($msg, $color) {
    $lblStatus.Text      = $msg
    $lblStatus.ForeColor = $color
    $lblDot.ForeColor    = $color
    $form.Refresh()
}

function Test-Port($port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", $port)
        $tcp.Close()
        return $true
    } catch {
        return $false
    }
}

function Open-Browser($url) {
    $browsers = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe",
        "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
    )
    foreach ($b in $browsers) {
        if (Test-Path $b) {
            Add-Log "Abrindo: $(Split-Path $b -Leaf)"
            Start-Process $b "--app=$url"
            return
        }
    }
    Add-Log "Abrindo no navegador padrao..."
    Start-Process $url
}

$btnStart.Add_Click({
    $btnStart.Enabled = $false
    $btnStart.Text    = "Iniciando..."
    $progress.Visible = $true

    Add-Log "Iniciando Carrasco Fit..."
    Add-Log "Pasta: $PROJECT_PATH"
    Set-Status "Verificando servidor...", $YELLOW

    if (Test-Port $PORT) {
        Add-Log "Servidor ja ativo na porta $PORT"
        Set-Status "Servidor ja ativo!", $GREEN
        Open-Browser $APP_URL
        Set-Status "Sistema pronto!", $GREEN
        $progress.Visible   = $false
        $btnStart.Text      = "Sistema Iniciado"
        $btnStart.BackColor = $GREEN
        return
    }

    Add-Log "Iniciando servidor (npm run dev)..."
    Set-Status "Iniciando servidor...", $YELLOW

    $psi                  = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName         = "cmd.exe"
    $psi.Arguments        = "/c npm run dev"
    $psi.WorkingDirectory = $PROJECT_PATH
    $psi.WindowStyle      = "Minimized"
    $psi.UseShellExecute  = $true
    [System.Diagnostics.Process]::Start($psi) | Out-Null

    Add-Log "Aguardando servidor na porta $PORT..."

    $attempts    = 0
    $maxAttempts = 30
    while (-not (Test-Port $PORT) -and $attempts -lt $maxAttempts) {
        Start-Sleep -Seconds 1
        $attempts++
        Add-Log "  Tentativa $attempts / $maxAttempts..."
        [System.Windows.Forms.Application]::DoEvents()
    }

    if (Test-Port $PORT) {
        Add-Log "Servidor ativo!"
        Set-Status "Servidor pronto!", $GREEN
        Start-Sleep -Milliseconds 800
        Add-Log "Abrindo tela de recepcao..."
        Open-Browser $APP_URL
        Add-Log "Sistema iniciado com sucesso!"
        Set-Status "Sistema pronto!", $GREEN
        $btnStart.Text      = "Sistema Iniciado"
        $btnStart.BackColor = $GREEN
    } else {
        Add-Log "ERRO: servidor nao respondeu em ${maxAttempts}s"
        Add-Log "Verifique se o Node.js esta instalado."
        Set-Status "Erro ao iniciar servidor", $RED
        $btnStart.Enabled = $true
        $btnStart.Text    = "TENTAR NOVAMENTE"
    }

    $progress.Visible = $false
    [System.Windows.Forms.Application]::DoEvents()
})

Add-Log "Launcher pronto. Clique em INICIAR SISTEMA."
[System.Windows.Forms.Application]::Run($form)
