# Getting Song Scratch onto the App Store

Written for a Windows machine with no Mac.

## The one thing that can't be worked around

**Apple's build tools only run on macOS.** There is no Windows path that produces a
signed `.ipa`. What you *can* avoid is owning, renting, or ever touching a Mac
yourself: a cloud CI service runs the build on its own machines from your git
repo, and hands the result straight to Apple. You configure it from Windows in a
browser.

Everything else — signing certificates, the app record, screenshots, the
paywall — is done in a browser and works fine from here.

**Unavoidable cost:** Apple Developer Program, **$99/year**. Nothing reaches the
App Store without it.

---

## 1. Apple Developer Program — already active

Membership is live and the Paid Applications agreement is signed, so nothing to
do here. The distribution certificate is **per team**: it already exists from
Easy as Tuning and must be reused, never reissued. Issuing a second one does not
break the first, but it burns one of the two slots a team gets.

## 2. The native shell — done, in the repo

Capacitor 8.5 wraps the app. `ios/` is **committed**, not generated on the build
machine, so the Info.plist edits below survive.

- **Bundle ID `com.songscratch.app`** — permanent, set in
  `capacitor.config.json` and `project.pbxproj`.
- **Deployment target iOS 15.0**, iPhone only (`TARGETED_DEVICE_FAMILY = 1`),
  portrait only.
- **Plugins:** `@capacitor/keyboard` and `@capacitor/status-bar`, both npm
  packages, so `cap sync` writes them into `packageClassList` itself. If a
  hand-written Swift plugin is ever added to the app target, its class name has
  to be put back into `ios/App/App/capacitor.config.json` after every sync —
  that file is regenerated, and a plugin missing from the list compiles, signs,
  ships, and can never be called.
- **`Info.plist`:** `NSMicrophoneUsageDescription` (the voice tab crashes
  without it), `ITSAppUsesNonExemptEncryption = false` so TestFlight stops
  asking on every upload, portrait-only orientations, `arm64` rather than the
  template's legacy `armv7`.
- **A shared scheme** at `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`,
  written by hand — Xcode puts schemes in gitignored `xcuserdata`, so CI would
  otherwise have nothing to build.
- **The launch screen is black.** The template's was `systemBackgroundColor`,
  which is white, over a stock splash image — a white flash on every cold launch
  of an app that is black edge to edge.
- **The app icon** comes from `assets/icon-master.png` — a square 1024 PNG,
  the one thing drawn by hand. `npm run icons` resizes it into every web size
  and writes the native one straight into the asset catalog as opaque RGB. An
  icon carrying an alpha channel is rejected at upload (ITMS-90717), after the
  build has already run. To change the icon: replace the master, run
  `npm run icons`, commit both.
- **The service worker does not register in the native shell.** The assets are
  already on the device; a worker holding the old bundle inside the WebView
  would keep serving it after an App Store update.

Capacitor 8 uses Swift Package Manager, not CocoaPods, so there is no `Podfile`
and nothing needs `pod install`.

## 3. Create the app record

In [App Store Connect](https://appstoreconnect.apple.com) - **My Apps -> +**.

- Platform iOS, bundle ID `com.songscratch.app`, an SKU (any private string).
- **The app name must be unique across the whole store.** Check "Song Scratch"
  is free before anything else.

You do **not** need to create a certificate or a provisioning profile by hand.
The build does that on its first run - see below.

## 4. Codemagic

`codemagic.yaml` is in the repo, workflow **`ios-testflight`**. Two things must
exist in the Codemagic UI before the first build:

1. **The App Store Connect integration**, already there under the name
   **"Easy as Tuning"** - referenced by `integrations.app_store_connect`.
2. **An environment group named `ios_signing`**, containing one variable:

   | Variable | Value |
   | --- | --- |
   | `CERTIFICATE_PRIVATE_KEY` | The whole contents of `C:\Users\Joe\Documents\easyastuning-signing\ios_distribution_key.pem`, `BEGIN`/`END` lines included. Mark it secure. |

   The App Store Connect API key does **not** carry this. Without it
   `keychain add-certificates` has a certificate and no private key to pair it
   with, and the build fails at signing.

   If your existing group is called something else, change the one line under
   `environment.groups`.

Signing is done by the CLI, not by `environment.ios_signing`: that block only
*fetches* files that already exist, and nothing exists for a bundle ID that has
never been built. `fetch-signing-files --create` registers the App ID and issues
the profile on the first run. The distribution certificate is per-team and
already exists - it is fetched, not reissued.

## 5. TestFlight

The first successful build appears in TestFlight within about 15 minutes. Install
TestFlight on your iPhone, accept the invite, and you have the real app — this is
also how you test on **other people's devices**, which is the only honest way to
check other screen sizes.

Expect the first two or three builds to fail on something small. That's normal.

## 6. The listing

Prepared in App Store Connect, all from Windows:

- **Screenshots.** Required sizes are listed in App Store Connect and change
  fairly often — check them there rather than trusting any guide. Your iPhone 12
  shots are 1170×2532 and will usually need scaling up to the largest required
  size; any image editor does this.
- **Privacy policy URL.** Required even though this app collects nothing. A
  single page saying "Song Scratch stores everything on your device and sends
  nothing anywhere" is enough. GitHub Pages will host it free.
- **App privacy questionnaire.** Answer **"Data Not Collected"** — true here, and
  it keeps the listing clean.
- Description, keywords, support URL, age rating (4+).

## 7. Submit

Review usually takes 24–48 hours. Common first-time rejections for an app like
this one: a missing permission reason string, a privacy policy URL that 404s, or
a paywall that isn't clear about what it costs before you buy.

---

## The paywall — where it fits

**It comes after step 5.** You need a build in TestFlight before you can test a
purchase at all, and the products are configured against the app record from
step 3.

Three things to know before you plan around it:

1. **It has to be In-App Purchase.** Unlocking features in an iOS app with
   Stripe or any other outside payment is against the rules and gets apps pulled.
   Digital content sold in an app goes through StoreKit, and Apple takes 15% for
   the first $1M/year (you'll be in the Small Business Program).
2. **The paperwork is the slow part.** Before you can sell anything you must sign
   the Paid Applications agreement and fill in banking and tax details in App
   Store Connect. Start this early — it involves a real bank account and a tax
   form, and can take longer than the review.
3. **Use RevenueCat rather than raw StoreKit.** `@revenuecat/purchases-capacitor`
   handles receipt validation, restoring purchases, and the "is this user
   entitled" question, all of which are miserable to write correctly. Free until
   about $2.5k/month of revenue.

### Order of work

1. Sign the Paid Applications agreement; fill in banking and tax.
2. Create the products in App Store Connect (a subscription, or a one-off
   "unlock everything" — the latter suits an app like this).
3. Add the RevenueCat plugin and wire one boolean through the app: *is this user
   unlocked*.
4. Gate the features behind it.
5. Test with a sandbox tester account through TestFlight.
6. Submit the products for review **with** the app build — they are reviewed
   together on a first submission.

### What to actually gate

Whatever you choose, the rule that keeps reviewers happy is that **the free app
has to be genuinely useful on its own**. Something like: unlimited songs free,
but voice memos beyond a handful, or export, behind the unlock. Gating so hard
that the free app can't do anything is a rejection under guideline 4.2.

The code side of this is small — one flag, checked in a few places. Say the word
and I'll build the gate so it's ready before you have products to sell.
