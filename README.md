# Cookie Domain Cleaner

A small Firefox extension for finding and deleting cookies by matching text in the cookie domain.

The default match text is `microsoft`, but it can be changed in the popup before counting or deleting cookies.

## Status

This is currently set up for Firefox only.

The Firefox extension files are in the `firefox/` folder. Other browsers are not configured or tested yet.

## What it does

- Counts cookies whose domain contains the entered text
- Deletes cookies whose domain contains the entered text
- Defaults to `microsoft`
- Matches against cookie domains only, not cookie names or values

## Install the packaged Firefox add-on

Use the prebuilt `.xpi` file if you just want to install the extension.

1. Download the `cookie-domain-cleaner-2.1.0.xpi` file from this repo.
2. Open Firefox.
3. Open the `cookie-domain-cleaner-2.1.0.xpi` file with Firefox, or drag it into a Firefox window.
4. Confirm the install prompt.

## Alternative - Load the developer version

Use the unpacked files if you want to edit or test the extension locally.

1. Open Firefox.
2. Go to `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…**.
4. Select `firefox/manifest.json`.

Temporary add-ons loaded this way are removed when Firefox restarts.

## Notes

- Uses the Firefox `cookies` WebExtension API.
- Requests `cookies` and `<all_urls>` so it can enumerate cookies and then filter locally.
- Enumerates available cookie stores to better handle container/private stores when accessible.
- Attempts partition-aware lookup/removal for Firefox's partitioned cookie storage.
- If you need private-window cookies affected, allow the extension to run in private windows.
- Cookie deletion depends on Firefox extension permissions and the cookie stores Firefox exposes to the extension.

## Have fun!
![cookie-domain-cleaner icon](cookie-eater.png)