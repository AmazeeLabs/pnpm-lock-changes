import { expect, test } from '@jest/globals';

import { parseLock } from '../utils';

test('parse minor', () => {
  const parsed = parseLock('src/__tests__/locks/3-minor.yaml');
  expect(parsed).toMatchSnapshot();
});
