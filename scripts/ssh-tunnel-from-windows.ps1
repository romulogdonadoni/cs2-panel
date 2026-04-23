# Executa ISTO no PowerShell no Windows (ajusta USER@HOST).
# Encaminha a porta 3080 do teu PC para o painel no servidor (Docker no Linux).
#
# Depois abre no browser: http://127.0.0.1:3080
#
# No .env do servidor, para login Steam funcionar com este túnel, usa:
#   PANEL_BASE_URL=http://127.0.0.1:3080
# (o browser no Windows chama localhost; o OpenID da Steam redireciona para essa URL.)
#
# Se usas outra porta local, por ex. 13080:
#   ssh -L 13080:127.0.0.1:3080 USER@HOST
#   e PANEL_BASE_URL=http://127.0.0.1:13080

param(
  [Parameter(Mandatory = $true)]
  [string] $RemoteUserHost
)

ssh -N -L 3080:127.0.0.1:3080 $RemoteUserHost
