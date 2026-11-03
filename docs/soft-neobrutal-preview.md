# Soft neobrutalist surface preview

Branch: `preview/soft-neobrutal-cards`. This is a frontend preview; do not merge or promote it to production without design review.

The repo's Hallmark tokens supply the accent and motion timing. The Hallmark skill itself was not available in the session. The additional surface tokens live in `css/hallmark/surfaces.css`: warm paper, muted maroon rules, compact corners, small solid offset shadows and a deeper dialog shadow. This layer follows the existing school theme and keeps the school posters and public hero artwork intact.

Cards, record tables, student details, announcements, sign-in, the assistant and the public guide use the shared treatment. Buttons have a short pressed movement; static information cards stay still. Motion is disabled for the reduced-motion preference, and decorative shadows are removed when printing.

Shared popups use the current three-second minimum loading policy in `docs/preview-loading.md`, as explicitly requested for the preview. They have accessible dialog names, a keyboard focus loop, Escape and backdrop dismissal, focus restoration, stacked-popup handling and an inert background. Long content scrolls within a viewport-bounded card. Incident evidence keeps its own gallery scroll and persistent footer.

Validation includes the production build, the 152 existing automated checks, student/admin workspace workflows on desktop and mobile, incident uploads/eight-image gallery, admin PIN flows, plus focused popup keyboard/stacking/scroll checks at 1440, 390 and 844 pixels.

The preview uses the existing Supabase backend and normal school accounts. Saving, editing or deleting through it affects the same school data. Automated browser checks use intercepted services and synthetic records; no real school data or outbound messages are changed by the checks.
