export interface Foundation {
  id: string;
  title: string;
  eyebrow: string;
  done: boolean;
  /** raw HTML from reference body */
  body: string;
}

export const FOUNDATIONS: Foundation[] = [
  {
    id: 'hold',
    title: 'How to hold the ukulele',
    eyebrow: 'Module 1 · 3 min',
    done: true,
    body: `<p class="lead">Bad posture is the #1 reason students get wrist pain in week 2 and quit. Two minutes here saves weeks of frustration.</p>
      <div class="video-placeholder">
        <div class="video-play-btn">▶</div>
        <div class="video-caption">2:14 · Sitting and standing positions</div>
      </div>
      <h3>The basics</h3>
      <ol class="step-list">
        <li>Sit upright. Rest the body of the ukulele against your chest, just below your right ribs.</li>
        <li>Tuck the ukulele between your right forearm and your chest — your forearm holds it in place, not your left hand.</li>
        <li>Your left hand should be free to move along the neck without supporting the instrument's weight.</li>
        <li>The neck should angle slightly upward. Headstock above the body, not below.</li>
      </ol>
      <h3>Quick check</h3>
      <p>Let go with your left hand. The ukulele should stay put against your chest. If it falls, your right arm isn't doing its job.</p>`
  },
  {
    id: 'tune',
    title: 'Tune your ukulele',
    eyebrow: 'Module 2 · 4 min',
    done: true,
    body: `<p class="lead">An out-of-tune ukulele makes everything you play sound wrong — even when you're playing it right. Tune before every practice. Always.</p>
      <h3>Standard tuning: G–C–E–A</h3>
      <p>From the string closest to the ceiling to the string closest to the floor: <strong>G, C, E, A</strong>. The top string (G) is actually higher than the C — this is called re-entrant tuning and it's normal for ukulele.</p>
      <h3>Live mic tuner</h3>
      <p>Tap the strings one at a time. The app listens and tells you if you're flat (too low), sharp (too high), or in tune.</p>
      <div class="live-tuner">
        <div class="tuner-mic-status"><div class="tuner-mic-dot"></div>Microphone listening</div>
        <div class="tuner-strings-row">
          <div class="tuner-cell in-tune"><div class="note-letter">G</div><div class="note-status">In tune</div><div class="tuner-meter"><div class="tuner-meter-fill"></div></div></div>
          <div class="tuner-cell in-tune"><div class="note-letter">C</div><div class="note-status">In tune</div><div class="tuner-meter"><div class="tuner-meter-fill"></div></div></div>
          <div class="tuner-cell flat"><div class="note-letter">E</div><div class="note-status">Flat (-8¢)</div><div class="tuner-meter"><div class="tuner-meter-fill"></div></div></div>
          <div class="tuner-cell in-tune"><div class="note-letter">A</div><div class="note-status">In tune</div><div class="tuner-meter"><div class="tuner-meter-fill"></div></div></div>
        </div>
      </div>
      <h3>If a string won't stay in tune</h3>
      <p>New strings stretch for the first 1–2 weeks. Tune, play for 5 min, tune again. After two weeks they settle. If a single peg keeps slipping after that, the peg needs tightening — ask your teacher to show you in class.</p>`
  },
  {
    id: 'chord-box',
    title: 'Read a chord diagram',
    eyebrow: 'Module 3 · 3 min',
    done: true,
    body: `<p class="lead">Every chord in this course is shown as a small grid. Once you know how to read one, you can read all of them.</p>
      <h3>Anatomy of a chord box</h3>
      <p>The vertical lines are the strings (G–C–E–A from left to right). The horizontal lines are the frets. A numbered circle tells you which finger goes where: <strong>1</strong> = index, <strong>2</strong> = middle, <strong>3</strong> = ring, <strong>4</strong> = pinky.</p>
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap;margin:20px 0;padding:24px;background:var(--paper-warm);border-radius:12px">
        <div class="chord-diagram">
          <div class="chord-diagram-name">C</div>
          <svg width="80" height="100" viewBox="0 0 80 100">
            <rect x="10" y="10" width="60" height="80" fill="white" stroke="var(--navy)" stroke-width="2"/>
            <line x1="10" y1="30" x2="70" y2="30" stroke="var(--navy)"/>
            <line x1="10" y1="50" x2="70" y2="50" stroke="var(--navy)"/>
            <line x1="10" y1="70" x2="70" y2="70" stroke="var(--navy)"/>
            <line x1="25" y1="10" x2="25" y2="90" stroke="var(--navy)"/>
            <line x1="40" y1="10" x2="40" y2="90" stroke="var(--navy)"/>
            <line x1="55" y1="10" x2="55" y2="90" stroke="var(--navy)"/>
            <text x="10" y="6" font-size="9" text-anchor="middle" fill="var(--ink-soft)">G</text>
            <text x="25" y="6" font-size="9" text-anchor="middle" fill="var(--ink-soft)">C</text>
            <text x="40" y="6" font-size="9" text-anchor="middle" fill="var(--ink-soft)">E</text>
            <text x="55" y="6" font-size="9" text-anchor="middle" fill="var(--ink-soft)">A</text>
            <circle cx="55" cy="80" r="7" fill="var(--gold)" stroke="var(--navy)" stroke-width="2"/>
            <text x="55" y="84" font-size="10" text-anchor="middle" font-weight="700" fill="var(--navy)">3</text>
          </svg>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;max-width:120px">Ring finger on A string, 3rd fret. Other strings open.</div>
        </div>
        <div class="chord-diagram">
          <div class="chord-diagram-name">F</div>
          <svg width="80" height="100" viewBox="0 0 80 100">
            <rect x="10" y="10" width="60" height="80" fill="white" stroke="var(--navy)" stroke-width="2"/>
            <line x1="10" y1="30" x2="70" y2="30" stroke="var(--navy)"/>
            <line x1="10" y1="50" x2="70" y2="50" stroke="var(--navy)"/>
            <line x1="10" y1="70" x2="70" y2="70" stroke="var(--navy)"/>
            <line x1="25" y1="10" x2="25" y2="90" stroke="var(--navy)"/>
            <line x1="40" y1="10" x2="40" y2="90" stroke="var(--navy)"/>
            <line x1="55" y1="10" x2="55" y2="90" stroke="var(--navy)"/>
            <circle cx="40" cy="20" r="7" fill="var(--gold)" stroke="var(--navy)" stroke-width="2"/>
            <text x="40" y="24" font-size="10" text-anchor="middle" font-weight="700" fill="var(--navy)">1</text>
            <circle cx="10" cy="40" r="7" fill="var(--gold)" stroke="var(--navy)" stroke-width="2"/>
            <text x="10" y="44" font-size="10" text-anchor="middle" font-weight="700" fill="var(--navy)">2</text>
          </svg>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;max-width:120px">Index on E (1st fret), middle on G (2nd fret).</div>
        </div>
        <div class="chord-diagram">
          <div class="chord-diagram-name">G</div>
          <svg width="80" height="100" viewBox="0 0 80 100">
            <rect x="10" y="10" width="60" height="80" fill="white" stroke="var(--navy)" stroke-width="2"/>
            <line x1="10" y1="30" x2="70" y2="30" stroke="var(--navy)"/>
            <line x1="10" y1="50" x2="70" y2="50" stroke="var(--navy)"/>
            <line x1="10" y1="70" x2="70" y2="70" stroke="var(--navy)"/>
            <line x1="25" y1="10" x2="25" y2="90" stroke="var(--navy)"/>
            <line x1="40" y1="10" x2="40" y2="90" stroke="var(--navy)"/>
            <line x1="55" y1="10" x2="55" y2="90" stroke="var(--navy)"/>
            <circle cx="25" cy="40" r="7" fill="var(--gold)" stroke="var(--navy)" stroke-width="2"/>
            <text x="25" y="44" font-size="10" text-anchor="middle" font-weight="700" fill="var(--navy)">1</text>
            <circle cx="55" cy="40" r="7" fill="var(--gold)" stroke="var(--navy)" stroke-width="2"/>
            <text x="55" y="44" font-size="10" text-anchor="middle" font-weight="700" fill="var(--navy)">2</text>
            <circle cx="40" cy="60" r="7" fill="var(--gold)" stroke="var(--navy)" stroke-width="2"/>
            <text x="40" y="64" font-size="10" text-anchor="middle" font-weight="700" fill="var(--navy)">3</text>
          </svg>
          <div style="font-size:11px;color:var(--ink-soft);margin-top:4px;max-width:120px">A small triangle: 1, 2, 3 across the second &amp; third frets.</div>
        </div>
      </div>
      <h3>The "press here" rule</h3>
      <p>Press the string firmly <strong>just behind</strong> the fret wire — not on top, not in the middle. Closer to the fret = cleaner sound, less buzzing. This is the single biggest fix for "why does my chord sound dead?"</p>`
  },
  {
    id: 'first-strum',
    title: 'Your first strum',
    eyebrow: 'Module 4 · 4 min',
    done: true,
    body: `<p class="lead">Strumming is wrist motion, not arm motion. If your forearm is moving up and down, you're going to get tired in 30 seconds and your sound will be inconsistent.</p>
      <div class="video-placeholder">
        <div class="video-play-btn">▶</div>
        <div class="video-caption">3:08 · The wrist-flick technique</div>
      </div>
      <h3>What "D" and "U" mean</h3>
      <p>Throughout this course, strum patterns are written like this: <strong>D D D D</strong> or <strong>D DU U DU</strong>.</p>
      <p><strong>D</strong> = downstroke. Brush down across all four strings, top to bottom.<br>
      <strong>U</strong> = upstroke. Brush up across the bottom 2–3 strings (not all four).</p>
      <h3>Try it now: D D D D</h3>
      <p>Form the C chord. Count out loud: "1 — 2 — 3 — 4." On every count, flick your wrist downward across all four strings. Don't try to make it loud. Keep it relaxed.</p>
      <p>If your forearm is moving, you're using too much arm. Brace your elbow against the ukulele body — you'll naturally start using just the wrist.</p>`
  },
  {
    id: 'transitions',
    title: 'How to switch chords',
    eyebrow: 'Module 5 · 5 min',
    done: false,
    body: `<p class="lead">This is the skill that separates students who progress from students who quit. The hardest thing in week 2 isn't forming chords — it's <em>switching</em> between them in time.</p>
      <h3>The trick: anchor fingers</h3>
      <p>When you switch from C to Am, three of your four left-hand fingers move. When you switch from C to F, all your fingers move. But sometimes a finger can stay put — these are called <strong>anchor fingers</strong>, and finding them is the secret.</p>
      <h3>The transition drill</h3>
      <p>For every song in this course, the app will give you a 5-minute drill on the specific transition you need. Don't skip these. 5 minutes of drill beats 30 minutes of song attempts every single time.</p>
      <h3>The metronome rule</h3>
      <p>Always drill with a metronome. Always start slow — slower than you think. If you can't make the change at 60 BPM, you can't make it at 80. The goal isn't speed, it's <em>cleanness</em>.</p>
      <p>When you've done a transition 16 times in a row without a stumble, raise the BPM by 10. Repeat.</p>
      <div class="module-cta-row" data-mark-complete>
        <button class="btn-primary" data-action="mark-complete">Mark complete →</button>
        <button class="btn-secondary" data-action="back-home">Back to course</button>
      </div>`
  }
];
