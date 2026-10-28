# ClubSphere v11 source update

This update addresses the inspected v10 source issues below. It is a source-code update and has not been run against the user's live MongoDB database.

## Changes
- Director Student Directory now includes editing for student accounts, per-student mentor assignment/removal controls, and keeps mentor `mentees` / student `assignedMentor` references synchronized.
- Account Administrator remains the only role allowed to create accounts, change roles/status/passwords, and delete accounts.
- Account deletion now cleans student memberships, joining requests, club member-role entries, mentor links, authored event dependencies, attendance records, OD rows, messages and notifications without deleting other students' club membership records.
- Fixed `My Clubs` scoping so presidents see only clubs where they are the designated president (including multiple clubs), faculty coordinators see clubs they coordinate, and vice presidents use their own club/access assignments.
- Added event-independent attendance sessions. Presidents can create and edit attendance by purpose; members receive a view-only list in notifications; faculty coordinators can view the saved records.
- Added OD lists with student name/email/details rows, add/remove rows, president-only create/edit, Club Coordinator approval/rejection, and notifications to listed students without exposing the list to them.
- Fixed the attendance UI's prior undefined `c.memberRoles` reference by replacing the event-tied attendance screen with the standalone session workflow.
- Student event APIs continue to filter out events until Club Coordinator approval.

## Validation limits
- All JavaScript files passed `node --check` syntax validation.
- No live MongoDB integration tests were run in this environment. Please apply to a copy/backup first and test the workflows before relying on it for the deadline.


## Consolidated fixes prepared after user testing (October 2026)

- Fixed event time schema validation to accept valid 24-hour `HH:mm` values.
- Added session-scoped President portal access for existing student accounts explicitly listed in a club's authorized access emails. The stored account role remains `student`; the President role override is only applied to that login session and scoped to the authorized club.
- Preserved student identity when a student is appointed President during coordinator-led club creation; club-specific role is recorded on the club membership.
- Fixed Browse Clubs membership display to use active club memberships instead of stale `User.club` or approved-request state. Removing a member also closes the old approved request so the student can request again.
- Added Director deletion controls for student accounts and corresponding server authorization, while continuing to deny deletion of administrator accounts.
- Replaced Club Coordinator Edit Club prompts with an in-dashboard editing page for details, authorized emails, and Faculty Coordinator assignment.
- Replaced account-edit prompts with an in-dashboard edit page.
- Added a notification to the student when their mentor assignment changes or is removed.
- Improved Mentor club role resolution using club-specific membership roles and President/Vice President references.
- Added View Club access to Faculty Coordinator My Clubs cards.

These changes have been syntax-checked. Live MongoDB integration and end-to-end browser testing have not been performed in this environment. Back up the project and database before deploying, and test each listed workflow in the existing development database. No seed or deletion scripts should be run as part of this update.

## v12.1 follow-up: event access control and event discovery
- Removed ordinary `student` role from event creation and event-status update API routes.
- Added controller-level role and per-club authorization checks so ordinary Student sessions cannot create events, and President portal sessions are restricted to their authorized club.
- Kept event creation form visible only to President and Vice President portal roles.
- Added Upcoming & Ongoing Events navigation for Student, Mentor, Director, and system administrator dashboards where applicable.
- Limited Student and Mentor event listings to coordinator-approved events dated today or later, ordered by date.
- No database migration or data deletion is required.

## Consolidated event access and venue-review update
- Ordinary students cannot create events; the event creation form is only shown in the President portal, and the API enforces the role and club scope.
- Non-club students see only approved upcoming/ongoing events. A student who belongs to the event's club can also see that club's event approval stages, including venue rejection.
- Event listings display Club Coordinator and Venue Administrator decisions separately.
- Venue review now has a full-details view and an inline decision form. Cancel closes the form without sending a decision; no browser prompt is used for venue decisions.
- Venue rejection requires a reason and supports selecting alternative venues that are not booked for overlapping times. Notifications are sent to the event creator, the actual club President, and the Faculty Coordinator when assigned.
- Removed the separate Vice President portal card. Existing student/legacy VP accounts can use the President portal only when their email is explicitly authorized for a club; their stored account role is not changed.
