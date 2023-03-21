import { markdownTable } from 'markdown-table';

import { Changes, countStatuses, STATUS } from './utils';

const ASSETS_URL = {
  ADDED: 'https://git.io/J38HP',
  DOWNGRADED: 'https://git.io/J38ds',
  REMOVED: 'https://git.io/J38dt',
  UPDATED: 'https://git.io/J38dY',
} as const;

export type Status = keyof typeof ASSETS_URL;

const getStatusLabel = (status: Status) =>
  `[<sub><img alt="${status}" src="${ASSETS_URL[status]}" height="16" /></sub>](#)`;

export const createTable = (lockChanges: Changes, plainStatuses = false) =>
  markdownTable(
    [
      ['Name', 'Status', 'Previous', 'Current'],
      ...Object.entries(lockChanges)
        .map(([key, { status, previous, current }]) => [
          '`' + key + '`',
          plainStatuses ? status : getStatusLabel(status),
          previous,
          current,
        ])
        .sort((a, b) => a[0].localeCompare(b[0])),
    ],
    { align: ['l', 'c', 'c', 'c'], alignDelimiters: false },
  );

const createSummaryRow = (lockChanges: Changes, status: Status) => {
  const statusCount = countStatuses(lockChanges, status);
  return statusCount
    ? [getStatusLabel(status), statusCount.toString()]
    : undefined;
};

export const createSummary = (lockChanges: Changes) => {
  return markdownTable(
    [
      ['Status', 'Count'],
      createSummaryRow(lockChanges, STATUS.ADDED),
      createSummaryRow(lockChanges, STATUS.UPDATED),
      createSummaryRow(lockChanges, STATUS.DOWNGRADED),
      createSummaryRow(lockChanges, STATUS.REMOVED),
    ].filter(isTruthy),
    {
      align: ['l', 'c'],
      alignDelimiters: false,
    },
  );
};

function isTruthy<T>(x: T | false | undefined | null | '' | 0): x is T {
  return !!x;
}
