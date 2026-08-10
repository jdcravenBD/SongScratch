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

## 1. Enrol in the Apple Developer Program

<https://developer.apple.com/programs/enroll/>

- Enrol as an **individual**, not an organization, unless you need the company
  name on the listing. An organization needs a D-U-N-S number and takes days to
  weeks; an individual is usually approved within 48 hours.
- Your Apple ID needs two-factor authentication on already.
- Your listing will show your legal name as the seller. If that matters, that's
  the reason to go the organization route instead.

While you wait, do steps 2 and 3.

## 2. Wrap the web app with Capacitor

This part runs on Windows. It creates the native project that CI will build.

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios @capacitor/keyboard @capacitor/status-bar
```

```bash
npx cap init "Song Scratch" com.yourname.songscratch --web-dir=dist
```

Pick the bundle id carefully — `com.yourname.songscratch` is permanent once the
app exists in App Store Connect, and it can never be reused for anything else.

```bash
npm run build && npx cap add ios
```

`cap add ios` works on Windows; it only copies the project template. Commit the
generated `ios/` folder — CI builds from it.

### Things this app specifically needs in the native project

| What | Where | Why |
| --- | --- | --- |
| `NSMicrophoneUsageDescription` | `ios/App/App/Info.plist` | The voice tab **will crash without it**, and review rejects apps that ask for a permission with no reason string. Something like "Song Scratch records voice memos so you can keep an idea before you lose it." |
| `Keyboard.setAccessoryBarVisible({ isVisible: false })` | called once at startup | Removes Safari's own toolbar above the keyboard — the double bar you see when testing in Safari. This is the only way to get rid of it. |
| Status bar style | `@capacitor/status-bar` | Keep it light-on-black to match the app. |
| Service worker | `src/main.tsx` | Skip registering it when running under Capacitor. The assets are already local, and a service worker inside the app's WebView can serve stale files across app updates. |

A bonus you get for free: IndexedDB inside a native WebView is **not** subject to
Safari's seven-day eviction. Recordings become genuinely durable.

## 3. Create the app record

In [App Store Connect](https://appstoreconnect.apple.com) → **My Apps → +**.

- Platform iOS, the bundle id from step 2, an SKU (any private string).
- **The app name must be unique across the whole store.** Check "Song Scratch"
  is free early; if it isn't, you need a different name before anything else.

Then, still in a browser:

- **Users and Access → Integrations → App Store Connect API** → create a key with
  **App Manager** access. Download the `.p8` **once** — it is never shown again.
  This key is what lets CI sign and upload without a Mac.

## 4. Set up the cloud build

Two reasonable options.

**Codemagic** (easiest for Capacitor). Free tier covers 500 build minutes a month,
which is plenty for a personal app. Connect the repo, choose the Capacitor/iOS
workflow, paste in the App Store Connect API key, and turn on automatic code
signing — it creates and manages the certificates for you. Its output can go
straight to TestFlight.

**GitHub Actions** (free, more fiddly). `runs-on: macos-14`, then
`npm ci && npm run build && npx cap sync ios`, then `xcodebuild -archive` and
`xcrun altool --upload-app`. macOS minutes bill at 10× on private repos, so the
free allowance is roughly 200 macOS minutes a month — enough, but not generous.

Either way the certificate work happens in the cloud. You never generate a CSR
on a Mac.

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
