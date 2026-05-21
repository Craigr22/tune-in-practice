export type AttendanceMark = 'present' | 'late' | 'absent' | 'upcoming';
export type SongStatus = 'mastered' | 'in-progress' | 'next' | 'locked';

export interface SongProgress {
  song: string;
  status: SongStatus;
  completion: number; // 0-100
  plays: number;
}

export interface Student {
  name: string;
  joined: string;
  avatar: string;
  avatarType: '' | 'star' | 'alert';
  current: string;
  todayPlays: number;
  dailyTarget: number;
  approvedDays: number;
  targetApprovals: number;
  streak: number;
  flag: 'recording' | 'steady' | 'behind' | 'streak' | 'stuck';
  flagText: string;
  barColor: '' | 'olive' | 'terracotta';
  // NEW — class & workload tracking
  attendance: AttendanceMark[];        // last 6 Saturdays (oldest → newest, last = tomorrow)
  totalPlays: number;                  // cumulative plays this semester
  workload: SongProgress[];            // per-song completion across the 8 songs
  notes?: string;
}

// 8-song semester roster (matches src/data/audio.ts order)
const SEM_SONGS = [
  'Sunshine', 'Piyu Bole', 'Photograph', "I'm Yours",
  'Kaisi Paheli', 'Kho Gaye', 'Over the Rainbow', 'Sham',
];

const wl = (...vals: Array<[SongStatus, number, number]>): SongProgress[] =>
  vals.map(([status, completion, plays], i) => ({ song: SEM_SONGS[i], status, completion, plays }));

export const STUDENTS: Student[] = [
  { name: 'Aarav Mehta',  joined: 'Joined Nov 12', avatar: 'AM', avatarType: 'star',
    current: 'Photograph', todayPlays: 5, dailyTarget: 5, approvedDays: 5, targetApprovals: 7,
    streak: 14, flag: 'recording', flagText: 'New recording', barColor: 'olive',
    attendance: ['present','present','present','late','present','upcoming'],
    totalPlays: 142,
    workload: wl(
      ['mastered',100,38], ['mastered',100,32], ['in-progress',62,28],
      ['next',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ),
    notes: 'Strong on transitions. Ready for verse 2 of Photograph.' },

  { name: 'Priya Sharma', joined: 'Joined Nov 12', avatar: 'PS', avatarType: '',
    current: 'Sunshine',   todayPlays: 4, dailyTarget: 4, approvedDays: 4, targetApprovals: 7,
    streak: 9,  flag: 'steady', flagText: 'On track', barColor: '',
    attendance: ['present','present','present','present','present','upcoming'],
    totalPlays: 96,
    workload: wl(
      ['in-progress',78,42], ['next',0,0], ['locked',0,0],
      ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ) },

  { name: 'Vikram Iyer',  joined: 'Joined Nov 12', avatar: 'VI', avatarType: '',
    current: 'Sunshine',   todayPlays: 3, dailyTarget: 4, approvedDays: 3, targetApprovals: 7,
    streak: 7,  flag: 'steady', flagText: 'On track', barColor: '',
    attendance: ['present','late','present','present','present','upcoming'],
    totalPlays: 71,
    workload: wl(
      ['in-progress',55,31], ['next',0,0], ['locked',0,0],
      ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ) },

  { name: 'Nisha Reddy',  joined: 'Joined Nov 19', avatar: 'NR', avatarType: 'alert',
    current: 'Sunshine',   todayPlays: 0, dailyTarget: 4, approvedDays: 1, targetApprovals: 7,
    streak: 0,  flag: 'behind', flagText: 'No practice 4d', barColor: 'terracotta',
    attendance: ['absent','present','absent','present','absent','upcoming'],
    totalPlays: 18,
    workload: wl(
      ['in-progress',22,18], ['locked',0,0], ['locked',0,0],
      ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ),
    notes: 'Missed two classes. Reach out before Saturday.' },

  { name: 'Karan Joshi',  joined: 'Joined Nov 12', avatar: 'KJ', avatarType: '',
    current: 'Sunshine',   todayPlays: 4, dailyTarget: 4, approvedDays: 5, targetApprovals: 7,
    streak: 12, flag: 'recording', flagText: 'New recording', barColor: 'olive',
    attendance: ['present','present','present','present','present','upcoming'],
    totalPlays: 108,
    workload: wl(
      ['mastered',100,40], ['in-progress',45,24], ['locked',0,0],
      ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ) },

  { name: 'Aditi Bose',   joined: 'Joined Nov 12', avatar: 'AB', avatarType: 'star',
    current: 'Photograph', todayPlays: 5, dailyTarget: 5, approvedDays: 6, targetApprovals: 7,
    streak: 18, flag: 'streak', flagText: '18-day streak', barColor: 'olive',
    attendance: ['present','present','present','present','present','upcoming'],
    totalPlays: 168,
    workload: wl(
      ['mastered',100,44], ['mastered',100,36], ['in-progress',74,30],
      ['next',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ),
    notes: 'Cohort leader — consider stretch goal on I\'m Yours.' },

  { name: 'Rahul Kumar',  joined: 'Joined Nov 19', avatar: 'RK', avatarType: 'alert',
    current: 'Sunshine',   todayPlays: 1, dailyTarget: 4, approvedDays: 2, targetApprovals: 7,
    streak: 2,  flag: 'stuck', flagText: 'F chord buzzing', barColor: 'terracotta',
    attendance: ['present','absent','present','late','present','upcoming'],
    totalPlays: 34,
    workload: wl(
      ['in-progress',35,28], ['locked',0,0], ['locked',0,0],
      ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ),
    notes: 'Spend 5 min on F-chord placement at start of class.' },

  { name: 'Sara Khan',    joined: 'Joined Nov 12', avatar: 'SK', avatarType: '',
    current: 'Sunshine',   todayPlays: 3, dailyTarget: 4, approvedDays: 4, targetApprovals: 7,
    streak: 8,  flag: 'recording', flagText: 'New recording', barColor: '',
    attendance: ['present','present','late','present','present','upcoming'],
    totalPlays: 82,
    workload: wl(
      ['in-progress',68,36], ['next',0,0], ['locked',0,0],
      ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0], ['locked',0,0],
    ) },
];

export interface Recording {
  name: string;
  song: string;
  bars: number;
  days: string;
}

export const RECORDINGS: Recording[] = [
  { name: 'Aarav', song: 'Photograph · Verse 1',     bars: 32, days: '2h ago' },
  { name: 'Karan', song: 'Sunshine · full song',     bars: 24, days: '5h ago' },
  { name: 'Aditi', song: 'Photograph · Chorus',      bars: 30, days: '1d ago' },
  { name: 'Sara',  song: 'Sunshine · Verse 2',       bars: 22, days: '1d ago' },
  { name: 'Aarav', song: 'Photograph · transitions', bars: 28, days: '2d ago' },
  { name: 'Karan', song: 'Sunshine · Chorus',        bars: 26, days: '3d ago' }
];
