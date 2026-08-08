# AI Code Review Platform

> **An AI-powered code review platform that downloads any public GitHub repository, runs it through 14 language linters, and generates a structured review report using Groq (Llama 3.3) with Gemini 2.5 Flash as automatic fallback.**

---

## ✅ What's Built

| Stage | Feature | Status |
|---|---|---|
| Auth | JWT registration / login | ✅ Done |
| Auth | GitHub OAuth | ✅ Done |
| Repo | GitHub URL validation | ✅ Done |
| Repo | Zipball fetch + temp dir extraction | ✅ Done |
| Repo | Repo size enforcement (200 MB cap) | ✅ Done |
| Linting | Language auto-detection (14 languages) | ✅ Done |
| Linting | ESLint 10 (JS / TypeScript) | ✅ Done |
| Linting | Flake8 (Python) | ✅ Done |
| Linting | Cargo Clippy (Rust) | ✅ Done |
| Linting | golangci-lint (Go) | ✅ Done |
| Linting | Checkstyle (Java) | ✅ Done |
| Linting | RuboCop (Ruby) | ✅ Done |
| Linting | PHP_CodeSniffer (PHP) | ✅ Done |
| Linting | Cppcheck (C / C++) | ✅ Done |
| Linting | SwiftLint (Swift) | ✅ Done |
| Linting | ktlint (Kotlin) | ✅ Done |
| Linting | ShellCheck (Shell / Bash) | ✅ Done |
| Linting | SQLFluff (SQL / PostgreSQL, dialect auto-detected) | ✅ Done |
| Linting | Built-in MongoDB analyzer (no binary needed) | ✅ Done |
| Linting | Fault isolation (one linter failing never kills others) | ✅ Done |
| AI | Groq — Llama 3.3-70b (primary, fastest) | ✅ Done |
| AI | Gemini 2.5 Flash (automatic fallback) | ✅ Done |
| AI | Structured JSON review report (score, issues, suggestions) | ✅ Done |
| API | `POST /api/review` — full pipeline endpoint | ✅ Done |
| Frontend | UI dashboard | 🔜 Next |

---

## How It Works

```
POST /api/review  { repoUrl, branch?, githubToken? }
        │
        ▼
┌─────────────────┐
│  Fetch Repo     │  Downloads GitHub zipball → extracts to temp dir
└────────┬────────┘
         ▼
┌─────────────────┐
│  Detect Langs   │  Scans file extensions + manifest files
└────────┬────────┘
         ▼
┌─────────────────────────────────────────────────────────┐
│                    Run Linters (parallel)                │
│  ESLint · Flake8 · Clippy · golangci-lint · Checkstyle  │
│  RuboCop · phpcs · Cppcheck · SwiftLint · ktlint        │
│  ShellCheck · SQLFluff · MongoDB Analyzer               │
└────────┬────────────────────────────────────────────────┘
         ▼
┌─────────────────┐
│  Build Prompt   │  Structures lint findings for the AI
└────────┬────────┘
         ▼
┌────────────────────────────┐
│  AI Review (with fallback) │
│  1st: Groq / Llama 3.3     │  ~1s response
│  2nd: Gemini 2.5 Flash     │  auto-fallback on rate limit
└────────┬───────────────────┘
         ▼
┌─────────────────┐
│  ReviewReport   │  summary · score · issues[] · suggestions
└─────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ (ES Modules) |
| Framework | Express 5 |
| Database | PostgreSQL + Prisma ORM |
| Auth | JWT + GitHub OAuth |
| Linting — JS/TS | ESLint 10 + typescript-eslint |
| Linting — Python | Flake8 |
| Linting — Rust | Cargo Clippy |
| Linting — Go | golangci-lint |
| Linting — Java | Checkstyle |
| Linting — Ruby | RuboCop |
| Linting — PHP | PHP_CodeSniffer |
| Linting — C/C++ | Cppcheck |
| Linting — Swift | SwiftLint |
| Linting — Kotlin | ktlint |
| Linting — Shell | ShellCheck |
| Linting — SQL | SQLFluff |
| Linting — MongoDB | Built-in static analyzer |
| AI Primary | Groq API — `llama-3.3-70b-versatile` |
| AI Fallback | Google Gemini — `gemini-2.5-flash` |

---

## Project Structure

```
ai-code-review/
└── backend/
    ├── src/
    │   ├── config/
    │   │   └── db.js                      # Prisma DB connection
    │   ├── controllers/
    │   │   ├── authController.js
    │   │   ├── repositoryController.js
    │   │   └── reviewController.js        # POST /api/review handler
    │   ├── middleware/
    │   │   └── authMiddleware.js
    │   ├── routes/
    │   │   ├── authRoutes.js
    │   │   ├── githubAuth.js
    │   │   ├── repositoryRoutes.js
    │   │   └── reviewRoutes.js            # POST /api/review
    │   ├── services/
    │   │   ├── aiProviderService.js       # Groq + Gemini fallback
    │   │   ├── fileScanner.js
    │   │   ├── linterService.js           # Orchestrates all 14 linters
    │   │   ├── linters/
    │   │   │   ├── shared.js              # safeExec, normalizeSeverity, relPath
    │   │   │   ├── eslintLinter.js
    │   │   │   ├── flake8Linter.js
    │   │   │   ├── clippyLinter.js
    │   │   │   ├── golangLinter.js
    │   │   │   ├── javaLinter.js
    │   │   │   ├── rubyLinter.js
    │   │   │   ├── phpLinter.js
    │   │   │   ├── cppLinter.js
    │   │   │   ├── swiftLinter.js
    │   │   │   ├── kotlinLinter.js
    │   │   │   ├── shellLinter.js
    │   │   │   ├── sqlLinter.js
    │   │   │   └── mongodbLinter.js
    │   │   ├── repoService.js             # GitHub zipball fetch + extract
    │   │   ├── reviewService.js           # Full pipeline orchestrator
    │   │   ├── secretScanner.js
    │   │   └── validationService.js
    │   ├── utils/
    │   │   └── repoWalker.js              # Repo file tree walker
    │   ├── test-linter-step.js            # Linter verification tests (25 assertions)
    │   ├── test-clone-step.js
    │   └── server.js
    ├── prisma/
    │   └── schema.prisma
    ├── package.json
    └── .env
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- PostgreSQL running locally
- (Optional) Linter binaries for the languages you want to lint

