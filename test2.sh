#!/usr/bin/env bash

set -e

rm -Rf dist/bin/tests/legacy-cli/e2e.esbuild_node22_

yarn bazel build --//tests/legacy-cli:enable_native_windows_testing=true //tests/legacy-cli:e2e.esbuild_node22 --platforms=tools:windows_x64

tar -cf /tmp/test.tar.gz dist/bin/tests/legacy-cli/e2e.esbuild_node22_

mv /tmp/test.tar.gz /mnt/c/Users/paulg/Desktop/test
rm -Rf /mnt/c/Users/paulg/Desktop/test/dist

echo "Extracting.."

(cd /mnt/c/Users/paulg/Desktop/test && pv test.tar.gz | tar -x)

node scripsconvert-symlinks.mjs \
    /mnt/c/Users/paulg/Desktop/test/dist/bin/tests/legacy-cli/e2e.esbuild_node22_/e2e.esbuild_node22.bat.runfiles

(cd /mnt/c/Users/paulg/Desktop/test/dist/bin/tests/legacy-cli/e2e.esbuild_node22_/e2e.esbuild_node22.bat.runfiles/angular_cli && cmd.exe /C "mklink /D external ..")

(cd /mnt/c/Users/paulg/Desktop/test/dist/bin/tests/legacy-cli/e2e.esbuild_node22_/e2e.esbuild_node22.bat.runfiles/angular_cli && /mnt/c/Program\ Files/Git/bin/bash.exe -c "BAZEL_BINDIR=. ../../e2e.esbuild_node22")
