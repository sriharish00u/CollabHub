# CollabHub — Product Requirements Document

**Version:** 1.0
**Author:** Jay Harish P
**Date:** July 2026
**Status:** Draft for MVP development

---

## 1. Overview

### 1.1 Problem Statement
Students looking for teammates for hackathons, projects, competitions, and research rely on unstructured, unreliable channels — WhatsApp groups, Instagram DMs, word of mouth. There is no way to verify whether a prospective teammate actually has the skills they claim before committing to a team. This leads to mismatched teams, wasted time, and projects that stall because critical skill gaps surface too late.

### 1.2 Solution
CollabHub is a skill-verified teammate-matching platform. Every user builds a self-rated skill profile. Every activity (hackathon, project, competition, etc.) declares the skills and minimum levels it requires. The platform automatically checks eligibility and calculates a weighted match score for each applicant, turning team formation from guesswork into a data-driven decision.

### 1.3 Goals
- Give students a credible way to find and vet teammates by actual skill, not social proximity.
- Give activity creators a ranked, explainable shortlist of applicants instead of a first-come-first-served inbox.
- Ship an MVP that is demoable and technically defensible for a college viva, while being a genuine foundation for a real product.

### 1.4 Non-Goals (for MVP)
- Real-time WebSocket chat (polling is acceptable for v1).
- Payments, monetization, or premium tiers.
- Mobile native app (responsive web only).
- AI-based recommendations (explicitly deferred to future scope).

---

## 2. Target Users

| Persona | Description | Primary Need |
|---|---|---|
| **Team Seeker** | Student wanting to join a hackathon/project team | Find activities they're actually eligible for; apply with confidence |
| **Team Creator** | Student organizing a hackathon team, project, or competition entry | Post requirements; quickly identify best-fit applicants |
| **Casual Browser** | Student exploring what's available on campus | Discover activities relevant to their skills/interests |

---

## 3. User Journey

1. Register / Login
2. Create profile (college, department, year, bio)
3. Add skills with self-rated levels (1–5)
4. Browse activity feed
5. View activity detail → system checks eligibility automatically
6. Apply to join
7. Creator reviews applicants ranked by match score
8. Creator approves/rejects
9. Approved members unlock group chat and collaborate

---

## 4. Functional Requirements

### 4.1 Module: Authentication
| ID | Requirement | Priority |
|---|---|---|
| AUTH-01 | User can register with name, email, password, college, department, year | P0 |
| AUTH-02 | User can log in with email/password | P0 |
| AUTH-03 | Session/JWT-based auth persists login across page loads | P0 |
| AUTH-04 | Secure logout clears session | P0 |
| AUTH-05 | Forgot password flow | P2 |

### 4.2 Module: User Profile
| ID | Requirement | Priority |
|---|---|---|
| PROF-01 | User can edit name, college, department, year, bio, photo | P0 |
| PROF-02 | User can add/edit/remove skills, each with a level 1–5 | P0 |
| PROF-03 | System calculates and displays profile completion % | P1 |
| PROF-04 | Profile displays badges earned (e.g. Hackathon Winner) | P2 |

### 4.3 Module: Activity Feed
| ID | Requirement | Priority |
|---|---|---|
| FEED-01 | Feed displays activities as cards: title, category, required skills, seats left, deadline, creator | P0 |
| FEED-02 | User can filter by category (Hackathon, Project, Competition, Research, Startup, Open Source, Workshop) | P1 |
| FEED-03 | User can search activities by skill name | P1 |
| FEED-04 | User can bookmark an activity | P2 |
| FEED-05 | User can sort by newest / deadline soonest / best match for them | P2 |

### 4.4 Module: Create Activity
| ID | Requirement | Priority |
|---|---|---|
| CREATE-01 | Creator can set title, description, category, mode (online/offline), max members, deadline | P0 |
| CREATE-02 | Creator can add multiple required skills, each with a minimum level | P0 |
| CREATE-03 | Creator can edit or close an activity after creation | P1 |

### 4.5 Module: Smart Eligibility Engine
| ID | Requirement | Priority |
|---|---|---|
| ELIG-01 | On viewing an activity, system compares applicant's skill levels against each required skill | P0 |
| ELIG-02 | System shows binary status: "Eligible" or specific gap (e.g. "Need React Level 3, current Level 2") | P0 |
| ELIG-03 | System calculates per-skill match %, capped at 100% once requirement is met or exceeded | P0 |
| ELIG-04 | System calculates overall match score as the average across required skills (optionally weighted by skill importance) | P0 |

### 4.6 Module: Join Requests
| ID | Requirement | Priority |
|---|---|---|
| JOIN-01 | Eligible or gap-shown user can submit a join request | P0 |
| JOIN-02 | Creator sees pending applicants with skill ratings and match score | P0 |
| JOIN-03 | Applicants are sortable by match score (highest first) | P1 |
| JOIN-04 | Creator can approve or reject with one click | P0 |
| JOIN-05 | Applicant is notified of approval/rejection | P1 |

