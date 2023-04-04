const locked = 1;
const unlocked = 0;

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
    
    // https://blogtitle.github.io/using-javascript-sharedarraybuffers-and-atomics/
    lock() {
        while (true) {
            if (Atomics.compareExchange(new Int32Array(this.lockBuffer), 0, unlocked, locked) == unlocked) {
                return;
            }

            try {
                // Main thread can't be blocked with wait...
                // so we just block it with this while true :P
                Atomics.wait(new Int32Array(this.lockBuffer), 0, locked);
            } catch {}
        }
    }
    
    unlock() {
        if (Atomics.compareExchange(new Int32Array(this.lockBuffer), 0, locked, unlocked) != locked) {
            throw new Error("Mutex is in inconsistent state: unlock on unlocked Mutex.");
        }
        Atomics.notify(new Int32Array(this.lockBuffer), 0, 1);      
    }
}