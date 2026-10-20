/**
 * The run timeline (STU-031): one recording of the app, read into rows on three lanes over one time axis.
 *
 *   page data   every request the app made (the probe's log, ./probe.js): a query's start and end, its rows, and the
 *               query node that asked, found by its collection and, where the trace has it, by the millisecond its
 *               `items` came out (STU-030: a wired query's output lands on the request's answer); a request no query
 *               node could have made was asked from JavaScript
 *   workflows   the trace's signals (the runtime's own record, armed by the in-page preview): a card's event starts a
 *               run of that card, and a signal into a node the card reaches is a step of it. Every trace `cause` is 0
 *               today (P123-STU030-SIGNALCAUSE), so "a step of it" is read off the files, never off the trace. A signal
 *               no card on the page explains (inside a component, a logic node's own) is `minor`, shown on request
 *   the screen  what changed in the app's document (the probe's MutationObserver), each change given to the page
 *               element that holds it, changes to one element close together made one row; and the app's moves
 *               between pages
 *
 * All three are read on the frame's own clock (`performance.now()`), so they sit on one axis without adjusting.
 * Names come from the files (the caller's `label`), not from the trace's dictionary, which forgets a page's nodes once
 * the app leaves it.
 *
 * Pure: the recording and the caller's naming in, rows out. A row is
 *   { lane: 'data' | 'workflow' | 'screen', t, end?, text, sub, link: { node } | { card: { node, port } } | { item } | null, minor? }
 * with `t` and `end` in ms from the recording's start.
 */

export const LANES = [['data', 'Page data'], ['workflow', 'Workflows'], ['screen', 'The screen']];

const an = (word) => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);
const classOf = (path) => { const m = /\/classes\/([^/]+)(\/[^/]+)?$/.exec(path || ''); return m ? { collection: decodeURIComponent(m[1]), one: !!m[2] } : null; };

/** What a request asked, in a few words, and the collection it asked about. */
export function requestWords(e) {
  const c = classOf(e.path);
  if (c) {
    if (e.method === 'POST' && e.body?._method === 'GET') return { words: c.one ? `reads one ${c.collection}` : `asks for ${c.collection}`, collection: c.collection, query: !c.one };
    if (e.method === 'GET') return { words: c.one ? `reads one ${c.collection}` : `asks for ${c.collection}`, collection: c.collection, query: !c.one };
    if (e.method === 'POST') return { words: `creates ${an(c.collection)}`, collection: c.collection };
    if (e.method === 'PUT') return { words: `saves ${an(c.collection)}`, collection: c.collection };
    if (e.method === 'DELETE') return { words: `deletes ${an(c.collection)}`, collection: c.collection };
  }
  const path = e.path || '';
  if (/\/login$/.test(path)) return { words: 'signs in' };
  if (/\/logout$/.test(path)) return { words: 'signs out' };
  if (/\/users\/me$/.test(path)) return { words: 'reads the signed-in user' };
  if (/\/users$/.test(path) && e.method === 'POST') return { words: 'signs up' };
  const fn = /\/functions\/([^/]+)$/.exec(path);
  if (fn) return { words: `runs ${decodeURIComponent(fn[1])} on the backend` };
  return { words: `${e.method} ${path}` };
}

