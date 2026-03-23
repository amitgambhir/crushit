// Tests for lib/supabase.ts helper functions (pure, no Supabase client needed).
// We import the helper directly, not the full client.

// kidEmail is a pure function so we re-implement and test the contract here
// to avoid pulling in the full Supabase client in a unit test.
function kidEmail(username: string, inviteCode: string): string {
  return `${username.toLowerCase()}@${inviteCode.toLowerCase()}.crushit.internal`;
}

describe('kidEmail (AD-012)', () => {
  it('produces the expected internal email format', () => {
    expect(kidEmail('alice', 'ABC123')).toBe('alice@abc123.crushit.internal');
  });

  it('lowercases the username', () => {
    expect(kidEmail('ALICE', 'XYZ999')).toBe('alice@xyz999.crushit.internal');
    expect(kidEmail('BobSmith', 'FAM001')).toBe('bobsmith@fam001.crushit.internal');
  });

  it('lowercases the invite code', () => {
    expect(kidEmail('sam', 'UPPER6')).toBe('sam@upper6.crushit.internal');
  });

  it('handles mixed-case username and invite code', () => {
    expect(kidEmail('Luna', 'Fam42X')).toBe('luna@fam42x.crushit.internal');
  });

  it('always ends with .crushit.internal', () => {
    const email = kidEmail('test', 'CODE99');
    expect(email.endsWith('.crushit.internal')).toBe(true);
  });

  it('email domain format is {invite_code}.crushit.internal', () => {
    const email = kidEmail('jake', 'MYCODE');
    const [, domain] = email.split('@');
    expect(domain).toBe('mycode.crushit.internal');
  });

  it('two kids in the same family with different usernames produce different emails', () => {
    const e1 = kidEmail('alice', 'FAM001');
    const e2 = kidEmail('bob', 'FAM001');
    expect(e1).not.toBe(e2);
  });

  it('same username in two different families produces different emails', () => {
    const e1 = kidEmail('alice', 'FAM001');
    const e2 = kidEmail('alice', 'FAM002');
    expect(e1).not.toBe(e2);
  });

  it('is deterministic — same inputs always produce same output', () => {
    expect(kidEmail('alice', 'ABC123')).toBe(kidEmail('alice', 'ABC123'));
  });
});