### 1. Install

```bash
git clone <repo-url>
cd ai-code-review/backend
npm install
```

### 2. Environment Variables

Create / edit `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/ai_code_review

# Auth
JWT_SECRET=your_jwt_secret_here

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=http://localhost:5050/api/auth/github/callback

# AI Providers (free tier — no credit card needed)
# Get Groq key:   https://console.groq.com
# Get Gemini key: https://aistudio.google.com
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIza...
```

### 3. Database Setup

```bash
createdb ai_code_review
npx prisma generate
npx prisma migrate dev
```

### 4. Run

```bash
npm run dev
# Server starts on http://localhost:5050
```

---

## API Reference

### Auth

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/auth/register` | Create account | No |
| POST | `/api/auth/login` | Login, receive JWT | No |
| GET | `/api/auth/me` | Get current user | Yes |
| GET | `/api/auth/github` | Start GitHub OAuth | No |
| GET | `/api/auth/github/callback` | OAuth callback | No |

### Repositories

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/repositories` | Add repository record | Yes |
| GET | `/api/repositories` | List your repositories | Yes |

### Review

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| POST | `/api/review` | Run full AI code review | Yes |

#### `POST /api/review`

**Request body:**
```json
{
  "repoUrl": "https://github.com/owner/repo",
  "branch": "main",
  "githubToken": "ghp_..."
}
```

**Response:**
```json
{
  "success": true,
  "report": {
    "repoUrl": "https://github.com/owner/repo",
    "languages": ["javascript", "python"],
    "providerUsed": "groq",
    "summary": "Overall the code is well structured but has security concerns...",
    "score": 72,
    "issues": [
      {
        "file": "src/auth.js",
        "line": 45,
        "severity": "error",
        "category": "security",
        "message": "JWT secret hardcoded in source",
        "suggestion": "Move to environment variable"
      }
    ],
    "secretsFound": 0,
    "lintIssuesFound": 38,
    "linterRuns": [
      { "linter": "eslint", "status": "success", "issueCount": 38 },
      { "linter": "flake8", "status": "failed", "reason": "binary_not_found" }
    ],
    "generatedAt": "2026-08-08T12:00:00.000Z"
  }
}
```

All protected routes require: `Authorization: Bearer <token>`

---

## Linter Binaries

The platform runs whatever linters are installed on the server. Missing linters are reported as `binary_not_found` in `linterRuns[]` and never crash the pipeline.

```bash
# Install all supported linters (macOS)
brew install golangci-lint checkstyle cppcheck swiftlint ktlint shellcheck sqlfluff
gem install rubocop
composer global require squizlabs/php_codesniffer
pip install sqlfluff

# MongoDB analyzer needs no binary — it's built-in
```

---

## Running Tests

```bash
# Linter verification suite (25 assertions)
node src/test-linter-step.js

# Clone / repo fetch tests
node src/test-clone-step.js
```

---

## Roadmap

- [x] JWT auth + GitHub OAuth
- [x] GitHub repo fetch via zipball API
- [x] 14-language linter support with fault isolation
- [x] Groq + Gemini AI provider with automatic fallback
- [x] `POST /api/review` full pipeline endpoint
- [ ] Secret scanning integration into AI prompt
- [ ] Frontend review dashboard (file tree, severity badges, AI comments)
- [ ] PR comment posting via GitHub API
- [ ] Review history + database storage
- [ ] Webhook support (auto-review on push)

---

## License

ISC