# AI Code Review

A backend tool that clones a GitHub repository, runs it through language-appropriate linters, sends the code to an AI model for review, and returns a merged report of findings — combining static lint results with AI-generated feedback on quality, structure, and potential issues.

> **Status:** Early development. Authentication is functional. The core review pipeline (clone → lint → AI review → report) is designed but not yet implemented.

---

## Features

### Working
- User registration and login (JWT-based authentication)
- Protected routes via auth middleware
- Basic repository record storage (manual entry, not yet linked to GitHub)

### Planned
- GitHub OAuth so users can connect their account
- Repository validation (existence, access, size, visibility, branch resolution)
- Repo fetching via GitHub's zipball API (no local `git clone`)
- Multi-language lint support (JS/TS, Python, Go, Rust)
- AI-powered code review with configurable focus (quality, security, structure)
- Merged report combining lint + AI findings, with duplicate detection across both sources

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ES Modules) |
| Framework | Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT (`jsonwebtoken`) |
| Linting (project itself) | ESLint (flat config) |

---

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── db.js
│   ├── controllers/
│   │   ├── authController.js
│   │   └── repositoryController.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── repositoryRoutes.js
│   ├── generated/
│   │   └── prisma/          # Prisma client output
│   └── server.js
├── prisma/
│   └── schema.prisma
├── eslint.config.js
├── package.json
└── .env
```

---

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL running locally or accessible via connection string

### Installation

```bash
git clone <this-repo-url>
cd backend
npm install
```

### Environment Variables

Create a `.env` file in `backend/`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/ai_code_review
JWT_SECRET=your_jwt_secret_here

# GitHub OAuth (planned, not yet active)
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/github/callback
```

### Database Setup

```bash
createdb ai_code_review
npx prisma generate
npx prisma migrate dev
```

### Run the Server

```bash
npm run dev
```

Server runs on the port configured in `server.js` (check for the exact value — commonly `5000`).

### Linting

```bash
npm run lint          # check for issues
npx eslint src/ --fix # auto-fix what's fixable
```

---

## API Endpoints (Current)

### Auth
| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| POST | `/api/auth/register` | Create a new user | No |
| POST | `/api/auth/login` | Log in, receive JWT | No |
| GET | `/api/auth/me` | Get current user | Yes |

### Repositories
| Method | Endpoint | Description | Auth required |
|---|---|---|---|
| POST | `/api/repositories` | Create a repository record | Yes |
| GET | `/api/repositories` | List your repositories | Yes |

Protected routes require an `Authorization: Bearer <token>` header.

---

## Planned Pipeline

```
Input (GitHub link)
      ↓
Validation (existence, access, size, visibility, branch)
      ↓
Clone (via GitHub zipball API into isolated temp directory)
      ↓
   ┌──┴──┐
Lint    AI Review
   └──┬──┘
      ↓
Merge results (dedup overlapping findings)
      ↓
Final report
```

See project design notes for full detail on validation checks, fault isolation, and result normalization strategy.

---

## Roadmap

- [ ] Complete GitHub OAuth flow
- [ ] Repository validation (link regex, existence, permissions, size, branch)
- [ ] Zipball fetch + temp directory handling
- [ ] Language detection + linter integration (ESLint, Flake8, Golint, Clippy)
- [ ] AI review integration with configurable prompt focus
- [ ] Result normalization and merge/dedup logic
- [ ] Final report display (UI and/or automated PR comments)

---

## Contributing

This is currently a solo learning/portfolio project, not yet open for external contributions.

## License

Not yet decided.