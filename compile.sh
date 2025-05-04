#!/usr/bin/env bash

# Requirements:
# - zig
# - jq
# - tar
# - wasm-opt (binaryen)

set -e

ZIG_SOURCE_TAG="0.14.0"
ZIG_REQUIRED_COMPILER_VERSION="0.14.0"

ZLS_SOURCE_COMMIT="f9b97383206c05626a21b0f24f89630aa91c072b"
ZLS_REQUIRED_COMPILER_VERSION="0.15.0-dev.355+206bd1ced"

if command -v zig >/dev/null 2>&1; then
    ZIG_VERSION=$(zig version) 
    echo "Found Zig $ZIG_VERSION"
else
    echo "zig is not installed or not in PATH"
    exit 1
fi

if command -v jq >/dev/null 2>&1; then
    echo "Found jq"
else
    echo "jq is not installed or not in PATH"
    exit 1
fi

if command -v wasm-opt >/dev/null 2>&1; then
    HAS_WASM_OPT=1;
    echo "Found $(wasm-opt --version)"
else
    echo "wasm-opt is not installed or not in PATH"
fi

compile_zls() {
    if [ "$ZIG_VERSION" != "$ZLS_REQUIRED_COMPILER_VERSION" ]; then
        echo "ZLS must be compiled with Zig $ZLS_REQUIRED_COMPILER_VERSION but got $ZIG_VERSION"
        exit 1
    fi

    if [ ! -d repos/zls ]; then
        git clone https://github.com/zigtools/zls.git repos/zls
        git -C repos/zls checkout --detach $ZLS_SOURCE_COMMIT
    fi
    ( cd repos/zls && zig build -Dtarget=wasm32-wasi -Doptimize=ReleaseSmall )
    if [ -n "$HAS_WASM_OPT" ]; then
        wasm-opt repos/zls/zig-out/bin/zls.wasm -o src/zls.wasm -O --enable-bulk-memory --enable-mutable-globals --enable-nontrapping-float-to-int --enable-sign-ext
    else
        cp repos/zls/zig-out/bin/zls.wasm src/zls.wasm
    fi

    echo "Created src/zls.wasm"
}

compile_zig() {
    if [ "$ZIG_VERSION" != "$ZIG_REQUIRED_COMPILER_VERSION" ]; then
        echo "Zig must be compiled with Zig $ZIG_REQUIRED_COMPILER_VERSION but got $ZIG_VERSION"
        exit 1
    fi

    if [ ! -d repos/zig ]; then
        git clone https://github.com/ziglang/zig.git repos/zig --branch $ZIG_SOURCE_TAG --depth 1
        git -C repos/zig apply ../../zig.patch
    fi
    ( cd repos/zig && zig build -Dtarget=wasm32-wasi -Doptimize=ReleaseSmall -Dno-lib -Ddev=wasm)
    if [ -n "$HAS_WASM_OPT" ]; then
        wasm-opt repos/zig/zig-out/bin/zig.wasm -o src/zig.wasm -O --enable-bulk-memory --enable-mutable-globals --enable-nontrapping-float-to-int --enable-sign-ext
    else
        cp repos/zig/zig-out/bin/zig.wasm src/zig.wasm
    fi

    echo "Created src/zig.wasm"
}

create_zig_tarball() {
    tar -czf src/zig.tar.gz -C $(zig env | jq .lib_dir -r)/.. lib/std

    echo "Created src/zig.tar.gz"
}

case $1 in
  "zls")
    compile_zls
    ;;
  "zig")
    compile_zig
    ;;
  "zig_tarball")
    create_zig_tarball
    ;;

  *)
    exit 1
    ;;
esac
