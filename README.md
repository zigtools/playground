# zls in the browser

Works pretty well in a bunch of browsers, but note the required security headers.

```bash
npm i -g parcel
parcel index.html
```

Make sure to compile zls for `wasm32-wasi` and place `zls.wasm` in `src`. Additionally, place `zig.tar` (make sure to un-xz and that the name matches) from the website in the current directory.

Enjoy!

## TODOs

- [ ] Fix `std` completions in Chrome
- [ ] Stop using `SharedArrayBuffer`s (they're awesome but a nightmare to deploy)
