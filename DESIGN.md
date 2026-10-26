# How Satzfabrik works

## The problem it solves

Anki, Duolingo and short grammar exercises train *recognition*: you see German and know what
it means. Speaking needs *production*: you have a meaning and must build the German yourself,
with the right article, case, verb form and word order, fast. Production only improves by
producing (output practice, retrieval practice, corrective feedback), spaced over days and
mixed with everything else you know. Satzfabrik makes every review a production task and
makes the game reward exactly that.

## What is stored

Everything learnable is an **item** (`src/content/types.ts`):

| Kind | Example | Extra data |
|---|---|---|
| noun | der Termin | gender, plural, topic |
| verb | anrufen | du/er present, Präteritum, Perfekt with auxiliary, separable prefix, reflexive, government |
| adjective / adverb / word | pünktlich, inzwischen | comparative/superlative |
| expression | Es kommt darauf an. | when to use it, detection keys |
| grammar | trotzdem + inversion | rule, pattern, 3 examples, 3 translation prompts with model answers, rebuild tasks, typical mistake, linked error types |

Each item you own has a **card**: the FSRS memory state (stability, difficulty, due date),
how often you used it right or wrong, and your last three corrected sentences with it.
The save also keeps daily stats, error counts per type, a "heat" value per grammar rule,
your journal (last 300 sentences with corrections), the level estimate (see below), the
economy and settings.

**Where it is saved.** On claude.ai the save is split into a few documents under your private
`data/users/<id>/` path in the artifact database (each document stays under 256 KiB) and
mirrored to browser storage for an instant start. The newest save wins on load. API keys are
never written to the cloud. You can export and import the save as text in Settings.

## One task, end to end

