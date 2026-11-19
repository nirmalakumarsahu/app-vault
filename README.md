# App Vault

A small, self-hosted app for keeping all your application details in one place: instances, environments, URLs, servers, cloud buckets, accounts, databases and their login credentials.

All data is saved in one plain Markdown file (`apps.md`). There's no database, no cloud and no account. App Vault runs as a local web app in your browser.

> ⚠️ `apps.md` stores credentials in **plain text**. Read [Security notes](#security-notes) before you use it for real secrets.

---

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [npm scripts](#npm-scripts)
- [Configuration](#configuration)
- [Data file format](#data-file-format)
- [Instance types](#instance-types)
- [Sharing](#sharing)
- [HTTP API](#http-api)
- [Project structure](#project-structure)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Applications and instances.** Group instances (servers, buckets, accounts, databases and so on) under the application they belong to. Each application has a description, an owner and tags.
- **Instance types.** Choose from Server, AWS S3, Account, Database or Custom. The type decides which fields the form shows and which extra fields it fills in for you. See [Instance types](#instance-types).
- **Custom fields.** Add, rename or remove extra fields on any instance, and mark any of them as secret.
- **Environments.** Tag each instance as Production, UAT, Staging, QA, Development, Testing or Other, then filter the list by environment.
- **Hidden secrets.** Usernames, passwords, API keys and secret custom fields stay masked until you click **View**. They hide again on their own after **30 seconds**, or as soon as you switch away from the tab or window.
- **One-click copy** for secrets, URLs, hosts and custom fields.
- **Search** across application names, instance names, environments, types, URLs, hosts, notes and non-secret custom fields. Search never looks inside secret values. Press <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>K</kbd> to jump to the search box and <kbd>Esc</kbd> to clear it.
- **Share** an application or a single instance as plain text or Markdown: copy it, download it, or send it with the system share sheet. Secrets are left out unless you choose to include them.
- **Light and dark themes.** It follows your OS setting by default, and the toggle remembers your choice.
- **Plain-file storage.** Every change is written straight to `apps.md`, and the previous version is kept as `apps.md.bak`.
- **Local only.** The server listens on `127.0.0.1`, so other machines on your network can't reach it.

## Requirements

- **Node.js 18 or newer** ([nodejs.org](https://nodejs.org)).
- A modern browser (Chrome, Edge, Firefox or Safari).

## Quick start

```bash
git clone <repo-url> app-vault
cd app-vault
npm install
npm start
```

Then open **http://localhost:5050**.

- `npm start` builds the React app into `dist/` and then starts the server.
- After the first build, `npm run serve` starts the server without rebuilding, so it's faster.
### One-click launchers

Instead of typing commands, you can double-click a launcher file in the project folder:

| OS | File | How to use |
| --- | --- | --- |
| **Windows** | `start.bat` | Double-click it in File Explorer. |
| **macOS** | `start.command` | Double-click it in Finder. It opens in Terminal. |

Each launcher:

1. switches to the project folder, so it works from anywhere,
2. runs `npm install` the first time, when `node_modules` is missing,
3. runs `npm start`, which builds the app and starts the server, and
4. opens http://localhost:5050 in your browser. `start.command` waits until the server answers; `start.bat` waits about 8 seconds.

Keep the window open while you use the app. Closing it, or pressing <kbd>Ctrl</kbd> + <kbd>C</kbd>, stops the server.

**macOS notes for `start.command`:**

- It finds Node.js even if you installed it with **nvm** or **Homebrew**. Finder doesn't load your shell profile, so the script looks in those places itself. If Node.js still isn't found, the script tells you to install it.
- It needs execute permission. That's already set, and Git keeps it. If you get *"could not be executed because you do not have appropriate access privileges"*, run this once:

  ```bash
  chmod +x start.command
  ```

- If macOS says it *"cannot be opened because it is from an unidentified developer"* (which can happen after downloading a ZIP), right-click the file, choose **Open**, then click **Open** again. You only have to do this once.
- It respects a custom port, for example `PORT=6000 ./start.command` in Terminal.

If `apps.md` doesn't exist yet, it's created empty the first time the app loads.

## npm scripts

| Script               | What it does                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------ |
| `npm start`          | Builds the UI (`vite build`) and starts the server on port 5050.                                 |
| `npm run serve`      | Starts the server only, using the existing `dist/` build.                                        |
| `npm run dev`        | Developer mode: the API server on 5050 plus the Vite dev server with hot reload on **5173**.     |
| `npm run build`      | Builds the UI into `dist/` only.                                                                 |

In developer mode, open **http://localhost:5173**. Vite sends `/api` requests on to the server at `127.0.0.1:5050`.

## Configuration

Both settings are read from environment variables:

| Variable    | Default                       | Description                                  |
| ----------- | ----------------------------- | -------------------------------------------- |
| `PORT`      | `5050`                        | Port the server listens on.                  |
| `DATA_FILE` | `./apps.md` (project folder)  | Path to the Markdown data file.              |

```bash
# macOS / Linux
PORT=6000 DATA_FILE=/path/to/my-apps.md npm run serve
```

```bat
:: Windows (cmd)
set PORT=6000
set DATA_FILE=D:\private\my-apps.md
npm run serve
```

```powershell
# Windows (PowerShell)
$env:PORT=6000; $env:DATA_FILE="D:\private\my-apps.md"; npm run serve
```

The backup is always written next to the data file as `<DATA_FILE>.bak`.

## Data file format

`apps.md` is your entire database. It's plain Markdown, so you can read and edit it in any text editor.

- Each **application** is a `##` heading.
- Each **instance** of that application is a `###` heading under it.
- Fields are `- **Label:** value` lines.
- **Extra (custom) fields** are nested under `- **Fields:**`. ` (secret)` after a field's label means its value is masked in the UI.
- Line breaks inside a value are written as `\n`, and a literal backslash as `\\`.

```md
# Application Details

> Managed by App Vault. This file contains login credentials — keep it private.

## Molta AI
- **ID:** 3f2a9c1d
- **Description:** Linguist marketplace
- **Owner:** Nirmala
- **Tags:** web, client

### Production server
- **ID:** a81c0e77
- **Type:** Server
- **Environment:** Production
- **URL:** https://molta.example.com
- **Host / IP:** 10.0.0.5
- **Port:** 22
- **Username:** admin
- **Password:** ********
- **API Key:**
- **Notes:** Line one\nLine two

### Media bucket
- **ID:** 5be01f2a
- **Type:** AWS S3
- **Environment:** Production
- **URL:** https://s3.console.aws.amazon.com/...
- **Notes:**
- **Fields:**
  - **Bucket:** molta-media
  - **Region:** ap-south-1
  - **Access Key ID:** AKIA...
  - **Secret Access Key (secret):** ********
```

**Application fields:** `ID`, `Description`, `Owner`, `Tags`

**Instance fields:** `ID`, `Type`, `Environment`, `URL`, `Host / IP`, `Port`, `Username`, `Password`, `API Key`, `Notes`, plus optional `Fields`

### Editing by hand

- Keep the layout above. Unknown field labels are ignored.
- You can leave `ID` out. A new random ID is assigned when the file is loaded.
- An instance with no `Type` is treated as a **Server**, and an unknown type as **Custom**.
- Reload the page to see your edits.
- Saving from the app rewrites the whole file in this standard layout, so any extra text or comments you add by hand will be lost.

### When the files are created

You never have to create either file yourself:

| Event | `apps.md` | `apps.md.bak` |
| --- | --- | --- |
| Server starts | Not created yet | Not created |
| Page opens in the browser | Created empty (header only) if missing | Not created |
| First save (add, edit or delete) | Updated | Created |
| Every later save | Updated | Replaced with the version from just before this save |

If you delete both files, the app still starts and shows an empty list.

### Saving and backups

On every save, the server:

1. copies the current file to `apps.md.bak`,
2. writes the new content to `apps.md.tmp`, and
3. renames it over `apps.md`, so the file is never left half-written.

`apps.md.bak` only holds **one** previous version. Make your own backups as well.

## Instance types

| Type         | Standard fields shown                              | Starts with these custom fields                                         |
| ------------ | -------------------------------------------------- | ----------------------------------------------------------------------- |
| **Server**   | URL, Host / IP, Port, Username, Password, API Key, Notes | none                                                              |
| **AWS S3**   | Console URL, Notes                                 | Bucket, Region, Access Key ID, Secret Access Key 🔒, Endpoint          |
| **Account**  | Login URL, Username, Password, Notes               | Email, Recovery Codes 🔒                                               |
| **Database** | Host / IP, Port, Username, Password, Notes         | Database Name, Engine                                                   |
| **Custom**   | Notes                                              | none                                                                    |

🔒 = secret (masked until you click View). Username, Password and API Key are always treated as secrets.

If you switch an instance to another type, custom fields that already have a value are kept, empty ones the new type doesn't use are dropped, and the new type's fields are added. A standard field that has a value is always shown, even if the current type doesn't normally use it.

## Sharing

Click the **share** icon on an application or an instance to open the share dialog:

- Choose **plain text** or **Markdown**.
- Secrets are replaced with `(not shared)` unless you turn on **include secrets**, which shows a warning when you do.
- **Copy** puts the text on the clipboard, **Download** saves it as a `.txt` or `.md` file, and **Share…** opens the system share sheet where the browser supports it.

## HTTP API

The server has one small JSON API that the UI uses. It's only reachable from `127.0.0.1`.

| Method | Path        | Body                 | Response                                  |
| ------ | ----------- | -------------------- | ----------------------------------------- |
| `GET`  | `/api/apps` | none                 | `{ "apps": [...], "file": "<data path>" }` |
| `PUT`  | `/api/apps` | `{ "apps": [...] }`  | `{ "ok": true, "apps": [...] }`           |

`PUT` replaces the whole list. The server cleans the input (trims names and adds missing IDs) before it writes `apps.md`. Request bodies over about 10 MB are rejected. Every other path serves the built UI from `dist/`.

## Project structure

```
app-vault/
├── server.js          # Node HTTP server: serves dist/, reads/writes apps.md, /api/apps
├── src/
│   ├── main.jsx       # React entry point
│   ├── App.jsx        # Main UI: list, search, filters, forms, share dialog
│   ├── types.js       # Instance types, standard fields, search text rules
│   ├── share.js       # Builds shareable plain-text / Markdown output
│   ├── Dropdown.jsx   # Dropdown component
│   ├── Icon.jsx       # SVG icons
│   └── styles.css     # Styles, including light/dark themes
├── index.html         # Vite HTML entry (sets theme before first paint)
├── vite.config.js     # Vite config (dev port 5173, /api proxy)
├── start.bat          # Windows one-click launcher
├── start.command      # macOS one-click launcher (double-click in Finder)
├── apps.md            # Your data (created when the page first loads, not committed)
└── apps.md.bak        # Backup of the previous version (created on the first save, not committed)
```

**Tech stack:** React 18, Vite 5 and plain Node.js `http` (no server framework or runtime dependencies).

## Security notes

App Vault is a convenience tool for your own computer. It is **not** an encrypted password manager.

- `apps.md` and `apps.md.bak` hold every credential in **plain text**. Anyone who can read those files can read your secrets.
- Keep the data file in a private folder, ideally on an encrypted disk (BitLocker or FileVault). Point `DATA_FILE` somewhere safe if the project folder isn't.
- **Never commit `apps.md` or `apps.md.bak`.** Both are listed in `.gitignore`. Check `git status` before you push.
- Masking in the UI only stops people reading over your shoulder. It doesn't protect the file on disk.
- There's no login. Anyone using your computer while the server is running can open the app.
- Be careful with **include secrets** when you share, and with where downloaded share files end up.

## Troubleshooting

| Problem | Fix |
| ------- | --- |
| Page says **"App not built yet. Run: npm start"** | `dist/` is missing. Run `npm start` or `npm run build` once. |
| `npm install` fails with **`EACCES: permission denied`**, or the build says **`Cannot find module @rollup/rollup-…`** | `node_modules` was copied from another computer or OS. Delete it (`rm -rf node_modules`, or remove the folder on Windows) and run `npm install` again. Don't copy `node_modules` between machines. |
| `start.command` won't open on macOS | Run `chmod +x start.command` once. If macOS blocks it as coming from an unidentified developer, right-click it and choose **Open**. |
| **`EADDRINUSE`** when starting | Port 5050 is already in use. Stop the other process or start with a different `PORT`. |
| Hand edits don't show up | Reload the page. Check that the `##`/`###` headings and `- **Label:** value` lines match the format exactly. |
| Lost changes after a bad save | Restore from `apps.md.bak`. Close the app first, then copy it over `apps.md`. |
