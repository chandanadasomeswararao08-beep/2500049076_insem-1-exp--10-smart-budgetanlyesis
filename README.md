# BudgetMind AI

**Your Money. Your Goals. Your AI Assistant.**

A full-stack personal budgeting starter built with HTML, CSS, Vanilla JavaScript, Node.js, Express, MongoDB/Mongoose and Google Gemini.

## Features
- Cookie-based JWT authentication, bcrypt password hashing, protected APIs and rate limits.
- Secure password recovery with SHA-256 hashed, random, single-use reset tokens that expire after 15 minutes; reset email delivered through configured SMTP.
- Income/expense CRUD, monthly budget limits, savings goals and contributions.
- Dashboard totals, Chart.js cash-flow and spending-category charts.
- Gemini assistant grounded in the signed-in user's saved transactions, budgets and goals.
- Responsive layout, profile preferences and password/account management.
- In-app budget notifications at 80% usage and budget-exceeded status at 100%+.
- Savings-goal progress notifications at 25%, 50%, 75% and 100%, deduplicated per goal milestone.
- Notification center with unread count, mark-read, mark-all-read and dismiss controls; notifications are scoped to the signed-in user.
- Amounts stored as integer paise to avoid floating-point storage errors.

## Requirements
- Node.js 18+ (20 LTS recommended)
- MongoDB Community Server or a MongoDB Atlas connection string
- Optional Gemini API key for the AI assistant

## Setup (Windows PowerShell)
1. Install Node.js LTS and MongoDB, or create a MongoDB Atlas database.
2. Extract this project and open PowerShell in the `BudgetMind-AI` folder.
3. Install packages:
   ```powershell
   npm install
   ```
4. Create your local environment file:
   ```powershell
   Copy-Item .env.example .env
   ```
5. Edit `.env`. Set `MONGODB_URI` and replace `JWT_SECRET` with a long random secret. Add `GEMINI_API_KEY` to enable AI.
6. Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM and APP_BASE_URL in `.env` to enable password reset emails. Use credentials from a trusted email provider; do not commit them. Without SMTP settings, the app intentionally does not expose reset tokens in the browser or logs.
7. Start MongoDB locally if using Community Server, then run:
   ```powershell
   npm run dev
   ```
8. Open http://localhost:5000

## Automated tests
The project uses Node's built-in test runner, so no separate test framework is required.

1. Install the project packages with `npm install`.
2. Run frontend finance-logic and password-reset utility tests:
   ```powershell
   npm test
   ```
3. For API integration tests, make sure MongoDB is running and set `MONGODB_TEST_URI` in `.env` to a **disposable test database**. The database name must contain `test`. Because the suite clears this database before and after the run, explicitly change `ALLOW_TEST_DB_RESET=false` to `ALLOW_TEST_DB_RESET=true` only after checking the URI:
   ```text
   MONGODB_TEST_URI=mongodb://127.0.0.1:27017/budgetmind_ai_test
   ALLOW_TEST_DB_RESET=true
   ```
4. Run the API integration tests:
   ```powershell
   npm run test:api
   ```
5. Run both sets in sequence:
   ```powershell
   npm run test:all
   ```

The API suite covers health, unauthenticated access, registration/login, HTTP-only session cookies, profile retrieval, transaction create/update/delete and user isolation, budget totals, savings-goal contributions, budget-warning and goal-milestone notifications, notification read/dismiss behavior and preference toggle, generic forgot-password responses, single-use password-reset tokens, and account-data deletion. Unit tests also exercise notification threshold rules. It does not send a real SMTP email; configure and verify SMTP separately using the password-reset flow.

## In-app notification rules

Notifications are generated when the signed-in user requests the notification list (the app refreshes it after dashboard data refreshes):
- A monthly category budget creates a warning when spending reaches 80% and an exceeded alert at 100% or above. The active threshold is represented by one alert type per budget/month.
- Savings goals create milestone alerts for each reached 25%, 50%, 75% and 100% milestone. Each milestone has a stable dedupe key, so refreshing the panel does not create duplicates.
- Users can mark one or all alerts as read or dismiss an alert. Dismissed alerts stay dismissed for their dedupe key.
- The profile's in-app notifications setting disables the notification feed; it does not erase prior alerts.

New files: `models/Notification.js`, `routes/notifications.js`, `services/notification-service.js`, and `utils/notification-rules.js`. The notification collection is also removed during account deletion.

## Manual browser checklist
- Register a new account; sign out; sign back in.
- Add income and expense records; edit and delete records.
- Set a monthly category budget and verify its spent amount.
- Spend past 80% of a category budget to see the warning; verify 100%+ uses the exceeded alert.
- Create a savings goal and add contributions; verify milestone alerts at 25%, 50%, 75% and 100%.
- Open the notification bell, mark one/all alerts read and dismiss an alert; verify it remains dismissed after refresh.
- Toggle notifications off in Settings and verify the feed is disabled, then turn it back on.
- Visit the AI assistant after adding records; ask it to summarize spending.
- Open the app at a narrow mobile viewport and check navigation.
- Request a password reset and verify the email arrives, the link expires, and it cannot be reused.
- Verify `/api/health` returns `{"status":"ok","app":"BudgetMind AI"}`.

## API overview
| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| POST | `/api/auth/logout` | Clear session |
| POST | `/api/auth/forgot-password` | Request a reset email (generic response) |
| POST | `/api/auth/reset-password` | Redeem a single-use reset token |
| GET | `/api/auth/me` | Current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/password` | Change password |
| DELETE | `/api/auth/account` | Delete account and records |
| GET/POST | `/api/transactions` | List/create |
| PUT/DELETE | `/api/transactions/:id` | Update/delete |
| GET/POST | `/api/budgets` | List/upsert monthly budget |
| DELETE | `/api/budgets/:id` | Delete budget |
| GET/POST | `/api/goals` | List/create goals |
| POST | `/api/goals/:id/contribute` | Add savings |
| GET | `/api/notifications` | Reconcile and list active in-app notifications |
| PUT | `/api/notifications/read-all` | Mark all active notifications read |
| PUT | `/api/notifications/:id/read` | Mark one notification read |
| DELETE | `/api/notifications/:id` | Dismiss one notification |
| DELETE | `/api/goals/:id` | Delete goal |
| POST | `/api/ai/chat` | Ask Gemini using user's finance context |

## Deployment notes
Deploy the Node application to a Node-compatible host and use MongoDB Atlas. Set `NODE_ENV=production`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN` and `GEMINI_API_KEY` in the host's secret/environment settings. Serve the frontend from the same Express origin (simplest cookie setup), or configure exact CORS origin and cookie `sameSite`/`secure` settings if frontend and API are on separate domains. Use HTTPS in production.

## Important production hardening
This is a functional learning/starter application, not a certified financial product. Before public launch, complete a security review, CSRF protection appropriate to your deployment, email verification, audit logging, backup/restore procedures, monitoring, stricter schema-level update allowlists, and a reviewed privacy policy. The included automated tests are a starting point, not proof of production readiness. Password reset email delivery requires a trusted SMTP provider configured in `.env`. Reset tokens are stored only as SHA-256 hashes, expire after 15 minutes, and are cleared after use or delivery failure. Configure HTTPS and a trusted `APP_BASE_URL` before production use. Keep `.env` private and never put API keys in `public/`.
