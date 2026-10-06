# VisionWeaver Book Pipeline

**Status:** deployed to the "Master Dashboard" Supabase project on 2026-10-06 as a builder release. It is **not production-certified**. Acceptance-test books are flagged `is_test`.

**Source brief:** the owner's "Book Pipeline Directive" (four layers, six agents, four approval gates). The directive was written for n8n, Airtable and Telegram. This system runs on Supabase and Vercel, so the same design was built on that stack instead.

## What it is

A book assembly line with four stations. Think of a kitchen pass: a dish moves from station to station, and the head chef can stop it at set points before it leaves the kitchen.

| Station | What happens | Directive part |
|---|---|---|
| 1. Idea intake | A raw idea becomes a standard book brief (title, subtitle, genre, audience, core promise, comparable titles, unique angle, source link). | Layer 1 |
| 2. Research | A research agent checks market demand, gaps and supporting material using live web search. | Layer 2 |
| 3. Writing team | Outline, chapter research, chapter writing, design notes, cover image, Consistency Critic. | Layer 3 |
| 4. Assembly | Manuscript (Markdown), print interior (PDF), reading copy (PDF), e-book (EPUB), cover, metadata. | Layer 4 |

### Where each directive tool went

| Directive | Built as |
|---|---|
| n8n workflows and sub-workflows | Edge function `visionweaver-book-director`, one unit of work per run |
| Airtable Book and Chapter tables | `vw_books`, `vw_book_chapters` |
| Telegram approval gates | `vw_book_approvals` plus the Book Pipeline screen |
| Perplexity research | Anthropic web search tool |
| DALL-E or Midjourney cover | Runway text-to-image |
| Google Drive and S3 | Private storage bucket `visionweaver-books`, signed links |
| Schedule trigger | pg_cron, three workers a minute |

## Approval gates

1. After the research brief
2. After the outline
3. After all chapters are drafted
4. Before final assembly

Approval mode is chosen per book:

- `gated` (default): stops at all four gates.
- `hybrid`: stops at the outline and before final assembly.
- `full_auto`: does not stop for a person. Gates are recorded as `auto_approved`.

In every mode the book **cannot be assembled while the Consistency Critic has blocking issues**. The Critic sends chapters back for revision up to two rounds, then the book pauses for a person.

## Failure rule

A failed step is retried once with the failure fed back into the prompt (up to four tries for rate limits and timeouts). If it still fails, the failure is written to `vw_book_events` and the book is set to `paused`. A director resumes it from the screen.

## Idea sources

- **Hand entry** on the New book tab.
- **Idea queue** (`vw_book_idea_queue`): agents or people drop ideas in; a director starts or dismisses each one.
- **Google Books by category** and **RSS feed**: one-off scans that produce ranked ideas.
- **T.H.E.L.M.A. Trend Radar:** every Monday 13:05 UTC, and on demand. Reads 22 book sites (`vw_book_sources`), ranks themes and proposes original ideas for a director to pick.

### Trend Radar honesty rules

- Three source types use official open feeds (Apple Books, Open Library, Google Books). The other sites do not allow direct automated reading, so they are read through live web search limited to that site.
- Each site reports `ok`, `no_data` or `failed`. A site with no search results returns nothing; titles are never filled in from the model's memory.
- Source counts and "titles on more than one list" are counted in code and are exact. Momentum and opportunity scores are editorial estimates by the analyst model and are labelled that way.
- Proposed ideas must be original. Listed titles are used for positioning only.

## Lengths

| Tier | Target | Chapters |
|---|---|---|
| Short read | about 10,000 words | 6 |
| Standard | about 30,000 words | 10 |
| Comprehensive | about 60,000 words | 16 |

The directive asks for 7 to 10 chapters of 2,000 to 4,000 words. Those ranges cannot add up to 10,000 or 60,000 words, so the short and comprehensive tiers use different chapter counts.

## Content rules built into every agent

- Original work only. No copying from existing books.
- No invented quotes, statistics, studies or anecdotes about real people or organizations.
- Research that could not be verified by web search is marked "NOT verified" on the research brief and on each chapter.

## Known limits (read before relying on output)

- **Not production-certified.** First run was the acceptance test of 2026-10-06.
- **Print readiness is partial.** `interior.pdf` has the trim size, embedded fonts (Crimson Text, SIL Open Font License) and mirrored margins. It has not been run through a printer's preview tool such as KDP's. The cover illustration is below 300 DPI at print size and has no spine or back cover.
- **EPUB** passes a structural self-check. It has not been run through EPUBCheck.
- **Author name** is optional. Without one, files show a placeholder; saving a name rebuilds the files.
- **ISBN** is a placeholder.
- **AI disclosure:** text and cover art are AI-generated. Most retailers require the publisher to declare this at upload. Nothing is published by this system.
- **Free-plan time limit:** each run has about 150 seconds. Long chapters are written in parts so that one run never needs more than one model call.
- **Cost:** each book uses the organization's Anthropic account, about two web searches per chapter plus six for the book, and one Runway image. A full Trend Radar scan uses up to about 60 web searches.

## Deployment note

The function is deployed as a one-line entry file that imports this folder from GitHub at one exact commit id. The deployed code therefore matches the repository at that commit and cannot change by itself. After this branch is merged, redeploy normally from the repository (`supabase functions deploy visionweaver-book-director`) to remove the pin.

## Operations

- Self-test (scheduler secret only): `{"action":"selftest"}` checks fonts, PDF, EPUB, storage, the model, web search and Runway configuration.
- Worker: pg_cron job `visionweaver-book-director-tick`, every minute, three workers. An idle tick is one database call.
- Weekly radar: pg_cron job `visionweaver-book-radar-weekly`.
- Model: `system_settings` keys `book_pipeline_model` and `book_pipeline_fast_model` override the defaults.
