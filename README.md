# zls in the browser

Works pretty well in a bunch of browsers, but note the required security headers.

## Installing

* Compile zls for `wasm32-wasi` and place `zls.wasm` in `src`
* Additionally, place `zig.tar.gz` (make sure that the name matches) from the website in `src`
  * If you've downloaded Zig and built from source following `ZIG_WASM.md`, you can also use this command:
    ```bash
    tar -C /path/to/zig -cz lib/std >src/zig.tar.gz
    ```

```bash
npm install
npm run serve
```

Enjoy!

## TODOs

- [ ] Stop using `SharedArrayBuffer`s (they're awesome but a nightmare to deploy)
