# Elysium

Elysium is a research project focused on exploring the modern technological capabilities of LLM systems in code, design, encryption, and styling.

## 2. Research Goal

The project was created to understand the current abilities of LLM systems when working with complex solutions. During development, the following LLM capabilities were tested:

- Working with cloud technologies
- Hashing and encryption
- Design and user interfaces
- Concurrency and memory management
- Maintaining complex project context
- Writing complex system code under large context
- Fixing and updating their own code

## 3. Key Features

- Text messages
- Sending files, images, video
- Voice and video messages (record directly in the app)
- Encryption (AES‑256‑GCM, keys only known to participants)
- Integration with cloud storage (Google Drive, Yandex Disk, OneDrive)
- OAuth 2.0 authorisation
- Smart polling
- PWA (Progressive Web App)
- Hashtag search
- Drag & Drop for file sending
- Responsive design

## 4. How It Works (Architecture)

- No central server – data is stored in users' cloud drives
- Client‑side encryption and decryption
- Class‑based provider structure
- Memory management

## 5. Technologies

- React + Vite
- PWA (manifest)
- Web Crypto API (AES‑256‑GCM, PBKDF2)
- Google Drive API, Yandex Disk API, Microsoft Graph API
- LLM: GLM‑5, DeepSeek (code co‑authored with AI)

## 6. Build & Run

For development:

```bash
git clone ...
npm install
npm run dev
```

For regular usage:

- Download the latest release (the `dist` folder)
- Start a local server: `python -m http.server 8000`
- Open `http://localhost:8000` in your browser
- If needed, create OAuth Client IDs for Google / Yandex / Microsoft and enter them in the app interface.

## 7. Requirements

- A modern browser with Web Crypto API support

## 8. License

Apache 2.0 – provided "AS IS", without warranties. All responsibility lies with the user.