// The bewary CLI: one command per MCP tool, built from lib/spec.json (scripts/gen.mjs). No dependencies, Node 18+.
// Everything a command can send comes from the spec; this file only parses, calls and prints.
import { readFileSync } from 'node:fs'

const SPEC = JSON.parse(readFileSync(new URL('./spec.json', import.meta.url), 'utf8'))
export const VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const ORDER = ['safe', 'unknown', 'suspicious', 'scam']
const LEVEL = { safe: 1, unknown: 2, suspicious: 3, scam: 4 }
const WORD = { safe: 'Safe', unknown: 'Unknown', suspicious: 'Suspicious', scam: 'Scam' }

export class UsageError extends Error {}

// ---------- arguments

const kebab = (s) => s.replace(/_/g, '-')
const GLOBAL = { key: 'value', api: 'value', 'fail-on': 'value', json: 'flag', 'no-color': 'flag', help: 'flag', version: 'flag' }

export function parse(argv) {
  const out = { command: null, positionals: [], flags: {} }
  const cmdSpec = () => SPEC.commands.find((c) => c.command === out.command)
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '-h') { out.flags.help = true; continue }
    if (a === '-v') { out.flags.version = true; continue }
    if (a.startsWith('--')) {
      let [name, value] = a.slice(2).split(/=(.*)/s, 2)
      const opt = cmdSpec()?.args.find((x) => !x.required && kebab(x.name) === name)
      const kind = GLOBAL[name] || (opt ? (opt.type === 'boolean' ? 'flag' : 'value') : null)
      if (!kind) throw new UsageError(`unknown option --${name}`)
      if (kind === 'flag') { out.flags[name] = value === undefined ? true : value !== 'false'; continue }
      if (value === undefined) { value = argv[++i]; if (value === undefined) throw new UsageError(`--${name} needs a value`) }
      out.flags[name] = value
      continue
    }
    if (!out.command) out.command = a
    else out.positionals.push(a)
  }
  return out
}

// ---------- the request

export function request(cmd, positionals, flags, { api = SPEC.api, key = '' } = {}) {
  const c = SPEC.commands.find((x) => x.command === cmd)
  if (!c) throw new UsageError(`unknown command "${cmd}". Run bewary --help`)
  const required = c.args.filter((a) => a.required)
  const values = {}
  const pos = [...positionals]
  if (pos.length < required.length) throw new UsageError(`usage: bewary ${c.command} ${usage(c)}`)
  if (pos.length > required.length) throw new UsageError(`bewary ${c.command} takes ${required.length} value${required.length > 1 ? 's' : ''}; quote text with spaces`)
  required.forEach((a, i) => { values[a.name] = pos[i] })
  for (const a of c.args.filter((x) => !x.required)) {
    const v = flags[kebab(a.name)]
    if (v !== undefined) values[a.name] = v
    else if (a.default !== undefined && a.where === 'path') values[a.name] = a.default
  }
  // a list option is typed comma-separated: --events domain.down,domain.up
  for (const a of c.args) if (a.type === 'array' && values[a.name] !== undefined)
    values[a.name] = String(values[a.name]).split(',').map((s) => s.trim()).filter(Boolean)
  for (const a of c.args) for (const v of [values[a.name]].flat()) if (a.enum && v !== undefined && !a.enum.includes(v))
    throw new UsageError(`${a.required ? a.name : `--${kebab(a.name)}`} must be one of: ${a.enum.join(', ')}`)
  for (const a of c.args) if (a.type === 'integer' && values[a.name] !== undefined && !/^\d+$/.test(String(values[a.name])))
    throw new UsageError(`--${kebab(a.name)} must be a whole number`)

  let path = c.path
  const query = new URLSearchParams(), body = {}
  for (const a of c.args) {
    const v = values[a.name]
    if (v === undefined) continue
    if (a.where === 'path') path = path.replace(`{${a.http}}`, encodeURIComponent(String(v)))
    else if (a.where === 'query') query.set(a.http, [v].flat().join(','))
    else {                                       // a dotted name sits inside a body object: entity.type
      const keys = a.http.split('.'), last = keys.pop()
      const at = keys.reduce((o, k) => (o[k] ??= {}), body)
      at[last] = a.type === 'integer' ? Number(v) : v
    }
  }
  const headers = { accept: 'application/json', 'user-agent': `bewary-cli/${VERSION} node/${process.versions.node}` }
  if (key) headers.authorization = `Bearer ${key}`
  if (c.method === 'POST') headers['content-type'] = 'application/json'
  const qs = query.toString()
  return { command: c, method: c.method, url: `${api.replace(/\/$/, '')}${path}${qs ? `?${qs}` : ''}`, headers,
    body: c.method === 'POST' ? JSON.stringify(body) : undefined }
}

