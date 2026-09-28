# Security

Steg2048 is an experimental project that runs entirely in the browser.

## Data handling

The published version has no application backend, and the encoding/decoding code makes no network request.
Your message and password stay in the local page context while the tool is running.

The exported JSON contains the 2048 trajectory required for decoding, but it never stores the password.

## Cryptography

Steg2048 currently uses:

- PBKDF2-SHA-256 with 250,000 iterations;
- AES-256-GCM authenticated encryption;
- a random 16-byte salt;
- a random 12-byte nonce.

The project has not undergone an independent cryptographic security audit and should not be treated as a replacement for an audited security protocol or secure-messaging product.

## Browser and hosting considerations

Steg2048 relies on the browser Web Crypto API. The confidentiality of data also depends on the security of the browser, device, operating system and page delivery environment.

GitHub Pages serves the static HTML, CSS and JavaScript files. Encoding and decoding do not require an application server.

## Reporting a vulnerability

For non-sensitive issues, open a GitHub issue.

For a vulnerability that should not be disclosed publicly right away, use the repository's **Private vulnerability reporting** feature if it is enabled.
