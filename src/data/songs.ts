export type SongState = 'mastered' | 'in-progress' | 'next' | 'locked' | 'stretch';

export interface SongSection {
  name: string;
  bars: string[];
}

export interface SongDrill {
  name: string;
  desc: string;
  bpm: number;
  score: number;
  total: number;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  track: number | 'fs';
  order: number;
  difficulty: string;
  chords: string[];
  newChord?: string | null;
  keyDrills?: SongDrill[];
  strum?: string;
  strumNote?: string;
  bpm?: number;
  state: SongState;
  dailyTarget?: number;
  playsToday?: number;
  approvedDays?: number;
  targetApprovals?: number;
  history?: number[];
  sections?: SongSection[];
  fingerstyle?: boolean;
  isLesson?: boolean;
}

export const SONGS: Song[] = [
  // ====== TRACK 1 ======
  {
    id: 'piyu-bole', title: 'Piyu Bole', artist: 'Sonu Nigam · Shreya Ghoshal',
    track: 1, order: 1, difficulty: 'Beginner',
    chords: ['C', 'G'], newChord: null,
    keyDrills: [{ name: 'C ↔ G', desc: 'The only switch in the song', bpm: 80, score: 14, total: 16 }],
    strum: 'D D D D D D', strumNote: '6/8 feel · accent on beat 4',
    bpm: 76, state: 'mastered',
    dailyTarget: 4, playsToday: 0, approvedDays: 7, targetApprovals: 7,
    history: [4, 5, 4, 4, 4, 3, 4, 5, 4, 4, 4, 4, 5, 0],
    sections: [
      { name: 'Intro', bars: ['G','C','G','C'] },
      { name: 'Verse', bars: ['G','C','G','C'] },
      { name: 'Chorus', bars: ['G','C','G','C'] }
    ]
  },
  {
    id: 'sunshine', title: 'You Are My Sunshine', artist: 'Johnny Cash',
    track: 1, order: 2, difficulty: 'Beginner',
    chords: ['C', 'F', 'G'], newChord: 'F',
    keyDrills: [
      { name: 'C ↔ F', desc: 'The main switch', bpm: 80, score: 12, total: 16 },
      { name: 'C ↔ G', desc: 'The chorus turn', bpm: 80, score: 15, total: 16 }
    ],
    strum: 'D D D D', strumNote: 'Four down-strums, equal weight',
    bpm: 88, state: 'in-progress',
    dailyTarget: 4, playsToday: 2, approvedDays: 5, targetApprovals: 7,
    history: [0, 2, 4, 4, 3, 4, 5, 4, 3, 2, 4, 4, 3, 2],
    sections: [
      { name: 'Verse 1', bars: ['C','—','F','C','F','C','C','G·C'] },
      { name: 'Chorus', bars: ['C','—','F','C','F','C','C','G·C'] }
    ]
  },
  // ====== TRACK 2 ======
  {
    id: 'photograph', title: 'Photograph', artist: 'Ed Sheeran',
    track: 2, order: 3, difficulty: 'Beginner+',
    chords: ['C', 'Am', 'G', 'F'], newChord: 'Am',
    keyDrills: [
      { name: 'C ↔ Am', desc: 'Same finger, just lift one', bpm: 76, score: 0, total: 16 },
      { name: 'G ↔ F', desc: 'The harder reach', bpm: 76, score: 0, total: 16 }
    ],
    strum: 'D-D-D-D-D-D-D-D', strumNote: 'Eighth notes — keep wrist loose',
    bpm: 108, state: 'next',
    dailyTarget: 5, playsToday: 0, approvedDays: 0, targetApprovals: 7,
    history: [],
    sections: [
      { name: 'Verse', bars: ['C','—','Am','—','G','—','F','—'] },
      { name: 'Pre-Chorus', bars: ['Am','F','C','G','Am','F','C','G'] },
      { name: 'Chorus', bars: ['C','—','G','—','Am','F','C','G'] }
    ]
  },
  {
    id: 'kho-gaye', title: 'Kho Gaye Hum Kahan', artist: 'Jasleen Royal · Prateek Kuhad',
    track: 2, order: 4, difficulty: 'Beginner+',
    chords: ['C', 'F', 'G', 'E7'], newChord: 'E7',
    keyDrills: [
      { name: 'F ↔ G', desc: 'Big jump on the fretboard', bpm: 80, score: 0, total: 16 },
      { name: 'E7 shape', desc: 'New chord — 3 fingers', bpm: 60, score: 0, total: 16 }
    ],
    strum: 'D-D-D-D-D-D-D-D', strumNote: 'Steady eighths, accent on 1',
    bpm: 102, state: 'locked',
    dailyTarget: 5, playsToday: 0, approvedDays: 0, targetApprovals: 7,
    history: [],
    sections: [
      { name: 'Verse', bars: ['C','F','G','—','C','F','G','—'] },
      { name: 'Chorus', bars: ['F','C','F','G','F','C','F','G'] },
      { name: 'Bridge', bars: ['E7','F','G','C','E7','F','G','C'] }
    ]
  },
  // ====== TRACK 3 ======
  {
    id: 'kaisi-paheli', title: 'Kaisi Paheli', artist: 'Sunidhi Chauhan',
    track: 3, order: 5, difficulty: 'Intermediate',
    chords: ['C', 'Am', 'Dm', 'G'], newChord: 'Dm',
    keyDrills: [
      { name: 'Dm shape', desc: 'New chord — 3 fingers, tight', bpm: 60, score: 0, total: 16 },
      { name: 'Am ↔ Dm', desc: 'Adjacent chords', bpm: 80, score: 0, total: 16 }
    ],
    strum: 'D-U-•-D-U-D-•', strumNote: 'Mute on the bullet · jazzy feel',
    bpm: 96, state: 'locked',
    dailyTarget: 5, playsToday: 0, approvedDays: 0, targetApprovals: 7,
    history: [],
    sections: [
      { name: 'Intro', bars: ['C','Am','Dm','G','C','Am','Dm','G'] },
      { name: 'Verse', bars: ['C','Dm','G','C','C','Dm','G','C'] }
    ]
  },
  {
    id: 'im-yours', title: "I'm Yours", artist: 'Jason Mraz',
    track: 3, order: 6, difficulty: 'Intermediate',
    chords: ['C', 'G', 'Am', 'F', 'D7'], newChord: 'D7',
    keyDrills: [
      { name: 'D7 shape', desc: 'Two fingers, easy reach', bpm: 80, score: 0, total: 16 },
      { name: 'Reggae strum', desc: 'D-DU-U-DU pattern', bpm: 76, score: 0, total: 16 }
    ],
    strum: 'D-DU-U-DU', strumNote: 'Reggae-feel · upstroke on the &',
    bpm: 76, state: 'locked',
    dailyTarget: 5, playsToday: 0, approvedDays: 0, targetApprovals: 7,
    history: [],
    sections: [
      { name: 'Verse', bars: ['C','—','G','—','Am','—','F','—'] },
      { name: 'Chorus', bars: ['C','G','Am','F','C','G','Am','F·D7'] }
    ]
  },
  // ====== TRACK 4 ======
  {
    id: 'over-rainbow', title: 'Over the Rainbow', artist: "Israel Kamakawiwo'ole",
    track: 4, order: 7, difficulty: 'Intermediate+',
    chords: ['C', 'Em', 'F', 'G', 'E7', 'Am'], newChord: 'Em',
    keyDrills: [
      { name: 'Em shape', desc: 'New chord — 3 fingers, tight cluster', bpm: 60, score: 0, total: 16 },
      { name: 'C ↔ Em', desc: 'The signature change', bpm: 76, score: 0, total: 16 }
    ],
    strum: 'D-DU-U-DU', strumNote: 'Slow reggae · let chords ring',
    bpm: 70, state: 'locked',
    dailyTarget: 6, playsToday: 0, approvedDays: 0, targetApprovals: 7,
    history: [],
    sections: [
      { name: 'Intro', bars: ['C','Em','F','C','F','E7','Am','F'] },
      { name: 'Verse', bars: ['C','Em','F','C','F','C','G','Am·F'] },
      { name: 'Bridge', bars: ['C','—','—','—','Em','—','Am','F'] }
    ]
  },
  {
    id: 'sham', title: 'Sham', artist: "Amit Trivedi · Nikhil D'Souza",
    track: 4, order: 8, difficulty: 'Stretch',
    chords: ['C', 'Em', 'F', 'G', 'Dm', 'Bb', 'Fm'], newChord: 'Bb / Fm',
    keyDrills: [
      { name: 'Bb shape', desc: 'Light barre — needs strong index', bpm: 50, score: 0, total: 16 },
      { name: 'Fm shape', desc: 'Hard cluster — Sem 2 candidate', bpm: 50, score: 0, total: 16 }
    ],
    strum: 'D-DU-U-DU',
    strumNote: 'This song uses 7 chords incl. Bb & Fm — flagged as a stretch piece',
    bpm: 72, state: 'stretch',
    dailyTarget: 6, playsToday: 0, approvedDays: 0, targetApprovals: 7,
    history: [],
    sections: [
      { name: 'Intro', bars: ['C','Em','F','Dm·G'] },
      { name: 'Verse', bars: ['C','Em','F','Dm·G','C','Em','F','Dm·G'] },
      { name: 'Chorus', bars: ['C','Em·F','Dm·G','C','Em·F','Dm·G','C·F','Bb·G'] }
    ]
  },
  // ====== FINGERSTYLE ======
  { id: 'tab-101', title: 'Reading Tab · 101', artist: 'BAM Foundations',
    track: 'fs', order: 0, difficulty: 'Foundation',
    fingerstyle: true, isLesson: true, chords: [], state: 'next' },
  { id: 'happy-bday', title: 'Happy Birthday', artist: 'Patty Hill, Mildred J. Hill',
    track: 'fs', order: 1, difficulty: 'Beginner',
    fingerstyle: true, chords: [], state: 'locked' },
  { id: 'saathiya', title: 'Saathiya', artist: 'A. R. Rahman',
    track: 'fs', order: 2, difficulty: 'Intermediate',
    fingerstyle: true, chords: [], state: 'locked' },
  { id: 'hedwig', title: "Hedwig's Theme", artist: 'John Williams',
    track: 'fs', order: 3, difficulty: 'Stretch',
    fingerstyle: true, chords: [], state: 'locked' },
];

