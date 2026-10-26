# Satzfabrik

A German "sentence factory" for A2–B1 learners who already *recognise* a lot of German
(Anki, Duolingo, classes) but can't yet *produce* it without thinking.

You only earn money by writing real German sentences. Every word and grammar structure
is a machine in your factory. A machine runs once you write your first correct sentence
with it, and it keeps producing Taler while the app is closed. When you are about to forget
the word, the machine rusts. A new sentence repairs it, and then it runs longer than before.
Claude checks every sentence, explains each mistake, and keeps track of your weak spots.

- **Production, not recognition.** Each review is a sentence you write in an everyday
  situation, a translation that forces a structure, or a sentence you rebuild.
- **Spaced repetition on production.** Scheduling uses FSRS (the algorithm in modern Anki),
  graded by the corrector instead of by you.
- **Scaffolding that fades.** New words show their article and forms. Mature words only show
  the English meaning, so you have to recall the German yourself.
- **Error-driven practice.** Corrections are tagged (case, word order, adjective ending …) and
  linked to grammar machines. Repeated mistakes come back as "weak spot" tasks, and the shop
  recommends the matching grammar.
- **Speed drills (Akkord).** 60-second rounds on articles, plurals, Perfekt, Präteritum,
  prepositions + case, Wo/Wohin, pronouns, possessives and adjective endings, built from
  your own machines. They need no AI.
- **Idle-game loop.** Offline earnings with a storage cap, rust, upgrades, daily orders and a
  chest, streaks, a combo multiplier, levels and achievements.
- **A pixel-art car factory.** The Fabrik tab draws your progress as a GBA-style map: workers
  in yellow helmets, welding robots, word racks, forging presses, paint booths and craft
  benches, one per item you own. Rusty machines show a "!" bubble, gold ones sparkle, and every
  sentence you write today parks a new car outside. Tap any machine to see its word or rule.

## Run it

**On claude.ai (recommended).** Open the published artifact. Corrections run on your own
Claude subscription (the artifact `sample` capability), and progress is saved privately per
person in the artifact's database, so it syncs between phone and laptop. Claude asks once for
permission at your first correction.

**Standalone.** [`app.html`](app.html) is the whole app in one file: download it and open
it in a browser, or serve it with GitHub Pages. Outside claude.ai it uses your own key or a
local model. To build it yourself:

```bash
cd satzfabrik
npm install
npm run dev        # http://localhost:5173
npm run build      # dist/index.html (single file) + dist/artifact.html (claude.ai page)
npm run release    # build and copy dist/index.html to app.html
```

In **Settings → KI-Korrektor**, pick one of:

| Corrector | Cost | Notes |
|---|---|---|
| Claude subscription | counts towards your normal usage limit | only when opened on claude.ai |
| Claude API key | roughly $1.50 (Opus 5.5), $0.70 (Sonnet 5.5) or $0.04 (Haiku 5.5) per 60 corrections | the key stays in your browser |
| Local model (Ollama, LM Studio) | free | start Ollama with `OLLAMA_ORIGINS=*`; use a 12B+ model, because small models miss errors or invent them |
| No AI | free | you compare with a model answer and rate yourself |

## Develop

```bash
npm test           # unit tests: scheduling, drills, importer, economy, content QA
npm run typecheck
npm run sim        # prints a 60-day economy simulation (pacing of rewards and reviews)
```

Code map:

- `src/content/`: curriculum and its schema in `types.ts`: 60 grammar structures, 180 nouns,
  114 verbs, 75 adjectives/adverbs, 74 expressions and 90 everyday situations, all A2–B1,
  all written for this app.
- `src/engine/`: FSRS wrapper and stages (`srs.ts`), shift builder (`tasks.ts`), form drills
  (`drills.ts`), Anki import (`importer.ts`), text helpers.
- `src/ai/`: prompts, response schema, providers (claude.ai `sample`, Anthropic SDK with
  structured outputs, OpenAI-compatible), corrector.
- `src/game/`: economy, upgrades, orders, achievements, and all state changes in `actions.ts`.
- `src/store/`: the store, plus local and claude.ai cloud persistence.
- `src/pixel/`: the factory map. `layout.ts` turns the save into positions (pure, tested),
  `sprites.ts` and `machines.ts` hold the pixel art, `scene.ts` draws and animates it.
- `src/ui/`: React screens.
- `dev/`: sprite and scene preview pages for the pixel art (`npm run dev`, then open
  `/dev/sprites.html` or `/dev/scene.html?mode=fresh|mid|big&night`).

See [DESIGN.md](DESIGN.md) for how the learning model, correction and game economy work.
