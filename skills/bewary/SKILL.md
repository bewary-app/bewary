---
name: bewary
description: "Bewary is a scam detection API and MCP server for apps and AI agents. It looks up links, domains, IP addresses, phone numbers, SMS short codes, email addresses, crypto wallets, IBANs, mobile apps and payment handles, and its watches send an event when a watched domain, number, wallet or brand changes. The CLI runs as `npx bewary` with no install, with one command per MCP tool. Use when a user asks whether a link, number, address or account they received is a scam, and before an agent opens a link, calls or texts a number, pays or replies."
---

# Bewary: scam, phishing and fraud detection

Each check and lookup returns `verdict` (`scam`, `suspicious`, `safe` or `unknown`), `p_scam`, `reason_codes`, `classification`, `entities` with their own `verdict` and typed `facts`, and `signals` with source class and weight. Use the MCP tools when they are installed, the CLI when the agent can run shell commands, and the REST API when it calls from code.

## When to check, and what to do with the verdict

Before you open a link, and before you advise the user about a link in a message, look it up with lookup_url. Look up every link in the message, not only the first.
- scam: do not open it. Tell the user it looks like a scam and why, from the reason codes.
- suspicious: do not open it without the user's confirmation.
- unknown, or the lookup failed: say you could not confirm it is safe. Never treat unknown as safe.
- safe: continue.

`unknown` means insufficient evidence or a failed source, so never treat it as safe. If `degraded` is true, a source failed and Bewary never returns `safe`. Ask the user to recheck later. State the verdict and strongest reason plainly.

## MCP

The MCP server is at `https://api.bewary.app/mcp` (streamable HTTP). It has 15 tools and runs the same code as the API. In Claude Code:

```bash
claude mcp add --transport http bewary https://api.bewary.app/mcp \
  --header "Authorization: Bearer $BEWARY_API_KEY"
```

