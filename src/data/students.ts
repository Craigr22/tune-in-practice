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
}

export const STUDENTS: Student[] = [
  { name: 'Aarav Mehta',  joined: 'Joined Nov 12', avatar: 'AM', avatarType: 'star',
    current: 'Photograph', todayPlays: 5, dailyTarget: 5, approvedDays: 5, targetApprovals: 7,
    streak: 14, flag: 'recording', flagText: 'New recording', barColor: 'olive' },
  { name: 'Priya Sharma', joined: 'Joined Nov 12', avatar: 'PS', avatarType: '',
    current: 'Sunshine',   todayPlays: 4, dailyTarget: 4, approvedDays: 4, targetApprovals: 7,
    streak: 9,  flag: 'steady',    flagText: 'On track',     barColor: '' },
  { name: 'Vikram Iyer',  joined: 'Joined Nov 12', avatar: 'VI', avatarType: '',
    current: 'Sunshine',   todayPlays: 3, dailyTarget: 4, approvedDays: 3, targetApprovals: 7,
    streak: 7,  flag: 'steady',    flagText: 'On track',     barColor: '' },
  { name: 'Nisha Reddy',  joined: 'Joined Nov 19', avatar: 'NR', avatarType: 'alert',
    current: 'Sunshine',   todayPlays: 0, dailyTarget: 4, approvedDays: 1, targetApprovals: 7,
    streak: 0,  flag: 'behind',    flagText: 'No practice 4d', barColor: 'terracotta' },
  { name: 'Karan Joshi',  joined: 'Joined Nov 12', avatar: 'KJ', avatarType: '',
    current: 'Sunshine',   todayPlays: 4, dailyTarget: 4, approvedDays: 5, targetApprovals: 7,
    streak: 12, flag: 'recording', flagText: 'New recording', barColor: 'olive' },
  { name: 'Aditi Bose',   joined: 'Joined Nov 12', avatar: 'AB', avatarType: 'star',
    current: 'Photograph', todayPlays: 5, dailyTarget: 5, approvedDays: 6, targetApprovals: 7,
    streak: 18, flag: 'streak',    flagText: '18-day streak', barColor: 'olive' },
  { name: 'Rahul Kumar',  joined: 'Joined Nov 19', avatar: 'RK', avatarType: 'alert',
    current: 'Sunshine',   todayPlays: 1, dailyTarget: 4, approvedDays: 2, targetApprovals: 7,
    streak: 2,  flag: 'stuck',     flagText: 'F chord buzzing', barColor: 'terracotta' },
  { name: 'Sara Khan',    joined: 'Joined Nov 12', avatar: 'SK', avatarType: '',
    current: 'Sunshine',   todayPlays: 3, dailyTarget: 4, approvedDays: 4, targetApprovals: 7,
    streak: 8,  flag: 'recording', flagText: 'New recording', barColor: '' }
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
