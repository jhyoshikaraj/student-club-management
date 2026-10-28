# ClubSphere v9 changes

- Replaced the president's prompt-based member editing flow with a member roster table containing editable names, emails and club-specific roles, plus explicit removal confirmation.
- Approved joining requests continue to add the student to the club roster and active membership records; the request form is blocked server-side while recruitment is closed.
- Added president-only open/close recruitment controls. Recruitment status is visible in club data, and opening/closing sends notifications to student accounts.
- Added president-only club announcements with member notifications and a student-facing View Club page for members.
- Fixed joining decision confirmation: cancelling the optional note prompt or the final confirmation leaves the request pending.
- Added an attendance occasion/session name so attendance can be recorded for a meetup or other occasion, not only described as generic event attendance.
- Added a dry-run-first Innovation Club removal script that also cleans linked requests, memberships, events, attendance, budgets and legacy user club references. It requires an explicit `--confirm` flag to delete.

## Validation performed

- Ran `node --check` on every JavaScript file in backend and frontend.
- Validated `backend/package.json` JSON syntax.
- Checked ZIP archive integrity after packaging.

These are static checks. A live MongoDB integration test and browser-based end-to-end test have not been run in this environment. Back up the database before using the destructive Innovation Club cleanup command.
