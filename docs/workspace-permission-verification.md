# Workspace permissions verification — 2026-11-03

Source branch: `preview/soft-neobrutal-cards`. Main is unchanged. The database permission repair is live on the existing shared Supabase project and takes effect on existing deployments immediately.

## Cause and repair

The live `evacuation_plans` table had SELECT/INSERT/UPDATE policies but no DELETE policy. A valid administrator DELETE therefore returned an empty result rather than removing the plan. The same omission existed on `risks`. Migration `20261103214256_restore_admin_record_deletion.sql` adds administrator-only DELETE policies using the existing `public.is_admin()` check, which reads the trusted `app_metadata.role` claim.

The audit also found that the floor-plan and inspection-photo upload policies allowed every authenticated account to upload. They now require the same administrator check. Student incident-evidence upload/read rules remain owner-scoped and unchanged. Existing editing creates a new file key, so these uploads do not need Storage upsert permissions.

No notification write grants were added: notification writes deliberately run through the authenticated server function. Student access remains limited to school contacts, floor plans, announcements, their own profile/grade and their own incident reports.

## Verification

`supabase/tests/workspace_crud_permissions.sql` runs the actual RLS checks under authenticated administrator, student and anonymous database roles, using claims from existing Auth accounts. Its fixtures and generated audit entries run inside a subtransaction that is explicitly rolled back. The grade assignment check is rolled back too. It creates no Auth accounts or Storage objects and sends no messages.

All **99 checks across 15 contexts passed**: administrator create/view/update/delete for contacts, floor plans, drills, inspections, supplies, risks, reports, announcements and incidents; student read scope and blocked writes/deletes; own incident submission and administrator review; profile and grade visibility; notification privacy; and administrator/student upload policy expressions. The initial run reproduced the missing floor-plan and risk DELETE permissions before the migration. Cleanup checks found no verification plans, incidents, notifications or audit events left behind; all five original floor-plan records remained intact.

The production build and **158 automated Auth/API/script checks** passed. All **14 browser suites** passed: accounts, administrator PIN, announcements, feedback/chat, incidents/evidence, loading controls, popups, route navigation, public scrolling, password recovery, record actions, sidebar, student login and full workspaces. Browser requests are intercepted; notification delivery, account changes and file transfers in those suites use test responses. Real email/SMS delivery and production account creation were not triggered.

Two browser-test maintenance fixes were needed: incident image names now match the existing reference-photo update, and the public-page test waits for native keyboard/wheel scrolling to settle before checking the next anchor click. The public page needed no runtime change.

The live migration history was checked through Supabase MCP and matches the committed version. The CLI local-history command could not connect because no local database stack is running; it was not used to infer live success.

Post-change security advisors are unchanged: intentional service-only RLS tables, plus existing [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) and [MFA configuration](https://supabase.com/docs/guides/auth/auth-mfa) warnings. This repair does not change Auth settings.
