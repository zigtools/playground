# zls in the browser

Works pretty well in a bunch of browsers, but note the required security headers.

## Installing

* Compile zls for `wasm32-wasi` and place `zls.wasm` in `src`
* Additionally, place `zig.tar` (make sure to un-xz and that the name matches) from the website in `src`

```bash
npm i -g parcel
parcel index.html
```

Enjoy!

## TODOs

- [ ] Stop using `SharedArrayBuffer`s (they're awesome but a nightmare to deploy)
