# bewary

Scam checks from the terminal, on the [Bewary API](https://bewary.app/docs): a link, domain, phone number, SMS short
code, email, IP address, crypto wallet, IBAN, app or payment handle, plus related domains and watches that send an
event when a domain, number, wallet or brand changes. No install. Every command needs an API key, and a free key gets
1,000 credits a month at [bewary.app/account](https://bewary.app/account).

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

## Commands

`url <url>` · `domain <domain>` · `phone <number>` · `shortcode <code>` ·
`email <address>` · `ip <ip>` · `wallet <chain> <address>` · `iban <iban>` · `app <store> <app_id>` ·
`payment-handle <provider> <handle>` · `related <domain>` · `watch <type> <value>` · `watches` · `unwatch <id>` ·
`events`: one per tool of the [Bewary MCP server](https://bewary.app/mcp), each the same call as its API endpoint.
`bewary --help` lists them all.

- `--json` prints the API's answer as it came.
- `--fail-on suspicious|scam` exits 2 when the verdict reaches it: a gate for scripts and CI.
- `--key`, or `BEWARY_API_KEY`, the key every command needs.

Exit codes: 0 answered, 1 failed, 2 the verdict reached `--fail-on`. Node 18 or newer, no dependencies.

Full guide: https://bewary.app/docs/cli
