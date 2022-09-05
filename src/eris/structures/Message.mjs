import Base from "./Base.mjs";
import User from "./User.mjs";

/**
* Represents a message
* @prop {Object?} activity The activity specified in the message
* @prop {Object?} application The application of the activity in the message
* @prop {String?} applicationID The ID of the interaction's application
* @prop {Array<Object>} attachments Array of attachments
* @prop {User} author The message author
* @prop {PrivateChannel | TextChannel | NewsChannel} channel The channel the message is in. Can be partial with only the id if the channel is not cached.
* @prop {Array<String>} channelMentions Array of mentions channels' ids
* @prop {String?} cleanContent Message content with mentions replaced by names. Mentions are currently escaped, but this behavior is [DEPRECATED] and will be removed soon. Use allowed mentions, the official way of avoiding unintended mentions, when creating messages.
* @prop {Command?} command The Command used in the Message, if any (CommandClient only)
* @prop {Array<Object>} components An array of component objects
* @prop {String} content Message content
* @prop {Number} createdAt Timestamp of message creation
* @prop {Number?} editedTimestamp Timestamp of latest message edit
* @prop {Array<Object>} embeds Array of embeds
* @prop {Number} flags Message flags (see constants)
* @prop {String} [guildID] The ID of the guild this message is in (undefined if in DMs)
* @prop {String} id The ID of the message
* @prop {String} jumpLink The url used by Discord clients to jump to this message
* @prop {Member?} member The message author with server-specific data
* @prop {Boolean} mentionEveryone Whether the message mentions everyone/here or not
* @prop {Array<User>} mentions Array of mentioned users
* @prop {Object?} messageReference An object containing the reference to the original message if it is a crossposted message or reply
* @prop {String?} messageReference.messageID The id of the original message this message was crossposted from
* @prop {String} messageReference.channelID The id of the channel this message was crossposted from
* @prop {String?} messageReference.guildID The id of the guild this message was crossposted from
* @prop {Object?} interaction An object containing info about the interaction the message is responding to, if applicable
* @prop {String} interaction.id The id of the interaction
* @prop {Number} interaction.type The type of interaction
* @prop {String} interaction.name The name of the command
* @prop {User} interaction.user The user who invoked the interaction
* @prop {Member?} interaction.member The member who invoked the interaction
* @prop {Boolean} pinned Whether the message is pinned or not
* @prop {String?} prefix The prefix used in the Message, if any (CommandClient only)
* @prop {Object} reactions An object containing the reactions on the message. Each key is a reaction emoji and each value is an object with properties `me` (Boolean) and `count` (Number) for that specific reaction emoji.
* @prop {Message?} referencedMessage The message that was replied to. If undefined, message data was not received. If null, the message was deleted.
* @prop {Array<String>} roleMentions Array of mentioned roles' ids
* @prop {Array<Object>?} stickers [DEPRECATED] The stickers sent with the message
* @prop {Array<Object>?} stickerItems The stickers sent with the message
* @prop {Number} timestamp Timestamp of message creation
* @prop {Boolean} tts Whether to play the message using TTS or not
* @prop {Number} type The type of the message
* @prop {String?} webhookID ID of the webhook that sent the message
*/
export default class Message extends Base {
    constructor(data, client) {
        super(data.id);
        // this.client = client;
        this.type = data.type || 0;
        this.timestamp = Date.parse(data.timestamp);
        this.channel = client.getChannel(data.channel_id) || {
            id: data.channel_id
        };
        this.content = "";
        // this.reactions = {};
        this.guildID = data.guild_id;
        this.webhookID = data.webhook_id;

        if(data.message_reference) {
            this.messageReference = {
                messageID: data.message_reference.message_id,
                channelID: data.message_reference.channel_id,
                guildID: data.message_reference.guild_id
            };
        } else {
            this.messageReference = null;
        }

        this.flags = data.flags || 0;

        if(data.author) {
            if(data.author.discriminator !== "0000") {
                this.author = client.users.update(data.author, client);
            } else {
                this.author = new User(data.author, client);
            }
        } else {
            client.emit("error", new Error("MESSAGE_CREATE but no message author:\n" + JSON.stringify(data, null, 2)));
        }
        if(data.referenced_message) {
            const channel = client.getChannel(data.referenced_message.channel_id);
            if(channel) {
                this.referencedMessage = channel.messages.update(data.referenced_message, client);
            } else {
                this.referencedMessage = new Message(data.referenced_message, client);
            }
        } else {
            this.referencedMessage = data.referenced_message;
        }

        if(this.channel.guild) {
            if(data.member) {
                data.member.id = this.author.id;
                if(data.author) {
                    data.member.user = data.author;
                }
                this.member = this.channel.guild.members.update(data.member, this.channel.guild);
            } else if(this.channel.guild.members.has(this.author.id)) {
                this.member = this.channel.guild.members.get(this.author.id);
            } else {
                this.member = null;
            }

            if(!this.guildID) {
                this.guildID = this.channel.guild.id;
            }
        } else {
            this.member = null;
        }
        
        this.update(data, client);
    }

    update(data, client) {
        if(data.content !== undefined) {
            this.content = data.content || "";
            this.mentionEveryone = !!data.mention_everyone;
        }
        if(data.attachments !== undefined) {
            this.attachments = data.attachments;
        }
        if(data.embeds !== undefined) {
            this.embeds = data.embeds;
        }
        if(data.activity !== undefined) {
            this.activity = data.activity;
        }
        if(data.application !== undefined) {
            this.application = data.application;
        }
        if(data.application_id !== undefined) {
            this.applicationID = data.application_id;
        }

        if(data.stickers !== undefined) {
            this.stickers = data.stickers;
        }

        if(data.sticker_items !== undefined) {
            this.stickerItems = data.sticker_items
        }

        if(data.components !== undefined) {
            this.components = data.components;
        }
    }
}