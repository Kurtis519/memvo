# Supabase Auth setting check

Project: iblnwhxtgyrrlvaehasa
Date: 2026-04-19

Confirmed in the Supabase dashboard that the **Confirm email** toggle on Authentication → Sign In / Providers was switched off and the change was saved successfully.

Observed signals:
- The toggle changed from enabled to disabled.
- The page displayed a success toast after saving.
- The Save changes button became inactive again after the update.

Impact:
- New email/password signups should now be able to receive an immediate session instead of waiting for email verification.
