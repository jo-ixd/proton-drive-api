# Proton Drive API — architecture

Status: design reviewed and accepted for implementation on 2026-11-16. Score after revision: 8/10. Implementation has not started. Operator confirmation of the MVP cut is the remaining gate.

The official client is Proton Drive CLI `0.9.0` (`cli-drive`), source tag [`cli/v0.9.0`](https://github.com/ProtonDriveApps/sdk/tree/cli/v0.9.0/cli) in [ProtonDriveApps/sdk](https://github.com/ProtonDriveApps/sdk). Download index: <https://proton.me/download/drive/cli/index.html>. Support article: <https://proton.me/support/drive-cli>.

## Outcome

`docker compose up` on a headless machine prints a Proton sign-in URL. The operator opens that URL on any device, completes login once, and the container keeps the session. An agent then calls the HTTP API with a bearer token. The token's scopes and path prefixes decide what the process is willing to ask the CLI to do.

A folder-backup token can upload into `/my-files/Backups/agent` and download that tree back to `/data`. It cannot trash, permanently delete, share, or address the rest of the drive.

## What the CLI actually is

These constraints come from the `0.9.0` command sources, not from a local binary (none is installed on the design machine).

- One official binary with Bun embedded. No apt package and no official image. Pin the binary by version and SHA-512. Do not build it from source: a source build reports a different `x-pm-appversion` than Proton's `cli-drive` builds.
- Linux glibc artifacts for `0.9.0`: `linux-x64` and `linux-arm64`. Musl artifacts exist and are the wrong choice for a Debian image. The README mentions `linux/x64-baseline`, and that file is not on the `0.9.0` index. Old CPUs without AVX2 may fail the `linux-x64` build; that gap stays documented until Proton publishes a baseline build.
- There is no sync daemon and no search command in this version. Backup means a one-shot `filesystem upload`. Pull means a one-shot `filesystem download`.
- Login is `proton-drive --json auth login`. It prints `{"signInUrl":"..."}` and waits. `xdg-open` fails silently when no browser exists, which is what we want in a container. The URL can be opened on another device. The CLI never takes the Proton password.
- The stored session is the whole account. The CLI cannot scope it to a folder. One account per data directory.
- Headless credential stores that exist in this version: `pass` (supported since `0.6.0`) and `unsafe_file` (plaintext `auth-session.json`, marked testing-only in the CLI README). The default `keychain` store needs a D-Bus secret service and fails on a server.
- `PROTON_DRIVE_CACHE_DIR` puts cache, app data, and logs in one directory.
- `--json` turns off interactive conflict prompts. If a name conflicts and no strategy was passed, the CLI throws. Every upload and download this API launches passes an explicit strategy.
- Upload file strategies: `skip`, `create-new-revision`, `rename`, `replace`. Upload folder strategies: `skip`, `merge`, `rename`, `replace`. The string `replace` trashes the existing remote node and then uploads. Download strategy `remove` deletes the local file.
- Identical content is skipped automatically on upload.
- A path segment that matches the node-UID pattern is resolved with a global UID lookup, not as a child of the parent. Prefix checks on the raw string do not contain that. The pattern is `^([a-zA-Z0-9=_-]{88,108}|[a-zA-Z0-9_-]{22})~([a-zA-Z0-9=_-]{88,108}|[a-zA-Z0-9_-]{22})$`.
- The CLI classifies a path as My Files with a prefix check on `/my-files` that has no segment boundary. This API matches on segment boundaries so `/my-files-evil` and `/my-files/Backups-evil` stay outside a grant for `/my-files/Backups`.
- `filesystem delete` only permanently deletes items that are already in trash, and trash paths are `/trash/<name>` looked up by name across the trash. `empty-trash` is global.
- `photo upload` takes local paths only, flattens folders, accepts `image/*` and `video/*`, and writes to the Photos timeline. Its strategies are `skip` and `rename`. There is no remote folder argument.
- `photo download` of exactly `/photos` walks the whole timeline. Albums live under `/albums/<name>`.
- Roots the CLI understands: `/my-files`, `/devices`, `/shared-by-me`, `/shared-with-me`, `/trash`, `/albums`, `/photos`, `/photos-shared-by-me`, `/photos-shared-with-me`, `/photos-trash`.
- The CLI is `0.x`. Conflict flags have already been renamed once. The Drive SDK README says a crypto-model migration is coming and that the SDK is not GA for third-party production. Wrapping the official binary matches Proton's published automation path. This project does not call Proton's HTTP API itself.

Pinned checksums, copied from the `0.9.0` index on 2026-11-16. The image build hashes the downloaded file and fails if it differs.

| Artifact | SHA-512 |
| --- | --- |
| `linux-x64` | `3533025ba69ae112b64e3e01fbcc1ad0688136a4043f6cf6a72886967d85fdcd9ec235479c2e113171614be5225bfba93427509a05ca5aa6071d924fa7e91ca8` |
| `linux-arm64` | `c8d5a6b174e57f06d05cb5483400b9963faf58e743b6b33706bb73ecff718047ffce6b439994255b94b5b226b90d2e91bef7418ec96c1c3f5d8bf39b6cd01321` |

URL shape: `https://proton.me/download/drive/cli/0.9.0/<artifact>/proton-drive`.

## Threat model

The API is an application gate in front of a god-mode session.

A stolen agent token can do only what that token's scopes, prefixes, and strategy allowlist allow. That is the blast radius this project exists to shrink.

Someone who can execute code in the container, or read the state volume, can use the Proton session directly. Docker stops the host user from casually running an unrestricted CLI on the host. It does not stop host root from reading the volume. A passphrase-less GPG key sitting next to a `pass` store is the same fact: volume read equals session theft. Say that in the runtime logs once at startup.

A separate Proton account, used only for the backups this agent should touch, is the boundary that still holds after the container is compromised. The design recommends it and does not require it.

Trust assumptions for the path jail: `/data` is not writable by other untrusted local users. The API `realpath`s a local path immediately before spawn. It does not try to beat a hostile host.

## Process model

One container. The code that allows a call is the code that builds the argument vector. There is no generic "run this CLI string" endpoint, and no sidecar. A sidecar that trusts the API adds a hop. A sidecar that repeats the policy has two implementations of the gate.

`replicas: 1`. One in-process queue, one CLI child at a time. The CLI keeps a shared SQLite cache and publishes no concurrency contract.

The container runs as a non-root user with `cap_drop: ALL`, `no-new-privileges`, a read-only root filesystem, and a tmpfs on `/tmp`.

Two volumes:

- State, mounted at `/var/lib/proton-drive-api`. Holds `PROTON_DRIVE_CACHE_DIR`, `GNUPGHOME`, `PASSWORD_STORE_DIR`, the API's SQLite database, and the audit log. Mode `0700`.
- Staging, mounted at `/data`. Agent local paths resolve under prefixes inside `/data` only. The state directory is not inside `/data`.

`PROTON_DRIVE_BIN` selects the binary. Production points it at the pinned `proton-drive`. Tests point it at the stub. The API never shells out with `shell: true`.

## Image and credentials

Debian glibc base, multi-arch. The Dockerfile downloads the pinned binary for the target architecture and checks the SHA-512 above.

Default `PROTON_DRIVE_CREDENTIALS_STORE=pass`. On first boot the entrypoint creates a no-passphrase GPG key in the state volume and initializes `pass`, with `GNUPGHOME` and `PASSWORD_STORE_DIR` on that volume so the read-only root filesystem still works.

If `pass` or `gpg` setup fails, the process exits non-zero and prints the error. It does not switch to `unsafe_file`. An operator who sets `PROTON_DRIVE_CREDENTIALS_STORE=unsafe_file` opts in explicitly, and the log states that Proton marks that store testing-only.

The first implementation task is a spike that proves unattended `pass` login under the production constraints: non-root, dropped capabilities, read-only root, tmpfs `/tmp`, state on the volume, no TTY. That spike is a release gate. Keychain plus D-Bus is not the homelab path.

## Login

When the state volume has no session, the process starts `proton-drive --json auth login` unless `PROTON_LOGIN=manual`. It parses `signInUrl` from stdout, writes that URL to the container logs once, and serves it from `GET /admin/session` while login is pending. The agent port, `/health`, and the audit log do not receive the URL.

Login holds the CLI queue. Agent routes answer `503` until the session exists. They do not sit in a queue behind a 15-minute login. The login attempt times out at 15 minutes by default and can be started again from the admin API.

`auth logout` is admin-only and requires a confirmation header. It ends the session for every token.

## Network

| Port | Inside the container | Published in the example Compose file | What it serves |
| --- | --- | --- | --- |
| Agent | `0.0.0.0:8080` | Operator's choice, often the LAN | Drive routes. Bearer agent tokens only. |
| Admin | `0.0.0.0:8081` | `127.0.0.1:8081:8081` | Token mint, list, revoke, session status, logout. Bearer admin token only. |

The Node process listens on all interfaces so Docker's port proxy can reach it. Publishing `127.0.0.1:8081:8081` is what keeps admin on the host's loopback. Publishing `8081:8081` would put admin on every host interface; the example file does not do that.

Docker's proxy never reaches a service bound only to the container's loopback, so the server does not bind admin to `127.0.0.1` inside the container. `network_mode: host` is unsupported in the example. Someone who turns it on sets `ADMIN_BIND=127.0.0.1` themselves.

Any other container on the same Compose network can open `api:8081`. The admin token is still required. Do not attach untrusted containers to that network.

Agent tokens are rejected on admin routes. The admin token is rejected on agent routes.

`/health` is unauthenticated and returns `{"ok":true}` with no session detail. `/ready` returns `503` until login has finished, and it does not include the URL.

No cookies, no CORS. Bearer tokens only. Failed authentication is rate-limited. Request bodies are size-limited. Logs redact `Authorization`. The one intentional login URL line on stdout is the exception, and it is not copied into structured audit fields.

## Tokens

`ADMIN_TOKEN` is required, at least 32 characters, compared in constant time. Prefer a Docker secret. `docker inspect` shows environment variables.

Agent tokens are 32 random bytes, displayed once, prefixed `pda_` so they can be spotted in a log, and stored as SHA-256 only.

Compose can declare one agent token. That covers the "set the permissions in the environment" path:

- `AGENT_TOKEN`
- `AGENT_SCOPES` (comma-separated)
- `AGENT_REMOTE_READ_PREFIXES`
- `AGENT_REMOTE_WRITE_PREFIXES`
- `AGENT_LOCAL_READ_PREFIXES`
- `AGENT_LOCAL_WRITE_PREFIXES`
- `AGENT_UPLOAD_FILE_STRATEGIES`
- `AGENT_UPLOAD_FOLDER_STRATEGIES`
- `AGENT_DOWNLOAD_FILE_STRATEGIES`
- `AGENT_DOWNLOAD_FOLDER_STRATEGIES`

The database row is `source=env`. On each boot:

- The same token hash refreshes scopes and prefixes from the environment.
- A new `AGENT_TOKEN` value replaces the hash and clears an admin disable. That is an intentional rotation.
- An empty `AGENT_TOKEN` disables the row.
- An admin revoke sets `disabled_at`. A later restart leaves the row disabled while the hash is unchanged, even if the Compose file still contains the token.

Further tokens are created and revoked on the admin API. They survive restart. The environment file does not recreate them.

The sample Compose token is folder backup and pull only:

- Scopes: `files:list`, `files:info`, `files:mkdir`, `files:upload`, `files:download`
- Remote read and write prefix: `/my-files/Backups/agent`
- Local read and write prefix: `/data`
- Upload files: `skip`, `create-new-revision`. Upload folders: `merge`, `skip`.
- Download files: `skip`, `rename`. Download folders: `merge`, `skip`.

`photos:upload` and `photos:download` are real routes and are left out of that sample. A comment in the Compose example says photo upload writes to the whole Photos timeline and can fill quota, and that downloading `/photos` requires the extra scope `photos:download:timeline`.

Startup logs a warning when a write prefix is exactly `/my-files`, `/photos`, or `/albums`. The sample stays on a nested prefix.

## Authorization

Deny by default. Each route has one argument-vector template. Callers do not pass flags through.

Paths:

- Reject control characters and any path whose first character is `-`.
- Reject any remote segment that matches the UID pattern. MVP does not resolve UIDs. A file whose name happens to look like a UID cannot be addressed by an agent token.
- Prefix match is on whole segments. `/my-files/Backups` allows that path and its descendants. It does not allow `/my-files/Backups-evil`, `/my-files-evil`, or `/my-files`.
- Every remote path is explicit. List and info have no default path and will not list `/`.
- Listing or reading the parent of an allowed prefix is denied.
- These roots are denied unless a configured prefix actually covers that path: `/`, `/devices`, `/shared-by-me`, `/shared-with-me`, `/trash`, `/photos-trash`, `/photos-shared-by-me`, `/photos-shared-with-me`.
- Local paths are `realpath`'d and must remain inside the token's local read prefix (upload source) or local write prefix (download destination).

Strategies come from the token's allowlist, not from an open string. The sample allowlist has no `replace` and no `remove`. The upload route rejects `replace` unless that token's allowlist contains it. The API always sends the chosen strategy so `--json` cannot drop into a prompt.

`files:list` and `files:info` require the path to sit under a remote read prefix. `files:upload` and `files:mkdir` require the remote path to sit under a remote write prefix, and the local source under a local read prefix. `files:download` requires each remote path under a remote read prefix and the local folder under a local write prefix.

Photo upload has no remote path. The scope `photos:upload` is an account-wide add into the Photos timeline. It cannot delete. Photo download requires a prefix under `/photos` or `/albums`. The exact path `/photos` is refused unless the token also has `photos:download:timeline`.

Audit each allow and each deny: time, token id, route, decision, reason, the argument vector with no secrets, exit code, duration, job id. No file contents and no sign-in URL.

## MVP routes

Long work returns `202` and a job id. List, info, and mkdir run in the request and use a short timeout.

| Method and path | Scope | CLI | Job |
| --- | --- | --- | --- |
| `GET /v1/nodes?path=` | `files:list` | `filesystem list --json <path>` | No |
| `GET /v1/nodes/info?path=` | `files:info` | `filesystem info --json <path>` | No |
| `POST /v1/folders` | `files:mkdir` | `filesystem create-folder --json <path>` | No |
| `POST /v1/uploads` | `files:upload` | `filesystem upload --json` with file and folder strategies and `--skip-thumbnails` | Yes |
| `POST /v1/downloads` | `files:download` | `filesystem download --json` with file and folder strategies | Yes |
| `POST /v1/photos/uploads` | `photos:upload` | `photo upload --json --conflict-strategy <skip\|rename>` | Yes |
| `POST /v1/photos/downloads` | `photos:download` | `photo download --json --conflict-strategy <allowlisted>` | Yes |

Update is an upload with `create-new-revision`. Folder backup is `POST /v1/uploads`. Pull is `POST /v1/downloads`.

`--skip-thumbnails` defaults on for `filesystem upload` so a missing image codec does not fail a document backup. Photo upload cannot skip thumbnails; the CLI refuses that, and this API does not try.

Job rules:

- Ids are unguessable. A token lists only its own jobs. Admin can list all.
- `Idempotency-Key`: the same token, key, and body returns the existing job. The same key with a different body returns `409`.
- Cancel sends `SIGTERM` to that child. A cancelled upload or download can leave a partial remote object or a partial local folder.
- The worker is the single CLI queue.

Errors: `401` unknown or revoked token, `403` scope, prefix, or strategy, `404` unknown route, `409` idempotency conflict, `502` CLI failure, `503` no session yet.

### Not registered in the MVP

No route exists for rename, copy, move, trash, permanent delete, empty trash, sharing, invitations, public URLs, or takeout. A backup token cannot call them, and a bug in a strategy allowlist cannot reach them either, because the argument templates are not in the process.

That is a deliberate cut. The operator's fear is a compromised agent deleting cloud backups. Leaving those commands unwired is a stronger guarantee than a scope that defaults to off.

Milestone 2 can add `files:trash` (reversible, prefix-scoped) and `files:purge` (permanent). Purge stays account-wide even then, because `/trash/<name>` is a global name lookup, and the token-creation response has to say so. `empty-trash` stays admin-only if it is added at all. Sharing and takeout stay out until there is a specific need: takeout exports the account, and sharing can create a public URL.

## Tests

`npm test` and `npm run test:e2e` need no Proton account. Future work on this repo is expected to run those before calling a change done.

- Policy tests, table-driven: segment boundaries, parent-of-prefix denial, UID segments, leading `-`, `replace` rejected for the sample allowlist, `realpath` escape, `/photos` timeline refusal without `photos:download:timeline`.
- Argument-vector snapshots for every route.
- A stub executable implementing the wrapped subset: JSON login URL, list, info, create-folder, upload, download, photo upload, photo download, the real strategy names, and exit codes `0`, `1`, and `2`. Under `--json`, a missing strategy is a non-zero exit. The stub appends every invocation to a log.
- End-to-end tests start the API with `PROTON_DRIVE_BIN` pointed at the stub. They assert a backup token receives `403` for anything outside its grant, and they assert the stub log never contains `trash`, `delete`, `empty-trash`, `replace`, or `sharing`.
- A checked-in contract manifest describes the `0.9.0` commands this API wraps. The route table must be a subset of that manifest.
- CI downloads the pinned binary and compares `proton-drive <command> --help` to a snapshot. That catches flag renames without a Proton login. It does not upload anything.

The stub proves the gate and the argument vectors. It does not prove Proton's servers. Swapping `PROTON_DRIVE_BIN` to the real binary is the live path, and it stays off unless `PROTON_LIVE=1`.

## Stack

Node 22, TypeScript, Fastify, zod, `node:sqlite`, vitest, pino. `node:sqlite` avoids a native addon so the read-only image stays simple. One package. OpenAPI from the Fastify schemas.

## Example Compose shape

The image and the entrypoint do not exist yet. This is the contract the file will meet.

```yaml
services:
  api:
    image: proton-drive-api
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    tmpfs: ["/tmp"]
    environment:
      ADMIN_TOKEN: ${ADMIN_TOKEN}
      AGENT_TOKEN: ${AGENT_TOKEN}
      AGENT_SCOPES: files:list,files:info,files:mkdir,files:upload,files:download
      AGENT_REMOTE_READ_PREFIXES: /my-files/Backups/agent
      AGENT_REMOTE_WRITE_PREFIXES: /my-files/Backups/agent
      AGENT_LOCAL_READ_PREFIXES: /data
      AGENT_LOCAL_WRITE_PREFIXES: /data
      PROTON_DRIVE_CREDENTIALS_STORE: pass
      PROTON_DRIVE_CACHE_DIR: /var/lib/proton-drive-api/cli
    volumes:
      - proton-state:/var/lib/proton-drive-api
      - ./staging:/data
    ports:
      - "8080:8080"
      - "127.0.0.1:8081:8081"
volumes:
  proton-state:
```

## Implementation order

1. `pass` login spike inside the hardened container. Stop if unattended `pass` cannot unlock.
2. Policy engine and its tables.
3. Argument-vector builder, stub binary, contract manifest, help snapshot.
4. Login URL handling and the `503` gate.
5. Jobs, then the seven routes.
6. Admin token CRUD and the env-token reconcile rules.
7. Compose file and the stub end-to-end run.

## Non-goals

An MCP adapter can sit on this HTTP API later. It does not get its own policy engine. Also out of scope: a web UI, more than one Proton account, a sync engine, more than one replica, sharing, and takeout.

## Review record

An architecture review scored the first draft 7/10. Four changes made it acceptable at 8/10:

- Admin listens on all container interfaces and the example publishes it only on the host loopback, with the Compose-network caveat recorded above.
- A failed `pass` setup exits. It does not fall through to `unsafe_file`.
- List and info take an explicit path under the read prefixes. Parent listing and unrelated roots are denied.
- MVP routes stop at list, info, mkdir, upload, download, and the two photo routes. Delete and trash are not implemented yet.

The review asked to keep, and this plan keeps: one process, no generic exec, the CLI mutex, UID rejection, segment prefixes, strategy allowlists, the env-token revoke that survives restart, the stub on the real exec path, and the honest limit of that stub.

## Operator confirmation before coding

One product choice should be confirmed before implementation starts. Milestone 1 has no trash and no permanent delete at all. A later milestone can add them as separate scopes, with purge labeled account-wide. That matches a backup agent that must not be able to wipe Drive, and it means a trusted token also cannot delete until that milestone exists.
