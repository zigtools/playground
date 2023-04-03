export class Sharer {
    public indexBuffer: SharedArrayBuffer;
    public lockBuffer: SharedArrayBuffer;
    public stdinBlockBuffer: SharedArrayBuffer;
    public dataBuffer: SharedArrayBuffer;

    static init(): Sharer {
        var sharer = new Sharer();
        sharer.indexBuffer = new SharedArrayBuffer(4);
        sharer.lockBuffer = new SharedArrayBuffer(4);
        sharer.stdinBlockBuffer = new SharedArrayBuffer(4);
        sharer.dataBuffer = new SharedArrayBuffer(4096 * 16);
        return sharer;
    }

    get index(): number {
        return Atomics.load(new Uint32Array(this.indexBuffer), 0);
    }
    
    set index(value: number) {
        Atomics.store(new Uint32Array(this.indexBuffer), 0, value);
    }
    
    lock() {
        try {
            // spin until open
            Atomics.wait(new Int32Array(this.lockBuffer), 0, 1);
        } catch {}
        // lock it
        Atomics.store(new Int32Array(this.lockBuffer), 0, 1);
    }
    
    unlock() {
        Atomics.store(new Int32Array(this.lockBuffer), 0, 0);
        Atomics.notify(new Int32Array(this.lockBuffer), 0);
    }
}