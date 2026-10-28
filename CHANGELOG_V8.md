# ClubSphere v8 changes

## Club ownership and membership
- Club joining requests are visible to and decidable only by the president of the specific requested club.
- Club presidents can own more than one club; the club's president reference, rather than the user's single legacy `club` field, controls club-specific access.
- `My Clubs` for club presidents/authorized student leaders is scoped to clubs they lead or have explicitly been granted access to; `Browse Clubs` remains separate.
- Faculty Coordinators have separate `My Clubs` and `Browse Clubs` views, and newly created clubs receive their own Faculty Coordinator account.
- Club-specific member positions are stored on the club, so a student can be Treasurer in one club and President in another without overwriting a global position.
- Presidents can add/update/remove student members and assign club positions. Assigning the `Vice President` position grants club-specific workspace/event access; joining requests remain president-only.

## Student mentoring and messaging
- Student-like accounts (regular students, club presidents, and legacy vice presidents) can be assigned a faculty mentor.
- Mentors can see the student's club-specific role in their mentee details.
- Student-like accounts can view their assigned mentor and message only that assigned mentor; mentors can message only assigned mentees.
- Staff accounts cannot be assigned as mentees.

## Events
- Event creation includes Solo and Collaborative types.
- Collaborative events notify each participating club's president and require their approval before Club Coordinator approval can proceed.
- The event retains its description, budget, requirements/resources, venue, OD eligibility, and existing approval workflow.
- Club Coordinators can delete past/completed/cancelled events, with linked budget and attendance records cleaned up.

## Account administration and usability
- System Account Administrator can edit account details/roles/status/passwords and delete accounts; related club and mentor references are cleaned up.
- Password fields have show/hide controls on login and in dashboard forms.
- Added `npm run remove:codeathon`, a targeted maintenance command that removes only events whose titles contain “Codeathon” and their linked budget/attendance records. It does not reset clubs, users, or venues.

## Important notes
- Existing MongoDB data is preserved by default. Do not run `npm run seed` to apply these changes.
- A President account is still a student identity for mentoring purposes. Club-specific positions are stored on the Club record.
- Backend and frontend JavaScript syntax checks were run. This ZIP has not been end-to-end tested against your live MongoDB instance; follow the verification checklist before relying on it for real use.