/** The verdict an answer carries, for --fail-on: a lookup's own, or the looked-up domain's in a related answer. */
export const verdictOf = (b) => b?.verdict ?? b?.domain?.verdict

// ---------- the answer

const ANSI = { scam: 31, suspicious: 33, safe: 32, unknown: 90, dim: 90, bold: 1 }
const paint = (on) => (code, s) => (on ? `\x1b[${ANSI[code] ?? code}m${s}\x1b[0m` : s)
const words = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '')
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** The rising four-bar mark, filled to the verdict's level (safe 1 ... scam 4). */
export const meter = (v, c = paint(false)) => {
  const n = LEVEL[v] || 2
  return c(v, '▂▄▆█'.slice(0, n)) + c('dim', '▂▄▆█'.slice(n).replace(/./g, '·'))
}

const STORE = { apple: 'the App Store', google_play: 'Google Play' }
const PROVIDER = { cashapp: 'Cash App', paypal: 'PayPal', venmo: 'Venmo' }
const n = (x) => Number(x).toLocaleString('en-US')
const join = (...xs) => xs.filter(Boolean).join(', ')
const complaints = (k, x) => x?.count ? `${n(x.count)} ${k} complaint${x.count === 1 ? '' : 's'} on ${n(x.days)} day${x.days === 1 ? '' : 's'}, last ${day(x.last_at)}` : null
/** The facts of one looked-up value, as [label, value] rows (a row whose value is missing is left out). */
const FACTS = {
  domain: (f) => [
    f.registered_at && ['registered', join(day(f.registered_at), f.registrar)],
    f.registered === false && ['registered', 'no'],
    f.tld && ['tld', `.${f.tld}${f.tld_abuse && f.tld_abuse !== 'low' ? `, ${f.tld_abuse} abuse` : ''}`],
    f.status && ['status', f.status]],
  phone: (f) => [
    ['number', join(f.number_type !== 'unknown' && words(f.number_type), f.country, f.original_carrier)],
    (f.complaints?.ftc || f.complaints?.fcc) && ['complaints', join(complaints('FTC', f.complaints.ftc), complaints('FCC', f.complaints.fcc))]],
  shortcode: (f) => [f.operator?.name && ['sender', f.operator.name], ['status', words(f.status)]],
  email: (f) => [['mailbox', f.disposable ? 'disposable' : f.role_account ? 'role account' : f.free_provider ? 'free provider' : 'own domain'],
    f.mx != null && ['mail server', f.mx ? 'yes' : 'none']],
  ip: (f) => [f.asn && ['network', `AS${f.asn} ${f.as_org || ''}`.trim()], f.hosting_type && ['hosting', f.hosting_type], f.reverse_dns && ['reverse dns', f.reverse_dns]],
  iban: (f) => [f.bank?.name && ['bank', join(f.bank.name, f.bank.bic && `BIC ${f.bank.bic}`)],
    ['iban', join(f.print_form, f.valid ? 'valid' : `invalid${f.invalid_reason ? ` (${words(f.invalid_reason).toLowerCase()})` : ''}`, f.sepa && 'SEPA')]],
  app: (f) => [f.name && ['app', join(f.name, f.developer)], ['status', `${f.status} on ${STORE[f.store] || f.store}`]],
  payment_handle: (f) => [['profile', `${f.status} on ${PROVIDER[f.provider] || f.provider}`]],
}

