# PUSHING FRAMES_ — Setup Guide

Local cinematic prompt studio. Bring your own keys for image and video generation across eight providers (Seedream, Seedance, GPT-image-2, Gemini, Imagen, Veo 3, Kling, OpenRouter). The tool is free; you pay providers per generation.

This guide gets you from zip → running app in about five minutes the first time, then it's a double-click after that.

## Step 1 — Install Node.js (one-time)

Both Mac and Windows need Node.js to run the app. Download the LTS (Long-Term Support) installer from:

https://nodejs.org

Run the installer, accept the defaults. Done.

If you've already got Node from another project, you're fine. Anything 18 or higher works.

## Step 2 — Unzip the project

Drop the zip somewhere stable — Documents, Desktop, wherever. Avoid spaces in the parent folder name if you can; not strictly required but cleaner. Unzip it.

You should end up with a folder containing `package.json`, `start.command`, `start.bat`, `src/`, `README.md`, and this guide.

## Step 3 — Launch

### macOS

Double-click **`start.command`** in Finder.

If macOS warns that the file is from an unidentified developer:
- Right-click `start.command` → Open → confirm
- Or: System Settings → Privacy & Security → scroll down, click "Allow" next to the warning

The first run takes about 30 seconds (it installs dependencies). After that it's a few seconds.

### Windows

Double-click **`start.bat`** in File Explorer.

A command window will open. First run takes ~30 seconds for dependencies. After that it's quick.

## Step 4 — Use the app

Your default browser will open to the app. **Use Chrome, Edge, Opera, Brave, or Arc.** Safari and Firefox don't support the File System Access API the project guide relies on.

1. Set a vault passphrase. This encrypts your API keys locally; nothing leaves your machine.
2. Click **add keys**. Paste at least one provider key. Each provider has a "get key" link to its dashboard.
3. Click **Create New Project** to walk through the project guide, or **Open Project** if you already have a project folder with `style.md` and `storyboard.md`.

## Step 5 — Stop the app

Close the Terminal window (Mac) or command window (Windows). The dev server stops; your project files stay on disk.

## Where your work lives

- **API keys** — encrypted in your browser's IndexedDB with your passphrase. Never leave your machine.
- **Project files** (`style.md`, `storyboard.md`, `refs/`, `generations/`) — wherever you picked the project folder during setup.
- **Generations** — saved to `<your project folder>/generations/` as PNG / JPG / MP4.

## Browser requirement (worth repeating)

**Chrome / Edge / Opera / Brave / Arc only.** The file system access the app needs is a Chromium-only browser API. If you try to "open project" in Safari and nothing happens, that's why.

## Troubleshooting

**"Node is not installed" on launch.** Step 1 — install Node.js from nodejs.org, then double-click the launcher again.

**"This file can't be opened" on Mac.** Right-click `start.command` → Open → confirm. macOS gatekeeper requires a one-time approval for shell scripts not signed by an Apple Developer ID.

**Browser opens but page is blank.** Wait 5-10 seconds for the dev server to finish starting. If still blank, refresh the page. If still blank, look at the Terminal/command window for errors and copy them in any feedback.

**Generation hangs in "running" forever.** Video providers (Veo, Kling, Seedance) take 1-5 minutes per shot. The queue says "running" the whole time. Image providers should be 5-30 seconds. If an image takes more than a minute, something's stuck — close and relaunch.

**"add keys" button doesn't work.** Hard reload (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows). The vault unlock can occasionally race the first render.

## Updating later

If you get a newer zip, replace the folder. Your project files (refs, generations, style.md, storyboard.md) live in YOUR project folder, not the app folder, so you don't lose anything by replacing the app.

## Questions

The README has more detail on the project format and the philosophy. The thesis is one line:

> Stop prompting. Start defining outcomes.

Treat the AI like a director of photography you've hired. Be specific about the camera, lens, lighting, shutter — the brief a real DP would need. Vague gets you average.
