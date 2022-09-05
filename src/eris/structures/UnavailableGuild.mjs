import Base from "./Base.mjs";

/**
* Represents a guild
* @prop {String} id The ID of the guild
* @prop {Boolean} unavailable Whether the guild is unavailable or not
* @prop {Shard} shard The Shard that owns the guild
*/
export default class UnavailableGuild extends Base {
    constructor(data, client) {
        super(data.id);
        this.shard = client.shards.get(client.guildShardMap[this.id]);
        this.unavailable = !!data.unavailable;
    }
}