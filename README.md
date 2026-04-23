# CS2 em Docker + painel web (Next.js)

## Stack do painel (`panel/`)

- [Next.js](https://nextjs.org/) (App Router) + [HeroUI](https://heroui.com/) + [Prisma](https://www.prisma.io/) (SQLite)
- [Bun](https://bun.sh/) como gestor de pacotes e runtime em dev (`bun run dev`); a imagem Docker do painel usa **Bun** no contentor
- Dados: `DATABASE_URL` (ficheiro SQLite: em Docker `file:/data/panel.db` no volume `panel-data`)

## Requisitos

- [Bun](https://bun.sh/) (para desenvolver o painel localmente)
- Docker / Docker Compose
- [GSLT](https://steamcommunity.com/dev/managegameservers) (`SRCDS_TOKEN`)
- **Disco:** a imagem oficial do servidor CS2 pede **≥ 60 GB livres** no sistema de ficheiros onde fica `./cs2-data` (download + extração; convém **≥ 65 GB** de margem). Com pouco espaço, o SteamCMD falha (ex.: `App '730' state is 0x602`) e recomeça o download.

## Arranque rápido

1. Na raiz deste repositório:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` e define no mínimo `SRCDS_TOKEN`, `SESSION_SECRET`, `LOADOUT_API_KEY` e `PANEL_BASE_URL` (URL **pública** onde o painel é acedido — necessário para o login Steam OpenID). Opcional: **`STEAM_WEB_API_KEY`** (criar em [Steam Web API](https://steamcommunity.com/dev/apikey)) para mostrar **nome e avatar** no cabeçalho do painel.

3. Servidor de jogo:

   ```bash
   docker compose up -d cs2
   ```

4. Painel web (edita `.env` do projeto, loadout na base SQLite, login Steam):

   ```bash
   docker compose up -d panel
   ```

   Ou em desenvolvimento, a partir de `panel/`:

   ```bash
   cd panel && bun install && bun run dev
   ```

   O painel escuta na porta `PANEL_PORT` (default `3080`), mapeada em `0.0.0.0` no host.

## Abrir o painel a partir do Windows

**Cenário A — Linux (VPS / PC) com Docker e o teu Windows noutra máquina**

1. No servidor, sobe o painel: `docker compose up -d panel`.
2. No **PowerShell no Windows**, cria um túnel SSH para a porta do painel no servidor:

   ```powershell
   ssh -N -L 3080:127.0.0.1:3080 UTILIZADOR@IP_OU_HOSTNAME_DO_SERVIDOR
   ```

   Mantém esta janela aberta. Opcional: `.\scripts\ssh-tunnel-from-windows.ps1 -RemoteUserHost "user@host"`.

3. No Windows, abre o browser em: `http://127.0.0.1:3080`

4. Para o **login Steam** funcionar com este túnel, no `.env` do servidor define  
   `PANEL_BASE_URL=http://127.0.0.1:3080` (é a URL que o teu browser no Windows usa).

**Cenário B — sem SSH, mesma rede LAN**

- Abre `http://IP_DO_SERVIDOR:3080` (a porta está publicada no host). Pode ser necessário abrir o firewall no Linux, por exemplo: `sudo ufw allow 3080/tcp`.  
- Ajusta `PANEL_BASE_URL` para `http://IP_DO_SERVIDOR:3080` (ou o hostname que usas no browser).

**Cenário C — Cursor / VS Code Remote SSH**

- Na aba **Ports**, reencaminha a porta `3080` (ou usa “Forward a Port”).

## Imagem Docker do CS2

Usa variáveis documentadas em [joedwards32/CS2](https://github.com/joedwards32/CS2) (`CS2_STARTMAP`, `CS2_GAMETYPE`, `CS2_GAMEMODE`, workshop, etc.). O `docker-compose.yml` lê o ficheiro `.env` na raiz.

## API de loadout (para o teu plugin)

- `GET /api/v1/loadout/{steamid64}` com header `X-API-Key: <LOADOUT_API_KEY>` (o mesmo valor que está no `.env` do painel).
- O corpo inclui `byWeaponId`, `agent_ct`, `agent_t`, `musicKit` (escolhidos na UI). O plugin pode mapear `weaponKey` + `paint_index` para cosméticos no jogo.

## Lobbies (organizar partida)

- Na página principal (autenticado): **+ Criar lobby** ou introduz o **código** e **Entrar**.
- Cada lobby tem **link partilhável** (`/lobby/XXXXXXXX`): abre, entra com Steam, escolhe time / espectador, **prontidão** e o líder ajusta mapa e opções. **Configurar skins** continua na página principal.
- A API: `POST /api/lobbies` (criar), `GET /api/lobbies/:code`, `POST .../join`, `PUT .../me` (time/pronto), `PUT .../settings` (líder), `DELETE ...` (líder apaga).

## Catálogo de skins / agentes / música

Dados em cache (ficheiros em `data/cache/` dentro do volume do painel) a partir do repositório comunitário [ByMykel/CSGO-API](https://github.com/ByMykel/CSGO-API). A primeira carga pode demorar (~5 MB de skins).

## Skins “tipo xplay”

O painel guarda o loadout por SteamID após login no site. Para **aplicar** no jogo é preciso um **plugin** no servidor que chame esta API e aplique paint kits / modelos conforme o teu contrato. O hook `cs2-data/pre.sh` corre **antes** do CS2 arrancar — aí podes instalar Metamod, CounterStrikeSharp, etc. (ver documentação da imagem).

## CS2: erro `0x602` / download a recomeçar

1. Confirma espaço: `df -h .` — alarga o disco da VPS ou apaga dados noutros sítios até teres **pelo menos ~65 GB livres** na partição do `cs2-data`.
2. Para o servidor: `docker compose stop cs2`.
3. Limpa o download Steam corrompido/incompleto: `rm -rf cs2-data/steamapps && mkdir -p cs2-data/steamapps && chown -R 1000:1000 cs2-data` (no host, o utilizador `steam` no contentor é UID **1000**).
4. Opcional no `.env`: `STEAMAPPVALIDATE=1` durante **um** arranque para forçar validação; depois volta a `0`.
5. Sobe de novo: `docker compose up -d cs2`.

## Segurança

- Não faças commit de `.env`.
- Opcional: `ADMIN_STEAMID64S` — lista de SteamID64 que podem editar o painel; vazio = qualquer utilizador autenticado.
