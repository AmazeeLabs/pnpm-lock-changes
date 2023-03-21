It was an attempt to re-write https://github.com/Simek/yarn-lock-changes for pnpm

I tried WIP on silverback-mono lock files and decided to drop the idea:

- the diffs are huge
- it's hard to generate a proper diff: there can be multiple versions of the same package in the lockfile
- the result diff won't say which workspace is affected by each change
