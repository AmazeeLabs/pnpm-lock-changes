import { sync as readYaml } from 'read-yaml-file';
import semverCompare from 'semver/functions/compare';

type LockParsed = Array<{
  name: string;
  version: string | Array<string>;
}>;

export type Changes = Record<
  string,
  {
    previous: string;
    current: string;
    status: Status;
  }
>;

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

export const parseLock = (file: string): LockParsed => {
  const result: LockParsed = [];
  const data: { packages: Record<string, unknown> } = readYaml(file);
  for (const key of Object.keys(data.packages)) {
    const versionIndex = key.lastIndexOf('/');
    const underscoreIndex = key.indexOf('_', versionIndex);
    const trimmed =
      underscoreIndex !== -1 ? key.slice(0, underscoreIndex) : key;
    const name = trimmed.slice(1, versionIndex);
    const version = trimmed.slice(versionIndex + 1);
    const index = result.findIndex((it) => it.name === name);
    if (index === -1) {
      result.push({ name, version });
    } else {
      const existing = result[index];
      if (Array.isArray(existing.version)) {
        if (!existing.version.includes(version)) {
          existing.version.push(version);
        }
      } else {
        if (existing.version !== version) {
          existing.version = [existing.version, version];
        }
      }
    }
  }
  return result;
};

export const diffLocks = (previous: LockParsed, current: LockParsed) => {
  const changes: Changes = {};

  previous.forEach((item) => {
    changes[item.name] = {
      previous: item.version,
      current: '-',
      status: STATUS.REMOVED,
    };
  });

  Object.keys(current).forEach((key) => {
    if (!changes[key]) {
      changes[key] = {
        previous: '-',
        current: current[key].version,
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
