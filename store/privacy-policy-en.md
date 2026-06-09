# Privacy Policy — Keepr Notes

**Last updated: June 6, 2026**

## One-sentence summary

Keepr Notes does not collect, transmit, or sell any data. Everything you write lives in your own browser, on your own device.

## What Keepr Notes is

Keepr Notes is a browser extension (Manifest V3) that lets you take timestamped notes while you watch videos on YouTube. It is local-first by design: it runs entirely on your machine, with no servers, no accounts, and no connection to external services.

## What data is processed and where it is stored

When you use Keepr Notes, the extension stores the following information **locally** in your browser:

- The text of the notes you write.
- The second (timestamp) of the video associated with each note.
- The YouTube video id and its title, so your notes can be grouped and shown per video.
- Your extension preferences (for example, display settings).

All of this is stored using the `chrome.storage.local` API (or its Firefox equivalent), which is your browser's local storage. This data:

- **Never** leaves your device on the extension's initiative.
- Is **not** sent to Keepr Notes, to its developers, or to any third party.
- Is **not** synced to any cloud (we do not use `chrome.storage.sync`).

## What we do NOT collect

To be explicit, Keepr Notes does **not** collect or process any of the following:

- Personally identifying information (name, email, address).
- Login credentials (the extension has no accounts or login).
- Your browsing or watch history.
- Health, location, contacts, or financial information.
- Analytics, telemetry, usage metrics, or tracking data.
- Tracking cookies or advertising identifiers.

## Network usage

Keepr Notes makes **no network requests of its own**. It has no backend server. There are no endpoints to send data to. The extension does not download or upload videos.

The only network involved is YouTube's own website, which your browser loads normally when you visit the page; that happens with or without the extension and is outside Keepr Notes' control. The extension only reads the current playback time of the player already loaded in the tab.

## Export, backup, and restore

Keepr Notes includes features to **export** your notes (to Markdown) and to **back up / restore** them (as JSON). These operations:

- Are started **manually** by you.
- Produce files saved **wherever you choose** on your disk, through your browser's own download/save dialog.
- Send nothing to the internet.

From the moment you export or back up, **you** are solely responsible for those files and where you store or share them.

## Extension permissions

Keepr Notes requests the **minimum permissions** needed to work. Each permission is used only to save your notes locally, show the side panel, and operate within YouTube video pages. No permission is used to collect or transmit data.

## Sharing data with third parties

We do **not** share data with third parties, because we do not collect any data. There are no advertisers, analytics providers, or data brokers involved.

## Selling data

We do **not** sell your data. We do not have it.

## Children

Keepr Notes does not collect data from anyone, including children. The extension does not ask for or store personal information.

## Security

Because all your data stays on your device, its security depends mainly on the security of your own machine and browser. We recommend keeping your operating system and browser up to date and protecting physical access to your device. If you share or export your backup files, do so through channels you consider secure.

## Deleting your data

You are in control of your data at all times. You can delete it by:

- Removing individual notes or all notes for a video from the extension's panel.
- Uninstalling the extension: when you do, the browser removes the local storage associated with Keepr Notes.
- Using your browser's tools to clear extension data.

Because we have no servers, there is no cloud copy to request or delete.

## Changes to this policy

If we ever change how the extension works in a way that affects privacy (for example, adding an optional sync feature), we will update this policy and the "Last updated" date, and announce it on the store listing before the change takes effect. Any feature involving network or sync would be **optional and off by default**, and clearly described.

## Compliance

This policy is provided to meet the requirements of the Chrome Web Store, Firefox Add-ons (AMO), and privacy regulations such as the GDPR (EU) and CCPA (California). Because Keepr Notes does not collect or process personal data on its servers (it has no servers), there is no "data controller" handling user data beyond your own device.

## Contact

If you have questions about this policy or about privacy in Keepr Notes, write to:
**joseignaciozavalarocha@gmail.com**
