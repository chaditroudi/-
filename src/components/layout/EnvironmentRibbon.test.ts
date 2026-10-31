import { describe, expect, it } from 'vitest';

import { describeEnvironment } from '@/lib/environmentLabel';

describe('describeEnvironment', () => {
  it('stays out of the way in production', () => {
    expect(describeEnvironment({ environment: 'production' })).toBeNull();
  });

  it.each([
    ['test', /fictives/],
    ['dev', /fictives/],
    ['staging', /Préproduction/],
    ['live-dev', /base réelle/],
  ])('names %s', (environment, label) => {
    expect(describeEnvironment({ environment })).toMatch(label);
  });

  it('warns about a stack that never declared itself', () => {
    expect(describeEnvironment({ environment: null, database_host_class: 'remote' })).toMatch(/base distante/);
    expect(describeEnvironment({ environment: null, database_host_class: 'local' })).toMatch(/non déclaré/);
  });

  it('warns when an older API sends nothing', () => {
    expect(describeEnvironment({})).toMatch(/non déclaré/);
  });
});
