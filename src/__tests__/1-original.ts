import { expect, test } from '@jest/globals';

import { parseLock } from '../utils';

test('parse original', () => {
  const parsed = parseLock('src/__tests__/locks/1-original.yaml');
  expect(parsed).toMatchSnapshot();
});
