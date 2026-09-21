# VisionWeaver rebuild — handoff (2026-09-20)

Where things stand (nothing below is merged to main yet, except PR #54):

- `visionweaver-studio` edge function: v24 is LIVE on Supabase project yqealeekngxooyoemfba. v25 (`studio_v25.ts` in this folder) is written and type-checked but NOT yet deployed.
- v25 adds: extend clip, edit video (Aleph 2 / Seedance edit), reframe, first/last-frame keyframes, character lock via references, AI Director shot planner, timeline.
- Still to do: deploy v25; add a `generation_ids` timeline mode to `api/visionweaver-assemble.js`; rewrite `src/components/VisionWeaverWorkspace.tsx` as the Runway/Higgsfield-style studio; PR + merge; test Extend on real clip d186cdf2-5edd-4f9b-ae6b-9799a5fee2eb; write the step-by-step how-to guide.
- Open questions for Sire: chapter breaks 5-15, missing Epilogue, character-to-cover mapping, real-person photo moderation risk, Aleph credit cost.
- Login: https://master-ceo-dashboard.vercel.app/systems/visionweaver with estibancreations@gmail.com (magic link).

Files in this folder: `CONVERSATION_LOG_part2.md` (condensed log of this session after its first compaction: full user/assistant text, tool calls as one-liners, no tool output, secrets redacted). Part 1 (before that compaction) survives only as the summary at the top of the log.
