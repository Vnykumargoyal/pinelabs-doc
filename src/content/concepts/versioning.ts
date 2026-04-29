export const versioningContent = `
# Versioning & Support

---

## Version scheme

The SDK follows **Semantic Versioning** (\`MAJOR.MINOR.PATCH\`):

- **MAJOR** — breaking API change
- **MINOR** — new features, backward-compatible
- **PATCH** — bug fixes only

The current release is **v1.0.0**.

---

## Platform status

| Platform | Status | Minimum OS | Notes |
|---|---|---|---|
| Android | **Shipping** | Android 8 (API 26) | Full feature set |
| iOS | **Preview** | iOS 15 | Phase 7 milestone |
| Python | **Preview** | Python 3.10 | Phase 7 milestone |
| Node.js | **Preview** | Node 18 LTS | Phase 7 milestone |
| C / C++ | **Preview** | — | Phase 7 milestone |

---

## Support policy

| Version | Support window | Notes |
|---|---|---|
| v1 | 24 months from GA | Security fixes always back-ported |
| v0.x | End-of-life | No further updates |

---

## Deprecation process

1. Feature/API is marked \`@Deprecated\` with replacement note.
2. Deprecated API remains functional for **one major version**.
3. Removed in the next major version.

---

## Migration guides

Migration guides are published in the \`CHANGELOG.md\` at the root of each
platform SDK repository. Subscribe to GitHub Releases for notifications.

---

## Reporting bugs

File issues at \`github.com/pinelabs/billing-sdk\`. Include:
- SDK version
- Platform and OS version
- Minimal reproduction steps
- Relevant log output (sanitised — no card numbers)
`

