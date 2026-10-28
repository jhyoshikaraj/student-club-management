# ClubSphere v3 changes

## Workflow and permissions
- Added the single `club_coordinator` role as head of clubs/chapters.
- Event workflow is President/VP submission -> Club Coordinator decision -> Venue Administrator queue.
- Venue approvals are restricted to Venue Administrator; requests only appear after coordinator approval.
- Added same-day/same-venue conflict checking and notifications listing alternative venues.
- Joining requests and budgets are decided by Club Coordinator; Faculty Coordinator can view event/venue statuses but no longer has approval controls.
- OD eligibility is granted only when an event has `hasOD: true` and the student is marked present.

## Student and mentor improvements
- Student overview shows joined-club count and My Clubs shortcut rather than an approved badge.
- Joining approval creates membership and sends a notification.
- My Clubs supports legacy memberships and resolves assigned president/vice-president/faculty coordinator details.
- Mentor label is `Mentor`; overview is mentee-focused and mentee details include clubs and attendance/OD activity.
- Recent activity on overview is limited to the last seven days without deleting event records.

## Accounts, messages, notifications
- Director account management can create numbered student, president, vice-president, faculty coordinator and mentor accounts (up to 100 per request).
- Director can assign mentees to mentors.
- Added role-checked messages, inbox/sent view and reply action.
- Notifications can be opened (marking them read), individually deleted, all read marked, all read deleted, or all deleted.

## Theme and venue inventory
- White professional theme with teal accents and less clutter; removed dashboard metric tiles.
- Added Club Coordinator portal and removed Parent/Alumni portals.
- Added safe non-destructive setup scripts for the Club Coordinator account and venue inventory.
- Venue inventory: AB-1/AB-2 rooms G01-G33 and 101-133 through 401-433, Einstein Hall, Newton Hall, Auditorium, Amphitheatre, CB G01-G33, SAC Ground Floor and SAC 2nd Floor.

## Safety notes
- No `.env` file or `node_modules` is included in the ZIP.
- Do not run `npm run seed` against an existing database because it resets users, clubs and venues.
- Run `npm run setup:roles` and `npm run setup:venues` from `backend`; both are non-destructive.
