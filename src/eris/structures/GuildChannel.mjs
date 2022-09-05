import Base from "./Base.mjs";
import Collection from '../../util/Collection.mjs'
import Permission from "./Permission.mjs";
import { Permissions } from "../Constants.mjs";
import PermissionOverwrite from "./PermissionOverwrite.mjs";
import Message from "./Message.mjs";
// const Message = require("./Message");

/**
* Represents a guild channel. You also probably want to look at CategoryChannel, NewsChannel, StoreChannel, TextChannel, and TextVoiceChannel. See Channel for extra properties.
* @extends Channel
* @prop {Guild} guild The guild that owns the channel
* @prop {String} id The ID of the channel
* @prop {String} name The name of the channel
* @prop {Boolean} nsfw Whether the channel is an NSFW channel or not
* @prop {String?} parentID The ID of the category this channel belongs to or the channel ID where the thread originated from (thread channels only)
* @prop {Collection<PermissionOverwrite>} permissionOverwrites Collection of PermissionOverwrites in this channel
* @prop {Number} position The position of the channel
*/
export default class GuildChannel extends Base {
    constructor(data, client) {
        super(data.id, client);
        this.messages = new Collection(Message, client.options.messageLimit);
        this.type = data.type;
        this.guild = client.guilds.get(data.guild_id) || {
            id: data.guild_id
        };

        this.update(data);
    }

    update(data) {
        if(data.type !== undefined) {
            this.type = data.type;
        }
        if(data.name !== undefined) {
            this.name = data.name;
        }
        if(data.position !== undefined) {
            this.position = data.position;
        }
        if(data.parent_id !== undefined) {
            this.parentID = data.parent_id;
        }
        if(data.permission_overwrites) {
            this.permissionOverwrites = new Collection(PermissionOverwrite);
            data.permission_overwrites.forEach((overwrite) => {
                this.permissionOverwrites.add(overwrite);
            });
        }
        
    }

    /**
    * Get the channel-specific permissions of a member
    * @arg {String | Member | Object} memberID The ID of the member or a Member object
    * @returns {Permission}
    */
    permissionsOf(memberID) {
        const member = typeof memberID === "string" ? this.guild.members.get(memberID) : memberID;
        let permission = this.guild.permissionsOf(member).allow;
        if(permission & Permissions.administrator) {
            return new Permission(Permissions.all);
        }
        const channel = (this.type === 10 || this.type === 11 || this.type === 12) ? this.guild.channels.get(this.parentID) : this;
        let overwrite = channel && channel.permissionOverwrites.get(this.guild.id);
        if(overwrite) {
            permission = (permission & ~overwrite.deny) | overwrite.allow;
        }
        let deny = 0n;
        let allow = 0n;
        for(const roleID of member.roles) {
            if((overwrite = channel && channel.permissionOverwrites.get(roleID))) {
                deny |= overwrite.deny;
                allow |= overwrite.allow;
            }
        }
        permission = (permission & ~deny) | allow;
        overwrite = channel && channel.permissionOverwrites.get(member.id);
        if(overwrite) {
            permission = (permission & ~overwrite.deny) | overwrite.allow;
        }
        return new Permission(permission);
    }
}