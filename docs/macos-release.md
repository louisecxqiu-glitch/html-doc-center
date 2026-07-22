# macOS DMG release

HTML Studio is distributed directly as a signed and notarized Apple Silicon DMG. The app uses bundle ID `com.louisqiu.htmlstudio`, supports macOS 12 or newer, and reads the release version from `VERSION`.

## One-time Apple setup

1. In Keychain Access, choose **Certificate Assistant > Request a Certificate From a Certificate Authority**. Save the CSR to disk and keep the generated private key in the login keychain.
2. In Apple Developer **Certificates, Identifiers & Profiles**, create a **Developer ID Application** certificate from that CSR. Download and open the certificate to install it in the same keychain.
3. Confirm that the identity is ready:

   ```bash
   security find-identity -v -p codesigning
   ```

4. In App Store Connect **Users and Access > Integrations > App Store Connect API > Team Keys**, create a **team API key** with Developer access. Download its `.p8` file once and record its Key ID and Issuer ID. Apple documents that individual API keys cannot use `notarytool`, so this workflow requires a team key. Do not add the key or certificate passwords to this repository. See [Apple’s API-key guide](https://developer.apple.com/documentation/appstoreconnectapi/creating-api-keys-for-app-store-connect-api).

## Local release

Install the build dependencies, then expose the App Store Connect values only for the release command:

```bash
python3 -m pip install -r requirements-build.txt
APPLE_API_KEY=/secure/path/AuthKey.p8 \
APPLE_API_KEY_ID=YOUR_KEY_ID \
APPLE_API_ISSUER_ID=YOUR_ISSUER_ID \
python3 scripts/release_macos.py
```

If more than one Developer ID identity is installed, also set `MACOS_SIGNING_IDENTITY` to the full value printed by `security find-identity`.

The script builds the arm64 app, enables Hardened Runtime, signs it, creates and signs the DMG, submits it to Apple with `notarytool --wait`, staples the ticket, and runs Gatekeeper validation. The final file is `dist/HTMLStudio-<version>-macos-arm64.dmg`.

For packaging diagnostics only, `--skip-notarization` creates a signed but non-distributable DMG with `-unnotarized` in its filename. On a machine without a certificate, add `--identity -` to exercise the complete packaging flow with an ad-hoc signature.

## GitHub Actions environment secrets

Export the Developer ID Application certificate and its private key from Keychain Access as a password-protected `.p12`. In GitHub, create the `desktop-release` Environment, then add these **environment secrets**. Repository secrets also work as a temporary migration path, but environment secrets are preferred because you can require approval before a release job receives them.

| Secret | Value |
| --- | --- |
| `MACOS_CERTIFICATE_P12_BASE64` | Base64-encoded `.p12` file |
| `MACOS_CERTIFICATE_PASSWORD` | Export password for the `.p12` |
| `APPLE_API_KEY_P8_BASE64` | Base64-encoded App Store Connect `.p8` file |
| `APPLE_API_KEY_ID` | App Store Connect Key ID |
| `APPLE_API_ISSUER_ID` | App Store Connect Issuer ID |

Encode the two files without copying their contents into shell history:

```bash
base64 -i DeveloperIDApplication.p12 | pbcopy
base64 -i AuthKey.p8 | pbcopy
```

Pushing a tag that exactly matches `v` plus the contents of `VERSION` runs the signed macOS build, the Windows build, creates `SHA256SUMS.txt`, and then creates the GitHub Release:

```bash
git tag v2.7.0
git push origin v2.7.0
```

The workflow imports the certificate into a temporary keychain and writes the API key under the runner's temporary directory. Neither credential is uploaded as an artifact. Before publishing a tag, run `python3 scripts/verify_release.py --check` locally; after release, download `SHA256SUMS.txt` with the installer and verify it using `shasum -a 256 <file>`.
