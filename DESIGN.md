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
your journal (last 300 sentences with corrections), the economy and settings.

**Where it is saved.** On claude.ai the save is split into a few documents under your private
`data/users/<id>/` path in the artifact database (each document stays under 256 KiB) and
mirrored to browser storage for an instant start. The newest save wins on load. API keys are
never written to the cloud. You can export and import the save as text in Settings.

## One task, end to end

1. **The shift builder** (`engine/tasks.ts`) picks about 10 tasks: new blueprints (an intro
   card plus the first sentence), rusty machines (rustiest first), one weak-spot task from
   your recent mistakes, and combos that bundle mature items (one structure plus one or two
   words) into a single situation. Task types rotate by stage: grammar starts with
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
   - praise and a tip.

   It is told never to invent errors and to accept colloquial but correct German. Answers
   that match the model answer exactly skip the AI.
5. **Grading → schedule** (`engine/srs.ts`): correct → Good (Easy if the sentence is perfect at
   stage 3+), flawed or synonym → Hard, wrong or missing → Again. Only the first graded
   production of an item per day changes its schedule; later ones that day are practice.
   Stages come from FSRS stability: 1 = built, 2 ≥ 3 days, 3 ≥ 10, 4 ≥ 30, 5 (gold) ≥ 90.
6. **Repair yourself.** After a mistake you can rewrite the sentence. Learners who fix their
   own error remember it better than learners who only read the correction, so a successful
   repair pays a bonus. If you think the corrector was wrong, "Einspruch" re-checks with a
   slower, more careful model and replaces the first verdict.
7. **Error memory.** Every error type is counted per day. Errors tagged with a grammar rule
   heat that rule up (the heat cools by 30 % a day). The hottest owned rule comes back as a
   weak-spot task, and the shop recommends unowned grammar that explains your most frequent
   error types.

On claude.ai the fast model tier usually returns a correction within a few seconds.
Corrections are not made as you type: grading every keystroke would cost a lot of tokens and
interrupt your thinking. The local check, speech input (standalone) and the instant drills cover the
"immediate" part.

## The game, and why each piece exists

| Mechanic | Learning purpose |
|---|---|
| Taler only from sentences and machines | Production is the only way to progress |
| Machine output = stage × condition | Long-term retention is what pays |
| Rust when due, up to 90 % output loss | Reviews feel like maintenance, not homework |
| Offline earnings with 8 h storage (upgradable) | A reason to come back every day |
| Blueprint prices rise with factory size | New items cost more when you have more to maintain, which prevents overload |
| Combo multiplier for correct answers in a row | Concentration pays; a mistake resets the combo but still earns a little |
| Daily orders + chest with random prize | Variable rewards and small, clear goals (good for ADHD) |
| Streak tied to a daily sentence goal | Daily habit; streak freezes come from chests |
| Levels unlock halls, every level gives a free blueprint | Steady progression, nothing hidden behind grinding |
| Akkord drills (60 s) | Automatic forms, fast wins between writing tasks |

There are no lives, no hearts and no lost progress: mistakes are the learning, so a wrong
answer still earns a little and shows you exactly what to fix.

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
- **More B1+ content:** Nominalisierung, Konnektoren like falls/sobald/solange, Partizip als
  Adjektiv, indirect speech.
