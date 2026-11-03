# Preview record actions and calculation surfaces

Branch: `preview/soft-neobrutal-cards`. This update does not change main or the hosted database.

Record actions share labeled View, Edit and Delete/Remove buttons, including inspections, supplies, drills and floor plans. Destructive actions use a muted red treatment. The sticky inspection/supply action header uses the same warm background as the rest of its header. The sideways-scroll hint is removed from both table and table-skeleton builders; keyboard focus and horizontal scrolling remain available.

Evacuation plans use an explicit View action for everyone. Administrators also receive Edit and Remove. Editing preserves the existing file unless a replacement is selected, updates the existing row and supports version/current status. Removal uses confirmation and refreshes the list. The existing upload flow remains available. Map, missing-image and PDF icons use the bundled Font Awesome font; new uploads retain their file extension and PDF links tolerate query strings.

The quantitative calculation uses warm outlined cards, offset shadows, a wrapping formula and a highlighted current band. It scrolls inside the shared dialog rather than a second nested scrolling body. Qualitative summaries use the same surface colors. Scoring and risk bands are unchanged.

Verification uses intercepted REST and Storage requests, never real school mutations: explicit row actions; administrator edit/remove and student read-only access; retained/replacement files; cancelled removal; failed edit/removal and retry; creation; map/PDF glyphs; shared inspection/supply styles and header backgrounds; formula/viewport fit. The focused record suite covers desktop (1440), touch desktop mode (980) and mobile (390), for both roles. The existing workspace suite covers all student/admin routes and forms, alongside 158 automated checks and the production build.