export function render(b, headers = {}, { color = false } = {}) {
  const c = paint(color), L = SPEC.words.labels, lines = []
  const v = b.verdict
  lines.push(`${c(v, c('bold', WORD[v] || v))}  ${meter(v, c)}  ${c('dim', 'p_scam')} ${Number(b.p_scam ?? 0).toFixed(4)}`)
  const cls = b.classification || {}
  const kv = []
  if (cls.impersonated_brand?.name) kv.push([L.impersonates, cls.impersonated_brand.name])
  if (cls.ask && cls.ask !== 'none') kv.push([L.ask, SPEC.words.ask[cls.ask] || words(cls.ask)])
  if (cls.artifact_type) kv.push([L.artifact_type, words(cls.artifact_type)])
  if (kv.length) { lines.push(''); const w = Math.max(...kv.map(([k]) => k.length)); kv.forEach(([k, x]) => lines.push(`${c('dim', k.padEnd(w))}  ${x}`)) }
  const sev = Object.fromEntries((b.signals || []).map((s) => [s.code, s.severity]))
  // the codes that decided the verdict, then any other non-info signal (an IBAN's country mismatch can leave it unknown)
  const codes = [...new Set([...(b.reason_codes || []), ...(b.signals || []).filter((s) => s.severity && s.severity !== 'info').map((s) => s.code)])]
  // a code with no plain label yet (API-CONTRACT §7) prints once, in the label's place
  const reasons = codes.map((code) => { const label = SPEC.codes[code]?.[0] || code
    return [words(sev[code] || SPEC.codes[code]?.[1] || 'info'), label, label === code ? '' : code] })
  if (reasons.length) {
    lines.push('')
    const w0 = Math.max(...reasons.map((r) => r[0].length)), w1 = Math.max(...reasons.map((r) => r[1].length))
    reasons.forEach(([s, label, code]) => lines.push(code ? `${s.padEnd(w0)}  ${label.padEnd(w1)}  ${c('dim', code)}` : `${s.padEnd(w0)}  ${label}`))
  }
  const ents = (b.entities || []).slice(0, 8)
  // a single looked-up value: the typed facts a person reads first (the bank behind an IBAN, a number's complaints);
  // every other field is in --json
  const facts = ents.length === 1 ? (FACTS[ents[0].type]?.(ents[0].facts || {}) || []).filter(Boolean) : []
  if (facts.length) {
    lines.push('')
    const w = Math.max(...facts.map(([k]) => k.length))
    facts.forEach(([k, x]) => lines.push(`${c('dim', k.padEnd(w))}  ${cut(String(x), 64)}`))
  }
  if (ents.length > 1) {
    lines.push('')
    const w0 = Math.max(...ents.map((e) => e.type.length)), vals = ents.map((e) => cut(String(e.value), 52)), w1 = Math.max(...vals.map((x) => x.length))
    ents.forEach((e, i) => lines.push(`${c('dim', e.type.padEnd(w0))}  ${vals[i].padEnd(w1)}  ${ORDER.includes(e.verdict) ? c(e.verdict, WORD[e.verdict]) : ''}`))
  }
  return [...lines, ...footer(b.request_id, headers, c)].join('\n')
}

function footer(id, headers, c) {
  const left = headers['x-free-remaining'] ?? headers['X-Free-Remaining']
  const credits = headers['x-credits-remaining'] ?? headers['X-Credits-Remaining']
  const s = (n) => (Number(n) === 1 ? '' : 's')
  const tail = [id, left != null ? `${left} free lookup${s(left)} left today`
    : credits != null ? `${credits} credit${s(credits)} left` : null].filter(Boolean)
  return tail.length ? ['', c('dim', tail.join(' · '))] : []
}

/** Columns padded to their widest cell; `dim` names the columns printed dimmed, a cell may be [text, colour]. */
function table(rows, c, dim = []) {
  const text = (x) => (Array.isArray(x) ? x[0] : String(x ?? ''))
  const w = rows[0]?.map((_, i) => Math.max(...rows.map((r) => text(r[i]).length))) || []
  return rows.map((r) => r.map((x, i) => {
    const s = i < r.length - 1 ? text(x).padEnd(w[i]) : text(x)
    return Array.isArray(x) && x[1] ? c(x[1], s) : dim.includes(i) ? c('dim', s) : s
  }).join('  ').trimEnd())
}

const day = (t) => (t ? String(t).slice(0, 10) : '')
const minute = (t) => (t ? String(t).slice(0, 16).replace('T', ' ') : '')
const verdictCell = (v) => (ORDER.includes(v) ? [WORD[v], v] : '')
const state = (x) => (x == null ? '-' : Array.isArray(x) ? (x.join(', ') || '-') : /^\d{4}-\d\d-\d\dT/.test(x) ? day(x) : String(x))

