# Developer notes — MV3 bypass (Verge + FT + WSJ)

Reference for future breakage. Written Jul 2026 against Chrome 150 / Puppeteer 25.

## Why this fork is Manifest V3

The original extension is Manifest V2 (`manifest.v2.json` kept as backup).

- Chrome 150+ will not load MV2 unpacked extensions in normal branded Chrome.
- `--load-extension` was removed from branded Chrome (≈137+). Automated testing must use Puppeteer’s `enableExtensions: [path]` (or Chrome for Testing), not CLI flags.
- MV2 `webRequestBlocking` is gone. Network changes use `declarativeNetRequest` + `declarativeNetRequestWithHostAccess`.

Current MV3 surface: Verge, FT, WSJ, Economist, Telegraph, Times, Bloomberg, NYT, WaPo, Atlantic, New Yorker.

Full-text reality check (no Googlebot):
- **Works well**: Verge, FT, Telegraph (body usually in DOM once Piano blocked)
- **Often soft / meter**: NYT, WaPo, Atlantic, New Yorker, Bloomberg (overlay/script block; varies by article)
- **Teaser / UI only**: WSJ, Economist, Times (server gates body; Googlebot spoof risks IP bans)

## How to run / test

```powershell
cd "c:\Users\georg\Dev Work\bypass-paywalls-chrome-clean-magnolia1234"
npm install

# Interactive browsers with extension loaded
node launch-dev.mjs
node launch-dev.mjs "https://www.ft.com/"
node launch-dev.mjs "https://www.theverge.com/"
node launch-brave-native.mjs "https://www.wsj.com/"   # best for WSJ (no Puppeteer/CDP)
node launch-brave.mjs "https://www.wsj.com/"           # Brave via Puppeteer (still fingerprintable)
# launch-dev.mjs = Chrome for Testing — almost always Akamai-blocked on wsj.com

# Automated checks
node test-verge.mjs
node test-ft.mjs
node test-ft-fetch.mjs   # SW fetch of FT ld+json only
node test-wsj.mjs         # may exit 2 if Akamai blocks automation IP
node test-wsj-fixture.mjs # offline Piano cleanup / restore against saved HTML
node test-economist.mjs
node test-telegraph.mjs
node test-times.mjs
node test-bloomberg.mjs
```

Key files:

| File | Role |
|------|------|
| `manifest.json` | MV3 entry (host permissions, content scripts, DNR) |
| `manifest.v2.json` | Original MV2 backup |
| `rules.json` | DNR block / modifyHeaders rules |
| `background-sw.js` | Service worker; FT/WSJ article fetch fallback |
| `contentScript_verge_early.js` | Block Zephr scripts at `document_start` |
| `contentScript_ft_early.js` | Block FT barrier scripts at `document_start` |
| `contentScript_wsj_early.js` | Block Piano / TinyPass / Cxense + snip overlay nodes at `document_start` |
| `contentScript_wsj.js` | Dedicated WSJ CSS hide + DOM remove (not `contentScript.js`) |
| `contentScript_economist_early.js` | Block Piano / TinyPass at `document_start` |
| `contentScript_economist.js` | Strip regwall UI + restore `__NEXT_DATA__` body (teaser when walled) |
| `contentScript.js` | Site DOM cleanup + JSON restore |
| `sites.js` | Legacy site config (still useful as rule catalogue) |

---

## The Verge (`theverge.com`)

### Paywall mechanism

- Soft paywall via **Zephr** (`assets.zephr.com/zephr-browser/.../zephr-browser.umd.js`).
- Full article HTML is usually already in the page under `#zephr-anchor`.
- Zephr JS + first-party `/zephr/features` + `/zephr/feature-decisions` truncate/hide content and inject “Continue reading with a Verge subscription”.
- `application/ld+json` often still contains `articleBody` (fallback).

### What works (current)

1. DNR **block** `zephr.com` / `assets.zephr.com/zephr-browser` / `theverge.com/zephr/`.
2. Early content script removes Zephr script tags before execute.
3. Later content script removes overlay UI; if body is short, restore from `ld+json` `articleBody`.

### What we tried / failed

