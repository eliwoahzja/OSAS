# Preview interaction and motion update

Branch: `preview/soft-neobrutal-cards`. Frontend preview only; main and the hosted backend are unchanged.

The current loading-duration policy is documented in [preview-loading.md](preview-loading.md) and supersedes the earlier immediate-transition timing below.

The Apple Design skill informed immediate input feedback, short reversible motion, stable spatial relationships and accessible alternatives. `js/motion.js` centralizes content arrival and interruptible popup presence. `css/hallmark/motion.css` supplies the motion timings, reduced-motion/contrast/transparency alternatives and interaction refinements while preserving the soft neobrutalist surface layer.

Routes render into separate page containers so delayed responses cannot overwrite newer pages. Actual completion controls indeterminate loading/busy status. Errors replace loading skeletons, requests have a timeout and ambiguous writes tell the user to refresh before retrying. Tables are keyboard-scrollable and have mobile scroll hints. The sidebar supports keyboard focus, Escape, current-page and expanded state; closed mobile items are inert.

Changed popup fields are protected by a keep-editing/discard choice. Shared dialogs include an explicit close control, field associations, stack/focus handling and viewport-bounded scrolling. Incident evidence uses a persistent footer, and active incident saves cannot be dismissed. Sign-in steps respond immediately instead of waiting for a long scripted transition.

Record lists fetch every API page. Incident exports use the current fields and server timestamp in Asia/Manila; CSV formula prefixes are neutralized. School poster dimensions reserve their space while images load.

Verification covers automated Auth/API/unit checks, desktop/mobile workspace workflows, normal and reduced motion, interruption during popup entrance, drafts, delayed response isolation, offline notices, error/retry, the existing sign-in/PIN/recovery/gallery/announcement flows and live transactional role checks. The separate readiness review records confirmed backend findings; these are not fixed by a frontend preview deployment.

Results: 156 automated checks (109 script, 28 Auth, 19 API), all 11 browser suites, the production build, and four live database role suites passed. Live SQL fixtures were rolled back; browser services were intercepted. No notification delivery or hostile production upload was performed.