1. **The shift builder** (`engine/tasks.ts`) picks about 10 tasks: new blueprints (an intro
   card plus the first sentence), rusty machines (rustiest first), up to two topics the coach
   put in focus, one weak-spot task from your recent mistakes, one to three A1 basics to check again, and combos that bundle mature
   items (one structure plus one or two words) into a single situation. You never have to
   look for rusty machines yourself: whatever is due comes back in the next shift. Task types rotate by stage: grammar starts with
   translations that force the structure (so you can't avoid it), then rebuild tasks, then
   free sentences.
2. **Cues fade with the stage.** A new noun shows "der Termin, appointment". At stage 2 you
   see "Termin", so you have to supply the article yourself. From stage 3 you only see
   "appointment (Nomen · T…)", so you have to recall the word.
3. **Before an AI call**, a local check warns you if a target word seems to be missing. This
   saves tokens and avoids an unfair "missing".
4. **The corrector** gets the task, the situation, the targets with their forms, a model
   answer if there is one, and the grammar index. It returns JSON with:
   - a status per target: correct, flawed, synonym, wrong or missing;
   - a minimal correction and an optional more natural version;
   - each error as exact words → fix, with a type, a grammar id and a short explanation;
   - praise and a tip;
   - the CEFR level the answer shows, which feeds the level engine.

   It is told never to invent errors and to accept colloquial but correct German. Answers
   that match the model answer exactly skip the AI.
5. **Grading → schedule** (`engine/srs.ts`): correct → Good, flawed or synonym → Hard, wrong or
   missing → Again. Never Easy: producing a word fades faster than recognising it. The one
   exception is an A1 basic you already knew on first sight, which starts as Easy. Only the first graded
   production of an item per day changes its schedule; later ones that day are practice.
   Stages come from FSRS stability: 1 = built, 2 ≥ 3 days, 3 ≥ 10, 4 ≥ 30, 5 (gold) ≥ 90.
6. **Repair yourself.** After a mistake you can rewrite the sentence. Learners who fix their
   own error remember it better than learners who only read the correction, so a successful
   repair pays a bonus. If you think the corrector was wrong, "Einspruch" re-checks with a
   slower, more careful model and replaces the first verdict.
7. **Error memory.** Every error type is counted per day. Errors tagged with a grammar rule
   heat that rule up (the heat cools by 30 % a day). The hottest owned rule comes back as a
   weak-spot task, and the daily delivery prefers grammar that explains your most frequent
   error types. After the shift, the coach looks at all of it together (next section).

On claude.ai the fast model tier usually returns a correction within a few seconds.
Corrections are not made as you type: grading every keystroke would cost a lot of tokens and
interrupt your thinking. The local check, speech input (standalone) and the instant drills cover the
"immediate" part.

## The coach

After every shift (`game/coach.ts`) the coach reads what happened: each mistake with its
correction, error type and grammar id, how every target was used, your level per area, the
weak spots of earlier shifts and what is already in focus. It looks for **patterns** (the
same kind of mistake twice, or once more on top of an earlier weak spot; a single slip is
not a pattern) and picks up to three grammar topics that explain them, e.g. "mit den
Kollege", "aus die Stadt" → *prepositions with the dative*. It writes a short note in your
explanation language: one concrete thing that went well and what comes next.

Focus topics are practised early in the next shifts, two per shift, for three shifts, or
until you get them right three times in a row. A topic you have no machine for yet arrives
as a free blueprint, even past the daily limit. The coach can only choose grammar in halls
you have built and at levels that are open. With an AI it is one extra call per shift (the
default model tier, since it has to weigh a whole shift); without one, it uses the grammar ids
the corrector attached to each mistake and the rule heat, with the same thresholds. The note
and the topics show at the end of the shift and on the factory tab, with a button to practise
a topic right away.

## Where the content comes from

The curriculum has two layers, 4,030 items in all (A1 590, A2 783, B1 1,810, B2 847):

- **A hand-written core** of 503 items: the grammar structures, everyday words and
  expressions an A2–B1 learner needs most, each with a usage note.
- **Full coverage of the official Goethe-Institut word lists** for A1 (Start Deutsch 1), A2
  and B1, the lists most Anki "Goethe" decks are built from: 2,631 words the core did not
  have. The lists decide which words are in and at which level (the lowest list a word
  appears in). Meanings, example sentences and notes are written for this app, not copied;
  the raw lists are not part of the repository. Austrian/Swiss-only variants, abbreviations
  and function words that a grammar machine already teaches are left out; homonyms (die Bank,
  bank and bench) are separate items.
- **Grammar** grows to 95 structures: 11 A1 basics (articles, present endings, questions,
  plural, *es gibt*, *gern*, the time, *man* …) for the refreshers, and the B1 gaps
  (*falls/sobald/solange*, participles as adjectives, nominalisation, reported speech,
  relative clauses with prepositions, *sodass*, *indem*, *als ob*, passive with modal verbs,
  *brauchen … zu*, adjectives as nouns, dative reflexives).
- **B2.** The Goethe-Institut publishes no B2 word list. The B2 set is therefore built from
  word frequency: frequent German words beyond the A1–B1 lists, each checked by hand for B2
  use (names, English loanwords, nationality adjectives and inflected forms are left out),
  792 words, plus 12 B2 structures (*hätte … machen sollen*, extended participles, passive
  substitutes, noun-verb combinations, subjective modal verbs, Futur II, nominal style …) and
  43 phrases for discussions and formal writing. B2 items open per area once your level
  estimate there reaches 3.6 ("B1+"); until then they are shown as locked in the shop. Everyday
  words that the Goethe lists happen to miss (das Abendessen, der Schreibtisch, monatlich …)
  keep their real level.

Every item is checked automatically (`tests/content.test.ts`): ids, required fields,
article and plural, complete verb forms, separable prefixes, and that each example sentence
really contains its word, so the "missing word" check works on real answers.

## The level engine

`engine/level.ts` estimates your CEFR level from your own answers, per area (vocabulary,
verbs, sentence structure, cases and endings, expressions):

- Ability is a number on the CEFR scale (1 = A1, 2 = A2, 3 = B1, 4 = B2). An item's level is
  its difficulty, and a logistic model gives the chance that someone at the current estimate
  uses it correctly (about 80 % at their own level).
- Every graded use moves the estimate by how surprising the result was (an Elo-style update).
  First encounters count fully; items practised many times count less, because success there
  shows memory more than level. The first steps are big, later ones small.
- The corrector also rates each sentence (A1…C1, complexity and accuracy together); that
  rating feeds a second, slower signal that makes up 30 % of the overall estimate.
- An existing save starts from its own history: each machine's right/wrong record counts as
  one observation.

What it drives:

- **The daily delivery.** Every day the queue is topped up to your new-machine allowance with
  blueprints just above your level in each area (the "i+1"), from the topics you already
  work with, with grammar that explains your most frequent mistakes first and a mix of kinds.
  Blueprints are always free: words are never bought. You can still pick extra blueprints
  in the shop's study plan (Laden → Lernplan), or switch the delivery off.
- **B2.** B2 items open per area at an estimate of 3.6 ("B1+").
- **A1 refreshers.** One basic per shift (two or three after repeated basic mistakes or at a
  low level) comes back as a recall task: only the meaning is shown. Known on first sight, it
  becomes a running machine at once and returns at growing intervals; forgotten, it becomes a
  blueprint to learn.
- **The AI prompts.** The corrector and the situation writer are told your level, and the
  "more natural" suggestion stays one small step above it.
- **Statistik → Dein Niveau** shows the estimate overall and per area.

## The game, and why each piece exists

Taler come from two places: every sentence you write, and the machines and staff that
produce while the app is closed. A sentence starts at **1 Taler** (more with quality, rust
repaired, new machines and the combo). Taler build the factory, never your vocabulary:

| Shop group | What it buys | Examples |
|---|---|---|
| Werkstatt | More Taler per sentence | Toolbox (+1 per level, 30 levels), master's certificate (×1.25), combo press, shift supervisor, piecework clock |
| Personal & Fahrzeuge | Production while the app is closed | Workers (+1/h each), forklifts (+5/h), car transporters (+15/h and storage) |
| Anlagen | Multipliers | Conveyor belts, HQ floors (+5 % on everything), warehouse (storage), machine oil (rusty machines keep more), hall expansions |
| Gebäude | Eight one-off projects | Canteen, water tower, car park, training centre, solar park, rail siding, test track, helicopter pad |

Prices grow per level, so the first purchases come within a shift or two and the big
buildings take weeks. The simulation (`npm run sim`) reaches about 90 Taler per sentence after
a month of daily practice. Everything bought shows up on the factory map.

| Mechanic | Learning purpose |
|---|---|
| Taler only from sentences and machines | Production is the only way to progress |
| Taler per sentence grows with upgrades | Writing stays the best way to earn, at every stage of the game |
| Machine output = stage × condition | Long-term retention is what pays |
| Rust when due, up to 90 % output loss | Reviews feel like maintenance, not homework |
| Offline earnings with 8 h storage (upgradable) | A reason to come back every day |
| Free daily delivery of fitting blueprints | New material arrives at your level without browsing a catalogue of thousands; money never decides what you learn |
| Combo multiplier for correct answers in a row | Concentration pays; a mistake resets the combo but still earns a little |
| Daily orders + chest with random prize | Variable rewards and small, clear goals (good for ADHD) |
| Streak tied to a daily sentence goal | Daily habit; streak freezes come from chests |
| Levels unlock halls, every level hires a worker for free | Steady progression, nothing hidden behind grinding |
| Akkord drills (60 s) | Automatic forms, fast wins between writing tasks |

There are no lives, no hearts and no lost progress: mistakes are the learning, so a wrong
answer still earns a little and shows you exactly what to fix.

## The factory map

The Fabrik tab shows the factory as pixel art, so progress is something you can see. The
map is computed from the save, nothing else is stored.

| On the map | What it means |
|---|---|
| A robot, rack crate, press, paint booth or bench | One item you own, in the hall it belongs to |
| Blue see-through machine | Blueprint: bought, but never used in a correct sentence |
| Brown machine with a "!" bubble | Due for review: use it in the next shift |
| Gold machine with sparkles | Gold stage, stable for months |
| Dashed yellow spots | Free room in the hall for the next blueprints |
| Construction site with a crane | Hall that opens at a higher level |
| Level plate and flag number on the HQ | Your level and your streak |
| Cars in the lot ("HEUTE 9") | Sentences written today |
| Walking workers, forklifts, supervisors in white helmets | Staff you hired (one worker is always there) |
| Yellow car transporters on the road | Your truck fleet |
| HQ floors, stars on the HQ roof, clock post | HQ upgrades, master's certificates, piecework clock |
| Tool shed (three sizes), combo press, containers, oil barrels | Toolbox, combo press, warehouse and machine oil upgrades |
| Stars on hall signs, belt speed | Hall expansions and conveyors; rust slows a hall's belts down |
| Buildings below the HQ, fenced plot with a price | Buildings you bought (with steam, a freight train, race cars, a helicopter …) and the next one to save for |

Machines keep their place: they are ordered by the time you unlocked them, so new ones
appear at the end of a hall. Words share racks (nine crates per rack; a big Anki import
packs several words per crate) so the warehouse stays a sensible size. The map is drawn
at a whole number of device pixels per pixel so it stays sharp, animates at 12 frames per
second only while visible, stands still with reduced motion, and switches to night when the
app is in dark mode. The list view is still there for screen readers and quick scanning.

## AI options

- **claude.ai subscription:** the artifact calls Claude through the platform's `sample`
  capability on the viewer's own account, with the fast tier by default and the default tier
  for careful mode. Nothing to configure.
- **Claude API key:** `@anthropic-ai/sdk` in the browser, with structured outputs (zod
  schema) and server-side refusal fallback. The default model is Opus 5.5, and Haiku 5.5 is
  the cheap option.
- **Local open source:** any OpenAI-compatible endpoint (Ollama, LM Studio). It works, but
  models under ~12B parameters regularly miss errors or flag correct German, which is harmful
  for a learner.

## Next steps

- **Conversation hall:** short role-plays with characters (landlord, doctor, colleague) that
  require your due items, graded turn by turn. This is the bridge to speaking.
- **Speaking practice:** dictate answers (already in standalone browsers), then shadow the
  corrected sentence with pronunciation feedback.
- **Enrich imported Anki words:** let Claude add gender, plural, forms and an example, so
  imported words get full drills.
- **Prestige:** "open a second factory in another city" for permanent multipliers once most
  machines are gold.
- **A coach that also plans vocabulary:** today it focuses grammar; it could also notice words
  you keep avoiding or misusing and bring them into focus.
