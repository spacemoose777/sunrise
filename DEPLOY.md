# Deploying Sunrise to GitHub Pages

These instructions will get your app live at a free public URL in about 10 minutes.

---

## Step 1 — Create a GitHub repository

1. Go to **github.com** and sign in.
2. Click the **+** button (top right) → **New repository**.
3. Name it exactly: `sunrise`
4. Set it to **Public** (required for free GitHub Pages).
5. Leave all other settings as default.
6. Click **Create repository**.

---

## Step 2 — Push your files to GitHub

Open a terminal (Command Prompt or PowerShell) and run these commands **one at a time**:

```bash
cd C:\Users\nickj\Claude\sunrise
```

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "Initial Sunrise app"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/sunrise.git
```
> Replace `YOUR_GITHUB_USERNAME` with your actual GitHub username.

```bash
git push -u origin main
```

Git will ask for your GitHub username and password.
**For the password, use a Personal Access Token** (GitHub no longer accepts plain passwords):
- Go to github.com → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Click "Generate new token (classic)"
- Give it a name, set expiry to "No expiration", tick the **repo** checkbox
- Copy the token and paste it as your password

---

## Step 3 — Enable GitHub Pages

1. Go to your repository on GitHub: `github.com/YOUR_USERNAME/sunrise`
2. Click **Settings** (tab at the top).
3. In the left sidebar, click **Pages**.
4. Under "Branch", select **main** and folder **/ (root)**.
5. Click **Save**.

GitHub will show a message: *"Your site is live at..."*
It usually takes **1–3 minutes** to deploy.

Your URL will be:
```
https://YOUR_GITHUB_USERNAME.github.io/sunrise/
```

---

## Step 4 — Install on your Android phone

1. Open **Chrome** on your Android phone.
2. Navigate to your GitHub Pages URL above.
3. Tap the **three-dot menu** (⋮) in the top right.
4. Tap **"Add to Home screen"**.
5. Confirm — Sunrise will appear as an app icon on your home screen.

---

## Step 5 — Enable 7am notifications

1. Open Sunrise from your home screen icon.
2. Tap **Settings** (bottom nav).
3. Toggle **Daily 7am notification** on.
4. When Chrome asks for permission, tap **Allow**.

That's it! You'll receive a morning prompt at 7am each day.

---

## Updating the app in future

If you make changes to the code, run these commands to push the update:

```bash
cd C:\Users\nickj\Claude\sunrise
git add .
git commit -m "Update: describe your change here"
git push
```

GitHub Pages auto-deploys within a minute or two.

---

## Notes

- **All your journal data** is stored privately on your phone only. Clearing Chrome's site data will erase it — use Settings → Export as JSON to back up.
- The app works **offline** once installed.
- **Notifications on Android**: for best results, keep the Sunrise PWA installed (not just a bookmark). Android may kill background services on some devices — if notifications stop arriving, open the app once to reactivate them.
