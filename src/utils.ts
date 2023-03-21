import { warning } from '@actions/core';
import semverCoerce from 'semver/functions/coerce';
import semverCompare from 'semver/functions/compare';
import semverValid from 'semver/functions/valid';

type LockParsed = {
  type: 'success' | 'error';
  object: Record<
    string,
    {
      version: string;
      resolved: string;
      integrity: string;
      dependencies?: Record<string, string>;
    }
  >;
};

export type Changes = Record<
  string,
  {
    previous: string;
    current: string;
    status: Status;
  }
>;

type Items = Record<string, { name: string; version: string }>;

export const STATUS = {
  ADDED: 'ADDED',
  DOWNGRADED: 'DOWNGRADED',
  REMOVED: 'REMOVED',
  UPDATED: 'UPDATED',
} as const;

type Status = keyof typeof STATUS;

export const countStatuses = (lockChanges: Changes, statusToCount: Status) =>
  Object.values(lockChanges).filter(({ status }) => status === statusToCount)
    .length;

const formatForNameCompare = (key: string) =>
  key.substr(0, key.lastIndexOf('@'));

const formatForVersionCompare = (key: string) => {
  const version = key.substr(key.lastIndexOf('@') + 1);
  return semverValid(semverCoerce(version)) || '0.0.0';
};

const formatLockEntry = (obj: LockParsed): Items =>
  Object.fromEntries(
    Object.keys(obj.object)
      .sort((a, b) => {
        const nameCompare = formatForNameCompare(a).localeCompare(
          formatForNameCompare(b),
        );
        if (nameCompare === 0) {
          return semverCompare(
            formatForVersionCompare(a),
            formatForVersionCompare(b),
          );
        }
        return nameCompare;
      })
      .map((key) => {
        const nameParts = key.split('@');
        const name = nameParts[0] === '' ? '@' + nameParts[1] : nameParts[0];
        return [name, { name, version: obj.object[key].version }];
      }),
  );

const detectYarnVersion = (
  lines: Array<string>,
): {
  version?: number;
  skipLines?: number;
} => {
  if (lines[1].includes('v1')) {
    return {
      version: 1,
      skipLines: 4,
    };
  } else if (lines[4].includes('version:')) {
    const lockVersion = parseInt(lines[4].split('version: ')[1]);
    return {
      version: lockVersion <= 4 ? 2 : 3,
      skipLines: 7,
    };
  }
  return {
    version: undefined,
    skipLines: undefined,
  };
};

const constructClassicEntry = (entryLines: Array<string>) => {
  const keys = entryLines[0].replaceAll(':', '').split(',');

  const dependencies = entryLines[4]
    ? Object.assign(
        {},
        ...entryLines.splice(5).map((dependencyLine) => {
          const parts = dependencyLine.trim().split(' ');
          if (parts.length === 2) {
            return {
              [parts[0]]: parts[1],
            };
          } else {
            return {};
          }
        }),
      )
    : undefined;

  const entryObject = {
    version: entryLines[1].split('version ')[1],
    resolved: entryLines[2].split('resolved ')[1],
    integrity: entryLines[3].split('integrity ')[1],
    dependencies,
  };

  return Object.assign(
    {},
    ...keys.map((key) => ({ [key.trim()]: entryObject })),
  );
};

const constructBerryEntry = (entryLines: Array<string>) => {
  const keys = entryLines[0]
    .replaceAll('@npm:', '@')
    .replaceAll('@yarn:', '@')
    .replaceAll('@workspace:', '@')
    .replaceAll(':', '')
    .split(',');

  const version = entryLines[1].split('version: ')[1];
  const isLocal = version.includes('use.local');

  const endFields = entryLines.splice(isLocal ? -3 : -4);
  const peerBlockStart = entryLines.findIndex((entry) =>
    entry.includes('peerDependencies:'),
  );
  const peerFields =
    peerBlockStart !== -1
      ? entryLines.splice(-(entryLines.length - peerBlockStart))
      : undefined;

  const dependencies = entryLines[3]?.includes('dependencies:')
    ? Object.assign({}, ...entryLines.splice(4).map(parseDependencyLine))
    : undefined;

  const peerBlockEnd =
    peerFields?.findIndex((entry) => entry.includes('peerDependenciesMeta:')) ||
    0;
  const peerDependencies =
    peerFields && peerFields[0]?.includes('peerDependencies:')
      ? Object.assign(
          {},
          ...peerFields
            .splice(-(peerFields.length - peerBlockEnd))
            .map(parseDependencyLine),
        )
      : undefined;

  const integrity = !isLocal && endFields[0].split('checksum: ')[1];
  const resolution = entryLines[2].split('resolution: ')[1];

  const entryObject = {
    version,
    resolved: resolution.includes('@workspace:') ? 'workspace' : resolution,
    integrity,
    language: endFields[isLocal ? 0 : 1].split('languageName: ')[1],
    link: endFields[isLocal ? 1 : 2].split('linkType: ')[1],
    dependencies,
    peerDependencies,
  };

  return Object.assign(
    {},
    ...keys.map((key) => ({ [key.trim()]: entryObject })),
  );
};

const parseDependencyLine = (dependencyLine: string) => {
  const parts = dependencyLine.trim().split(' ');
  if (parts.length === 2) {
    return {
      [parts[0]]: parts[1],
    };
  } else {
    return {};
  }
};

export const parseLock = (content: string): LockParsed => {
  const lines = content.replaceAll('\r', '').replaceAll('"', '').split('\n');

  const metadata = detectYarnVersion(lines);

  if (!metadata) {
    warning(
      'Unsupported Yarn lock version! Please report this issue in the action repository.',
    );
    return {
      type: 'error',
      object: {},
    };
  }

  const cleanedLines = lines.slice(metadata.skipLines);
  const maxIndex = cleanedLines.length - 1;

  // @ts-ignore
  const entryChunks = [];
  // @ts-ignore
  cleanedLines.reduce((previousValue, currentValue, currentIndex) => {
    if (currentValue !== '' && currentIndex !== maxIndex) {
      return [...previousValue, currentValue];
    } else {
      entryChunks.push([...previousValue, currentValue]);
      return [];
    }
  }, []);

  // @ts-ignore
  const result = entryChunks
    .filter((entryLines) => entryLines.length >= 4)
    .map((entryLines) =>
      metadata.version === 1
        ? constructClassicEntry(entryLines)
        : constructBerryEntry(entryLines),
    )
    .filter(Boolean);

  // Retain the official parser result structure for a while
  return {
    type: 'success',
    object: Object.assign({}, ...result),
  };
};

export const diffLocks = (previous: LockParsed, current: LockParsed) => {
  const changes: Changes = {};
  const previousPackages = formatLockEntry(previous);
  const currentPackages = formatLockEntry(current);

  Object.keys(previousPackages).forEach((key) => {
    changes[key] = {
      previous: previousPackages[key].version,
      current: '-',
      status: STATUS.REMOVED,
    };
  });

  Object.keys(currentPackages).forEach((key) => {
    if (!changes[key]) {
      changes[key] = {
        previous: '-',
        current: currentPackages[key].version,
        status: STATUS.ADDED,
      };
    } else {
      if (changes[key].previous === currentPackages[key].version) {
        delete changes[key];
      } else {
        changes[key].current = currentPackages[key].version;
        if (semverCompare(changes[key].previous, changes[key].current) === 1) {
          changes[key].status = STATUS.DOWNGRADED;
        } else {
          changes[key].status = STATUS.UPDATED;
        }
      }
    }
  });

  return changes;
};
