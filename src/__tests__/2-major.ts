import { expect, test } from '@jest/globals';

import { parseLock } from '../utils';

test('parse major', () => {
  const parsed = parseLock('src/__tests__/locks/2-major.yaml');
  expect(parsed).toMatchSnapshot();
});
