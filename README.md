# Hafize Project Tracker

A lightweight shared web app for File Tracker, Project Tracker, and Progress Tracker workflows. It runs as a static site, so it can be hosted from GitHub Pages and synced through Firebase Auth + Firestore.

## What is included

- File Tracker for hardcopy locations with project search, Jilid naming, Kabinet/Para location, and automatic Running/Closed categories.
- List of Projects as the master input for Project Name, Project Code, Status, and Pelaksanaan, with Excel download/upload.
- Project Tracker series for Konvensional Dalaman, Konvensional Perunding, and Reka & Bina.
- Progress Tracker series for Konvensional Dalaman, Konvensional Perunding, and Reka & Bina.
- Admin/team role controls for you and two colleagues.
- Firebase sign-in, real-time Firestore sync, and visible sync status.
- Fixed bottom-right trademark: `Hafize | ver1.0.0`.

## Run locally

Open `index.html` directly, or start a local static server:

```powershell
python -m http.server 5173
```

Then open `http://localhost:5173`.

Without Firebase config, the app works in local browser storage only. That is useful for testing the interface, but it will not sync with co-workers. Fresh local mode starts empty.

## Workflow

1. Add every project once in List of Projects.
2. Download Excel from List of Projects to get the current registered projects. The workbook columns are `Bil`, `Project Name`, `Project Code`, `Status`, and `Pelaksanaan`.
3. Upload Excel from List of Projects to register new projects. Existing project codes, duplicate uploaded project codes, and rows missing any of the five required columns are skipped.
4. Projects are sorted by the ending number in Project Code, such as `D23.430`, `C23.431`, then `D23.437`.
5. In File Tracker, search the master project by project code or project name.
6. Enter `0` for the first Jilid; the app will display the file as the project code only. Later Jilid values display as `CODE Jilid 2`, `CODE Jilid 3`, and so on.
7. When a newer Jilid is added, earlier Jilid rows for that project become Closed automatically. Update the closed file's Kabinet/Para manually if it moves.
8. Use Project Tracker and Progress Tracker by selecting from the master project list.

## Add Firebase

1. Create a Firebase project.
2. Add a Web app in Firebase project settings.
3. Copy the Firebase config object.
4. Enable Authentication with the Email/Password provider.
5. Create a Cloud Firestore database.
6. Put the Firebase web config in `firebase-config.js` so the public app can sync automatically:

```js
window.HAFIZE_FIREBASE_CONFIG = {
  apiKey: "your-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-sender-id",
  appId: "your-app-id"
};
window.HAFIZE_ADMIN_EMAILS = [];
```

For a static GitHub Pages app, the Firebase web config must be public if every browser should sync automatically. Keep admin emails and passwords out of the repository. Restrict the API key in Google Cloud to the GitHub Pages domain and rely on Firestore rules for data protection.

## Add Firestore rules

Publish `firebase.rules` in Firebase Console > Firestore Database > Rules. The rules do not contain a public admin email. Admin access is controlled by the `users/{uid}` document:

- `role`: `admin`
- `status`: `active`

For a fresh Firebase database, sign in once, then set your own `users/{uid}` document to `role = admin` and `status = active` in Firestore Data before inviting colleagues. Later users sign up as `colleague`; the admin can change roles and pause accounts in the Team page.

If a Firebase API key or admin email was ever committed publicly, rotate or restrict the key in Google Cloud API credentials and republish the sanitized Git history.

## GitHub Pages

This site is published from the `gh-pages` branch.

1. Open the GitHub repository.
2. Go to Settings > Pages.
3. Set Source to `Deploy from a branch`.
4. Set Branch to `gh-pages` and folder to `/ (root)`.

To update the live site after changes, push `main` to GitHub, then publish the same commit to `gh-pages`:

```powershell
git push origin main
git push origin main:gh-pages
```
