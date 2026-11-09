# BBLU Block Explorer — Implementation plan

Status: ready to execute. Date: 9 November 2026.
Implements [architecture.md](architecture.md). Product name: **BBLU Block Explorer**.
Server: `167.233.207.148`. Public name: `blockexplorer.bitcoin-blu.org`.

This plan is the order of work. Parameters, ports, and rejected options stay in the architecture. Each phase has a stop condition. Do not start the next phase on the server when the stop condition fails.

Three workstreams can run at the same time until they meet in phase 6:

| Stream | Where | Blocks |
| --- | --- | --- |
| A. Node, then ElectrumX | the Hetzner box | address pages and the mempool backend |
| B. DNS and the certificate | DNS host and nginx | public HTTPS |
| C. The mempool fork | this repository | the images nginx will proxy |

## Out of this plan

Lightning, Liquid, accelerator, mempool.space feeds, historical USDT charts, a public Electrum port, and replacing `explorer.bitcoin-blu.org` or `bbluexplorer.codefalcon.dev`. Those stay as ADR-006 and ADR-010.

## Phase 0 — Access and names

Owner steps, before software is installed.

1. Confirm SSH key login to `167.233.207.148`. Record the Ubuntu release (lever L3). The working assumption is 24.04 LTS.
2. Create the DNS `A` record `blockexplorer.bitcoin-blu.org` → `167.233.207.148`.
3. Confirm nginx is the process listening on ports 80 and 443, and that no other site on this box needs those server names.

Done when `dig +short blockexplorer.bitcoin-blu.org` returns `167.233.207.148` and `ssh` reaches the box.

## Phase 1 — Host baseline

On the server, with the node stopped.

1. Add a 2 GB swap file if swap is absent.
2. Install Docker Engine and the Docker Compose plugin. Install `python3-certbot-nginx` if `certbot` is absent.
3. Create directories:
   - `/var/lib/bitcoinblu`
   - `/var/lib/electrumx`
   - `/var/lib/bblu-explorer` (Compose volumes)
   - `/etc/bitcoinblu` for the config, mode `0750`
4. Firewall, public interface:
   - allow 22 from admin addresses, 80, 443, and 8343 (lever L6; close 8343 if this node should not take peers)
   - deny 8342, 50001, 3306, 8080, and 8999 from the public interface
5. Leave at least 20 GB free on the 80 GB disk after the OS and Docker.

Done when `free -h` shows swap, `docker compose version` runs, and a scan of the public address does not show 8342 or 50001.

## Phase 2 — Full node, synced alone

ElectrumX and the explorer containers stay stopped. This phase gets the whole machine.

