import Base from "./Base.mjs";

/**
* Represents a thread member
* @prop {Number} flags The user-thread settings of this member
* @prop {Member?} guildMember The guild member that this thread member belongs to. This will never be present when fetching over REST
* @prop {String} id The ID of the thread member
* @prop {Number} joinTimestamp Timestamp of when the member joined the thread
* @prop {String} threadID The ID of the thread this member is a part of
*/
export default class ThreadMember extends Base {
    constructor(data, client) {
        super(data.user_id);
        this.threadID = data.thread_id || data.id; // Thanks Discord
        this.joinTimestamp = Date.parse(data.join_timestamp);

        if(data.guild_member !== undefined) {
            const guild = this.client.guilds.get(this.client.threadGuildMap[this.threadID]);
            this.guildMember = guild.members.update(data.guild_member, guild);
            if(data.presence !== undefined) {
                this.guildMember.update(data.presence);
            }
        }

        this.update(data);
    }

    update(data) {
        if(data.flags !== undefined) {
            this.flags = data.flags;
        }
    }

}