/** What an event changed, from its before and after (only the fields the change is about are present). */
function change(e) {
  const a = e.after || {}, b = e.before || {}
  if (a.domain) return `${a.domain}${a.technique ? ` (${words(a.technique).toLowerCase()})` : ''}`
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter((k) => k !== 'within_days')
  const s = keys.slice(0, 2).map((k) => `${k} ${k in b ? `${state(b[k])} → ` : ''}${state(a[k])}`).join('; ')
  return a.within_days != null ? `${s}${s ? '; ' : ''}within ${a.within_days} days` : s
}

/** The answers that are records, not verdicts: related domains, watches, a deleted watch, events. */
export function renderRecord(answer, b, headers = {}, { color = false } = {}) {
  const c = paint(color), lines = []
  if (answer === 'RelatedResponse') {
    const d = b.domain || {}
    lines.push(`${d.value}  ${c(d.verdict, c('bold', WORD[d.verdict] || d.verdict))}  ${meter(d.verdict, c)}  ${c('dim', 'p_scam')} ${Number(d.p_scam ?? 0).toFixed(4)}`)
    lines.push('', `${b.total} related domain${b.total === 1 ? '' : 's'}${b.truncated ? ' (the strongest 500)' : ''}${b.has_more ? `, page ${b.page}` : ''}`)
    const rels = (r) => [...new Set((r.relations || []).map((x) => x.kind.replace(/_/g, ' ')))].join(', ')
    if (b.related?.length) lines.push(...table(b.related.map((r) => [r.strength, cut(r.domain, 48), verdictCell(r.verdict), rels(r)]), c, [0, 3]))
    const used = (b.pivots || []).filter((p) => p.used)
    if (used.length) lines.push('', `${c('dim', 'Through')}  ${used.map((p) => `${p.kind.replace(/_/g, ' ')} ${cut(p.value, 24)}${p.domains != null ? ` (${p.domains} domains)` : ''}`).join(' · ')}`)
    for (const k of b.campaigns || []) lines.push(`${c('dim', 'Campaign')}  ${k.kind.replace(/_/g, ' ')} ${cut(k.value, 24)}: ${k.domains} domains, ${k.listed} listed`)
    if (b.has_more) lines.push('', c('dim', `Next page: bewary related ${d.value} --page ${b.page + 1}`))
    return [...lines, ...footer(b.request_id, headers, c)].join('\n')
  }
  if (answer === 'WatchCreated' || answer === 'WatchList') {
    const list = answer === 'WatchList' ? b.watches || [] : [b]
    if (answer === 'WatchCreated') {
      lines.push(`${b.created ? 'Watching' : 'Already watching'} ${b.entity.type} ${b.entity.value}`, '')
      lines.push(...table([['Events', b.events?.length ? b.events.join(', ') : 'all'], ['Status', b.status],
        ['Paid until', day(b.paid_until)], ['Costs', `${b.credits_per_day} credit${b.credits_per_day === 1 ? '' : 's'} a day`], ['Id', b.id]], c, [0]))
      return [...lines, ...footer(null, headers, c)].join('\n')
    }
    if (!list.length) return 'No watches yet. Start one: bewary watch domain <domain>'
    lines.push(...table(list.map((w) => [w.id, w.entity.type, cut(w.entity.value, 48), w.status === 'paused' ? ['paused', 'suspicious'] : w.status,
      `${w.events?.length || 'all'} event${w.events?.length === 1 ? '' : 's'}`, w.last_event_at ? `last ${minute(w.last_event_at)}` : '']), c, [0, 4, 5]))
    return [...lines, ...footer(null, headers, c)].join('\n')
  }
  if (answer === 'Deleted') return b.deleted ? `Stopped watching: ${b.id}` : `No live watch ${b.id}`
  if (answer === 'EventPage') {
    if (!b.events?.length) lines.push('No events yet.')
    else lines.push(...table(b.events.map((e) => [minute(e.at), e.type, cut(e.entity?.value || '', 40), change(e)]), c, [0]))
    if (b.has_more) lines.push('', c('dim', `More: bewary events --cursor ${b.next_cursor}`))
    return [...lines, ...footer(null, headers, c)].join('\n')
  }
  return JSON.stringify(b, null, 2)
}