export const SONG_REASONING: Record<string, string> = {
  'piyu-bole': 'Two chords only — the gentlest possible start. Students play a real song in their first session.',
  'sunshine': 'Adds the F chord, which is the first "hard" chord most students meet. The C↔F switch is the rite of passage.',
  'photograph': 'Introduces Am — your first minor. The C-Am-F-G progression is the most common in pop music.',
  'kho-gaye': 'Introduces 7th chords (E7) and faster transitions. Indian melodic shape inside Western chord vocabulary.',
  'kaisi-paheli': 'Adds Dm and a syncopated mute strum. Students start sounding "rhythmic" rather than just "in time".',
  'im-yours': 'The reggae strum and D7. Combines all the chords learned so far in a faster groove.',
  'over-rainbow': 'Em arrives — a tight three-finger cluster that takes a few sessions. The melody is iconic enough to be motivating.',
  'sham': 'Bb and Fm are barre-adjacent. Most students need Sem 2 for these. Flagged as stretch — optional.',
  'tab-101': 'Read tab before attempting any fingerstyle piece. Saves weeks of confusion.',
  'happy-bday': 'Simple melodic shape. Confidence-builder before Saathiya.',
  'saathiya': 'Steady left-hand pattern, romantic melody. Familiar Indian audience favorite.',
  'hedwig': 'Stretches up to fret 10 — tenor/concert ukulele only. Optional showpiece.'
};
