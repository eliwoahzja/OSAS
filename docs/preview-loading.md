# Preview loading and school-photo update

Branch: `preview/soft-neobrutal-cards`. Main and the hosted backend are unchanged.

The existing school-front photograph now fills the landing hero behind the copy, with a lighter overlay so the building remains visible. The slanted divider, seal and theme remain intact.

The user explicitly requested a **3,000 ms default** for skeletons and spinners. This overrides the previous immediate-loading preference. `js/loading.js` centralizes that duration; it is not shortened for reduced motion. Reduced motion stops shimmer/rotation while retaining the same loading state and accessible status.

- Routes render behind a loading stage and reveal after both three seconds and the page work complete. Previous route requests still cannot replace a newer page.
- Student dashboard placeholders show the profile and announcement feed. Admin placeholders show the greeting, six summaries and three chart panels. Other student/admin pages use distinct table placeholders.
- Popups, initial sign-in, sign-in/recovery/PIN form switches, risk wizard steps, notification review forms and the assistant opening use skeleton covers. Forms remain inert while covered. Cancelled covers clean up their timers and do not steal focus later. Image evidence can hold its cover until signed image URLs finish loading.
- Async button actions hide all text/icons and display a centered spinner without changing size. The button accepts one action at a time, holds a three-second presentation before committing, and stays busy until that operation completes. Closing its form before the queued action begins cancels it. This is a frontend presentation policy, not a server-side idempotency guarantee.
- Buttons restore their labels and interaction state after completion/failure; resend cooldowns can intentionally keep a control disabled. PIN verification also holds its pending indicator for at least three seconds.

Validation includes measured three-second page/popup/button durations, role-specific layout assertions, a long-running action, a failed action, duplicate events, detached/cancelled actions, native-event target preservation, reduced motion, popup focus/stacking, desktop/mobile workflows and the existing Auth/API regressions. Browser backend requests are intercepted; these checks send no real email/SMS and change no real records.

Results: 156 automated Auth/API/script checks, all 12 browser suites and the production build passed. Desktop/mobile screenshots confirm the visible school photograph and distinct student/admin loading layouts.
