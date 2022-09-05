import Base from "./Base.mjs";
import * as Endpoints from "../rest/Endpoints.mjs";
import Collection from '../../util/Collection.mjs'
import GuildChannel from "./GuildChannel.mjs";
import Member from "./Member.mjs";
import Role from "./Role.mjs";
import Permission from "./Permission.mjs";
import { Permissions } from "../Constants.mjs";
import ThreadChannel from "./ThreadChannel.mjs";

/**
* Represents a guild
* @prop {String?} afkChannelID The ID of the AFK voice channel
* @prop {Number} afkTimeout The AFK timeout in seconds
* @prop {String?} applicationID The application ID of the guild creator if it is bot-created
* @prop {Number?} approximateMemberCount The approximate number of members in the guild (REST only)
* @prop {Number?} approximatePresenceCount The approximate number of presences in the guild (REST only)
* @prop {Boolean?} autoRemoved Whether the guild was automatically removed from Discovery
* @prop {String?} banner The hash of the guild banner image, or null if no banner (VIP only)
* @prop {String?} bannerURL The URL of the guild's banner image
* @prop {Array<Object>?} categories The guild's discovery categories
* @prop {Collection<GuildChannel>} channels Collection of Channels in the guild
* @prop {Number} createdAt Timestamp of the guild's creation
* @prop {Number} defaultNotifications The default notification settings for the guild. 0 is "All Messages", 1 is "Only @mentions"
* @prop {String?} description The description for the guild (VIP only)
* @prop {String?} discoverySplash The has of the guild discovery splash image, or null if no discovery splash
* @prop {String?} discoverySplashURL The URL of the guild's discovery splash image
* @prop {Number?} emojiCount The number of emojis on the guild
* @prop {Array<Object>} emojis An array of guild emoji objects
* @prop {Number} explicitContentFilter The explicit content filter level for the guild. 0 is off, 1 is on for people without roles, 2 is on for all
* @prop {Array<String>} features An array of guild feature strings
* @prop {String?} icon The hash of the guild icon, or null if no icon
* @prop {String?} iconURL The URL of the guild's icon
* @prop {String} id The ID of the guild
* @prop {Number} joinedAt Timestamp of when the bot account joined the guild
* @prop {Array<String>?} keywords The guild's discovery keywords
* @prop {Boolean} large Whether the guild is "large" by "some Discord standard"
* @prop {Number} mfaLevel The admin 2FA level for the guild. 0 is not required, 1 is required
* @prop {Number?} maxMembers The maximum amount of members for the guild
* @prop {Number} maxPresences The maximum number of people that can be online in a guild at once (returned from REST API only)
* @prop {Number?} maxVideoChannelUsers The max number of users allowed in a video channel
* @prop {Number} memberCount Number of members in the guild
* @prop {Collection<Member>} members Collection of Members in the guild
* @prop {String} name The name of the guild
* @prop {Boolean} nsfw [DEPRECATED] Whether the guild is designated as NSFW by Discord
* @prop {Number} nsfwLevel The guild NSFW level designated by Discord
* @prop {String} ownerID The ID of the user that is the guild owner
* @prop {String} preferredLocale Preferred "COMMUNITY" guild language used in server discovery and notices from Discord
* @prop {Boolean} premiumProgressBarEnabled If the boost progress bar is enabled
* @prop {Number?} premiumSubscriptionCount The total number of users currently boosting this guild
* @prop {Number} premiumTier Nitro boost level of the guild
* @prop {Object?} primaryCategory The guild's primary discovery category
* @prop {Number?} primaryCategoryID The guild's primary discovery category ID
* @prop {String?} publicUpdatesChannelID ID of the guild's updates channel if the guild has "COMMUNITY" features
* @prop {Collection<Role>} roles Collection of Roles in the guild
* @prop {String?} rulesChannelID The channel where "COMMUNITY" guilds display rules and/or guidelines
* @prop {Shard} shard The Shard that owns the guild
* @prop {String?} splash The hash of the guild splash image, or null if no splash (VIP only)
* @prop {String?} splashURL The URL of the guild's splash image
* @prop {Array<Object>?} stickers An array of guild sticker objects
* @prop {Number} systemChannelFlags The flags for the system channel
* @prop {String?} systemChannelID The ID of the default channel for system messages (built-in join messages and boost messages)
* @prop {Collection<ThreadChannel>} threads Collection of threads that the current user has permission to view
* @prop {Boolean} unavailable Whether the guild is unavailable or not
* @prop {String?} vanityURL The vanity URL of the guild (VIP only)
* @prop {Number} verificationLevel The guild verification level
* @prop {Collection<VoiceState>} voiceStates Collection of voice states in the guild
* @prop {Object?} welcomeScreen The welcome screen of a Community guild, shown to new members
* @prop {Object} welcomeScreen.description The description in the welcome screen
* @prop {Array<Object>} welcomeScreen.welcomeChannels The list of channels in the welcome screens. Each channels have the following properties: `channelID`, `description`, `emojiID`, `emojiName`. `emojiID` and `emojiName` properties can be null.
* @prop {Number?} widgetChannelID The channel id that the widget will generate an invite to. REST only.
* @prop {Boolean?} widgetEnabled Whether the guild widget is enabled. REST only.
*/
export default class Guild extends Base {
    constructor(data, client) {
        super(data.id);
        this.client = client;
        this.shard = client.shards.get(client.guildShardMap[this.id] || (Base.getDiscordEpoch(data.id) % client.options.maxShards) || 0);
        this.unavailable = !!data.unavailable;
        this.channels = new Collection(GuildChannel);
        this.threads = new Collection(ThreadChannel);
        this.members = new Collection(Member);
        this.memberCount = data.member_count;
        this.roles = new Collection(Role);
        this.applicationID = data.application_id;
        this.ownerID = data.owner_id

        if(data.approximate_member_count !== undefined) {
            this.approximateMemberCount = data.approximate_member_count;
        }
        if(data.approximate_presence_count !== undefined) {
            this.approximatePresenceCount = data.approximate_presence_count;
        }
        if(data.categories !== undefined) {
            this.categories = data.categories;
        }
        if(data.roles) {
            for(const role of data.roles) {
                this.roles.add(role, this);
            }
        }

        if(data.channels) {
            for(const channelData of data.channels) {
                channelData.guild_id = this.id;
                if(channelData.type === 0){
                    const channel = new GuildChannel(channelData, this.client);
                    channel.guild = this;
                    this.channels.add(channel, client);
                    client.channelGuildMap[channel.id] = this.id;
                }
            }
            // console.log("channel")
            // const replacerFunc = () => {
            //     const visited = new WeakSet();
            //     return (key, value) => {
            //         const newvalue = typeof value === 'bigint' ? value.toString() : value
            //       if (typeof newvalue === "object" && newvalue !== null) {
            //         if (visited.has(newvalue)) {
            //           return;
            //         }
            //         visited.add(newvalue);
            //       }
            //       return newvalue;
            //     };
            //   };
              
            // console.log(JSON.stringify(this.channels, replacerFunc()))
            // console.log(this.channels.toJSON())
        }
        if(data.threads) {
            for(const threadData of data.threads) {
                threadData.guild_id = this.id;
                if(threadData.type===11){
                    const channel = new ThreadChannel(threadData, client);
                    channel.guild = this;
                    this.threads.add(channel, client);
                    client.threadGuildMap[channel.id] = this.id;
                }
            }
        }

        if(data.members) {
            for(const member of data.members) {
                member.id = member.user.id;
                this.members.add(member, this);
            }
        }

        this.update(data);
    }

