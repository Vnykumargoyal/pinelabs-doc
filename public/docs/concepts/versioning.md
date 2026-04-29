# Versioning, support, and compatibility

This page is the contract between the Pine Labs SDK and your code
across releases. Pin to it.

---

## SemVer policy

The SDK follows **[SemVer 2.0.0](https://semver.org/)**: `MAJOR.MINOR.PATCH`.

| Bump | Triggers |
|---|---|
| `MAJOR` | Breaking change to the public UDL: removed/renamed types or methods, narrowed input validation, removed `metadata` keys, removed `TransactionStatus` variants, behavioural change with no overload-and-deprecate path. |
| `MINOR` | Additive only: new optional fields, new methods, new transports, new `TransportType` / `PaymentMode` / `OperationState` enum entries, new `metadata` keys. New `SdkError` variants are also `MINOR` (your `when` / `switch` should always have a default branch — see below). |
| `PATCH` | Bug fixes, performance, internal refactors. No API surface change. |

**v1.0.0 is not tagged** until the full §4 transport × language
matrix is complete (App-to-App / Cloud / PADController across
Kotlin / Swift / Python / Node / C). Until then, releases are tagged
`v0.x.y` and **may break compatibly within the v0 line at MINOR
bumps** to absorb late-breaking deltas. Production integrations
should pin to an exact `v0.x.y` tag and re-validate on each bump.

> **`SdkError` exhaustiveness:** new variants are MINOR additions.
> Always include a default / wildcard branch when matching on
> `SdkError`:
>
> ```kotlin
> when (e) {
>     is SdkError.InvalidInput  -> …
>     is SdkError.Timeout       -> …
>     // … known variants …
>     else                      -> log.warn("unknown SdkError variant: $e")
> }
> ```

---

## Minimum supported versions

| Component | Minimum | Target / tested |
|---|---|---|
| **Rust toolchain** (for building from source) | 1.75 (MSRV) | latest stable |
| **Android** | API 21 (Android 5.0 Lollipop) | API 34 |
| **AGP** (Android Gradle Plugin) | 8.6 | 8.6.1 |
| **Kotlin** | 2.0.0 | 2.0.20 |
| **iOS / iPadOS** | 14.0 | latest stable |
| **Swift** | 5.9 | latest stable |
| **Python** | 3.9 | 3.12 |
| **Node.js** | 18 LTS | latest LTS |
| **C compiler** | C11 (GCC ≥ 9, Clang ≥ 11, MSVC 2019+) | latest stable |
| **JNA** (Android runtime dep, transitive via UniFFI Kotlin) | 5.14.0 | 5.14.0 |

The MSRV (minimum supported Rust toolchain) is 1.75. We bump it
**at most** at MINOR releases, and only with at least one full
release of advance warning in the changelog.

---

## Supported transports per language (v1)

| Transport | Kotlin | Swift | Python | Node.js | C |
|---|---|---|---|---|---|
| App-to-App | ✓ | n/a (Android-only) | n/a | n/a | n/a |
| Cloud REST | ✓ | ✓ | ✓ | ✓ | ✓ |
| PADController | ✓ | ✓ | ✓ | ✓ | ✓ |
| TCP direct | placeholder | placeholder | placeholder | placeholder | placeholder |

App-to-App is fundamentally Android (it bridges to the MasterApp
service via `Messenger` IPC); the other transports are
platform-agnostic.

---

## Backwards compatibility guarantees

What we **will not** do without a MAJOR bump:

* Remove a public type, method, parameter, dictionary field, enum
  variant, or `SdkError` variant.
* Tighten validation rules (e.g. lower the `metadata` cap from 10
  to 5).
* Change the meaning of an existing `metadata` key.
* Change the dispatch thread for callbacks (always SDK-internal,
  never caller's stack frame, always serialised — see
  [`lifecycle.md`](./lifecycle.md)).
* Re-order callback emission (`onStarted` before `onSuccess` /
  `onFailure`).
* Change the synchronous-vs-async error delivery channel for an
  existing variant (see [`error-handling.md`](./error-handling.md)).

What we **may** do at MINOR (additively):

* Add new fields, methods, enum variants, `SdkError` variants,
  `metadata` keys, transports.
* Loosen validation rules.
* Promote `metadata` keys to typed fields (the typed field is
  added; the `metadata` key remains populated for one MAJOR cycle
  to give you migration time).

What we **may** do at PATCH:

* Bug fixes, performance, log-level tuning, doc updates, internal
  refactors, dependency bumps that do not require a consumer-side
  change.

---

## Distribution and integrity

* Every release artifact (AAR / xcframework / wheel / npm tarball
  / `.tar.gz`) is published exclusively on the **Pinelabs Developer
  Portal** and via the **Pinelabs MCP `getSDK` tool**.
* The SDK is **not** published to Maven Central, CocoaPods.org,
  PyPI, npmjs.com, or any private registry.
* Every artifact is accompanied by a **SHA-256 checksum** and a
  **detached signature**. Both are downloadable from the same
  release page.
* Every artifact ships with a copy of these docs in its zip
  (`docs/site/index.html`).

Verify checksums before you check the artifact into your build
system. Procedures per language are in each
[`per-language/<lang>/setup.md`](../per-language/).

---

## Deprecation policy

When we deprecate a public symbol:

1. The symbol is annotated `@Deprecated` (Kotlin / Java),
   `@available(*, deprecated)` (Swift), `DeprecationWarning`
   (Python), `@deprecated` JSDoc tag (Node.js), or
   `__attribute__((deprecated))` (C).
2. The deprecation message names the replacement symbol.
3. The CHANGELOG records the deprecation in the MINOR release that
   introduced it.
4. The symbol is removed **only** at the next MAJOR.

---

## Support channels

* **Bug reports / questions:** the Pinelabs Developer Portal
  ticketing system. Include the SDK version, your platform, the
  `event_id` (if any), and an excerpt of the SDK log at `Debug`
  level.
* **Security issues:** see `SECURITY.md` at the repository root.
  Do **not** file security issues in the public ticket queue.
* **Feature requests:** the Developer Portal feedback channel.
  Feature work is scheduled into the next MINOR.

---

## End-of-life

The SDK supports the **two most recent MAJOR lines** at any time.
When `vN+2.0.0` ships, `vN.x.y` enters maintenance mode (security
patches only) for **6 months** and is then EOL'd. The CHANGELOG
records EOL deadlines as soon as `vN+1.0.0` ships.
