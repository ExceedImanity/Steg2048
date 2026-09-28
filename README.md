<div align="center">

# 🎴 STEG2048

### Encrypted messages hidden inside valid 2048 game trajectories.

**100% client-side · FR/EN interface · No backend · No telemetry · GitHub Pages ready**

[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
![JavaScript](https://img.shields.io/badge/JavaScript-ES%20Modules-f7df1e?logo=javascript&logoColor=000)
![Web Crypto](https://img.shields.io/badge/crypto-Web%20Crypto%20API-7c3aed)
![GitHub Pages](https://img.shields.io/badge/deploy-GitHub%20Pages-222?logo=github)
![Privacy](https://img.shields.io/badge/privacy-local%20only-10b981)

**Original concept & project by `ExceedImanity`**

</div>

---

## ✦ What is Steg2048?

**Steg2048** is an experimental steganography project that hides an encrypted message inside a sequence of **valid 2048 game states**.

Instead of storing the message as readable text, Steg2048:

1. derives an encryption key from your password;
2. encrypts the message locally in your browser;
3. converts the encrypted data into bits;
4. encodes those bits through legal choices in a 2048 trajectory;
5. exports the resulting game as JSON.

The reverse process reconstructs the encrypted payload from the trajectory and decrypts it with the correct password.

> Steg2048 is an educational and experimental project. It does **not** claim to provide undetectable steganography.

---

## ⚡ Try it

Once GitHub Pages is enabled, the project runs directly from a URL such as:

```text
https://YOUR_GITHUB_USERNAME.github.io/steg2048/
```

There is nothing to install for normal use.

Open the page, enter a message and password, generate the trajectory, then export the JSON file.

---

## 🔐 How it works

```text
┌─────────────────────┐
│      Your message   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ PBKDF2-SHA-256      │
│ password → key      │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ AES-256-GCM         │
│ encrypted payload   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Bit stream          │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Valid 2048 choices  │
│ move + tile spawn   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ 2048 trajectory     │
│ exported as JSON    │
└─────────────────────┘
```

### Cryptography

Steg2048 currently uses:

- **AES-256-GCM** for authenticated encryption;
- **PBKDF2-SHA-256** for password-based key derivation;
- **250,000 PBKDF2 iterations**;
- a random **16-byte salt**;
- a random **12-byte AES-GCM nonce**.

A wrong password or altered encrypted payload causes authentication to fail instead of silently returning corrupted plaintext.

---

## 🕵️ Steganography layer

The hidden data is not written directly into visible text fields.

Steg2048 generates a sequence of states where each state follows the rules of 2048. At each step, the encoder selects among valid candidate transitions to transport encrypted bits.

```text
Board N
   │
   ├── legal move
   │
   ├── normal merges
   │
   └── valid 2 / 4 spawn
           │
           ▼
       Board N+1
```

The decoder rebuilds the same candidate choices from the sequence and extracts the encoded data.

---

## 🛡️ Privacy by design

Steg2048 is intentionally a **static web application**.

There is:

- no Flask server;
- no database;
- no account system;
- no analytics code;
- no telemetry;
- no API used during encoding or decoding.

Your message and password are processed by the browser using the **Web Crypto API**.

```text
message ───────┐
password ──────┼──► your browser ───► Steg2048 trajectory
               │
               └──X──► application server
```

GitHub Pages only serves the HTML, CSS and JavaScript files.

---

## ✨ Features

- 🔐 local AES-256-GCM encryption;
- 🔑 password-based key derivation;
- 🎮 valid 2048 trajectories;
- ▶️ step-by-step trajectory viewer;
- 📦 JSON export and import;
- 🔎 detection of wrong passwords / altered payloads;
- 🌐 fully static GitHub Pages deployment;
- 📴 no runtime dependencies;
- 👁️ built-in **About** tab explaining the project;
- 🌍 automatic **French / English** interface with a persistent manual language switch;
- 🎨 neon/comic interface while keeping the classic 2048 board style.

---

## 🌍 Language support

The application interface is available in **French and English**.

Language selection works as follows:

- if the browser's primary language starts with `fr`, Steg2048 starts in French;
- every other browser language starts in English;
- the **FR / EN** button lets the user switch language at any time;
- the manual choice is stored locally in the browser with `localStorage`.

The repository documentation files (`README.md`, `SECURITY.md`, `LICENSE` and `NOTICE`) are intentionally maintained in English.

---

## 🚀 Deploy on GitHub Pages

### 1. Create the repository

Create a repository named, for example:

```text
steg2048
```

### 2. Push the project

```bash
git init
git add .
git commit -m "Initial Steg2048 release"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/steg2048.git
git push -u origin main
```

### 3. Enable Pages

In the GitHub repository:

```text
Settings → Pages → Source → GitHub Actions
```

The included workflow deploys the static project automatically after a push to `main`.

---

## 💻 Run locally

Because the project uses JavaScript ES modules, use any small static HTTP server instead of opening `index.html` through `file://`.

For example, if Python is already installed:

```bash
python -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

Python is **not** part of the application. It is only one optional way to serve the static files locally.

---

## 🧪 Tests

The test suite only requires Node.js 20+:

```bash
node --test tests/steg.test.js
```

No `npm install` is required.

---

## 📁 Project structure

```text
steg2048/
├── index.html
├── assets/
│   └── style.css
├── js/
│   ├── app.js
│   ├── errors.js
│   ├── i18n.js
│   ├── simulator2048.js
│   ├── steg.js
│   └── trajectory.js
├── tests/
│   └── steg.test.js
├── .github/
│   └── workflows/
│       └── pages.yml
├── .nojekyll
├── LICENSE
├── NOTICE
├── README.md
└── SECURITY.md
```

---

## 📄 Export format

Current format identifier:

```text
steg2048-web-v1
```

A simplified export looks like:

```json
{
  "format": "steg2048-web-v1",
  "boards": [
    [0, 2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0]
  ]
}
```

The password is **never stored in the exported file**.

---

## ⚠️ Limitations

Steg2048 is a research/learning project, not an audited secure-messaging product.

Current limitations include:

- maximum message size: **96 UTF-8 bytes**;
- minimum password length: **8 characters**;
- no independent cryptographic audit;
- hiding data in a 2048 trajectory does not guarantee that the presence of hidden information cannot be detected;
- browser and device security remain outside Steg2048's control.

Do not rely on Steg2048 as the sole protection for highly sensitive information.

---

## 👤 Attribution

Steg2048 was originally conceived and developed by:

### **ExceedImanity**

The project is intentionally open for learning, modification, forks and redistribution. The original attribution is preserved through the project's [`NOTICE`](NOTICE) file and the conditions of the Apache License 2.0.

If you build something from Steg2048, keeping a visible reference to the original project is appreciated in addition to the attribution required by the license.

---

## ⚖️ License

Steg2048 is licensed under the **Apache License 2.0**.

See:

- [`LICENSE`](LICENSE) — full Apache License 2.0 text;
- [`NOTICE`](NOTICE) — original project attribution.

Copyright © 2026 **ExceedImanity**.

---

<div align="center">

**Steg2048 · cryptography × steganography × 2048**

Made as an experimental cybersecurity project.

</div>
