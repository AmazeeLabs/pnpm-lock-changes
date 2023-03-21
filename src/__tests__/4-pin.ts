import { expect, test } from '@jest/globals';

import { parseLock } from '../utils';

test('parse pin', () => {
  const parsed = parseLock('src/__tests__/locks/4-pin.yaml');
  expect(parsed).toMatchSnapshot();
});
