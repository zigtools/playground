# Zig Playground

Works pretty well in a bunch of browsers, but note the required security headers.

## Installing

You can either:

- Use it online: https://playground.zigtools.org/
- Run it locally:

```bash
npm install
npm run serve
```

Enjoy!

### Update artifacts

For the time being, the following artifacts have been commited to source control:

- `src/zls.wasm` - A build of [ZLS](https://github.com/zigtools/zls) (ReleaseSmall, wasm32-wasi, VERSION_TBA)
- `src/zig.wasm` - A build of [Zig](https://github.com/ziglang/zig) (ReleaseSmall, wasm32-wasi, 0.14.0 with `./zig.patch` applied)
- `src/zig.tar.gz` - The source code of [Zig](https://github.com/ziglang/zig). Only the `lib/std` subdirectory is needed.

The `./compile.sh` script can be used to create these artifacts:

```bash
./compile zls
./compile zig
./compile zig_tarball
```

Compiling Zig and ZLS may require different Zig compiler versions.
