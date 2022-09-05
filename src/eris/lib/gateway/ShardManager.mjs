import Collection from "../util/Collection.mjs";
import Shard from "./Shard.mjs";

export default class ShardManager extends Collection {
    constructor(client, options = {}) {
        super(Shard);
        this.client = client;

        this.options = Object.assign({
            concurrency: 1
        }, options);

        this.buckets = new Map();
        this.connectQueue = [];
        this.connectTimeout = null;
    }

    connect(shard) {
        this.connectQueue.push(shard);
        this.tryConnect();
    }

    setConcurrency(concurrency) {
        this.options.concurrency = concurrency;
    }

    spawn(id) {
        let shard = this.get(id);
        if(!shard) {
            shard = this.add(new Shard(id, this.client));
            shard.on("ready", () => {
                /**
                * Fired when a shard turns ready
                * @event Client#shardReady
                * @prop {Number} id The ID of the shard
                */
                this.client.emit("shardReady", shard.id);
                if(this.client.ready) {
                    return;
                }
                for(const other of this.values()) {
                    if(!other.ready) {
                        return;
                    }
                }
                this.client.ready = true;
                this.client.startTime = Date.now();
                /**
                * Fired when all shards turn ready
                * @event Client#ready
                */
                this.client.emit("ready");
            }).on("resume", () => {
                /**
                * Fired when a shard resumes
                * @event Client#shardResume
                * @prop {Number} id The ID of the shard
                */
                this.client.emit("shardResume", shard.id);
                if(this.client.ready) {
                    return;
                }
                for(const other of this.values()) {
                    if(!other.ready) {
                        return;
                    }
                }
                this.client.ready = true;
                this.client.startTime = Date.now();
                this.client.emit("ready");
            }).on("disconnect", (error) => {
                /**
                * Fired when a shard disconnects
                * @event Client#shardDisconnect
                * @prop {Error?} error The error, if any
                * @prop {Number} id The ID of the shard
                */
                this.client.emit("shardDisconnect", error, shard.id);
                for(const other of this.values()) {
                    if(other.ready) {
                        return;
                    }
                }
                this.client.ready = false;
                this.client.startTime = 0;
                /**
                * Fired when all shards disconnect
                * @event Client#disconnect
                */
                this.client.emit("disconnect");
            });
        }
        if(shard.status === "disconnected") {
            return this.connect(shard);
        }
    }

    tryConnect() {
        // nothing in queue
        if(this.connectQueue.length === 0) {
            return;
        }

        // loop over the connectQueue
        for(const shard of this.connectQueue) {
            // find the bucket for our shard
            const rateLimitKey = (shard.id % this.options.concurrency) || 0;
            const lastConnect = this.buckets.get(rateLimitKey) || 0;

            // has enough time passed since the last connect for this bucket (5s/bucket)?
            // alternatively if we have a sessionID, we can skip this check
            if(!shard.sessionID && Date.now() - lastConnect < 5000) {
                continue;
            }

            // Are there any connecting shards in the same bucket we should wait on?
            if(this.some((s) => s.connecting && ((s.id % this.options.concurrency) || 0) === rateLimitKey)) {
                continue;
            }

            // connect the shard
            shard.connect();
            this.buckets.set(rateLimitKey, Date.now());

            // remove the shard from the queue
            const index = this.connectQueue.findIndex((s) => s.id === shard.id);
            this.connectQueue.splice(index, 1);
        }

        // set the next timeout if we have more shards to connect
        if(!this.connectTimeout && this.connectQueue.length > 0) {
            this.connectTimeout = setTimeout(() => {
                this.connectTimeout = null;
                this.tryConnect();
            }, 500);
        }
    }

    _readyPacketCB(shardID) {
        const rateLimitKey = (shardID % this.options.concurrency) || 0;
        this.buckets.set(rateLimitKey, Date.now());

        this.tryConnect();
    }
}