1. Install the current Linux 64-bit build from the downloads page. On 9 November 2026 that is [bblu-28.3.1-linux-64.tar.gz](https://www.bitcoin-blu.org/downloads/28.3.1/linux_64/bblu-28.3.1-linux-64.tar.gz). Compiling Bitcoin-Blu on 2 vCPU and 4 GB is reserved for the case where the published archive does not run. Record the installed version next to lever L7’s notes.
2. Write `/etc/bitcoinblu/bitcoinblu.conf` as in architecture section 5.4. Generate `rpcauth` on the server. Do not commit the file. Do not set `chain=`. The chain name is `main-blu`.
3. For the first sync set `dbcache=1024`. Put `datadir=/var/lib/bitcoinblu`.
4. Install a systemd unit `bitcoinblu.service` that runs `bitcoinblu-d -conf=/etc/bitcoinblu/bitcoinblu.conf` and restarts on failure.
5. Watch `bitcoinblu-cli getblockchaininfo` until `initialblockdownload` is false.

Stop and fix `bitcoin-blu` before continuing if any of these are true:

- `chain` is anything other than `main-blu`
- `blocks` stalls near 11,111, 33,333, or 48,500, or at the extra checkpoint added in 28.3.1
- `getblockhash 0` is not `0000000043770b6cd3992ee9602eaa941d8a5de392c1f1baf1f55eb9cd898be6`
- `pruned` is true
- height is far from `circulating_supply / 50` on `https://www.bitcoin-blu.org/api/bblu/chain/v1/`

Done when the node is at the tip, `pruned` is false, `txindex` serves `getrawtransaction` for an old txid, and the genesis hash matches. Then set `dbcache=512` and `maxmempool=64` and restart the node once.

## Phase 3 — Local ElectrumX

Starts only after phase 2’s stop condition has passed.

1. Clone <https://github.com/bitcoin-blu/electrumx> and record the commit (lever L8). The tree must contain the `BitcoinBlu` coin class (`NET = main-blu`, genesis hash above).
2. Install it under `/opt/electrumx` with its documented Python environment. Environment from architecture section 5.4: `COIN=BitcoinBlu`, `NET=main-blu`, `CACHE_MB=256`, `SERVICES=tcp://127.0.0.1:50001`, `DB_DIRECTORY=/var/lib/electrumx`. `DAEMON_URL` uses the same `rpcauth` secret and `127.0.0.1:8342`.
3. systemd unit `electrumx.service`, `After=bitcoinblu.service`, restart on failure.
4. Let it index to the node tip. On this chain that index is small. Keep Docker stopped while it catches up.

Done when an Electrum client on the host can call `server.version` and `blockchain.headers.subscribe` on `127.0.0.1:50001`, and the header tip matches `bitcoinblu-cli getblockcount` within a few blocks.

## Phase 4 — Import the fork

This stream starts immediately. It does not need the server.

1. Record the mempool `master` commit that will be imported (lever L7) in architecture section 9.11.
2. Bring that tree into <https://github.com/bitcoin-blu/bitcoinbluexplorer>, keeping `docs/architecture.md` and this plan. One import. Further upstream changes are hand-picked later (ADR-001).
3. Add the AGPL license already in the upstream tree and a footer credit to The Mempool Open Source Project. The product name and logo are BBLU Block Explorer and the Bitcoin-Blu mark from <https://www.bitcoin-blu.org/logo/bitcoin-blu.svg>. Do not ship mempool trademarks.

Done when the repository builds the upstream frontend and backend at the pinned commit, before BBLU edits.

## Phase 5 — BBLU edits in the fork

Still in the repository. Apply architecture section 5.3 and the configuration in section 5.2.

1. Address tables in `frontend/src/app/shared/address-utils.ts` and `regex.utils.ts`: pubkey `B`, script `b`, bech32 `bb1`. Match `bb1` before a single leading `b`.
2. Reject a pasted WIF (version `0xbc`, leading `7` or `U`) in the search box and keep it out of logs.
3. `bitcoin.utils.ts`: `rbf` 0, `segwit` 0, Taproot inactive. `app.constants.ts`: Bitcoin-Blu genesis label, halving captions in BBLU at 210,000 × n, no Taproot banner at height 709,632.
4. Titles, navigation, and assets say BBLU Block Explorer. Remove Lightning and Liquid routes from the UI.
5. Turn off `OFFICIAL`, replication, automatic pool updates, external data server URLs, accelerations, and the upstream BTC price feed.
6. Add a price poller for `https://www.bitcoin-blu.org/api/bblu/averageprice/v1/`. Display `average_price` with the label USDT and the payload `timestamp`. Keep the last good value when the poll fails.
7. Add `deploy/pools.json`, empty at launch (lever L5). Point the pool loader at that file.
8. Backend startup refuses to serve when `getblockhash 0` mismatches, `chain` is not `main-blu`, or `pruned` is true (architecture section 6.5).
9. Compose file for this repo:
   - services `web`, `api`, `db` only
   - `web` publishes `127.0.0.1:8080:8080` and nothing on 80 or 443
   - MariaDB `innodb_buffer_pool_size=256M`, data under `/var/lib/bblu-explorer`
   - `extra_hosts: ["host.docker.internal:host-gateway"]`
   - RPC port 8342, Electrum `50001` with TLS off, both via `host.docker.internal`
   - secrets from an env file on the server, mode `0600`, not from git

Done when a local or CI build shows a BBLU title, accepts the three address shapes, rejects `bc1` and `1…`, and the image list contains no `bitcoin` service.

## Phase 6 — Website on the server

Starts when phase 2 is synced, phase 3 is caught up, and phase 5 has an image tag.

1. From inside the `api` container, call the node and Electrum through `host.docker.internal`. `rpcbind=127.0.0.1` alone is invisible to the container. Add the host-gateway address to `rpcbind` and `rpcallowip`, and add the same address to ElectrumX `SERVICES`, so both listen on loopback and on the Docker bridge. The public firewall still drops 8342 and 50001.
2. Load the image tag. `docker compose up -d`. Confirm a restart of the compose project does not restart `bitcoinblu.service` or `electrumx.service`.
3. Read the backend log for the Electrum `server.version` banner and for a successful RPC `getblockchaininfo`.
4. Walk one block, one transaction, and one address through `http://127.0.0.1:8080` on the server.

Done when those three pages render BBLU data and the backend stays unhealthy if pointed at a node with the wrong genesis. That negative check can be a unit test of the gate rather than a live misconfiguration.

## Phase 7 — Certificate and nginx

Can start as soon as phase 0’s DNS is live. The proxy to port 8080 waits until phase 6 answers on localhost.

1. Add the nginx `map` for `$connection_upgrade` and the server block in architecture section 7.5, plus a `limit_req` zone on `POST /api/tx`.
2. Issue the certificate:

```bash
sudo certbot --nginx -d blockexplorer.bitcoin-blu.org
```

3. Confirm `certbot.timer` is enabled and `certbot certificates` shows this name with more than 14 days left.
4. Confirm port 80 redirects to HTTPS and `/.well-known/acme-challenge/` is still reachable for renewal.

Done when a browser loads `https://blockexplorer.bitcoin-blu.org` with the Let’s Encrypt certificate and the homepage follows the node tip.

## Phase 8 — Acceptance

Run architecture section 10 against the public site. Record the result of each row.

| Check | How |
| --- | --- |
| Genesis gate | Covered in phase 6. |
| `bb1`, `B…`, `b…` | Open one of each that `validateaddress` accepts. History loads. |
| `bc1` and `1…` | The UI rejects them. |
| WIF | Paste a throwaway test key shape. It is refused and absent from nginx and backend logs. |
| Isolation | Public scan finds 22, 80, 443, 8343. It does not find 8342, 50001, 3306, 8080. |
| HTTPS | Certificate name is `blockexplorer.bitcoin-blu.org`. HTTP redirects. |
| Broadcast | One raw transaction from a test wallet is accepted or rejected by the node, and a tight loop is limited by nginx. |
| Index lag | ElectrumX tip is visible if it falls behind. The homepage still uses the node. |
| Price | The number is labeled USDT and carries the API timestamp. Stopping the poll leaves the previous value. |
| Rebuild | Retag the frontend. `bitcoinblu-d` and ElectrumX keep the same PID start time. |
| License | Footer links to `https://github.com/bitcoin-blu/bitcoinbluexplorer`. |
| Labels | No BTC price, no Bitcoin pool name, no Taproot-activated banner. Halving text says BBLU. |

Also run one RPC method the backend uses that might be newer than this node (`getrawmempool`, `getblocktemplate` or the fee-estimation calls the log shows). If a call is missing, disable the feature that needs it or patch that call. Do not announce the site on a partial mempool view without noting it.

## Phase 9 — Launch

1. Push the pinned commit and the image tag. The public footer must match that commit.
2. Leave the pool file empty until real coinbase tags are known. Unknown pools stay unknown.
3. Tell users the site is an additional explorer. Leave the other two explorers in place.
4. After the first day, check disk free (goal: at least 20 GB), memory pressure, and that `certbot.timer` is scheduled.

## Suggested calendar

The node sync is the long pole, and on this chain it should be hours, not days, unless a checkpoint stops it. The fork work fills that wait.

| When | Stream A | Stream B | Stream C |
| --- | --- | --- | --- |
| Day 0 | Phases 0–1, start phase 2 | DNS record | Phase 4 import |
| While the node syncs | Watch height | Certificate once DNS answers, proxy still a placeholder | Phase 5 edits |
| Node at tip | Phase 3 ElectrumX | | Images built |
| Index caught up | Phase 6, then point nginx at 8080 | Phase 7 completed | |
| Same day if the checks pass | Phase 8 and 9 | | |

## What you still set during the work

| Lever | When it is filled |
| --- | --- |
| L3 Ubuntu release | Phase 0 |
| L5 pool file | Empty through launch. Edit `deploy/pools.json` when tags are known. |
| L6 P2P 8343 public | Phase 1. Default is open. |
| L7 mempool commit | Phase 4, written into the architecture |
| L8 ElectrumX commit | Phase 3, written into the architecture |