export const msText = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`);

/**
 * @param {object} r
 * @param {number} r.t0  the recording's start on the frame's clock (0: from the frame's first millisecond)
 * @param {number} r.t1  its end
 * @param {boolean} [r.fromOpen]  the recording began with the app opening
 * @param {object[]} r.trace   the trace's events (seq, t, kind, fromNode, fromPort, toNode, toPort)
 * @param {object[]} r.log     the probe's entries ({ kind: 'request', method, path, body, t0, t1, status, rows } | { kind: 'nav', path, t })
 * @param {object[]} r.screen  the screen's changes, each already given to a page element: { t, node | null, added, removed, text }
 * @param {object[]} r.cards   the cards: the page's and its reusables' { node, port, component, name, when, reach: Set<id> }
 * @param {(id: string) => string} r.label        a node's name, from the files
 * @param {(id: string) => string | null} r.pageNode  the page element holding a node (itself, or the copy it is inside), or null
 * @param {(collection: string, request: object, trace: object[]) => ({ name: string, link: object | null } | null)} r.asker
 *        the query that made a request (with a `note` when that is a guess), or null when no query node could have
 */
export function buildTimeline({ t0, t1, fromOpen = false, trace = [], log = [], screen = [], cards = [], label, pageNode, asker }) {
  const rows = [];
  const at = (t) => Math.max(0, t - t0);
  const inside = (t) => t >= t0 && t <= t1;
  if (fromOpen) rows.push({ lane: 'screen', t: 0, text: 'The app opens', sub: 'a fresh copy of the app, from its first millisecond', link: null });

  // ---- page data: the probe's requests
  for (const e of log) {
    if (e.kind !== 'request' || !inside(e.t0)) continue;
    const { words, collection, query } = requestWords(e);
    const who = query && asker ? asker(collection, e, trace) : null;
    const end = e.t1 !== undefined ? at(e.t1) : undefined;
    const answer = end === undefined ? 'still waiting for the answer' : !(e.status >= 200 && e.status < 300) ? `refused (${e.status || 'no answer'})` : e.rows !== undefined ? `${e.rows} row${e.rows === 1 ? '' : 's'}` : 'answered';
    rows.push({ lane: 'data', t: at(e.t0), end, text: query ? `${who ? who.name : 'JavaScript'} ${words}` : `The app ${words}`,
      sub: `${msText(at(e.t0))} → ${end === undefined ? '…' : msText(end)} · ${answer}${query && !who ? ' · no query node asks this: a JavaScript node or a script did' : who?.note ? ` · ${who.note}` : ''}`,
      link: who?.link ?? null, collection });
  }

  // ---- workflows: a card's event starts a run; a signal into a node that card reaches, from one already in the run, is a step
  const cardBy = new Map(cards.map((c) => [`${c.node}.${c.port}`, c]));
  const runs = [], loose = [];
  const signals = trace.filter((e) => e.kind === 'signal' && inside(e.t)).sort((a, b) => a.seq - b.seq);
  for (const e of signals) {
    const card = cardBy.get(`${e.fromNode}.${e.fromPort}`);
    if (card) {
      // one event wired to two first steps sends two signals in the same millisecond: lanes of one run (STU-024)
      const last = runs.findLast((r) => r.card === card);
      if (last && e.t - last.t < 1) { last.steps.add(e.toNode); last.nodes.add(e.toNode); last.end = Math.max(last.end, e.t); continue; }
      runs.push({ card, t: e.t, end: e.t, steps: new Set([e.toNode]), nodes: new Set([card.node, e.toNode]) });
      continue;
    }
    const run = runs.findLast((r) => r.card.reach.has(e.toNode) && r.nodes.has(e.fromNode));
    if (run) { run.steps.add(e.toNode); run.nodes.add(e.toNode); run.end = e.t; continue; }
    loose.push(e);
  }
  for (const r of runs) {
    const n = r.steps.size;
    rows.push({ lane: 'workflow', t: at(r.t), end: at(r.end), text: r.card.name, sub: `${r.card.when} · ${n} step${n === 1 ? '' : 's'} ran${r.end > r.t ? ` over ${msText(r.end - r.t)}` : ''}`,
      link: { card: { node: r.card.node, port: r.card.port, component: r.card.component } } });
  }
  for (const e of loose) {
    const to = pageNode(e.toNode), from = pageNode(e.fromNode);
    rows.push({ lane: 'workflow', t: at(e.t), text: `${label(e.fromNode)}'s ${e.fromPort} → ${label(e.toNode)}`, sub: `a signal no workflow on this page starts${to || from ? ` · inside ${label(to || from)}` : ''}`,
      link: to || from ? { node: to || from } : null, minor: true });
  }

  // ---- the screen: changes to one element close together are one row; the app's moves between pages
  const groups = [];
  for (const s of screen.filter((x) => inside(x.t)).sort((a, b) => a.t - b.t)) {
    const g = groups.at(-1);
    if (g && g.node === s.node && s.t - g.end <= 30) { g.end = s.t; g.added += s.added || 0; g.removed += s.removed || 0; if (s.text && !g.texts.includes(s.text)) g.texts.push(s.text); g.changes++; continue; }
    groups.push({ node: s.node, t: s.t, end: s.t, added: s.added || 0, removed: s.removed || 0, texts: s.text ? [s.text] : [], changes: 1 });
  }
  for (const g of groups) {
    const who = g.node ? label(g.node) : 'The page';
    const what = g.added ? `${g.added} element${g.added === 1 ? '' : 's'} drawn${g.removed ? `, ${g.removed} taken away` : ''}` : g.removed ? `${g.removed} element${g.removed === 1 ? '' : 's'} taken away` : g.texts.length ? 'its text changes' : 'changes';
    const text = g.texts.join(' · ');
    rows.push({ lane: 'screen', t: at(g.t), end: g.end > g.t ? at(g.end) : undefined, text: `${who} draws`, sub: `${what}${text ? ` · “${text.length > 70 ? text.slice(0, 69) + '…' : text}”` : g.added || g.removed ? '' : ' · empty'}`,
      link: g.node ? { node: g.node } : null, node: g.node, texts: g.texts });
  }
  for (const e of log) if (e.kind === 'nav' && inside(e.t)) rows.push({ lane: 'screen', t: at(e.t), text: `The app goes to ${e.path}`, sub: 'a move to another page', link: null });

  const order = { data: 0, workflow: 1, screen: 2 };
  rows.sort((a, b) => a.t - b.t || order[a.lane] - order[b.lane]);
  // the axis runs to the last thing that happened, not to Stop: a recording left running after the app went quiet would
  // squeeze everything into its first few pixels (the page opening: all of it in the first 0.5 s of 5)
  // and, recorded from now, from the first thing that happened: the seconds before the first click are not the story
  const last = Math.max(0, ...rows.map((r) => r.end ?? r.t));
  const span = Math.max(20, Math.min(t1 - t0, last * 1.04));
  const first = rows.length ? rows[0].t : 0;
  const from = !fromOpen && first > 200 ? Math.max(0, first - (span - first) * 0.04) : 0;
  return { rows, length: t1 - t0, from, span, loose: loose.length, runs: runs.length };
}
