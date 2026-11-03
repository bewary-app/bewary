# Bewary

Bewary is a scam detection API and MCP server for apps and AI agents: phishing, fraud and threat intelligence lookups for developers, trust and safety teams and agent builders. It looks up a link, domain, IP address, phone number, SMS short code, email address, crypto wallet, IBAN, mobile app or payment handle, and returns a verdict (`scam`, `suspicious`, `safe` or `unknown`), the probability that it is a scam, the facts behind it and reason codes your code can branch on. Unknown is never safe.

This repository holds the clients: the `bewary` CLI and the setup files for MCP clients (Claude Code, Cursor, Gemini CLI). The API and its data are a hosted service at [bewary.app](https://bewary.app).

- Docs: https://bewary.app/docs
- MCP server: `https://api.bewary.app/mcp` (streamable HTTP, 15 tools)
- OpenAPI: https://api.bewary.app/v1/openapi.json
- Official MCP Registry: `app.bewary/bewary`

A free key gets 1,000 credits a month, no card: https://bewary.app/account. A lookup costs 1 credit. Prepaid credit packs start at $20 and never expire.

## MCP: give an agent scam checks

Clients that support sign-in (Claude, ChatGPT, Claude Code, Cursor) can connect to `https://api.bewary.app/mcp` and sign in to Bewary with OAuth. Any client can send an API key as an `Authorization: Bearer` header instead.

**Claude Code**

```bash
claude mcp add --transport http bewary https://api.bewary.app/mcp \
  --header "Authorization: Bearer $BEWARY_API_KEY"
```

Or install this repository as a plugin, which adds the MCP server and a skill that tells the agent when to check:

```
/plugin marketplace add bewary-app/bewary
/plugin install bewary@bewary
```

**Claude and ChatGPT apps:** add a custom connector with the URL `https://api.bewary.app/mcp` and sign in when asked.

**Cursor** (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "bewary": {
      "url": "https://api.bewary.app/mcp",
      "headers": { "Authorization": "Bearer YOUR_BEWARY_API_KEY" }
    }
  }
}
```

**VS Code** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "bewary": {
      "type": "http",
      "url": "https://api.bewary.app/mcp",
      "headers": { "Authorization": "Bearer YOUR_BEWARY_API_KEY" }
    }
  }
}
```

**Windsurf** (`mcp_config.json`):

```json
{
  "mcpServers": {
    "bewary": {
      "serverUrl": "https://api.bewary.app/mcp",
      "headers": { "Authorization": "Bearer YOUR_BEWARY_API_KEY" }
    }
  }
}
```

**Gemini CLI:** `gemini extensions install https://github.com/bewary-app/bewary` asks for your key and stores it in the keychain.

### Tools

| Tool | What it answers |
|---|---|
| `lookup_url` | Is this link safe to open, or a phishing or malware link? Resolves shorteners and redirects and checks where it really goes. |
| `lookup_domain` | Domain age, lookalike-brand technique, abused TLD, blocklist status and a verdict. |
| `related_domains` | Other domains that share an IP address, name servers, a certificate, a registrar or a page template with this one. |
| `lookup_ip` | Network owner, ASN, country, hosting type, reverse DNS. |
| `lookup_phone` | Country, number type, FTC and FCC complaints and a verdict for a phone number. |
| `lookup_shortcode` | Who operates a US SMS short code, and whether it is legitimate, shared or a scam code. |
| `lookup_email` | Mail server, disposable or free provider, role mailbox and the sender domain's facts. |
| `lookup_wallet` | Scam reports, OFAC sanctions and Tether and Circle freezes for a crypto wallet. |
| `lookup_iban` | Whether an IBAN is valid, its bank name and BIC, and a mismatch with the country the payee claims. |
| `lookup_app` | Whether an app is live on the App Store or Google Play, or was pulled. |
| `lookup_payment_handle` | Whether a Cash App, PayPal.me or Venmo handle exists, is active and is on a scam list. |
| `watch`, `unwatch`, `list_watches`, `list_events` | Follow a domain, phone number, wallet or brand and read the events when it changes. |

Lookups are read-only. `watch` and `unwatch` change only your account's watches.

## CLI: scam checks from the terminal

No install, Node 18 or newer:

```bash
export BEWARY_API_KEY="bw_..."
npx bewary url https://amazon-orders-help.top/confirm
```

```text
Scam  ▂▄▆█  p_scam 0.9116

High    Fake domain (brand + suspicious TLD)  DOMAIN_BRAND_ON_ABUSED_TLD
Medium  Lookalike domain                      DOMAIN_LOOKALIKE_BRAND_WORD

url     https://amazon-orders-help.top/confirm  Scam
domain  amazon-orders-help.top                  Scam
```

Commands: `url`, `domain`, `phone`, `shortcode`, `email`, `ip`, `wallet`, `iban`, `app`, `payment-handle`, `related`, `watch`, `watches`, `unwatch`, `events`. `--json` prints the API's answer as it came, and `--fail-on suspicious|scam` exits 2 when the verdict reaches it, which fails a CI step. Source: [`cli/`](cli/). Full guide: https://bewary.app/docs/cli

## REST API

```bash
curl -s "https://api.bewary.app/v1/url?u=https://amazon-orders-help.top/confirm" \
  -H "Authorization: Bearer $BEWARY_API_KEY"
```

Every lookup returns the same envelope: `verdict`, `p_scam`, `reason_codes`, `entities` with typed facts, and `signals` with their source class. Verdicts come from evidence, not a language model: phishing and malware feeds, FTC Do Not Call and FCC complaints, CERT Polska, OFAC sanctions, certificate transparency logs and Bewary's own DNS history. Endpoints, prices and response formats: https://bewary.app/docs

## What is in this repository

| Path | What it is |
|---|---|
| `cli/` | Source of the [`bewary`](https://www.npmjs.com/package/bewary) npm package |
| `.claude-plugin/`, `.mcp.json`, `skills/` | Claude Code plugin and marketplace |
| `.cursor-plugin/`, `mcp.json` | Cursor plugin |
| `gemini-extension.json`, `GEMINI.md` | Gemini CLI extension |
| `server.json` | The server's entry in the official MCP Registry |

## License

MIT for everything in this repository. Use of the Bewary API is covered by the [terms](https://bewary.app/terms) and [privacy policy](https://bewary.app/privacy). Questions: support@bewary.app