### 4.7 Module: Group Chat
| ID | Requirement | Priority |
|---|---|---|
| CHAT-01 | Chat is unlocked only for approved members of an activity | P0 |
| CHAT-02 | Messages display sender name, avatar, timestamp | P0 |
| CHAT-03 | Chat auto-refreshes via polling (every few seconds) | P0 |
| CHAT-04 | Members list visible within chat | P1 |

### 4.8 Module: Dashboard
| ID | Requirement | Priority |
|---|---|---|
| DASH-01 | Dashboard shows activities created and joined | P0 |
| DASH-02 | Dashboard shows pending requests (sent and received) | P0 |
| DASH-03 | Dashboard shows upcoming deadlines at a glance | P1 |

### 4.9 Bonus Features (Post-MVP / stretch)
- Ratings after activity ends
- Notifications for approvals (in-app)
- Badges (Hackathon Winner, Mentor)
- Match score sorting for creators (may pull into MVP if time allows — high viva value)

---

## 5. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Performance** | Feed and eligibility checks should respond within 1–2 seconds under normal load |
| **Security** | Passwords hashed (bcrypt); JWT/session tokens for auth; input validation on all forms |
| **Usability** | Fully responsive (desktop, tablet, mobile); no page requires more than 3 clicks to reach from dashboard |
| **Reliability** | Core flows (register → profile → apply → approve) must work end-to-end without errors for the demo |
| **Scalability** | Schema and API design should not block adding WebSockets or AI recommendations later |
| **Hosting** | Deployable on free/campus-tier hosting (e.g. Render/Railway backend, static frontend) |

---

## 6. Data Model (Summary)

Seven core tables:

- **Users** — id, name, email, password, college, department, bio
- **Skills** — id, skill_name
- **User_Skills** — user_id, skill_id, level
- **Activities** — id, creator_id, title, description, category, max_members, deadline
- **Activity_Skills** — activity_id, skill_id, required_level
- **Join_Requests** — id, activity_id, user_id, status (Pending/Approved/Rejected)
- **Messages** — id, activity_id, user_id, message, time

*(Full schema with data types, indexes, and constraints to be finalized during implementation — see engineering notes.)*

---

## 7. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Backend | Python — FastAPI or Flask |
| Database | MySQL |
| Auth | Sessions / JWT |
| Chat | Polling (few-second interval) — WebSockets deferred |
| Hosting | Any free/campus tier (e.g. Render for backend, static hosting for frontend) |

---

## 8. Success Metrics

**For the college viva:**
- Full user journey (register → profile → apply → approve → chat) runs live, end-to-end, without errors.
- Match score algorithm can be explained and demonstrated with a concrete example.
- Schema and code are clean enough to survive technical questioning.

**For the real product (post-viva):**
- Number of activities created per week
- Number of applications submitted per activity (signal of discoverability)
- Approval rate and time-to-approval (signal of match score usefulness)
- Retention: % of users who return after their first joined activity ends

---

## 9. MVP Scope Cut

Given "whole MVP end-to-end" as the priority, the MVP includes all P0 items above:
Auth → Profile & Skills → Activity Feed → Create Activity → Eligibility Engine → Join Requests → Chat → Dashboard.

P1 items (filters, sorting, notifications) should be built if time permits but are not blocking for a working demo. P2 items (forgot password, bookmarks, badges) are explicitly out of scope for MVP.

---

## 10. Future Scope

- AI-based teammate recommendations
- Auto-generated resume from completed activities
- Video meeting integration
- Calendar sync
- Real-time chat via WebSockets
- Organization/college pages
- Native mobile application

---

## 11. Risks & Open Questions

| Risk / Question | Notes |
|---|---|
| Self-rated skill levels can be inflated | No verification mechanism in MVP — flag as a known limitation; future scope could add peer validation or completed-activity-based leveling |
| Weighted match score criticality | Needs a clear, simple default (equal weighting) before any "critical skill" weighting is added — keep MVP formula simple and explainable |
| Chat scaling via polling | Fine for MVP/demo scale; flag WebSocket migration path for future scope |
| Campus-tier hosting limits | Confirm free-tier DB/connection limits before demo day to avoid live-demo failures |

---

## 12. Appendix: Standout Feature Detail — Match Score Algorithm

**Example:** Activity "AI Project" requires Python (Level 4), React (Level 3), ML (Level 2). Applicant Jay has Python 5, React 4, ML 1.

- Python: required 4, has 5 → 100% (capped)
- React: required 3, has 4 → 100% (capped)
- ML: required 2, has 1 → 50%
- **Overall match score: 87%** (average, optionally weighted)

This score lets creators sort all applicants by best fit instead of reviewing requests one by one — the core differentiator of CollabHub versus a plain job-board-style listing.