// ---------- help

const usage = (c) => c.args.filter((a) => a.required).map((a) => `<${a.name === c.file ? 'file' : a.name}>`).join(' ')

export function help() {
  const w = Math.max(...SPEC.commands.map((c) => `${c.command} ${usage(c)}`.length))
  const rows = SPEC.commands.map((c) => {
    const use = `${c.command} ${usage(c)}`
    const opts = c.args.filter((a) => !a.required).map((a) => `--${kebab(a.name)}${a.type === 'boolean' ? '' : a.type === 'array' ? ` <${a.name},...>`
      : a.enum ? ` <${a.enum.join('|')}>` : ` <${a.name}>`}`).join(' ')
    return `  ${use.padEnd(w)}  ${c.title}${opts ? `\n  ${''.padEnd(w)}  ${opts}` : ''}`
  })
  return [`bewary ${VERSION}: scam checks from the terminal, on the Bewary API (${SPEC.api})`, '',
    'Usage: bewary <command> <value> [options]', '', 'Commands:', ...rows, '',
    'Options:',
    '  --json              print the API answer as JSON',
    '  --fail-on <level>   exit 2 when the verdict is this or worse: suspicious or scam',
    `  --key <key>         API key (or BEWARY_API_KEY), needed for every command. A free key gets ${SPEC.free.monthly_credits.toLocaleString('en-US')} credits a month: https://bewary.app/account`,
    '  --no-color          plain output (also NO_COLOR)', '',
    'Examples:',
    '  bewary url https://amazon-orders-help.top/confirm --fail-on suspicious',
    '  bewary phone +18008291040', '',
    'Exit codes: 0 answered, 1 failed, 2 the verdict reached --fail-on. Docs: https://bewary.app/docs/cli'].join('\n')
}

// ---------- run

export async function main(argv, { env = process.env, stdout = process.stdout, stderr = process.stderr, fetchImpl = fetch } = {}) {
  let args
  try { args = parse(argv) } catch (e) { stderr.write(`bewary: ${e.message}\n`); return 1 }
  const f = args.flags
  if (f.version) { stdout.write(`${VERSION}\n`); return 0 }
  if (f.help || !args.command || args.command === 'help') { stdout.write(help() + '\n'); return args.command || f.help ? 0 : 1 }
  if (f['fail-on'] && !['suspicious', 'scam'].includes(f['fail-on'])) { stderr.write('bewary: --fail-on must be suspicious or scam\n'); return 1 }
  const cmd = SPEC.commands.find((x) => x.command === args.command)
  if (f['fail-on'] && cmd && !['Envelope', 'RelatedResponse'].includes(cmd.answer)) { stderr.write(`bewary: ${cmd.command} answers with no verdict, so --fail-on does not apply\n`); return 1 }
  let req
  try {
    req = request(args.command, args.positionals, f, { api: f.api || env.BEWARY_API || SPEC.api, key: f.key || env.BEWARY_API_KEY || '' })
  } catch (e) { stderr.write(`bewary: ${e.message}\n`); return 1 }
  let res, body
  try {
    res = await fetchImpl(req.url, { method: req.method, headers: req.headers, body: req.body, signal: AbortSignal.timeout(20000) })
    body = await res.json().catch(() => null)
  } catch (e) { stderr.write(`bewary: could not reach ${new URL(req.url).origin} (${e.message})\n`); return 1 }
  if (!res.ok) {
    const msg = body?.error?.message || `HTTP ${res.status}`
    const after = res.headers.get('retry-after')
    stderr.write(`bewary: ${msg}${res.status === 429 && after ? ` (retry in ${after}s)` : ''}\n`)
    return 1
  }
  if (f.json) stdout.write(JSON.stringify(body, null, 2) + '\n')
  else {
    const color = !f['no-color'] && !('NO_COLOR' in env) && (stdout.isTTY || env.FORCE_COLOR)
    const headers = Object.fromEntries(res.headers.entries())
    const { kind, answer } = req.command
    stdout.write((kind === 'record' ? renderRecord(answer, body, headers, { color }) : render(body, headers, { color })) + '\n')
  }
  if (f['fail-on'] && LEVEL[verdictOf(body)] >= LEVEL[f['fail-on']]) return 2
  return 0
}
