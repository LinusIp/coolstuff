# Log

## Needs owner

- Nothing open. (GitHub Pages was enabled on 2026-10-23; deploys run from `main`.)

---

## 2026-10-22 → 2026-10-23 · Bootstrap

**Done**
- Started as a lab showcase; shipped Flipline (game), Ma (blog theme) and Physarum (experiment), all smoke-clean. After the spec changed to a learning site, they moved to the `archive/lab` branch.
- Pivoted to the textbook: Vite + TS + Preact multi-page scaffold; `curriculum.ts` with all 272 §9 lessons, cross-subject prerequisites and six learning paths (tests: counts per subject, no cycles, valid path orders).
- Scripts: `new-lesson`, `build-index` (meta vs curriculum + search index), `smoke` (desktop, phone, dark + reduced motion; KaTeX errors, §4 sections and counts, blank figures, 44px controls, heading order, offline), `sync-progress`, `build-pages`, `shoot`.
- Design system chosen by a judge panel of three proposals ("Paper": warm paper and ink, Source Serif 4, Tufte margins, colour only for meaning). Kit contracts, core foundations and two kit groups (controls + lesson shell, visuals) built.
- Deployed a preview: a home page with the full curriculum map and a `/kit` gallery of the finished components. Draft lessons are left out of the published build (`COOLSTUFF_SKIP_WIP`).

**Not done yet / honest notes**
- Kit groups for practice (worked examples, problems, quizzes) and formulas are partly built; data-structure views not started; no adversarial review of the kit groups yet.
- The three flagship lessons are scaffolds at the plan/content stage (`status: "wip"`).
- Site pages beyond the preview home (subject pages, prerequisite graph, practice/exam, search) are not built.
- Two background workflows were lost to container restarts and one run to a usage limit; work was resumed from cached results each time. Work paused at the owner's request.
- Firefox console checks have not been run (only Chromium is available in this environment). Lighthouse is run ad hoc, not in CI.
