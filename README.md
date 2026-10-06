# Riff — AI Song Studio

A one-page web app for the [Suno API](https://docs.sunoapi.org). Paste your API key, then write songs, remix audio, and export the results. There's no build step and no backend beyond a tiny Netlify function.

## Features

- **Accounts**: sign up and log in with email and password through Supabase Auth. Includes email confirmation, forgot/reset password, and log out. Each account has its own library and Suno key on the device.
- **Key gate**: the app checks your key against the credits endpoint before letting you in. You can keep it on this device (localStorage) or only for the current tab session. **Sign out** erases it.
- **Create**
  - *Simple mode*: describe the song. There are idea chips and a 🎲 Surprise me button, and you can add image, audio or video files as inspiration.
  - *Custom mode*: title, style (with genre and mood chips plus ✨ **Boost style**), lyrics with section-tag buttons, excluded styles, vocal gender, style adherence, weirdness, audio weight, variety, length (10–360s) and persona.
  - Models: **V6**, **V6 Wild**, **V6 Mini**, plus the legacy V5.5 through V4.
- **Lyrics**: generates structured lyrics and sends them to Custom mode in one click.
- **Remix**: cover (restyle), extend, add vocals, add backing band, mashup and replace a section. You can upload a file, paste a URL or pick a track from your library.
- **Sounds**: loops and sound design, with key, BPM and loop controls.
- **Library and tools**: favorites, search, MP3 and WAV export, stem splitting (vocals/instrumental, full band, or a single instrument), music video, AI cover art, save a voice as a persona, and sing-along karaoke lyrics.
- **Player**: a sticky player with queue, seeking, keyboard controls (Space, Ctrl/⌘+Enter) and media-session controls.
- **Themes**: light, dark and system.

## How it works

- Suno tasks are asynchronous. Every endpoint requires a `callBackUrl`, and the app points it at `/.netlify/functions/suno-callback`, which does nothing but reply OK. Results come from polling the `record-info` endpoints instead. Unfinished jobs are saved in the browser and pick up again after a reload.
- `netlify.toml` proxies `/proxy/suno/*` → `api.sunoapi.org` and `/proxy/upload/*` → the Suno file-upload host, so the browser never runs into CORS. If the proxy isn't there (for example on a local static server), the app switches to calling the API directly.
- The library, lyrics and personas are stored in `localStorage`. Suno keeps the generated files for about 14 days.

## Accounts (Supabase)

- `config.js` holds the Supabase project URL and its **publishable** key. That key is meant to live in browser code.
- `auth.js` shows the login screen until there's a session, then starts the studio.
- One-time setup in the Supabase dashboard: go to **Authentication → URL Configuration**, set **Site URL** to the Netlify URL, and add `https://<your-site>.netlify.app/**` under **Redirect URLs**. Without this, the confirmation and password-reset emails link to `localhost:3000`.
- Supabase's built-in email sender only allows a few emails per hour. That's fine for personal use. For real sign-up traffic, set up custom SMTP under **Authentication → Emails → SMTP Settings**.

## Deploy

Connect this repo to Netlify. The publish directory is `.` and functions live in `netlify/functions`, both already set in `netlify.toml`. There's no build command.

## Local preview

```sh
npx netlify dev        # full proxy + function
# or
python3 -m http.server # static; calls the API directly
```
