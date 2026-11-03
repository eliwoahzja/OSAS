# OSAS verification — November 3, 2026

The public brochure, student portal and administrator workspace were checked on desktop and mobile. Browser Auth, REST and Edge requests were intercepted: these checks did not send real email/SMS or modify real accounts. Live database permission checks ran in transactions that rolled back.

## Corrections

- Replaced the clipped hero gradient with edge-anchored shapes. Both white stripes reach the hero's top and bottom at 980, 1440 and 1920 pixels; original images and content are preserved.
- Made brochure navigation scroll the document directly, using the section's header offset. Drills and Reminders now land below the sticky header reliably.
- Synchronized the assistant's startup screen with its composer visibility, preventing a fast first message from being ignored while the conversation initializes.
- Clarified the existing student-ID/admin-email sign-in field and email recovery field. The student-ID placeholder is preserved.
- Added column-header semantics to shared tables and printed reports.
- Added restrictive database read guards for account profiles and administrator-only school tables. Existing write policies and service-role access remain intact.

## Results

| Check | Result |
| --- | --- |
| `npm test` | 152 passing: 106 script, 28 Auth and 18 API checks |
| Production build and syntax checks | Passed |
| Public brochure | Mouse/keyboard scrolling, section navigation, animations, reduced motion, login/back and no-JavaScript fallback passed |
| Native touch swipes | Passed at 390-pixel mobile and 980-pixel desktop-width touch layouts |
| Admin PIN | First-use setup, confirmation, existing PIN, retries, restoration, cancellation and mobile keypad taps checked |
| Student sign-in | Student-ID/email, saved mailbox OTP, invalid code retry and restored session checked |
| Password recovery | Reset requests, callbacks, expiry, password update, session isolation and subsequent sign-in checked |
| Accounts | Listing, create/edit UI, immutable IDs and admin grade assignment checked |
| Navigation and sidebar | Role boundaries, obsolete-route handling and desktop/tablet/mobile geometry checked |
| Incident reports | Own-report isolation, submission, multiple uploads, status review, failure retry, eight-image gallery and mobile/landscape sizing checked |
| Announcements and student details | Admin publishing/edit/delete, two-post pagination, posters, student name/ID/grade, no adviser and no student analytics requests checked |
| Whole workspace | All 11 admin pages and four student pages loaded at 1440 and 390 pixels; main forms, CSV downloads, native-print invocation, chat and logout passed |
| Live database | Workspace reads, incident ownership, announcement permissions and grade assignment/isolation passed |
| Live services | All nine deployed Edge Functions reported active; the Email Auth provider is enabled |

The ten browser scripts are `browser-public-scroll`, `browser-admin-pin`, `browser-student-login`, `browser-recovery`, `browser-accounts`, `browser-sidebar`, `browser-navigation`, `browser-incidents`, `browser-announcements` and `browser-workspaces` under `tests/`.

## Remaining hosted setting and limits

The live Auth settings returned `disable_signup: false`. The owner was asked to turn off **Allow new users to sign up** in [Supabase Authentication providers](https://supabase.com/dashboard/project/rwqaeabxusivkyjgskko/auth/providers), matching the admin-created-account workflow. The connected Supabase tools do not expose Auth configuration updates. This requires a dashboard change and a subsequent settings recheck.

Real email/SMS delivery, a new authenticated production n8n conversation and physical printing were not triggered. Those outbound actions are represented by intercepted browser requests; this report does not claim a new live delivery test.
