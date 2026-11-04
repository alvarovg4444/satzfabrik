import { CASE_CHANT, CASE_CHECK, CASE_DE, type CaseHelp as Help, type CaseTable } from "../engine/drills";

/** All forms of the case table, the right one marked. */
export function CaseTableView({ t }: { t: CaseTable }) {
  return (
    <div className="case-table-wrap">
      <span className="eyebrow">{t.title}</span>
      <table className="case-table">
        <thead>
          <tr>
            {t.head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((r, ri) => (
            <tr key={ri} className={ri === t.hl[0] ? "hl-row" : undefined}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, ci) => (
                <td key={ci} className={ri === t.hl[0] && ci === t.hl[1] ? "hl" : undefined}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The four questions and the article chant, to look up any time. */
export function CaseCheck({ open = false }: { open?: boolean }) {
  return (
    <details className="case-check" open={open}>
      <summary>Welcher Fall? In 4 Fragen</summary>
      <ol>
        {CASE_CHECK.map((s) => (
          <li key={s.q}>
            <b>{s.q.replace(/^\d\.\s*/, "")}</b> {s.a}
          </li>
        ))}
      </ol>
      <p className="small">
        <b>Zum Auswendiglernen, laut sprechen:</b>
      </p>
      <ul className="small">
        {CASE_CHANT.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </details>
  );
}

/** Shown after a wrong case answer: why this case, when it would be the other one, and the whole table. */
export function CaseHelpView({ help, compact = false }: { help: Help; compact?: boolean }) {
  return (
    <div className="case-help stack" style={{ gap: 8 }}>
      <p className="small">
        <b>Warum {CASE_DE[help.c]}?</b> {help.why}
      </p>
      <p className="small muted">
        <b>Und sonst?</b> {help.whyNot}
      </p>
      <CaseTableView t={help.table} />
      {compact ? null : <CaseCheck />}
    </div>
  );
}