| Attempt | Result |
|---------|--------|
| Rely on existing MV2 install in Chrome 150 | Extension never loaded (no SW / background) |
| `--load-extension` CLI | Ignored on branded Chrome 150 |
| Googlebot UA | Unnecessary; content already in HTML |
| Remove `#zephr-anchor` | **Wrong** — that node holds the article |

### Breakage checklist

1. Confirm Zephr still loads: DevTools → Network → filter `zephr`. Should be `ERR_BLOCKED_BY_CLIENT` with extension on.
2. If Zephr domain/path changed, update `rules.json` + `contentScript_verge_early.js`.
3. If article is no longer in HTML (hard paywall), strengthen `ld+json` restore or find a new source (`__NEXT_DATA__`, etc.).
4. Re-run `node test-verge.mjs` — baseline should show paywall; with-ext should show full text (e.g. “RAMageddon”).

---

## Financial Times (`ft.com`)

### Paywall mechanism (as of Jul 2026)

- Hard subscribe shell in Chrome: title **“Subscribe to read”**, copy **“Subscribe to unlock this article”**.
- Server response is **fingerprint-sensitive**. Same URL can return full article HTML (with `ld+json` `articleBody`) or the subscribe shell depending on client signals.
- Article URLs look like `https://www.ft.com/content/<uuid>`.

### What works (current)

DNR `modifyHeaders` on `||ft.com/content/` and `||amp.ft.com/`:

1. Set `User-Agent` to **Firefox 128** desktop string.
2. Set `Referer` to `https://www.google.com/`.
3. **Remove** Chrome Client Hints: `sec-ch-ua`, `sec-ch-ua-mobile`, `sec-ch-ua-platform`, `sec-ch-ua-full-version-list`, etc.

Also:

- Block FT barrier helpers (`pg.ft.com/adapters/dotcom-article`, `financial-times-o-private-foundation`, barrier/paywall JS).
- Content script cleans barrier DOM; asks SW to `fetch` article and inject `articleBody` if still locked.
- Successful navigations sometimes land on `?syn-…=1` (FT syndication-style redirect) with full content.

### What we tried / failed

| Attempt | Result |
|---------|--------|
| **Googlebot UA** (classic BPC) | **403 Security Verification** — dead |
| Institutional proxy redirect (Durham/Harvard/Michigan) in old content script | Unreliable; removed from MV3 FT path |
| `ft_auto_redirect.js` → Google search for ezproxy links | Not used in MV3; aggressive UX |
| AMP URL `amp.ft.com/content/…` | Redirects to www with `?syn=…`; can help via curl, not the main fix |
| Google webcache / archive.is / Wayback | Cache miss / 429 / 404 for fresh articles |
| SW `fetch` with default Chrome identity | Got subscribe shell (no `articleBody`) until Firefox UA + referer applied via DNR |
| Spoof Googlebot via DNR | Triggered Cloudflare / “Just a moment…” |
| Rely only on DOM unhide | Browser often never receives article body nodes |

### Important curl findings (reproduce when debugging)

```powershell
$url = "https://www.ft.com/content/<uuid>"

# Often FULL article
curl.exe -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0" -e "https://www.google.com/" $url -o ft-ff.html

# Often SUBSCRIBE shell or flaky
curl.exe -sL -A "Mozilla/5.0 ... Chrome/150..." $url -o ft-chrome.html

# Googlebot — usually blocked
curl.exe -sL -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" -e "https://www.google.com/" $url -o ft-bot.html
```

Check for success: `<title>` is the headline (not “Subscribe to read”) and HTML contains `articleBody`.

Note: FT responses are flaky/rate-limited. Re-test the same UA twice before concluding a method is dead.

### Breakage checklist

1. Without extension: confirm hard paywall still appears.
2. With extension: Network request to `/content/…` should use Firefox UA + Google referer (DNR). Puppeteer’s `request.headers()` may still show Chrome UA — trust the **response** (title/body), not CDP’s pre-DNR view.
3. If Firefox UA starts getting subscribe shells: probe new UAs with curl (`Chrome/149`, other Firefox versions). Update `rules.json` id `30` / `31`.
4. If Client Hints return: ensure remove rules still match header names Chrome sends.
5. If HTML no longer embeds `articleBody`: SW fallback and content-script restore both fail — need a new extraction source.
6. Re-run `node test-ft.mjs` (homepage → click `/content/` link) and `node test-ft-fetch.mjs`.

