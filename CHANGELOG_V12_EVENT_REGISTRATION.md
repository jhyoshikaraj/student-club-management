# ClubSphere v12 update: event privacy, registration, and recruitment

## Event visibility and publication
- Public student event lists include only upcoming events that have both Club Coordinator and Venue Administrator approval and have been published by the organizing President.
- Students who are members of the organizing or collaborating club can view their club's event workflow and approval statuses. Other students do not receive pending/rejected club workflow records.
- President event lists are scoped to clubs they lead or are authorized to manage.

## Event registration
- Added a unique event registration record per student and event.
- Registration is available only after approval and publication while registration is open.
- Event participant limits are enforced by the API. Registration automatically closes when the limit is reached.
- Authorized organizing/collaborating club leadership can view registered students' names, emails, and registration times.
- Presidents can publish only after all collaboration, coordinator, and venue approvals are complete, and can open/close registrations.
- Event forms support multiple requested venues and a maximum participant count.

## Collaboration and decisions
- Collaboration requests have a details page/button and inline decision note controls rather than browser prompts.
- Event and venue decision details are displayed in pages/inline forms rather than browser prompts.

## Club recruitment
- Presidents can configure multiple recruitment roles while recruitment is closed. Recruitment cannot be opened until at least one role is configured.
- Student join requests now require a motivation statement and up to three ordered role preferences.
- Presidents can open request details to view the student's motivation and role preferences.

## Data safety
- No seed, deletion, or database-reset scripts are required. Existing documents remain in place; new fields use defaults for older records.
- New EventRegistration collection is created by Mongoose when first used.

## Verification limits
- JavaScript syntax checks and ZIP integrity checks were performed. Live MongoDB integration, browser testing, and end-to-end permission tests must still be run in the user's environment.

## Follow-up fixes: Faculty attendance details and student event privacy
- Faculty Coordinators can open attendance sessions in a dedicated read-only details page showing purpose, confirmation date, totals, and each student's present/absent status.
- Students only receive event approval workflow visibility for unpublished events belonging to their own club or a collaborating club they belong to.
- Public event catalogue responses omit internal Club Coordinator and Venue Administrator decisions. Published event details shown to students also omit those internal approval fields.
- These changes modify source code only and do not run database migrations, seed scripts, or deletion scripts.
