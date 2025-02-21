/**
 * @fileoverview Script that takes a directory and converts all its Unix symlinks
 * to relative Windows-compatible symlinks. This is necessary because when building
 * tests via Bazel inside WSL; the output cannot simply be used outside WSL to perform
 * native Windows testing. This is a known limitation/bug of the WSL <> Windows interop.
 *
 * Symlinks are commonly used by Bazel inside the `.runfiles` directory, which is relevant
 * for executing tests outside Bazel on the host machine. In addition, `rules_js` heavily
 * relies on symlinks for node modules.
 *
 * Some more details in: TODO
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import childProcess from 'node:child_process';

const [rootDir, cmdPath] = process.argv.slice(2);

const debug = process.env.DEBUG === '1';
const skipDirectories = [
  // Modules that we don't need and would unnecessarily slow-down this.
  'node22_windows_amd64/bin/nodejs/node_modules',
];

const workspaceRootPaths = [/.*\.runfiles\/angular_cli\//, /^.*-fastbuild\/bin\//];

async function transformDir(p) {
  for (const file of await fs.readdir(p, { withFileTypes: true })) {
    const subPath = path.join(p, file.name);

    if (skipDirectories.some((d) => subPath.endsWith(d))) {
      continue;
    }

    if (file.isDirectory()) {
      await transformDir(subPath);
    } else if (file.isSymbolicLink()) {
      let target = '';
      try {
        target = await fs.realpath(subPath);
      } catch (e) {
        if (debug) {
          console.error('Skipping', subPath);
        }
        continue;
      }

      await fs.rm(subPath);

      const subPathId = relativizeForSimilarWorkspacePaths(subPath);
      const targetPathId = relativizeForSimilarWorkspacePaths(target);
      const isSelfLink = subPathId === targetPathId;

      // This is an actual file that needs to be copied. Copy contents.
      //   - the target path is outside any of our workspace roots.
      //   - the target path is equivalent to the link. This is a self-link from `.runfiles` to `bin/`.
      if (isSelfLink || targetPathId.startsWith('..')) {
        exec(`cp -Rf ${target} ${subPath}`);
        continue;
      }

      const relativeSubPath = relativizeToRoot(subPath);
      const targetAtDestination = path.relative(path.dirname(subPathId), targetPathId);
      const targetAtDestinationWindowsPath = targetAtDestination.replace(/\//g, '\\');

      const wslSubPath = relativeSubPath.replace(/\//g, '\\');

      if (debug) {
        console.log({
          targetAtDestination,
          subPath,
          relativeSubPath,
          target,
          targetPathId,
          subPathId,
        });
      }

      if ((await fs.stat(target)).isDirectory()) {
        // A symlink to a directory, create a dir junction.
        exec(`${cmdPath} /c mklink /d "${wslSubPath}" "${targetAtDestinationWindowsPath}"`);
      } else {
        // A symlink to a file, create a file junction.
        exec(`${cmdPath} /c mklink "${wslSubPath}" "${targetAtDestinationWindowsPath}"`);
      }
    }
  }
}

function exec(cmd) {
  childProcess.execSync(cmd, { cwd: rootDir });
}

function relativizeForSimilarWorkspacePaths(p) {
  const workspaceRootMatch = workspaceRootPaths.find((r) => r.test(p));
  if (workspaceRootMatch !== undefined) {
    return p.replace(workspaceRootMatch, '');
  }

  return path.relative(rootDir, p);
}

function relativizeToRoot(p) {
  const res = path.relative(rootDir, p);
  if (!res.startsWith('..')) {
    return res;
  }

  throw new Error('Could not relativize to root: ' + p);
}

await transformDir(rootDir);