---

## Wall Street Journal (`wsj.com`)

### Paywall mechanism (as of Jul 2026)

- Hard paywall via **Piano** (`cdn.tinypass.com`, `www.wsj.com/asset/piano/`, `piano.vx.wsj.com`) + Cxense.
- Article HTML includes `__NEXT_DATA__` with:
  - `isSnippetView: true` / `paywallIndex`
  - short `articleData.flattenedBody` (teaser only)
  - `encryptedDataHash` `{ content, iv }` + `encryptedDocumentKey` (full body AES-CTR encrypted)
- UI: `[class*="SnippetOverlay"]`, “Subscribe to continue reading”, not only legacy `.snippet-promotion`.
- Server may set `isServerUnlockedContent` / `hasBotUnlockHeader` for Googlebot (classic BPC path).
- `/client?legacy=false` can return `documentKey` when `x-original-url` carries a valid `st=` share token (WSJ Reddit links). Tokens expire (~7 days). Without a valid token, `documentKey` is empty for non-subscribers.
- AMP (`wsj.com/amp/...`) often redirects back to the Next.js page with the same Piano snippet.

### What works (current MV3)

1. **No request-header spoofing** for WSJ (Googlebot/Referer rewrites trip Akamai).
2. DNR **block** Cxense / TinyPass / Piano (`piano.io`, `wsj.com/asset/piano/`, **`piano.vx.wsj.com`**, `piano.auth.wsj.com`) / amp-access|subscriptions.
3. Content script strips Piano UI + shows public teaser only. **No Googlebot, no Google referer, no `/client` decrypt probes** (those trigger Akamai IP blocks).
4. **Hard limit:** full article body is AES-CTR in `encryptedDataHash`; without a valid `/client` `documentKey` (fresh `st=` share token or subscription) the page only has a 1–3 paragraph teaser. Googlebot unlock is dead under Akamai.
5. **Test in Brave** (`node launch-brave.mjs` or Load unpacked). Not `launch-dev.mjs`. Close DevTools.

### What we tried / failed

| Attempt | Result |
|---------|--------|
| DNR **Googlebot UA** | **“Access is temporarily restricted”** — removed |
| Chrome for Testing / `launch-dev.mjs` | Same Akamai restricted page (automation fingerprint) |
| Brave (normal browser) | Page loads (use this for WSJ) |
| Puppeteer / DevTools open | Captcha / restricted (“developer tools”) |
| Content script top-level `return` | Aborted WSJ handler — fixed |
| Expired Reddit `st=` tokens | `/client` returns empty `documentKey` |

### Breakage checklist

1. Restricted page → switch to Brave; do **not** use `launch-dev.mjs` for WSJ; close DevTools; reload extension.
2. Without extension: Piano / “Subscribe to continue reading”; `isSnippetView: true` in `__NEXT_DATA__`.
3. With extension in Brave: Piano scripts blocked; overlay removed / `#bpc_wsj_restored` if unlock/decrypt works.
4. Full body still missing → need `/client` `documentKey` or another source; UA spoofing is not viable.
5. `node test-wsj-fixture.mjs` for offline DOM checks; `node test-wsj.mjs` often exits `2` under Akamai.

---

## MV3 porting pattern (next sites)

1. Identify mechanism: cookie meter, script paywall (Piano/Zephr/Poool), UA gate, hard server shell.
2. Prefer DNR **block** for paywall scripts; **modifyHeaders** only when proven via curl.
3. Add `host_permissions` + `content_scripts` (`document_start` early blocker if needed).
4. Keep a DOM cleanup + structured-data fallback in `contentScript.js`.
5. Add a Puppeteer with/without-extension test before calling it done.
6. Do **not** assume Googlebot still works — verify.

## Known non-goals / caveats

- Cookie consent banners (FT “Cookies on FT Sites”, Verge privacy notice) are **not** the paywall; leave unless product asks.
- Extending to all `sites.js` domains needs a general MV3 background that rebuilds DNR rules from site config (not done yet).
- Enterprise policy / registry MV2 re-enable was attempted locally and blocked by permissions; not a viable team workflow.
