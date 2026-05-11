# Live Preview Notes

- The Expo web preview opened directly on `/onboarding`.
- Slide 1 is visibly rendered with the Memvo icon, headline text, and the `Back` and `Next` buttons.
- A direct indexed click on the visible `Next` button failed because the element index became stale after locate, so the next verification step should refresh the page state before continuing.

The refreshed preview exposed stable button indices. Clicking `Next` successfully advanced the live web preview from slide 1 to slide 2, and slide 2 visibly shows the expected heading plus all three feature rows.

Clicking `Next` from slide 2 advanced the live preview to slide 3, and clicking `Get started` then changed the live URL from `/onboarding` to `/signup`. The signup screen rendered in the preview with the expected heading, email field, password field, full-name field, and Google button, confirming that the onboarding CTA now navigates correctly in the live Expo preview.