    update(data) {
        if(data.name !== undefined) {
            this.name = data.name;
        }
        if(data.icon !== undefined) {
            this.icon = data.icon;
        }
        if(data.large !== undefined) {
            this.large = data.large;
        }
        if(data.max_presences !== undefined) {
            this.maxPresences = data.max_presences;
        }
        if(data.preferred_locale !== undefined) {
            this.preferredLocale = data.preferred_locale;
        }
    }

    get iconURL() {
        const url = Endpoints.GUILD_ICON(this.id, this.icon)
        return this.icon ? `${Endpoints.CDN_URL}${url}.${url.includes("/a_") ? "gif" : "jpg"}?size=128` : null;
    }

    /**
    * Get the guild permissions of a member
    * @arg {String | Member | Object} memberID The ID of the member or a Member object
    * @returns {Permission}
    */
    permissionsOf(memberID) {
        const member = typeof memberID === "string" ? this.members.get(memberID) : memberID;
        if(member.id === this.ownerID) {
            return new Permission(Permissions.all);
        } else {
            let permissions = this.roles.get(this.id).permissions.allow;
            if(permissions & Permissions.administrator) {
                return new Permission(Permissions.all);
            }
            for(let role of member.roles) {
                role = this.roles.get(role);
                if(!role) {
                    continue;
                }

                const {allow: perm} = role.permissions;
                if(perm & Permissions.administrator) {
                    permissions = Permissions.all;
                    break;
                } else {
                    permissions |= perm;
                }
            }
            return new Permission(permissions);
        }
    }
}