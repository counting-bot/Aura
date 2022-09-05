import Base from "./Base.mjs";
import TextChannel from "./TextChannel.mjs";
import ThreadChannel from "./ThreadChannel.mjs";
import PrivateThreadChannel from "./PrivateThreadChannel.mjs";

/**
* Represents a channel. You also probably want to look at CategoryChannel, GroupChannel, NewsChannel, PrivateChannel, TextChannel, and TextVoiceChannel.
* @prop {Client} client The client that initialized the channel
* @prop {Number} createdAt Timestamp of the channel's creation
* @prop {String} id The ID of the channel
* @prop {String} mention A string that mentions the channel
* @prop {Number} type The type of the channel
*/
export default class Channel extends Base {
    constructor(data, client) {
        super(data.id);
        this.type = data.type;
    }

    static from(data, client) {
        switch(data.type) {
            case 0: {
                return new TextChannel(data, client);
            }
            case 1: {
                return this;
            }
            case 11: {
                return new ThreadChannel(data, client);
            }
            case 12: {
                return new PrivateThreadChannel(data, client);
            }
            default: {
                return;
            }
        }
    }
}