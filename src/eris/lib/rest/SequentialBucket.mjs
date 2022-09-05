export default class SequentialBucket {
    last;
    latencyRef;
    limit;
    processing = false;
    #queue = [];
    remaining;
    reset;
    constructor(limit, latencyRef) {
        this.limit = this.remaining = limit;
        this.latencyRef = latencyRef;
        this.last = this.reset = 0;
    }
    check(force = false) {
        if (this.#queue.length === 0) {
            if (this.processing) {
                if (typeof this.processing !== "boolean")
                    clearTimeout(this.processing);
                this.processing = false;
            }
            return;
        }
        if (this.processing && !force)
            return;
        const now = Date.now();
        const offset = this.latencyRef.latency;
        if (!this.reset || this.reset < now - offset) {
            this.reset = now - offset;
            this.remaining = this.limit;
        }
        this.last = now;
        if (this.remaining <= 0) {
            this.processing = setTimeout(() => {
                this.processing = false;
                this.check(true);
            }, Math.max(0, (this.reset || 0) - now + offset) + 1);
            return;
        }
        --this.remaining;
        this.processing = true;
        this.#queue.shift()(() => {
            if (this.#queue.length > 0)
                this.check(true);
            else
                this.processing = false;
        });
    }
    /**
     * Add an item to the queue.
     * @param func The function to queue.
     * @param priority- If true, the item will be added to the front of the queue/
     */
    queue(func, priority = false) {
        if (priority)
            this.#queue.unshift(func);
        else
            this.#queue.push(func);
        this.check();
    }
}