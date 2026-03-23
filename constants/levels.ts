// Level thresholds — mirrors calculate_level() in 001_initial_schema.sql (AD-002).
// UI uses this for progress bars and level titles. DB is the source of truth for
// the actual level value stored on the profile.

export interface LevelInfo {
  level: number;
  title: string;
  minPoints: number;
  maxPoints: number; // points needed to reach NEXT level (Infinity for last defined)
}

const FIXED_LEVELS: Array<{ level: number; title: string; min: number }> = [
  { level: 1,  title: 'Rookie Crusher 🥊',       min: 0 },
  { level: 2,  title: 'Task Tackler 💪',          min: 50 },
  { level: 3,  title: 'Go-Getter ⚡',             min: 125 },
  { level: 4,  title: 'Power Player 🔥',          min: 250 },
  { level: 5,  title: 'Crush Machine 🤖',         min: 450 },
  { level: 6,  title: 'Boss Mode 😎',             min: 700 },
  { level: 7,  title: 'Unstoppable 🚀',           min: 1000 },
  { level: 8,  title: 'Elite Crusher 🏅',         min: 1400 },
  { level: 9,  title: 'Legend in Training 🌟',    min: 1900 },
  { level: 10, title: 'Full Legend 🏆',           min: 2500 },
];

export function getLevelInfo(lifetimePoints: number): LevelInfo {
  let level = 1;
  let title = FIXED_LEVELS[0].title;
  let minPoints = 0;

  // Levels 1–10
  for (const l of FIXED_LEVELS) {
    if (lifetimePoints >= l.min) {
      level = l.level;
      title = l.title;
      minPoints = l.min;
    }
  }

  // Levels 11–15 (+700 each from 2500)
  if (lifetimePoints >= 2500) {
    const extra = Math.floor((lifetimePoints - 2500) / 700);
    const add = Math.min(extra, 5);
    if (add > 0) {
      level = 10 + add;
      title = 'Champion Crusher 🥇';
      minPoints = 2500 + (add - 1) * 700;
    }
  }

  // Levels 16–20 (+1000 each from 6000)
  if (lifetimePoints >= 6000) {
    const extra = Math.floor((lifetimePoints - 6000) / 1000);
    const add = Math.min(extra, 5);
    if (add > 0) {
      level = 15 + add;
      title = 'Mega Champion 💥';
      minPoints = 6000 + (add - 1) * 1000;
    }
  }

  // Levels 21+ (+1500 each from 11000)
  if (lifetimePoints >= 11000) {
    const extra = Math.floor((lifetimePoints - 11000) / 1500);
    if (extra > 0) {
      level = 20 + extra;
      title = 'Ultimate Crusher 👑';
      minPoints = 11000 + (extra - 1) * 1500;
    }
  }

  // Calculate maxPoints (start of next level)
  let maxPoints: number;
  if (level < 10) {
    maxPoints = FIXED_LEVELS[level].min;
  } else if (level < 15) {
    maxPoints = 2500 + (level - 10 + 1) * 700;
  } else if (level < 20) {
    maxPoints = 6000 + (level - 15 + 1) * 1000;
  } else {
    maxPoints = 11000 + (level - 20 + 1) * 1500;
  }

  return { level, title, minPoints, maxPoints };
}

export function levelProgress(lifetimePoints: number): number {
  const { minPoints, maxPoints } = getLevelInfo(lifetimePoints);
  if (maxPoints === Infinity) return 1;
  return Math.min((lifetimePoints - minPoints) / (maxPoints - minPoints), 1);
}
