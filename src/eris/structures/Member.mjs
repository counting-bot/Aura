import Base from "./Base.mjs";
import User from "./User.mjs";

/**
* Represents a server member
* @prop {Number?} accentColor The user's banner color, or null if no banner color (REST only)
* @prop {Array<Object>?} activities The member's current activities
* @prop {String?} avatar The hash of the member's guild avatar, or null if no guild avatar
* @prop {String} avatarURL The URL of the user's avatar which can be either a JPG or GIF
* @prop {String?} banner The hash of the user's banner, or null if no banner (REST only)
* @prop {String?} bannerURL The URL of the user's banner
* @prop {Boolean} bot Whether the user is an OAuth bot or not
* @prop {Object?} clientStatus The member's per-client status
* @prop {String} clientStatus.web The member's status on web. Either "online", "idle", "dnd", or "offline". Will be "online" for bots
* @prop {String} clientStatus.desktop The member's status on desktop. Either "online", "idle", "dnd", or "offline". Will be "offline" for bots
* @prop {String} clientStatus.mobile The member's status on mobile. Either "online", "idle", "dnd", or "offline". Will be "offline" for bots
* @prop {Number?} communicationDisabledUntil Timestamp of timeout expiry. If `null`, the member is not timed out
* @prop {Number} createdAt Timestamp of user creation
* @prop {String} defaultAvatar The hash for the default avatar of a user if there is no avatar set
* @prop {String} defaultAvatarURL The URL of the user's default avatar
* @prop {String} discriminator The discriminator of the user
* @prop {Object?} game The active game the member is playing
* @prop {String} game.name The name of the active game
* @prop {Number} game.type The type of the active game (0 is default, 1 is Twitch, 2 is YouTube)
* @prop {String?} game.url The url of the active game
* @prop {Guild} guild The guild the member is in
* @prop {String} id The ID of the member
* @prop {Number?} joinedAt Timestamp of when the member joined the guild
* @prop {String} mention A string that mentions the member
* @prop {String?} nick The server nickname of the member
* @prop {Boolean?} pending Whether the member has passed the guild's Membership Screening requirements
* @prop {Permission} permission [DEPRECATED] The guild-wide permissions of the member. Use Member#permissions instead
* @prop {Permission} permissions The guild-wide permissions of the member
* @prop {Number?} premiumSince Timestamp of when the member boosted the guild
* @prop {Array<String>} roles An array of role IDs this member is a part of
* @prop {String} staticAvatarURL The URL of the user's avatar (always a JPG)
* @prop {String} status The member's status. Either "online", "idle", "dnd", or "offline"
* @prop {User} user The user object of the member
* @prop {String} username The username of the user
*/
export default class Member extends Base {
    constructor(data, guild, client) {
        super(data.id || data.user.id);
        if(!data.id && data.user) {
            data.id = data.user.id;
        }
        if((this.guild = guild)) {
            this.user = guild.shard.client.users.get(data.id);
            if(!this.user && data.user) {
                this.user = guild.shard.client.users.add(data.user, guild.shard.client);
            }
            if(!this.user) {
                throw new Error("User associated with Member not found: " + data.id);
            }
        } else if(data.user) {
            if(!client) {
                this.user = new User(data.user);
            } else {
                this.user = client.users.update(data.user, client);
            }
        } else {
            this.user = null;
        }

        this.roles = [];
        this.update(data);
    }

    update(data) {
        if(data.joined_at !== undefined) {
            this.joinedAt = data.joined_at ?  Date.parse(data.joined_at) : null;
        }
        if(data.roles !== undefined) {
            this.roles = data.roles;
        }
        if(data.avatar !== undefined) {
            this.avatar = data.avatar;
        }
        if(data.communication_disabled_until !== undefined) {
            if(data.communication_disabled_until !== null) {
                this.communicationDisabledUntil = Date.parse(data.communication_disabled_until);
            } else {
                this.communicationDisabledUntil = data.communication_disabled_until;
            }
        }
    }

    get permissions() {
        return this.guild.permissionsOf(this);
    }
}