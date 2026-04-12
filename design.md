# Memvo Mobile Interface Design

Memvo is designed as a **portrait-first**, **one-handed**, privacy-focused voice note experience that feels native to iOS while remaining consistent on Android. The interface should privilege quick capture, calm visual hierarchy, and clear trust signals. The central user promise is that recording is fast, transcription is understandable, and privacy controls are visible rather than hidden.

The visual system is anchored by a restrained palette that supports high readability and a clinical sense of trust. The primary brand color is **#0F6E56**, used for the record button, active states, and focused accents. The background remains **#FFFFFF**, primary text is **#1A1A1A**, and supporting text uses **#888888**. Cards use a 12px corner radius, inputs use an 8px corner radius, and spacing should remain generous so dense transcript content never feels cramped.

| Design element | Specification |
|---|---|
| Orientation | Mobile portrait, 9:16 |
| Primary color | `#0F6E56` |
| Background | `#FFFFFF` |
| Primary text | `#1A1A1A` |
| Secondary text | `#888888` |
| Card radius | 12px |
| Input radius | 8px |
| Typography | System default, SF Pro on iOS and Roboto on Android |
| Primary action pattern | Large floating record control placed within easy thumb reach |

## Screen List

The app requires a concise but complete screen system that supports the V1 core product scope, with future-ready room for V1 Launch additions. Each screen should feel visually related, with the record action treated as the central behavioral anchor.

| Screen | Purpose | Primary content and functionality |
|---|---|---|
| Onboarding | Explain trust, value, and pricing before account creation | Three slides, logo, feature highlights, pricing transparency, Google and email signup, free-tier entry, referral code prefill state |
| Home Feed | Default landing area for recent notes and fast capture | Greeting, date, search field, optional Pro memory clusters, chronological notes feed, floating record button |
| Active Recording | Full focus capture experience | Waveform, timer, live transcript, pause, stop, offline banner, microphone state |
| Note Detail | Review and organize one note | Editable title, playback bar if local audio exists, collapsible summary, action items, editable tags, timestamped transcript, export actions |
| Search | Fast retrieval across transcripts | Focused search bar, highlighted result snippets, filters for tags, date, folder |
| Library | Folder-based organization and recent activity | Default folders, user folders, note counts, create/rename/delete folder controls, recent note summaries |
| Settings | Account, privacy, referral, support, and subscription control | Profile details, plan status, upgrade path, billing history, referral stats, privacy controls, sync state, support links |
| Paywall | Honest upgrade screen triggered at limits | Free vs Pro comparison, explicit price, no-ads promise, cancel-anytime messaging |
| Admin Panel | Restricted owner-only operational controls | Aggregate usage stats, referral metrics, recent signups, grant/revoke manual Pro access |

## Screen-Level Layout Notes

The **Onboarding** flow should use a horizontally paged card-like storytelling structure with the strongest message on privacy and pricing transparency. The final step transitions into authentication without visual disruption. If a referral link is present, the code should appear automatically and the bonus message should be visible before signup submission.

The **Home Feed** should prioritize quick scanning. The header should contain a friendly greeting and today’s date, followed by a search field. If Pro-only memory clusters are present later, they should sit in a horizontally scrollable row above the note list. Notes should appear as vertically stacked cards containing title, date, duration, summary snippet, and tags. The 72px floating record button should remain visually centered above the bottom tab bar.

The **Active Recording** screen should minimize distractions. The top area should carry status messaging, the center should hold the waveform and timer, and the lower half should present the live transcript in a readable scrolling region. Pause and stop controls must remain large enough for one-handed use and should clearly distinguish between temporary pause and final stop.

The **Note Detail** screen should feel like a readable document rather than a settings page. The title should be prominent and editable in place. The summary is collapsed by default to reduce clutter, while action items and tags should be easy to scan. The transcript area should visually separate timestamps from transcript text to support replay navigation.

The **Search** screen should open with keyboard focus and show results immediately beneath the field. The filtering interface should remain lightweight and horizontally scrollable where possible to avoid consuming vertical space. Highlighted transcript snippets should guide users directly to where the search term appears.

The **Library** screen should emphasize structure. Default system folders should appear first, followed by user-created folders. Counts and recent activity should help users understand note volume at a glance. Create, rename, and delete actions should be available without overcrowding the list.

The **Settings** screen should be organized into clearly labeled groups: account, subscription, referral, privacy, app status, support, and admin access. The referral entry should feel promotional but still consistent with the privacy-first tone. The admin panel link should only render for users with elevated access.

The **Paywall** should present a calm and honest comparison rather than a high-pressure sales interface. The language should foreground transparency, language support, unlimited usage, and the absence of ads or surprise charges.

The **Admin Panel** should use a compact dashboard layout with statistic cards at the top, recent signups below, and grant/revoke controls in a separate section that reduces risk of accidental misuse.

## Key User Flows

The main experience centers on fast voice capture and trusted review. The first critical flow begins when the user opens the app, reaches the home feed, taps the floating record button, records audio, watches live transcript updates, then stops recording and is taken into note processing and review.

| Flow | Step-by-step path |
|---|---|
| First-time onboarding | Open app → onboarding slides → choose Google, email, or free entry → optional referral code handling → land on home feed |
| Record a note | Home feed → tap floating record button → active recording screen → pause/resume as needed → stop recording → transcription and AI processing → note detail |
| Review and edit | Home feed or search result → note detail → edit title/tags/transcript → review summary and action items → export or share |
| Search past content | Open Search tab → type keyword → review highlighted results → open matching note detail |
| Organize notes | Open Library → browse default or custom folders → create or rename folder → assign notes through note detail flow |
| Invite friends | Settings → Invite friends & earn minutes → view referral code and stats → tap share → send prewritten message |
| Upgrade plan | Hit free-tier limit or open subscription area → paywall → review honest plan comparison → continue to subscription purchase flow |
| Admin moderation | Settings → Admin panel → review stats and recent signups → enter email to grant or revoke manual Pro access |

## Interaction and Accessibility Guidance

The app should maintain strong thumb ergonomics. Primary actions need to be placed in the lower half of the screen where practical, especially the record control and major confirmation actions. All tappable elements should meet the 44x44pt minimum touch target. Live transcript text, note cards, and settings rows should support dynamic type scaling without clipping.

Privacy reassurance should be visible in the interaction language. Whenever upload, sync, deletion, or billing state is relevant, the UI should use plain language that explains what is happening. Memvo should feel trustworthy not only because of backend rules, but because the interface continuously communicates those rules clearly.

## Content Tone and Brand Expression

Memvo should sound calm, direct, and trustworthy. Copy should avoid hype and technical jargon in end-user contexts. The product voice should reinforce that the app is private, bot-free, transparent about pricing, and respectful of user data. Success states should feel reassuring rather than celebratory, while errors should explain the next safe step clearly.
