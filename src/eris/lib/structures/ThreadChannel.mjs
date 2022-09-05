import Collection from "../util/Collection.mjs";
import GuildChannel from "./GuildChannel.mjs";
import Message from "./Message.mjs";
import ThreadMember from "./ThreadMember.mjs";

/**
* Represents a thread channel. You also probably want to look at NewsThreadChannel, PublicThreadChannel, and PrivateThreadChannel. See GuildChannel for extra properties.
* @extends GuildChannel
* @prop {String} lastMessageID The ID of the last message in this channel
* @prop {Object?} member Thread member for the current user, if they have joined the thread
* @prop {Number} member.flags The user's thread settings
* @prop {String} member.id The ID of the thread
* @prop {Number} member.joinTimestamp The time the user last joined the thread
* @prop {String} member.userID The ID of the user
* @prop {Number} memberCount An approximate number of users in the thread (stops at 50)
* @prop {Collection<ThreadMember>} members Collection of members in this channel
* @prop {Number} messageCount An approximate number of messages in the thread (stops at 50)
* @prop {Collection<Message>} messages Collection of Messages in this channel
* @prop {String} ownerID The ID of the user that created the thread
* @prop {Number} rateLimitPerUser The ratelimit of the channel, in seconds. 0 means no ratelimit is enabled
* @prop {Object} threadMetadata Metadata for the thread
* @prop {Number} threadMetadata.archiveTimestamp Timestamp when the thread's archive status was last changed, used for calculating recent activity
* @prop {Boolean} threadMetadata.archived Whether the thread is archived
* @prop {Number} threadMetadata.autoArchiveDuration Duration in minutes to automatically archive the thread after recent activity, either 60, 1440, 4320 or 10080
* @prop {Boolean} threadMetadata.locked Whether the thread is locked
*/
export default class ThreadChannel extends GuildChannel {
    constructor(data, client, messageLimit) {
        super(data, client);
        this.messages = new Collection(Message, messageLimit == null ? client.options.messageLimit : messageLimit);
        this.members = new Collection(ThreadMember);
        this.lastMessageID = data.last_message_id || null;
        this.ownerID = data.owner_id;
        this.update(data);
    }

    update(data) {
        super.update(data);
        if(data.member_count !== undefined) {
            this.memberCount = data.member_count;
        }
        if(data.message_count !== undefined) {
            this.messageCount = data.message_count;
        }
        if(data.rate_limit_per_user !== undefined) {
            this.rateLimitPerUser = data.rate_limit_per_user;
        }
        if(data.thread_metadata !== undefined) {
            this.threadMetadata = {
                archiveTimestamp: Date.parse(data.thread_metadata.archive_timestamp),
                archived: data.thread_metadata.archived,
                autoArchiveDuration: data.thread_metadata.auto_archive_duration,
                locked: data.thread_metadata.locked
            };
        }
        if(data.member !== undefined) {
            this.member = new ThreadMember(data.member, this.client);
        }
    }
}