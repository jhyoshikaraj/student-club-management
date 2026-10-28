# Student Club Management System

A full-stack role-based Student Club Management System aligned with the project's UML workflows: login, club browsing, club joining requests, request review, events, venues, attendance/OD, budgets, bills and notifications.

## Stack
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Authentication: JWT + bcrypt

## Run locally

### 1. Configure MongoDB
Copy `backend/.env.example` to `backend/.env` and set `MONGO_URI` and `JWT_SECRET`.

### 2. Install dependencies
```bash
cd backend
npm install
```

### 3. Optional demo data
```bash
npm run seed
```
This creates demo users, clubs and venues. Demo password: `Pass@123`.

### 4. Start the application
```bash
npm start
```
Open **http://localhost:5000**. The new landing page lets users choose Student, Employee, Parent or Alumni. Student and Employee sign-in are wired to the current backend. Parent and Alumni are explicitly marked as planned because those roles and workflows are not present in the supplied backend. The Express server serves the frontend, so the frontend and backend use the same origin.

## UML-aligned workflows
1. Student logs in and browses clubs.
2. Student submits a **Club Joining Request**.
3. Faculty Coordinator reviews and approves/rejects the request.
4. Approved requests add the student to the club and notify the student.
5. President/VP create club events and request venues.
6. Venue Administrator reviews venue requests; Faculty Coordinator can override for assigned clubs.
7. President/VP take attendance after venue approval; present students become OD eligible.
8. President/VP submit budgets; Director reviews them; Faculty Coordinator can override for assigned clubs.
9. Approved budgets accept bills; approved bills are released to the club account.
10. Faculty Mentors see only their assigned mentees and participation information.
11. Users receive in-app notifications for important workflow decisions.

## Demo accounts
All seeded users use password `Pass@123`:
- `student@college.edu`
- `president@college.edu`
- `vp@college.edu`
- `coordinator@college.edu`
- `venue@college.edu`
- `director@college.edu`
- `mentor@college.edu`

## Portal and workflow notes
- Student sign-in accepts the `student` role; Employee sign-in accepts the current staff roles (president, vice president, venue administrator, director, faculty coordinator and faculty mentor). A mismatch is shown before opening the dashboard.
- The use-case document includes additional parent/alumni-style portals in the visual reference, but the supplied backend only defines student and staff roles. Do not treat the Parent and Alumni cards as implemented features.
- The refreshed UI uses a light cream and green palette, responsive portal cards, keyboard-friendly links and inline login errors. Existing API routes and dashboard workflows have been retained.

## Production note
The registration endpoint currently supports the project's demo/setup workflow. Before production deployment, privileged roles should be created only by an authorized administrator/director rather than selected freely during public registration.


## Portal selection page (updated)
The home page now lists the roles already defined by the backend: Student, Club President, Vice President, Faculty Coordinator, Venue Administrator, Director, and Faculty Mentor. Each portal validates the signed-in account against its exact backend role. No Parent or Alumni accounts are invented. The interface uses a light ivory, teal, and muted accent palette.


## v3 workflow and account updates
- The Club Coordinator is the head of all clubs and chapters. Event submissions go to this role first; venue requests appear in the Venue Administrator queue only after event approval.
- Only the Venue Administrator can decide venue requests. If the requested venue is already approved for another event on the same day, the request is blocked and available alternatives are sent to the event creator.
- Only the Club Coordinator can approve joining requests and budgets. Faculty Coordinators can view event/venue statuses but do not approve joining requests or events.
- Events have an explicit OD checkbox; attendance only grants OD eligibility for events marked as OD.
- Students see approved memberships under My Clubs and receive a notification when a joining request is approved. The My Clubs endpoint also supports legacy membership data.
- Notifications support click-to-open/read, deleting individual notifications, deleting all read notifications, marking all read and deleting all notifications.
- Messaging is available in each dashboard and validates recipient role rules on the server. Mentors can message only assigned mentees.
- The Director has account management for creating numbered student, president, vice president, faculty coordinator and mentor accounts, plus assigning mentees. The single Club Coordinator account is created with `npm run setup:roles` if missing.
- The venue inventory is created safely without deleting existing venues with `npm run setup:venues`. It adds AB-1 and AB-2 room G01-G33 and floors 1-4 (101-133 through 401-433), Einstein Hall, Newton Hall, Auditorium, Amphitheatre, CB G01-G33 and SAC Ground/2nd Floor.
- Recent activity in the overview is limited to items created in the last seven days; historical events are not deleted.

Run the migration scripts from `backend` after saving a backup of the database:
```powershell
npm run setup:roles
npm run setup:venues
```
These scripts do not delete existing users, clubs or venues. Do not run `npm run seed` on an existing database because it resets users, clubs and venues.


## Account creation and persistence (v5)

Account creation is reserved for the separate **Account Administrator** role. The Director can view the MongoDB-backed account directory and assign mentors, but cannot create accounts.

1. In `backend/.env`, set `SYSTEM_ADMIN_EMAIL` to an email you control and `SYSTEM_ADMIN_PASSWORD` to a private password of at least 10 characters.
2. From the `backend` folder, run `npm run setup:admin` once. This creates the Account Administrator in MongoDB without deleting existing records.
3. Run `npm start`, open `http://localhost:5000`, choose **Account Administrator**, and sign in using those credentials.
4. Use Account Creation to add multiple accounts. New accounts are saved in MongoDB, so they remain after server/browser restarts as long as `.env` continues pointing to the same database.
5. Sign in as Director to see the refreshed student list and assign students to mentors. Use Refresh list after another administrator adds accounts.

Do not run `npm run seed` against a database containing data you want to keep.


## Club creation and event review additions (v7)

- The Club Coordinator now has a **Clubs & Create Club** navigation item. The form creates a club and creates its President, Vice President, and Faculty Coordinator accounts, assigning each account to the correct club relationship. Use distinct emails and passwords of at least 8 characters.
- President/VP event proposals now capture an event description, proposed budget, and requirements/resources needed.
- The Club Coordinator's Event & Finance Review table has a **View details** action showing the proposer, event details, requested resources, proposed budget, related budget proposals/justifications, and venue/coordinator status before approving or rejecting.
- Existing MongoDB records are not intentionally deleted by these changes. New Event fields have defaults, so older event records remain readable.

## v8 maintenance and verification

The updated version keeps your existing MongoDB data. Do not run `npm run seed` to apply the v8 changes.

To remove only existing events whose titles contain “Codeathon” (and their linked budgets and attendance), open a terminal in `backend` and run:

```powershell
npm run remove:codeathon
```

Run this after confirming that the backend `.env` points to the intended MongoDB database. The command reports the matching events before deleting them and does not delete users, clubs, or venues.

Collaborative events require each invited club's president to accept the collaboration request before the Club Coordinator can approve the event. Club joining requests are approved/rejected only by the president of the club requested. Passwords can be shown or hidden with the control beside each password field.

Before demonstration, test login for each role, student joining requests, president approvals, mentor assignment/message flow, My Clubs versus Browse Clubs, solo and collaborative event creation, collaborative acceptance/rejection, event and budget approvals, account edit/delete, and the Codeathon cleanup against the intended database.


## Latest event and recruitment update
See `CHANGELOG_V12_EVENT_REGISTRATION.md` for the latest source changes and verification limits. Do not run seed or deletion scripts to install this update.
