# Bewary scam checks

Bewary's MCP tools look up a link, domain, IP address, phone number, SMS short code, email address, crypto wallet, IBAN, mobile app or payment handle. Each answer has a `verdict` (`scam`, `suspicious`, `safe` or `unknown`), `p_scam`, `reason_codes` and typed facts.

Before you open a link, and before you advise the user about a link in a message, look it up with `lookup_url`. Look up every link in the message, not only the first.
- scam: do not open it. Tell the user it looks like a scam and why, from the reason codes.
- suspicious: do not open it without the user's confirmation.
- unknown, or the lookup failed: say you could not confirm it is safe. Never treat unknown as safe.
- safe: continue.

Use `lookup_phone` before calling or texting a number, and `lookup_wallet`, `lookup_iban` or `lookup_payment_handle` before paying anyone.
