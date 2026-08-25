# 🎮 FakeDiscordRP - Vencord Plugin

A powerful, fully customisable **Fake Discord Rich Presence** plugin for [Vencord](https://vencord.dev). Set custom game titles, descriptions, animated GIFs, images, custom timestamps (counting up), and take #1 top priority over any background game or Spotify.

---

## ✨ Features

- **🎮 Custom Title & Subtitle**: Set any game name (e.g. `Minecraft`, `Visual Studio Code`, `Custom App`) and custom details/state lines.
- **🖼️ Universal Media & GIF Support**:
  - Direct upload from your computer (`.gif`, `.png`, `.jpg`, `.mp4`).
  - Paste any link from **Google Images**, **Tenor**, **Giphy**, or **Imgur** (auto-resolved and cleaned).
  - Built-in **Avatar Circle Cropper** ✂️ to crop any image/GIF into a round Discord profile picture.
- **⏱️ Dynamic Live Timers**: Enter any duration (e.g. `140h 30m 20s`, `1h`, `43:04`) and Discord will automatically count up second-by-second.
- **👑 Guaranteed Top Priority (#1)**: Completely suppresses running background processes (`RunningGameStore`) so your Fake RP always displays first on your profile.
- **⚡ Quick Access**: Open the config menu by clicking the Gamepad icon in the chat bar or typing `/fakerp`.

---

## 🚀 Installation

### Method 1: Userplugins (Recommended)
1. Clone or download this repository into your Vencord `userplugins` directory:
   ```bash
   cd Vencord/src/userplugins
   git clone https://github.com/imigrant1616-dot/FakeDiscordRP.git fakeDiscordRP
   ```
2. Build Vencord:
   ```bash
   pnpm build
   ```
3. Restart / reload Discord (**Ctrl + R**).
4. Go to **Settings -> Vencord -> Plugins** and enable **FakeDiscordRP**.

---

## 🛠️ Usage

1. Click the **Gamepad icon 🎮** on the bottom-right of your chat input bar (or type `/fakerp`).
2. Fill in:
   - **Główny text** (Title)
   - **Maly text** (Details)
   - **Grafika** (Upload `.gif`/image or paste URL)
   - **Czas** (e.g. `140h 30m 20s` or `1h`)
3. Click **Zapisz** – your profile instantly updates live!

---

## 👤 Author
- **[imigrant1616-dot](https://github.com/imigrant1616-dot)**

---

## 📜 License
GPL-3.0 License
