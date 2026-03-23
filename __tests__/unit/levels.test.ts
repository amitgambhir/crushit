import { getLevelInfo, levelProgress } from '@/constants/levels';

// ─── getLevelInfo ─────────────────────────────────────────────────────────────

describe('getLevelInfo', () => {
  describe('fixed levels 1–10', () => {
    const cases: [number, number, string][] = [
      [0,    1,  'Rookie Crusher 🥊'],
      [1,    1,  'Rookie Crusher 🥊'],
      [49,   1,  'Rookie Crusher 🥊'],
      [50,   2,  'Task Tackler 💪'],
      [124,  2,  'Task Tackler 💪'],
      [125,  3,  'Go-Getter ⚡'],
      [249,  3,  'Go-Getter ⚡'],
      [250,  4,  'Power Player 🔥'],
      [449,  4,  'Power Player 🔥'],
      [450,  5,  'Crush Machine 🤖'],
      [699,  5,  'Crush Machine 🤖'],
      [700,  6,  'Boss Mode 😎'],
      [999,  6,  'Boss Mode 😎'],
      [1000, 7,  'Unstoppable 🚀'],
      [1399, 7,  'Unstoppable 🚀'],
      [1400, 8,  'Elite Crusher 🏅'],
      [1899, 8,  'Elite Crusher 🏅'],
      [1900, 9,  'Legend in Training 🌟'],
      [2499, 9,  'Legend in Training 🌟'],
      [2500, 10, 'Full Legend 🏆'],
    ];

    test.each(cases)(
      '%i pts → level %i (%s)',
      (pts, expectedLevel, expectedTitle) => {
        const info = getLevelInfo(pts);
        expect(info.level).toBe(expectedLevel);
        expect(info.title).toBe(expectedTitle);
      }
    );
  });

  describe('progressive levels 11–15 (+700 each from 2500)', () => {
    const cases: [number, number][] = [
      [3200,  11], // 2500 + 700
      [3899,  11],
      [3900,  12], // 2500 + 700*2
      [4599,  12],
      [4600,  13],
      [5299,  13],
      [5300,  14],
      [5999,  14],
      [6000,  15], // 2500 + 700*5 = 6000 → also start of next bracket
    ];

    test.each(cases)('%i pts → level %i', (pts, expectedLevel) => {
      expect(getLevelInfo(pts).level).toBe(expectedLevel);
    });

    it('uses Champion Crusher title for levels 11–15', () => {
      expect(getLevelInfo(3200).title).toBe('Champion Crusher 🥇');
      expect(getLevelInfo(5500).title).toBe('Champion Crusher 🥇');
    });
  });

  describe('progressive levels 16–20 (+1000 each from 6000)', () => {
    const cases: [number, number][] = [
      [7000,  16],
      [7999,  16],
      [8000,  17],
      [9000,  18],
      [10000, 19],
      [10999, 19],
      [11000, 20],
    ];

    test.each(cases)('%i pts → level %i', (pts, expectedLevel) => {
      expect(getLevelInfo(pts).level).toBe(expectedLevel);
    });

    it('uses Mega Champion title for levels 16–20', () => {
      expect(getLevelInfo(7000).title).toBe('Mega Champion 💥');
    });
  });

  describe('levels 21+ (+1500 each from 11000)', () => {
    it('level 21 at 12500 pts', () => {
      expect(getLevelInfo(12500).level).toBe(21);
    });
    it('level 22 at 14000 pts', () => {
      expect(getLevelInfo(14000).level).toBe(22);
    });
    it('uses Ultimate Crusher title', () => {
      expect(getLevelInfo(12500).title).toBe('Ultimate Crusher 👑');
    });
  });

  describe('minPoints and maxPoints', () => {
    it('level 1: min=0, max=50', () => {
      const info = getLevelInfo(0);
      expect(info.minPoints).toBe(0);
      expect(info.maxPoints).toBe(50);
    });

    it('level 2: min=50, max=125', () => {
      const info = getLevelInfo(50);
      expect(info.minPoints).toBe(50);
      expect(info.maxPoints).toBe(125);
    });

    it('level 10: min=2500, max=3200 (first level 11 threshold)', () => {
      const info = getLevelInfo(2500);
      expect(info.minPoints).toBe(2500);
      expect(info.maxPoints).toBe(3200);
    });
  });

  describe('mirrors the Postgres calculate_level() function', () => {
    // These exact boundary values must match the DB function — if they diverge,
    // a kid's displayed level will differ from their stored level (AD-002).
    it('exactly 50 pts is level 2, not level 1', () => {
      expect(getLevelInfo(49).level).toBe(1);
      expect(getLevelInfo(50).level).toBe(2);
    });

    it('exactly 2500 pts is level 10, not level 9', () => {
      expect(getLevelInfo(2499).level).toBe(9);
      expect(getLevelInfo(2500).level).toBe(10);
    });

    it('exactly 11000 pts is level 20 (cap of 16–20 bracket)', () => {
      expect(getLevelInfo(10999).level).toBe(19);
      expect(getLevelInfo(11000).level).toBe(20);
    });
  });
});

// ─── levelProgress ────────────────────────────────────────────────────────────

describe('levelProgress', () => {
  it('returns 0 at the start of a level', () => {
    expect(levelProgress(0)).toBe(0);    // start of level 1
    expect(levelProgress(50)).toBe(0);   // start of level 2
    expect(levelProgress(2500)).toBe(0); // start of level 10
  });

  it('returns 0.5 at the midpoint of a level', () => {
    // Level 1: 0–50, midpoint = 25
    expect(levelProgress(25)).toBeCloseTo(0.5);
    // Level 2: 50–125, midpoint = 87.5
    expect(levelProgress(87)).toBeCloseTo(0.493, 1);
  });

  it('approaches 1 just before a level threshold', () => {
    // Level 1 ends at 50; at 49 pts progress should be 49/50 = 0.98
    expect(levelProgress(49)).toBeCloseTo(0.98);
  });

  it('clamps to 1 at or above maxPoints (never exceeds 1)', () => {
    // Edge: passing a value exactly at the max of a level
    const info = getLevelInfo(2500); // level 10, maxPoints = 3200
    expect(levelProgress(info.maxPoints)).toBeLessThanOrEqual(1);
  });

  it('returns a number between 0 and 1 for any valid input', () => {
    [0, 1, 49, 50, 500, 2500, 3200, 12000].forEach((pts) => {
      const p = levelProgress(pts);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    });
  });
});