Install steps for Cursor, VS Code, Windsurf and the Claude and ChatGPT apps are on the [MCP page](https://bewary.app/mcp). Every tool call needs your key, as an `Authorization: Bearer` header or at the end of the URL. MCP apps that support sign-in, such as Claude and ChatGPT, can sign in to Bewary instead.

| Tool | What it answers | Credits |
|---|---|---|
| `lookup_url` | Is this link safe to open? Resolves shorteners and redirects and checks where it really goes; on a shortener, says whether the shortener itself disabled, flagged or removed the link. | 1 credit, deep 30 |
| `lookup_domain` | Domain age, lookalike-brand technique, abused TLD, blocklist status and a verdict. | 1 credit, deep 30 |
| `related_domains` | Which other domains share infrastructure or a kit with this one: the same IP address, /24, ASN or name servers (from Bewary's own DNS history), one certificate, a registrar and registration time, a page template or a tracking id. Each relation has a strength; CDNs and shared hosting are not pivoted on. Each related domain carries its own verdict. A relation is a link, not proof of common ownership. | 5 credits a page; API key required |
| `lookup_ip` | Network owner, ASN, country, hosting type, reverse DNS. | 1 credit |
| `lookup_phone` | Country, number type, blocklist status and a verdict for a phone number. | 1 credit, with line type 10 |
| `lookup_shortcode` | Who operates this SMS short code, and is it legitimate, shared or a scam code? | 1 credit |
| `lookup_email` | Mail server, disposable or free provider, role mailbox, and the sender domain's facts. | 1 credit |
| `lookup_wallet` | Is this wallet on Bewary's scam list? | 1 credit |
| `lookup_iban` | Is this IBAN valid (country length and structure, check digits), which bank does it belong to (name, BIC), and did a community report name it? Pass the country the payee claims to catch a mismatch. | 1 credit |
| `lookup_app` | Is this app live on the Apple App Store or Google Play, or did the store pull it? Name, developer, rating count and when we first and last saw it live. | 1 credit |
| `lookup_payment_handle` | Does this Cash App $Cashtag, PayPal.me name or Venmo username exist, is it active, and is it on Bewary's scam list? Existence and status only, never the person's name. | 1 credit |
| `watch` | Get events when a domain, phone number, wallet or brand changes: a domain's IP addresses, name servers, down/up/parked, re-registered, expiring or expired; a listing or delisting; a new lookalike domain of a brand. Watching it again updates the event types. | 1 credit a day (a brand watch also 1 per lookalike event); API key required |
| `unwatch` | Delete a watch: no more events or charges. Its events stay readable. | free |
| `list_watches` | Every live watch on the account. | free; API key required |
| `list_events` | Events of the account's watches, oldest first. Keep next_cursor and pass it as cursor to read only what came after. | free; API key required |

## CLI

### Run it, no install

```bash
npx bewary url https://amazon-orders-help.top/confirm
```

The CLI printed this answer for the link in a fake Amazon delivery text. It includes the verdict, `p_scam`, the reason codes, and the link and its domain, each with its verdict.

```text
Scam  ▂▄▆█  p_scam 0.9116

High    Fake domain (brand + suspicious TLD)  DOMAIN_BRAND_ON_ABUSED_TLD
Medium  Lookalike domain                      DOMAIN_LOOKALIKE_BRAND_WORD

url     https://amazon-orders-help.top/confirm  Scam
domain  amazon-orders-help.top                  Scam

req_01M6A6HXWF86METPG24EPK22Z9
```

To keep it installed: `npm install -g bewary`. It needs Node 18 or newer and nothing else.

### Commands

One command per tool of the [MCP server](https://bewary.app/mcp), each the same call as the API endpoint beside it.

| Command | Checks | API |
|---|---|---|
| `bewary url <url>` | A link, with its redirects and the domain behind it | `GET /v1/url` |
| `bewary domain <domain>` | A domain: age, registrar, lookalike brands | `GET /v1/domain/{host}` |
| `bewary phone <number>` | A phone number, in E.164 form like `+18008291040` | `GET /v1/phone/{number}` |
| `bewary shortcode <code>` | A US SMS short code | `GET /v1/shortcode/US/{code}` |
| `bewary email <address>` | An email address and its domain | `GET /v1/email/{address}` |
| `bewary ip <ip>` | An IP address: network, country, hosting | `GET /v1/ip/{ip}` |
| `bewary wallet <chain> <address>` | A crypto wallet on `btc`, `eth`, `trx`, `ltc`, `sol`, `xmr` or `dash` | `GET /v1/wallet/{chain}/{address}` |
| `bewary iban <iban>` | A bank account number: valid or not, and the bank it belongs to | `GET /v1/iban/{iban}` |
| `bewary app <store> <app_id>` | An app on `apple` (its numeric id) or `google_play` (its package name): live, or pulled by the store | `GET /v1/app/{store}/{app_id}` |
| `bewary payment-handle <provider> <handle>` | A `cashapp`, `paypal` or `venmo` handle: whether it exists and is active | `GET /v1/payment-handle/{provider}/{handle}` |
| `bewary related <domain>` | Other domains that share an address, name servers, a certificate or a page template with it (API key only) | `GET /v1/domain/{host}/related` |

`bewary --help` lists every option. The ones a command adds:

- `phone`: `--line-type`, the live line type (API key only).
- `url` and `domain`: `--deep`, to read the linked page (API key only).
- `iban`: `--claimed-country`, the country the payee says they are in. An IBAN from another country is flagged.
- `related`: `--page` and `--per-page`, up to 50 domains a page.

### Watch a domain, number, wallet or brand

With an API key, `watch` sends you an event when something changes: a domain moves to new addresses or goes down, a number or wallet is listed, a new lookalike of a brand appears.

| Command | Does | API |
|---|---|---|
| `bewary watch <type> <value>` | Starts a watch on a `domain`, `phone`, `wallet` or `brand`. `--events` picks the event types | `POST /v1/watches` |
| `bewary watches` | Lists your watches, active or paused | `GET /v1/watches` |
| `bewary unwatch <id>` | Stops a watch | `DELETE /v1/watches/{watch_id}` |
| `bewary events` | Reads your watches' events, oldest first. `--cursor` continues where the last page ended | `GET /v1/events` |

### Use it in scripts and CI

`--fail-on suspicious` (or `scam`) makes the exit code the decision, and `--json` prints the API's answer as it came:

```bash
if ! npx bewary url "$LINK" --fail-on suspicious; then
  echo "Not opening $LINK"
fi

npx bewary domain "$DOMAIN" --json | jq -r '.verdict'
```

Exit codes: `0` answered, `1` failed (bad input, no network, an API error), `2` the verdict reached `--fail-on`.

### Your key

Every command needs an API key: set `BEWARY_API_KEY` or pass `--key`. A free key gets 1,000 credits a month, no card.

```bash
export BEWARY_API_KEY="bw_..."   # your key, from bewary.app/account
npx bewary url "$LINK" --deep
```

## REST

- Base URL: https://api.bewary.app. Auth: `Authorization: Bearer <key>` or `X-Api-Key` on every call.
- Free: a free key gets 1,000 credits a month, no card. Every call needs a key.
- Rate limit: 600 requests a minute per key.

| Job | Call | Credits | Speed |
|---|---|---|---|
| [Is this link safe to open?](https://bewary.app/docs/url.md) | `GET /v1/url` | 1 credit, deep=true 30 | median 477 ms |
| [How old is this domain, and does it imitate a brand?](https://bewary.app/docs/domain.md) | `GET /v1/domain/{host}` | 1 credit, deep=true 30 | median 449 ms |
| [Is this phone number reported for scams?](https://bewary.app/docs/phone.md) | `GET /v1/phone/{number}` | 1 credit, line_type=true 10 | median 115 ms |
| [Who sends texts from this short code?](https://bewary.app/docs/shortcode.md) | `GET /v1/shortcode/{country}/{code}` | 1 credit | median 113 ms |
| [Is this email address disposable?](https://bewary.app/docs/email.md) | `GET /v1/email/{address}` | 1 credit | median 211 ms |
| [Who runs this IP address, and is it on a scam list?](https://bewary.app/docs/ip.md) | `GET /v1/ip/{ip}` | 1 credit | median 260 ms |
| [Is this crypto wallet on a scam list?](https://bewary.app/docs/wallet.md) | `GET /v1/wallet/{chain}/{address}` | 1 credit | median 127 ms |
| [Is this IBAN valid, and which bank is it at?](https://bewary.app/docs/iban.md) | `GET /v1/iban/{iban}` | 1 credit | - |
| [Is this app still live on its store?](https://bewary.app/docs/app.md) | `GET /v1/app/{store}/{app_id}` | 1 credit | - |
| [Does this Cash App, PayPal or Venmo handle exist?](https://bewary.app/docs/payment-handle.md) | `GET /v1/payment-handle/{provider}/{handle}` | 1 credit | - |
| [Which other domains run on the same setup?](https://bewary.app/docs/related.md) | `GET /v1/domain/{host}/related` | 5 credits | - |
| [Do a new seller's contact points check out?](https://bewary.app/docs/assess.md) | `POST /v1/assess` | 1 credit per field | - |
| [Check up to 1,000 values in one request](https://bewary.app/docs/batch.md) | `POST /v1/batch` | 1 credit per value | - |

## What Bewary keeps

A lookup keeps no record of who asked. A looked-up domain is queued for its web-archive history and a looked-up app is recorded as seen on its store. API keys are stored as SHA-256 hashes.

## Docs

- [Scam checks for AI agents](https://bewary.app/docs/ai-agents.md)
- [Bewary CLI](https://bewary.app/docs/cli.md)
- [Act on a verdict](https://bewary.app/docs/verdicts.md)
- [Keys, limits and errors](https://bewary.app/docs/authentication.md)
- [Response format](https://bewary.app/docs/response.md)
- [Reason codes](https://bewary.app/docs/reason-codes.md)
- [Watches, events and webhooks](https://bewary.app/docs/watches.md)
- [Bulk files and backtests](https://bewary.app/docs/bulk.md)
- [Datasets and calibration](https://bewary.app/docs/datasets.md)
- [Changelog](https://bewary.app/docs/changelog.md)
- [OpenAPI](https://api.bewary.app/v1/openapi.json)
- [All docs in one file](https://bewary.app/llms-full.txt)
