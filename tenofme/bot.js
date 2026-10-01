// A hand for scripted runs: the checks, the ?demo preview and ?autoplay all play floors with it.
// A script is a list of steps for one run:
//   ['go', tx]     walk to the middle of column tx      ['up'] / ['down']  climb the ladder here to the next floor
//   ['wait', s]    stand until the clock reads s         ['idle', s]        stand for s seconds
//   ['act']        pick up or put down                   ['stop']           end the run here (this copy waits here)
//   ['spotted']    stand until a guard comes after you   ['climb', s]       climb up for s seconds and hang on there
import { T, BW, IN } from './sim.js';

export class Bot {
  constructor(script) { this.cmds = script || []; this.i = 0; this.k = 0; this.mark = 0; this.done = false; }
  input(g) {
    const me = g.you;
    for (let guard = 0; guard < 8; guard++) {
      const c = this.cmds[this.i]; if (!c) { this.done = true; return 0; }
      const k = this.k++;
      switch (c[0]) {
        case 'go': {
          const d = c[1] * T + T / 2 - (me.x + BW / 2);
          if (Math.abs(d) <= 0.6 && !me.climb) { this.nextCmd(); continue; }
          if (me.climb && Math.abs(d) > 0.6) return d > 0 ? IN.R : IN.L;
          return Math.abs(d) <= 0.6 ? 0 : d > 0 ? IN.R : IN.L;
        }
        case 'up': case 'down': {
          if (k > 1 && !me.climb) { this.nextCmd(); continue; }
          return c[0] === 'up' ? IN.U : IN.D;
        }
        case 'wait': if (g.t >= c[1] - 1e-9) { this.nextCmd(); continue; } return 0;
        case 'idle': if (k === 0) this.mark = g.t; if (g.t - this.mark >= c[1] - 1e-9) { this.nextCmd(); continue; } return 0;
        case 'act': if (k === 0) return IN.A; this.nextCmd(); return 0;
        case 'spotted': if (g.guards.some(gd => gd.target === me)) { this.nextCmd(); continue; } return 0;
        case 'climb': if (k === 0) this.mark = g.t; if (g.t - this.mark >= c[1] - 1e-9) { this.nextCmd(); continue; } return IN.U;
        case 'stop': this.nextCmd(); this.stop = true; return 0;
        default: throw new Error('bot: unknown step ' + c[0]);
      }
    }
    return 0;
  }
  nextCmd() { this.i++; this.k = 0; }
}

// Play one run of a script to its end. Returns how it ended.
export function playRun(g, script, { maxTicks = 1e5 } = {}) {
  const b = new Bot(script); g.start();
  let n = 0;
  while (!g.ended && n++ < maxTicks) {
    const inp = b.input(g);
    if (b.stop) { g.stop(); break; }
    g.step(inp);
  }
  return g.ended;
}

// Play a whole solution (a list of run scripts) from a fresh floor. Returns the ending of the last run and the game.
export function playSolution(g, runs, { onRun } = {}) {
  g.restart(); let end = null;
  for (let r = 0; r < runs.length; r++) {
    end = playRun(g, runs[r]);
    onRun?.(r, end, g);
    if (end.type === 'win' || r === runs.length - 1) break;
    if (end.type === 'alarm') return { end, g, run: r };
    g.next();
  }
  return { end, g, run: g.run };
}
