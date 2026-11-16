# Fin Modeler

A private, offline retirement and net-worth modeler. It installs to the iPhone Home Screen as a PWA, runs entirely in the browser, and keeps every figure on the device.

Built for a book-style foldable: a single-column layout on the folded cover screen, a master-detail workspace on the unfolded inner display.

## Privacy model

- **No server, no calls.** After the app loads it makes no network requests. No analytics, telemetry, fonts, or CDNs. Production builds ship a Content-Security-Policy that blocks every origin but the app's own.
- **Local storage only.** The plan lives in IndexedDB, with a localStorage fallback. Preferences and the passcode hash live in localStorage.
- **No personal data in this repository.** First launch loads a clearly labelled `Sample Preset` of generic round numbers. A guided setup builds your own plan in eight steps and saves nothing until you finish. `Reset to Sample` and `Clear to Blank` are under **Vault**.
- **Backups you control.** Export plain JSON, or an AES-256-GCM `.enc.json` sealed with a password (PBKDF2-SHA-256 key derivation, Web Crypto). Export the year-by-year projection as CSV. On iPhone the share sheet saves to Files or iCloud Drive.
- **App lock.** Optional 4 to 8 digit passcode, stored as a salted PBKDF2-SHA-256 hash, plus optional Face ID / Touch ID unlock through a device-bound WebAuthn passkey.
- **Numbers from many places.** Balance and spending fields have an "Add up" list: one line per account or bill, lines can subtract, the total fills the field, and the list is saved with the plan. Fields also accept sums such as `12000+48500`.
- **A friendly face.** Pip the nest egg (an inline SVG, no downloads) reflects how the plan is doing. Type uses the system rounded font.
- **Privacy Blur.** The eye in the top bar blurs every monetary value across cards, charts and tables.

One limit worth knowing: the passcode gates the screen. It does not encrypt the plan at rest in browser storage. For a copy that is safe to keep elsewhere, use the encrypted backup.

## Deploy to GitHub Pages

1. Push this repository to GitHub.
2. Open **Settings → Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` lints, tests, builds and publishes.
4. The app is served at `https://<user>.github.io/<repo>/`.

Asset paths are relative (`base: './'`), so the same build works under any `/<repo>/` subpath or a custom domain. Nothing needs configuring when the repository is renamed.

## Add to the iPhone Home Screen

1. Open the Pages URL in **Safari**.
2. Tap **Share**, then **Add to Home Screen**, then **Add**.
3. Launch it from the Home Screen icon. It opens full screen and works offline from then on.

Installing matters for durability. Safari can evict storage for sites that are not on the Home Screen after weeks without use. Installed apps keep theirs. Take an encrypted backup regardless.

Home Screen apps have storage separate from Safari tabs. Enter data in the installed app, or move it across with export and import.

## Develop

```bash
npm install
npm run dev        # local dev server
npm test           # engine unit tests
npm run lint       # eslint
npm run build      # type-check and production build into dist/
npm run preview    # serve the production build
```

Requires Node 20 or newer. Stack: React 19, TypeScript, Vite, Tailwind CSS 4, Lucide icons, `vite-plugin-pwa`. Charts are hand-written SVG.

## What it models

**Balance sheet.** Five liquid buckets (cash, domestic equities, foreign equities with FX rate, drift and volatility, fixed income, alternatives with a valuation haircut), a tax-deferred account, and CPF-style statutory accounts: Ordinary, Special / Retirement and Healthcare, each with its own rate. The healthcare account has a ceiling. Above it, contributions and interest overflow to the special or retirement account, then to the ordinary account. At the unlock age the Full or Enhanced Retirement Sum is locked in and the rest becomes accessible. A lifetime payout starts at the payout age.

**Property.** Value, mortgage (with an Ordinary Account / cash split), rent, running costs, and a tenancy lock-in before which no sale is possible. The app tracks statutory funds used for housing plus accrued interest, and splits sale proceeds for any chosen year into the refund to the locked account and the free cash that reaches accessible net worth.

**Income, tax, spending.** Gross or take-home salary, a bonus with low / base / high bands, net rent, dividends and coupons, decaying secondary income, progressive tax brackets, capped tax-deferred top-ups, and phased spending: working years, then a retirement multiplier or a custom budget, plus one-off and periodic expenses.

**Outputs.**

- Deterministic projection from today to age 95: headline versus accessible net worth.
- Liquidity bridge analyzer for the gap between retirement and the statutory unlock age.
- Hold versus sell comparator for the property.
- Annual cash-flow and net-worth table, exportable to CSV.
- Monte Carlo, 1,000 to 5,000 paths in a Web Worker: P10 / P25 / P50 / P75 / P90 fan charts for accessible and total net worth, probability of success, and bridge survival rate.

### Modeling conventions

- One step per year. Returns and interest accrue on opening balances. The year's net cash flow is saved or drawn at year end.
- Expected returns are compound annual rates. Monte Carlo draws lognormal returns whose median equals that rate, so each bucket's median path matches the deterministic line.
- A plan "succeeds" on a path when accessible assets cover spending in every year. Locked accounts and unsold property never fund a shortfall.
- One contribution rate and allocation applies to all working years. The lifetime payout is level in nominal terms. Tax brackets are not inflation-indexed. Dividends are untaxed. Rent is taxed after mortgage interest.

Every rate, cap, age and bracket is editable. Defaults are illustrative, Singapore-calibrated placeholders, and will drift from current rules over time.

## Layout

| Display | Trigger | Layout |
| --- | --- | --- |
| Cover, portrait | width under 680px | One column, bottom tab bar, details open as a bottom sheet |
| Cover, landscape | wide but under 500px tall | One column with a side rail |
| Inner, unfolded | at least 680 × 500px | Two equal panes either side of the fold: charts and scenario controls left, live detail right |

On the unfolded display the gutter between the panes sits on the hinge. The tab bar stops at the left pane's edge, chart tooltips are clamped inside their own pane, and nothing interactive crosses the fold. Where the browser exposes viewport segments, the panes align to the real hinge. `env(safe-area-inset-*)` is respected throughout.

## Structure

```
src/engine/      pure calculation engine and its tests (no DOM, no React)
src/workers/     Monte Carlo Web Worker
src/store/       app state, persistence wiring, worker orchestration
src/security/    Web Crypto (passcode hash, encrypted backup) and WebAuthn
src/components/  shell, UI primitives, SVG charts
src/views/       the five tabs
src/details/     expanded card breakdowns and plan editors
```

## Disclaimer

A planning aid with simplified rules. Not financial, tax or legal advice.
