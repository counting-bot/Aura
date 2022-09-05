import Channel from "./structures/Channel.mjs";
import Collection from '../util/Collection.mjs'
import { Intents, GATEWAY_VERSION } from "./Constants.mjs";
import * as Endpoints from "./rest/Endpoints.mjs";
import Guild from "./structures/Guild.mjs";
import Invite from "./structures/Invite.mjs";
import Member from "./structures/Member.mjs";
import Message from "./structures/Message.mjs";
import RequestHandler from "./rest/RequestHandler.mjs";
import ShardManager from "./gateway/ShardManager.mjs";
import ThreadMember from "./structures/ThreadMember.mjs";
import UnavailableGuild from "./structures/UnavailableGuild.mjs";
import User from "./structures/User.mjs";
import EventEmitter from "events";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
* Represents the main Eris client
* @extends EventEmitter
* @prop {Object?} application Object containing the bot application's ID and its public flags
* @prop {Boolean} bot Whether the bot user belongs to an OAuth2 application
* @prop {Object} channelGuildMap Object mapping channel IDs to guild IDs
* @prop {String} gatewayURL The URL for the discord gateway
* @prop {Collection<Guild>} guilds Collection of guilds the bot is in
* @prop {Object} guildShardMap Object mapping guild IDs to shard IDs
* @prop {Object} options Eris options
* @prop {Object} privateChannelMap Object mapping user IDs to private channel IDs
* @prop {Collection<PrivateChannel>} privateChannels Collection of private channels the bot is in
* @prop {RequestHandler} requestHandler The request handler the client will use
* @prop {Collection<Shard>} shards Collection of shards Eris is using
* @prop {Number} startTime Timestamp of bot ready event
* @prop {Object} threadGuildMap Object mapping thread channel IDs to guild IDs
* @prop {Collection<UnavailableGuild>} unavailableGuilds Collection of unavailable guilds the bot is in
* @prop {Number} uptime How long in milliseconds the bot has been up for
* @prop {ExtendedUser} user The bot user
* @prop {Collection<User>} users Collection of users the bot sees
*/
export default class Client extends EventEmitter {
    /**
    * Create a Client
    * @arg {String} token The auth token to use. Bot tokens should be prefixed with `Bot` (e.g. `Bot MTExIHlvdSAgdHJpZWQgMTEx.O5rKAA.dQw4w9WgXcQ_wpV-gGA4PSk_bm8`). Prefix-less bot tokens are [DEPRECATED]
    * @arg {Object} options Eris client options
    * @arg {Object} [options.agent] [DEPRECATED] A HTTPS Agent used to proxy requests. This option has been moved under `options.rest`
    * @arg {Object} [options.allowedMentions] A list of mentions to allow by default in createMessage/editMessage
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Boolean} [options.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to
    * @arg {Boolean} [options.autoreconnect=true] Have Eris autoreconnect when connection is lost
    * @arg {Boolean} [options.compress=false] Whether to request WebSocket data to be compressed or not
    * @arg {Number} [options.connectionTimeout=30000] How long in milliseconds to wait for the connection to handshake with the server
    * @arg {String} [options.defaultImageFormat="jpg"] The default format to provide user avatars, guild icons, and group icons in. Can be "jpg", "png", "gif", or "webp"
    * @arg {Number} [options.defaultImageSize=128] The default size to return user avatars, guild icons, banners, splashes, and group icons. Can be any power of two between 16 and 2048. If the height and width are different, the width will be the value specified, and the height relative to that
    * @arg {Object} [options.disableEvents] If disableEvents[eventName] is true, the WS event will not be processed. This can cause significant performance increase on large bots. [A full list of the WS event names can be found on the docs reference page](/Eris/docs/reference#ws-event-names)
    * @arg {Number} [options.firstShardID=0] The ID of the first shard to run for this client
    * @arg {Boolean} [options.getAllUsers=false] Get all the users in every guild. Ready time will be severely delayed
    * @arg {Number} [options.guildCreateTimeout=2000] How long in milliseconds to wait for a GUILD_CREATE before "ready" is fired. Increase this value if you notice missing guilds
    * @arg {Number | Array<String|Number>} [options.intents] A list of [intent names](/Eris/docs/reference), pre-shifted intent numbers to add, or a raw bitmask value describing the intents to subscribe to. Some intents, like `guildPresences` and `guildMembers`, must be enabled on your application's page to be used. By default, all non-privileged intents are enabled.
    * @arg {Number} [options.largeThreshold=250] The maximum number of offline users per guild during initial guild data transmission
    * @arg {Number} [options.lastShardID=options.maxShards - 1] The ID of the last shard to run for this client
    * @arg {Number} [options.latencyThreshold=30000] [DEPRECATED] The average request latency at which Eris will start emitting latency errors. This option has been moved under `options.rest`
    * @arg {Number} [options.maxReconnectAttempts=Infinity] The maximum amount of times that the client is allowed to try to reconnect to Discord.
    * @arg {Number} [options.maxResumeAttempts=10] The maximum amount of times a shard can attempt to resume a session before considering that session invalid.
    * @arg {Number | String} [options.maxShards=1] The total number of shards you want to run. If "auto" Eris will use Discord's recommended shard count.
    * @arg {Number} [options.messageLimit=100] The maximum size of a channel message cache
    * @arg {Boolean} [options.opusOnly=false] Whether to suppress the Opus encoder not found error or not
    * @arg {Number} [options.ratelimiterOffset=0] [DEPRECATED] A number of milliseconds to offset the ratelimit timing calculations by. This option has been moved under `options.rest`
    * @arg {Function} [options.reconnectDelay] A function which returns how long the bot should wait until reconnecting to Discord.
    * @arg {Number} [options.requestTimeout=15000] A number of milliseconds before requests are considered timed out. This option will stop affecting REST in a future release; that behavior is [DEPRECATED] and replaced by `options.rest.requestTimeout`
    * @arg {Boolean} [options.seedVoiceConnections=false] Whether to populate bot.voiceConnections with existing connections the bot account has during startup. Note that this will disconnect connections from other bot sessions
    * @arg {Number | String} [options.shardConcurrency="auto"] The number of shards that can start simultaneously. If "auto" Eris will use Discord's recommended shard concurrency.
    * @arg {Object} [options.ws] An object of WebSocket options to pass to the shard WebSocket constructors
    */
    constructor(token, options) {
        super();

        this.options = Object.assign({
            allowedMentions: {
                users: true,
                roles: true
            },
            autoreconnect: true,
            connectionTimeout: 30000,
            defaultImageFormat: "jpg",
            defaultImageSize: 128,
            disableEvents: {},
            firstShardID: 0,
            getAllUsers: false,
            guildCreateTimeout: 2000,
            intents: Intents.allNonPrivileged,
            largeThreshold: 250,
            maxReconnectAttempts: Infinity,
            maxResumeAttempts: 10,
            maxShards: 1,
            messageLimit: 100,
            requestTimeout: 15000,
            rest: {},
            restMode: false,
            shardConcurrency: "auto",
            ws: {},
            reconnectDelay: (lastDelay, attempts) => Math.pow(attempts + 1, 0.7) * 20000
        }, options);
        this.options.allowedMentions = this._formatAllowedMentions(this.options.allowedMentions);
        if (this.options.lastShardID === undefined && this.options.maxShards !== "auto") {
            this.options.lastShardID = this.options.maxShards - 1;
        }

        // Set HTTP Agent on Websockets if not already set
        if (this.options.agent && !(this.options.ws && this.options.ws.agent)) {
            this.options.ws = this.options.ws || {};
            this.options.ws.agent = this.options.agent;
        }

        if (this.options.hasOwnProperty("intents")) {
            if (Array.isArray(this.options.intents)) {
                let bitmask = 0;
                for (const intent of this.options.intents) {
                    if (typeof intent === "number") {
                        bitmask |= intent;
                    } else if (Intents[intent]) {
                        bitmask |= Intents[intent];
                    } else {
                        this.emit("warn", `Unknown intent: ${intent}`);
                    }
                }
                this.options.intents = bitmask;
            }
        }

        Object.defineProperty(this, "_token", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: token
        });

        this.requestHandler = new RequestHandler(this, this.options.rest, this._token);
        delete this.options.rest;

        const shardManagerOptions = {};
        if (typeof this.options.shardConcurrency === "number") {
            shardManagerOptions.concurrency = this.options.shardConcurrency;
        }
        this.shards = new ShardManager(this, shardManagerOptions);

        this.ready = false;
        this.bot = this._token.startsWith("Bot ");
        this.startTime = 0;
        this.lastConnect = 0;
        this.channelGuildMap = {};
        this.threadGuildMap = {};
        this.guilds = new Collection(Guild);
        this.privateChannelMap = {};
        this.privateChannels = new Collection(Channel);
        this.guildShardMap = {};
        this.unavailableGuilds = new Collection(UnavailableGuild);
        this.users = new Collection(User);
        this.presence = {
            activities: null,
            afk: false,
            since: null,
            status: "offline"
        };
        this.connect = this.connect.bind(this);
        this.lastReconnectDelay = 0;
        this.reconnectAttempts = 0;
    }

    get uptime() {
        return this.startTime ? Date.now() - this.startTime : 0;
    }

    /**
    * Add a role to a guild member
    * @arg {String} guildID The ID of the guild
    * @arg {String} memberID The ID of the member
    * @arg {String} roleID The ID of the role
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    addGuildMemberRole(guildID, memberID, roleID, reason) {
        return this.requestHandler.request(
            {
                method: "PUT",
                path: Endpoints.GUILD_MEMBER_ROLE(guildID, memberID, roleID),
                auth: true,
                json: {
                    reason
                }
            }
        );
    }

    /**
    * Add a reaction to a message
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message
    * @arg {String} reaction The reaction (Unicode string if Unicode emoji, `emojiName:emojiID` if custom emoji)
    * @arg {String} [userID="@me"] The ID of the user to react as. Passing this parameter is deprecated and will not be supported in future versions.
    * @returns {Promise}
    */
    addMessageReaction(channelID, messageID, reaction) {
        if (reaction === decodeURI(reaction)) {
            reaction = encodeURIComponent(reaction);
        }
        return this.requestHandler.request({ method: "PUT", path: Endpoints.CHANNEL_MESSAGE_REACTION_USER(channelID, messageID, reaction, "@me"), auth: true });
    }

    /**
    * Ban a user from a guild
    * @arg {String} guildID The ID of the guild
    * @arg {String} userID The ID of the user
    * @arg {Number} [deleteMessageDays=0] Number of days to delete messages for, between 0-7 inclusive
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    banGuildMember(guildID, userID, deleteMessageDays, reason) {
        if (!isNaN(deleteMessageDays) && (deleteMessageDays < 0 || deleteMessageDays > 7)) {
            return Promise.reject(new Error(`Invalid deleteMessageDays value (${deleteMessageDays}), should be a number between 0-7 inclusive`));
        }
        return this.requestHandler.request({method:"PUT", path:Endpoints.GUILD_BAN(guildID, userID), auth:true, json:{
            delete_message_days: deleteMessageDays || 0,
            reason: reason
        }});
    }

    /**
    * Edits command permissions for a multiple commands in a guild.
    * Note: You can only add up to 10 permission overwrites for a command.
    * @arg {String} guildID The guild id
    * @arg {Array<Object>} permissions An array of [partial guild command permissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure)
    * @returns {Promise<Array<Object>>} Returns an array of [GuildApplicationCommandPermissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure) objects.
    */
    bulkEditCommandPermissions(guildID, permissions) {
        if (!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to edit.");
        }

        return this.requestHandler.request({ method: "PUT", path: Endpoints.GUILD_COMMAND_PERMISSIONS(this.application.id, guildID), auth: true, json: permissions });
    }

    /**
    * Bulk create/edit global application commands
    * @arg {Array<Object>} commands An array of [Command objects](https://discord.com/developers/docs/interactions/application-commands#application-command-object)
    * @returns {Promise<Array>} Resolves with an array of commands objects
    */
    bulkEditCommands(commands) {
        for (const command of commands) {
            if (command.name !== undefined) {
                if (command.type === 1 || command.type === undefined) {
                    command.name = command.name.toLowerCase();
                    if (!command.name.match(/^[\w-]{1,32}$/)) {
                        throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                    }
                }
            }
        }
        return this.requestHandler.request({ method: "PUT", path: Endpoints.COMMANDS(this.application.id), auth: true, json: commands });
    }

    /**
    * Tells all shards to connect. This will call `getBotGateway()`, which is ratelimited.
    * @returns {Promise} Resolves when all shards are initialized
    */
    async connect() {
        if (typeof this._token !== "string") {
            throw new Error(`Invalid token "${this._token}"`);
        }
        try {
            const data = await (this.options.maxShards === "auto" || (this.options.shardConcurrency === "auto" && this.bot) ? this.getBotGateway() : this.getGateway());
            if (!data.url || (this.options.maxShards === "auto" && !data.shards)) {
                throw new Error("Invalid response from gateway REST call");
            }
            if (data.url.includes("?")) {
                data.url = data.url.substring(0, data.url.indexOf("?"));
            }
            if (!data.url.endsWith("/")) {
                data.url += "/";
            }
            this.gatewayURL = `${data.url}?v=${GATEWAY_VERSION}&encoding=json`;

            if (this.options.maxShards === "auto") {
                if (!data.shards) {
                    throw new Error("Failed to autoshard due to lack of data from Discord.");
                }
                this.options.maxShards = data.shards;
                if (this.options.lastShardID === undefined) {
                    this.options.lastShardID = data.shards - 1;
                }
            }

            if (this.options.shardConcurrency === "auto" && data.session_start_limit && typeof data.session_start_limit.max_concurrency === "number") {
                this.shards.setConcurrency(data.session_start_limit.max_concurrency);
            }

            for (let i = this.options.firstShardID; i <= this.options.lastShardID; ++i) {
                this.shards.spawn(i);
            }
        } catch (err) {
            if (!this.options.autoreconnect) {
                throw err;
            }
            const reconnectDelay = this.options.reconnectDelay(this.lastReconnectDelay, this.reconnectAttempts);
            await sleep(reconnectDelay);
            this.lastReconnectDelay = reconnectDelay;
            this.reconnectAttempts = this.reconnectAttempts + 1;
            return this.connect();
        }
    }

    /**
    * Create an invite for a channel
    * @arg {String} channelID The ID of the channel
    * @arg {Object} [options] Invite generation options
    * @arg {Number} [options.maxAge] How long the invite should last in seconds
    * @arg {Number} [options.maxUses] How many uses the invite should last for
    * @arg {String} [options.targetApplicationID] The target application id
    * @arg {Number} [options.targetType] The type of the target application
    * @arg {String} [options.targetUserID] The ID of the user whose stream should be displayed for the invite (`options.targetType` must be `1`)
    * @arg {Boolean} [options.temporary] Whether the invite grants temporary membership or not
    * @arg {Boolean} [options.unique] Whether the invite is unique or not
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Invite>}
    */
    createChannelInvite(channelID, options = {}, reason) {
        return this.requestHandler.request({method:"POST", path:Endpoints.CHANNEL_INVITES(channelID), auth:true, json:{
            max_age: options.maxAge,
            max_uses: options.maxUses,
            target_application_id: options.targetApplicationID,
            target_type: options.targetType,
            target_user_id: options.targetUserID,
            temporary: options.temporary,
            unique: options.unique,
            reason: reason
        }}).then((invite) => new Invite(invite, this));
    }

    /**
    * Create a channel webhook
    * @arg {String} channelID The ID of the channel to create the webhook in
    * @arg {Object} options Webhook options
    * @arg {String} options.name The default name
    * @arg {String} [options.avatar] The default avatar as a base64 data URI. Note: base64 strings alone are not base64 data URI strings
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    createChannelWebhook(channelID, options, reason) {
        options.reason = reason;
        return this.requestHandler.request({method:"POST", path:Endpoints.CHANNEL_WEBHOOKS(channelID), auth:true, json:options});
    }

    /**
    * Create a global application command
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Number} [type=1] The type of application command, 1 for slash command, 2 for user, and 3 for message
    * @arg {Boolean} [command.defaultPermission=true] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    createCommand(command) {
        if (command.name !== undefined) {
            if (command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if (!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request({method:"POST", path:Endpoints.COMMANDS(this.application.id), auth:true, json:command});
    }

    /**
    * Respond to the interaction with a message
    * Note: Use webhooks if you have already responded with an interaction response.
    * @arg {String} interactionID The interaction ID.
    * @arg {String} interactionToken The interaction Token.
    * @arg {Object} options The options object.
    * @arg {Object} [options.data] The data to send with the response.
    * @arg {Object} [options.data.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.data.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean} [options.data.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
    * @arg {Boolean | Array<String>} [options.data.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.data.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [options.data.components] An array of component objects
    * @arg {String} [options.data.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.data.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [options.data.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.data.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [options.data.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [options.data.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [options.data.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [options.data.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [options.data.components[].options[].description] The description for this option
    * @arg {Object} [options.data.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} options.data.components[].options[].label The label for this option
    * @arg {Number | String} options.data.components[].options[].value The value for this option
    * @arg {String} [options.data.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [options.data.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} options.data.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [options.data.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [options.data.content] A content string
    * @arg {Object} [options.data.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [options.data.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Boolean} [options.data.flags] 64 for Ephemeral (applies to Application Commands and Message Components)
    * @arg {Boolean} [options.data.tts] Set the message TTS flag
    * @arg {Number} options.type The response type to send [Check Discord docs for valid responses](https://discord.com/developers/docs/interactions/receiving-and-responding#interaction-response-object-interaction-callback-type).
    * @arg {Object | Array<Object>} [file] A file object (or an Array of them)
    * @arg {Buffer} file.file A buffer containing file data
    * @arg {String} file.name What to name the file
    * @returns {Promise}
    */
    createInteractionResponse(interactionID, interactionToken, options, file) {
        if (options.data && options.data.embed) {
            if (!options.data.embeds) {
                options.data.embeds = [];
            }
            options.data.embeds.push(options.data.embed);
        }
        return this.requestHandler.request({
            method: "POST",
            path: Endpoints.INTERACTION_RESPOND(interactionID, interactionToken),
            auth: true,
            json: options,
            file,
            route: "/interactions/:id/:token/callback"
        });
    }

    /**
    * Create a message in a channel
    * Note: If you want to DM someone, the user ID is **not** the DM channel ID. use Client.getDMChannel() to get the DM channel for a user
    * @arg {String} channelID The ID of the channel
    * @arg {String | Object} content A string or object. If an object is passed:
    * @arg {Object} [content.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [content.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [content.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [content.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Boolean} [content.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
    * @arg {Array<Object>} [content.components] An array of component objects
    * @arg {String} [content.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [content.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [content.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [content.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [content.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [content.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [content.components[].options[].description] The description for this option
    * @arg {Object} [content.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} content.components[].options[].label The label for this option
    * @arg {Number | String} content.components[].options[].value The value for this option
    * @arg {String} [content.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [content.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} content.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [content.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [content.content] A content string
    * @arg {Object} [content.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [content.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Object} [content.messageReference] The message reference, used when replying to messages
    * @arg {String} [content.messageReference.channelID] The channel ID of the referenced message
    * @arg {Boolean} [content.messageReference.failIfNotExists=true] Whether to throw an error if the message reference doesn't exist. If false, and the referenced message doesn't exist, the message is created without a referenced message
    * @arg {String} [content.messageReference.guildID] The guild ID of the referenced message
    * @arg {String} content.messageReference.messageID The message ID of the referenced message. This cannot reference a system message
    * @arg {String} [content.messageReferenceID] [DEPRECATED] The ID of the message should be replied to. Use `messageReference` instead
    * @arg {Array<String>} [content.stickerIDs] An array of IDs corresponding to stickers to send
    * @arg {Boolean} [content.tts] Set the message TTS flag
    * @arg {Object | Array<Object>} [file] A file object (or an Array of them)
    * @arg {Buffer} file.file A buffer containing file data
    * @arg {String} file.name What to name the file
    * @returns {Promise<Message>}
    */
    createMessage(channelID, content, file) {
        if (content !== undefined) {
            if (typeof content !== "object" || content === null) {
                content = {
                    content: "" + content
                };
            } else if (content.content !== undefined && typeof content.content !== "string") {
                content.content = "" + content.content;
            } else if (content.embed) {
                if (!content.embeds) {
                    content.embeds = [];
                }
                content.embeds.push(content.embed);
            }
            content.allowed_mentions = this._formatAllowedMentions(content.allowedMentions);
            content.sticker_ids = content.stickerIDs;
            if (content.messageReference) {
                content.message_reference = content.messageReference;
                if (content.messageReference.messageID !== undefined) {
                    content.message_reference.message_id = content.messageReference.messageID;
                    content.messageReference.messageID = undefined;
                }
                if (content.messageReference.channelID !== undefined) {
                    content.message_reference.channel_id = content.messageReference.channelID;
                    content.messageReference.channelID = undefined;
                }
                if (content.messageReference.guildID !== undefined) {
                    content.message_reference.guild_id = content.messageReference.guildID;
                    content.messageReference.guildID = undefined;
                }
                if (content.messageReference.failIfNotExists !== undefined) {
                    content.message_reference.fail_if_not_exists = content.messageReference.failIfNotExists;
                    content.messageReference.failIfNotExists = undefined;
                }
            } else if (content.messageReferenceID) {
                this.emit("warn", "[DEPRECATED] content.messageReferenceID is deprecated. Use content.messageReference instead");
                content.message_reference = { message_id: content.messageReferenceID };
            }
        }
        return this.requestHandler.request({method:"POST", path:Endpoints.CHANNEL_MESSAGES(channelID), auth:true, json:content, file}).then((message) => new Message(message, this));
    }

    /**
    * Create a thread with an existing message
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message to create the thread from
    * @arg {Object} options The thread options
    * @arg {Number} options.autoArchiveDuration Duration in minutes to automatically archive the thread after recent activity, either 60, 1440, 4320 or 10080
    * @arg {String} options.name The thread channel name
    * @returns {Promise<NewsThreadChannel | PublicThreadChannel>}
    */
    createThreadWithMessage(channelID, messageID, options) {
        return this.requestHandler.request({method:"POST", path:Endpoints.THREAD_WITH_MESSAGE(channelID, messageID), auth:true, json:{
            name: options.name,
            auto_archive_duration: options.autoArchiveDuration
        }}).then((channel) => Channel.from(channel, this));
    }

    /**
    * Create a thread without an existing message
    * @arg {String} channelID The ID of the channel
    * @arg {Object} options The thread options
    * @arg {Number} options.autoArchiveDuration Duration in minutes to automatically archive the thread after recent activity, either 60, 1440, 4320 or 10080
    * @arg {Boolean} [options.invitable] Whether non-moderators can add other non-moderators to the thread (private threads only)
    * @arg {String} options.name The thread channel name
    * @arg {Number} [options.type] The channel type of the thread to create. It is recommended to explicitly set this property as this will be a required property in API v10
    * @returns {Promise<PrivateThreadChannel>}
    */
    createThreadWithoutMessage(channelID, options) {
        return this.requestHandler.request({method:"POST", path:Endpoints.THREAD_WITHOUT_MESSAGE(channelID), auth:true, json:{
            auto_archive_duration: options.autoArchiveDuration,
            invitable: options.invitable,
            name: options.name,
            type: options.type
        }}).then((channel) => Channel.from(channel, this));
    }

    /**
    * Delete a global application command
    * @arg {String} commandID The command id
    * @returns {Promise}
    */
    deleteCommand(commandID) {
        if (!commandID) {
            throw new Error("You must provide an id of the command to delete.");
        }
        return this.requestHandler.request({method:"DELETE", path:Endpoints.COMMAND(this.application.id, commandID), auth:true});
    }

    /**
    * Delete a message
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteMessage(channelID, messageID, reason) {
        return this.requestHandler.request({method:"DELETE", path:Endpoints.CHANNEL_MESSAGE(channelID, messageID), auth:true, json:{
            reason
        }});
    }

    /**
    * Delete a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} [token] The token of the webhook, used instead of the Bot Authorization token
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    deleteWebhook(webhookID, token, reason) {
        return this.requestHandler.request({method:"DELETE", path:token ? Endpoints.WEBHOOK_TOKEN(webhookID, token) : Endpoints.WEBHOOK(webhookID), auth: !token, json:{
            reason
        }});
    }

    /**
    * Disconnects all shards
    * @arg {Object?} [options] Shard disconnect options
    * @arg {String | Boolean} [options.reconnect] false means destroy everything, true means you want to reconnect in the future, "auto" will autoreconnect
    */
    disconnect(options) {
        this.ready = false;
        this.shards.forEach((shard) => {
            shard.disconnect(options);
        });
        this.shards.connectQueue = [];
    }

    /**
    * Edit a global application command
    * @arg {String} commandID The command id
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    editCommand(commandID, command) {
        if (!commandID) {
            throw new Error("You must provide an id of the command to edit.");
        }
        if (command.name !== undefined) {
            if (command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if (!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request({
            method: "PATCH",
            path: Endpoints.COMMAND(this.application.id, commandID),
            auth: true,
            json: command
        });
    }

    /**
    * Edits command permissions for a specific command in a guild.
    * Note: You can only add up to 10 permission overwrites for a command.
    * @arg {String} guildID The guild id
    * @arg {String} commandID The command id
    * @arg {Array<Object>} permissions An array of [permissions objects](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-application-command-permissions-structure)
    * @returns {Promise<Object>} Resolves with a [GuildApplicationCommandPermissions](https://discord.com/developers/docs/interactions/application-commands#application-command-permissions-object-guild-application-command-permissions-structure) object.
    */
    editCommandPermissions(guildID, commandID, permissions) {
        if (!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to edit.");
        }
        if (!commandID) {
            throw new Error("You must provide an id of the command whose permissions you want to edit.");
        }
        return this.requestHandler.request({ method: "PUT", path: Endpoints.COMMAND_PERMISSIONS(this.application.id, guildID, commandID), auth: true, json: { permissions } });
    }

    /**
    * Edit a guild application command
    * @arg {String} guildID The guild id
    * @arg {Object} command A command object
    * @arg {String} command.name The command name
    * @arg {String} [command.description] The command description (Slash Commands Only)
    * @arg {Array<Object>} [command.options] An array of [command options](https://discord.com/developers/docs/interactions/application-commands#application-command-object-application-command-option-structure)
    * @arg {Boolean} [command.defaultPermission] Whether the command is enabled by default when the app is added to a guild
    * @returns {Promise<Object>} Resolves with a commands object
    */
    editGuildCommand(guildID, commandID, command) {
        if (!commandID) {
            throw new Error("You must provide an id of the command to edit.");
        }
        if (command.name !== undefined) {
            if (command.type === 1 || command.type === undefined) {
                command.name = command.name.toLowerCase();
                if (!command.name.match(/^[\w-]{1,32}$/)) {
                    throw new Error("Slash Command names must match the regular expression \"^[\\w-]{1,32}$\"");
                }
            }
        }
        command.default_permission = command.defaultPermission;
        return this.requestHandler.request({ method: "PATCH", path: Endpoints.GUILD_COMMAND(this.application.id, guildID, commandID), auth: true, json: command });
    }

    /**
    * Edit a guild member
    * @arg {String} guildID The ID of the guild
    * @arg {String} memberID The ID of the member (you can use "@me" if you are only editing the bot user's nickname)
    * @arg {Object} options The properties to edit
    * @arg {String?} [options.channelID] The ID of the voice channel to move the member to (must be in voice). Set to `null` to disconnect the member
    * @arg {Date?} [options.communicationDisabledUntil] When the user's timeout should expire. Set to `null` to instantly remove timeout
    * @arg {Boolean} [options.deaf] Server deafen the member
    * @arg {Boolean} [options.mute] Server mute the member
    * @arg {String} [options.nick] Set the member's server nickname, "" to remove
    * @arg {Array<String>} [options.roles] The array of role IDs the member should have
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Member>}
    */
    editGuildMember(guildID, memberID, options, reason) {
        return this.requestHandler.request({method:"PATCH", path:Endpoints.GUILD_MEMBER(guildID, memberID), auth:true, json:{
            roles: options.roles && options.roles.filter((roleID, index) => options.roles.indexOf(roleID) === index),
            nick: options.nick,
            mute: options.mute,
            deaf: options.deaf,
            channel_id: options.channelID,
            communication_disabled_until: options.communicationDisabledUntil,
            reason: reason
        }}).then((member) => new Member(member, this.guilds.get(guildID), this));
    }

    /**
    * Edit a message
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message
    * @arg {String | Array | Object} content A string, array of strings, or object. If an object is passed:
    * @arg {Object} [content.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [content.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [content.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [content.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [content.components] An array of component objects
    * @arg {String} [content.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [content.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [content.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [content.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [content.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [content.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [content.components[].options[].description] The description for this option
    * @arg {Object} [content.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} content.components[].options[].label The label for this option
    * @arg {Number | String} content.components[].options[].value The value for this option
    * @arg {String} [content.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [content.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} content.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [content.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [content.content] A content string
    * @arg {Object} [content.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [content.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Object | Array<Object>} [content.file] A file object (or an Array of them)
    * @arg {Buffer} content.file[].file A buffer containing file data
    * @arg {String} content.file[].name What to name the file
    * @arg {Number} [content.flags] A number representing the flags to apply to the message. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#message-object-message-flags) for flags reference
    * @returns {Promise<Message>}
    */
    editMessage(channelID, messageID, content) {
        if (content !== undefined) {
            if (typeof content !== "object" || content === null) {
                content = {
                    content: "" + content
                };
            } else if (content.content !== undefined && typeof content.content !== "string") {
                content.content = "" + content.content;
            } else if (content.embed) {
                if (!content.embeds) {
                    content.embeds = [];
                }
                content.embeds.push(content.embed);
            }
            if (content.content !== undefined || content.embeds || content.allowedMentions) {
                content.allowed_mentions = this._formatAllowedMentions(content.allowedMentions);
            }
        }
        return this.requestHandler.request({method:"PATCH", path:Endpoints.CHANNEL_MESSAGE(channelID, messageID), auth:true, json:content, file:content.file}).then((message) => new Message(message, this));
    }

    /**
    * Update the bot's status on all guilds
    * @arg {String} [status] Sets the bot's status, either "online", "idle", "dnd", or "invisible"
    * @arg {Array | Object} [activities] Sets the bot's activities. A single activity object is also accepted for backwards compatibility
    * @arg {String} activities[].name The name of the activity
    * @arg {Number} activities[].type The type of the activity. 0 is playing, 1 is streaming (Twitch only), 2 is listening, 3 is watching, 5 is competing in
    * @arg {String} [activities[].url] The URL of the activity
    */
    editStatus(status, activities) {
        if (activities === undefined && typeof status === "object") {
            activities = status;
            status = undefined;
        }
        if (status) {
            this.presence.status = status;
        }
        if (activities === null) {
            activities = [];
        } else if (activities && !Array.isArray(activities)) {
            activities = [activities];
        }
        if (activities !== undefined) {
            this.presence.activities = activities;
        }

        this.shards.forEach((shard) => {
            shard.editStatus(status, activities);
        });
    }

    /**
    * Edit a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {Object} options Webhook options
    * @arg {String} [options.name] The new default name
    * @arg {String} [options.avatar] The new default avatar as a base64 data URI. Note: base64 strings alone are not base64 data URI strings
    * @arg {String} [options.channelID] The new channel ID where webhooks should be sent to
    * @arg {String} [token] The token of the webhook, used instead of the Bot Authorization token
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    editWebhook(webhookID, options, token, reason) {
        return this.requestHandler.request({method:"PATCH", path:token ? Endpoints.WEBHOOK_TOKEN(webhookID, token) : Endpoints.WEBHOOK(webhookID), auth:!token, json:{
            name: options.name,
            avatar: options.avatar,
            channel_id: options.channelID,
            reason: reason
        }});
    }

    /**
    * Edit a webhook message
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {String} messageID The ID of the message
    * @arg {Object} options Webhook message edit options
    * @arg {Object} [options.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean} [options.allowedMentions.repliedUser] Whether or not to mention the author of the message being replied to.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Array<Object>} [options.components] An array of component objects
    * @arg {String} [options.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [options.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [options.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [options.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [options.components[].options[].description] The description for this option
    * @arg {Object} [options.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} options.components[].options[].label The label for this option
    * @arg {Number | String} options.components[].options[].value The value for this option
    * @arg {String} [options.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [options.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} options.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [options.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [options.content] A content string
    * @arg {Object} [options.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [options.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Object | Array<Object>} [options.file] A file object (or an Array of them)
    * @arg {Buffer} options.file[].file A buffer containing file data
    * @arg {String} options.file[].name What to name the file
    * @returns {Promise<Message>}
    */
    editWebhookMessage(webhookID, token, messageID, options) {
        if (options.allowedMentions) {
            options.allowed_mentions = this._formatAllowedMentions(options.allowedMentions);
        }
        if (options.embed) {
            if (!options.embeds) {
                options.embeds = [];
            }
            options.embeds.push(options.embed);
        }
        return this.requestHandler.request({method:"PATCH", path:Endpoints.WEBHOOK_MESSAGE(webhookID, token, messageID), auth:false, json:options, file:options.file}).then((response) => new Message(response, this));
    }

    /**
    * Execute a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {Object} options Webhook execution options
    * @arg {Object} [options.allowedMentions] A list of mentions to allow (overrides default)
    * @arg {Boolean} [options.allowedMentions.everyone] Whether or not to allow @everyone/@here.
    * @arg {Boolean | Array<String>} [options.allowedMentions.roles] Whether or not to allow all role mentions, or an array of specific role mentions to allow.
    * @arg {Boolean | Array<String>} [options.allowedMentions.users] Whether or not to allow all user mentions, or an array of specific user mentions to allow.
    * @arg {Boolean} [options.auth=false] Whether or not to authenticate with the bot token.
    * @arg {String} [options.avatarURL] A URL for a custom avatar, defaults to webhook default avatar if not specified
    * @arg {Array<Object>} [options.components] An array of component objects
    * @arg {String} [options.components[].custom_id] The ID of the component (type 2 style 0-4 and type 3 only)
    * @arg {Boolean} [options.components[].disabled] Whether the component is disabled (type 2 and 3 only)
    * @arg {Object} [options.components[].emoji] The emoji to be displayed in the component (type 2)
    * @arg {String} [options.components[].label] The label to be displayed in the component (type 2)
    * @arg {Number} [content.components[].max_values] The maximum number of items that can be chosen (1-25, default 1)
    * @arg {Number} [content.components[].min_values] The minimum number of items that must be chosen (0-25, default 1)
    * @arg {Array<Object>} [options.components[].options] The options for this component (type 3 only)
    * @arg {Boolean} [options.components[].options[].default] Whether this option should be the default value selected
    * @arg {String} [options.components[].options[].description] The description for this option
    * @arg {Object} [options.components[].options[].emoji] The emoji to be displayed in this option
    * @arg {String} options.components[].options[].label The label for this option
    * @arg {Number | String} options.components[].options[].value The value for this option
    * @arg {String} [options.components[].placeholder] The placeholder text for the component when no option is selected (type 3 only)
    * @arg {Number} [options.components[].style] The style of the component (type 2 only) - If 0-4, `custom_id` is required; if 5, `url` is required
    * @arg {Number} options.components[].type The type of component - If 1, it is a collection and a `components` array (nested) is required; if 2, it is a button; if 3, it is a select menu
    * @arg {String} [options.components[].url] The URL that the component should open for users (type 2 style 5 only)
    * @arg {String} [options.content] A content string
    * @arg {Object} [options.embed] An embed object. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Array<Object>} [options.embeds] An array of embed objects. See [the official Discord API documentation entry](https://discord.com/developers/docs/resources/channel#embed-object) for object structure
    * @arg {Object | Array<Object>} [options.file] A file object (or an Array of them)
    * @arg {Buffer} options.file.file A buffer containing file data
    * @arg {String} options.file.name What to name the file
    * @arg {Number} [options.flags] Flags to execute the webhook with, 64 for ephemeral (Interaction webhooks only)
    * @arg {String} [options.threadID] The ID of the thread channel in the webhook's channel to send the message to
    * @arg {Boolean} [options.tts=false] Whether the message should be a TTS message or not
    * @arg {String} [options.username] A custom username, defaults to webhook default username if not specified
    * @arg {Boolean} [options.wait=false] Whether to wait for the server to confirm the message create or not
    * @returns {Promise<Message?>}
    */
    executeWebhook(webhookID, token, options) {
        let qs = "";
        if (options.wait) {
            qs += "&wait=true";
        }
        if (options.threadID) {
            qs += "&thread_id=" + options.threadID;
        }
        if (options.embed) {
            if (!options.embeds) {
                options.embeds = [];
            }
            options.embeds.push(options.embed);
        }
        return this.requestHandler.request({method:"POST", path:Endpoints.WEBHOOK_TOKEN(webhookID, token) + (qs ? "?" + qs : ""), auth:!!options.auth, json:{
            content: options.content,
            embeds: options.embeds,
            username: options.username,
            avatar_url: options.avatarURL,
            tts: options.tts,
            flags: options.flags,
            allowed_mentions: this._formatAllowedMentions(options.allowedMentions),
            components: options.components
        }, file:options.file}).then((response) => options.wait ? new Message(response, this) : undefined);
    }

    /**
    * Get all active threads in a guild
    * @arg {String} guildID The ID of the guild
    * @returns {Promise<Object>} An object containing an array of `threads` and an array of `members`
    */
    getActiveGuildThreads(guildID) {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.THREADS_GUILD_ACTIVE(guildID),
            auth: true
        }).then((response) => {
            return {
                members: response.members.map((member) => new ThreadMember(member, this)),
                threads: response.threads.map((thread) => Channel.from(thread, this))
            };
        });
    }

    /**
    * Get all archived threads in a channel
    * @arg {String} channelID The ID of the channel
    * @arg {String} type The type of thread channel, either "public" or "private"
    * @arg {Object} [options] Additional options when requesting archived threads
    * @arg {Date} [options.before] List of threads to return before the timestamp
    * @arg {Number} [options.limit] Maximum number of threads to return
    * @returns {Promise<Object>} An object containing an array of `threads`, an array of `members` and whether the response `hasMore` threads that could be returned in a subsequent call
    */
    getArchivedThreads(channelID, type, options = {}) {
        return this.requestHandler.request({ method: "GET", path: Endpoints.THREADS_ARCHIVED(channelID, type), auth: true, json: options }).then((response) => {
            return {
                hasMore: response.has_more,
                members: response.members.map((member) => new ThreadMember(member, this)),
                threads: response.threads.map((thread) => Channel.from(thread, this))
            };
        });
    }

    /**
    * Get general and bot-specific info on connecting to the Discord gateway (e.g. connection ratelimit)
    * @returns {Promise<Object>} Resolves with an object containing gateway connection info
    */
    getBotGateway() {
        if (!this._token.startsWith("Bot ")) {
            this._token = "Bot " + this._token;
        }
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.GATEWAY_BOT,
            auth: true
        });
    }

    /**
    * Get a Channel object from a channel ID
    * @arg {String} channelID The ID of the channel
    * @returns {CategoryChannel | PrivateChannel | TextChannel | TextVoiceChannel | NewsChannel | NewsThreadChannel | PrivateThreadChannel | PublicThreadChannel}
    */
    getChannel(channelID) {
        if (!channelID) {
            throw new Error(`Invalid channel ID: ${channelID}`);
        }

        if (this.channelGuildMap[channelID] && this.guilds.get(this.channelGuildMap[channelID])) {
            return this.guilds.get(this.channelGuildMap[channelID]).channels.get(channelID);
        }
        if (this.threadGuildMap[channelID] && this.guilds.get(this.threadGuildMap[channelID])) {
            return this.guilds.get(this.threadGuildMap[channelID]).threads.get(channelID);
        }
        return this.privateChannels.get(channelID);
    }

    /**
    * Get all the webhooks in a channel
    * @arg {String} channelID The ID of the channel to get webhooks for
    * @returns {Promise<Array<Object>>} Resolves with an array of webhook objects
    */
    getChannelWebhooks(channelID) {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.CHANNEL_WEBHOOKS(channelID),
            auth: true
        });
    }

    /**
    * Get a global application command
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with an application command object.
    */
    getCommand(commandID) {
        if (!commandID) {
            throw new Error("You must provide an id of the command to get.");
        }
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.COMMAND(this.application.id, commandID),
            auth: true
        });
    }

    /**
    * Get the a guild's application command permissions
    * @arg {String} guildID The guild id
    * @arg {String} commandID The command id
    * @returns {Promise<Object>} Resolves with a guild application command permissions object.
    */
    getCommandPermissions(guildID, commandID) {
        if (!guildID) {
            throw new Error("You must provide an id of the guild whose permissions you want to get.");
        }
        if (!commandID) {
            throw new Error("You must provide an id of the command whose permissions you want to get.");
        }
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.COMMAND_PERMISSIONS(this.application.id, guildID, commandID),
            auth: true
        });
    }

    /**
    * Get the global application commands
    * @returns {Promise<Array<Object>>} Resolves with an array of application command objects.
    */
    getCommands() {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.COMMANDS(this.application.id),
            auth: true
        });
    }

    /**
    * Get a DM channel with a user, or create one if it does not exist
    * @arg {String} userID The ID of the user
    * @returns {Promise<PrivateChannel>}
    */
    getDMChannel(userID) {
        if (this.privateChannelMap[userID]) {
            return Promise.resolve(this.privateChannels.get(this.privateChannelMap[userID]));
        }
        return this.requestHandler.request({
            method: "POST",
            path: Endpoints.USER_CHANNELS("@me"),
            auth: true,
            json: {
                recipients: [userID],
                type: 1
            }
        }).then((privateChannel) => new Channel(privateChannel, this));
    }

    /**
    * Get info on connecting to the Discord gateway
    * @returns {Promise<Object>} Resolves with an object containing gateway connection info
    */
    getGateway() {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.GATEWAY
        });
    }

    /**
    * Get all the webhooks in a guild
    * @arg {String} guildID The ID of the guild to get webhooks for
    * @returns {Promise<Array<Object>>} Resolves with an array of webhook objects
    */
    getGuildWebhooks(guildID) {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.GUILD_WEBHOOKS(guildID),
            auth: true
        });
    }

    /**
    * Get joined private archived threads in a channel
    * @arg {String} channelID The ID of the channel
    * @arg {Object} [options] Additional options when requesting archived threads
    * @arg {Date} [options.before] List of threads to return before the timestamp
    * @arg {Number} [options.limit] Maximum number of threads to return
    * @returns {Promise<Object>} An object containing an array of `threads`, an array of `members` and whether the response `hasMore` threads that could be returned in a subsequent call
    */
    getJoinedPrivateArchivedThreads(channelID, options = {}) {
        return this.requestHandler.request({ method: "GET", path: Endpoints.THREADS_ARCHIVED_JOINED(channelID), auth: true, json: options }).then((response) => {
            return {
                hasMore: response.has_more,
                members: response.members.map((member) => new ThreadMember(member, this)),
                threads: response.threads.map((thread) => Channel.from(thread, this))
            };
        });
    }

    /**
    * Get a previous message in a channel
    * @arg {String} channelID The ID of the channel
    * @arg {String} messageID The ID of the message
    * @returns {Promise<Message>}
    */
    getMessage(channelID, messageID) {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.CHANNEL_MESSAGE(channelID, messageID),
            auth: true
        }).then((message) => new Message(message, this));
    }

    /**
    * Get a list of members that are part of a thread channel
    * @arg {String} channelID The ID of the thread channel
    * @returns {Promise<Array<ThreadMember>>}
    */
    getThreadMembers(channelID) {
        return this.requestHandler.request({method:"GET", path:Endpoints.THREAD_MEMBERS(channelID), auth:true}).then((members) => members.map((member) => new ThreadMember(member, this)));
    }

    /**
    * Get a webhook
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} [token] The token of the webhook, used instead of the Bot Authorization token
    * @returns {Promise<Object>} Resolves with a webhook object
    */
    getWebhook(webhookID, token) {
        return this.requestHandler.request({method:"GET", path: token ? Endpoints.WEBHOOK_TOKEN(webhookID, token) : Endpoints.WEBHOOK(webhookID), auth:!token});
    }

    /**
    * Get a webhook message
    * @arg {String} webhookID The ID of the webhook
    * @arg {String} token The token of the webhook
    * @arg {String} messageID The message ID of a message sent by this webhook
    * @returns {Promise<Message>} Resolves with a webhook message
    */
    getWebhookMessage(webhookID, token, messageID) {
        return this.requestHandler.request({
            method: "GET",
            path: Endpoints.WEBHOOK_MESSAGE(webhookID, token, messageID)
        }).then((message) => new Message(message, this));
    }

    /**
    * Join a thread
    * @arg {String} channelID The ID of the thread channel
    * @arg {String} [userID="@me"] The user ID of the user joining
    * @returns {Promise}
    */
    joinThread(channelID, userID = "@me") {
        return this.requestHandler.request({
            method: "PUT",
            path: Endpoints.THREAD_MEMBER(channelID, userID),
            auth: true
        });
    }

    /**
    * Leave a thread
    * @arg {String} channelID The ID of the thread channel
    * @arg {String} [userID="@me"] The user ID of the user leaving
    * @returns {Promise}
    */
    leaveThread(channelID, userID = "@me") {
        return this.requestHandler.request({
            method: "DELETE",
            path: Endpoints.THREAD_MEMBER(channelID, userID),
            auth: true
        });
    }

    /**
    * Remove a role from a guild member
    * @arg {String} guildID The ID of the guild
    * @arg {String} memberID The ID of the member
    * @arg {String} roleID The ID of the role
    * @arg {String} [reason] The reason to be displayed in audit logs
    * @returns {Promise}
    */
    removeGuildMemberRole(guildID, memberID, roleID, reason) {
        return this.requestHandler.request({
            method: "DELETE", path: Endpoints.GUILD_MEMBER_ROLE(guildID, memberID, roleID), auth: true, json: {
                reason
            }
        });
    }

    _formatAllowedMentions(allowed) {
        if (!allowed) {
            return this.options.allowedMentions;
        }
        const result = {
            parse: []
        };
        if (allowed.everyone) {
            result.parse.push("everyone");
        }
        if (allowed.roles === true) {
            result.parse.push("roles");
        } else if (Array.isArray(allowed.roles)) {
            if (allowed.roles.length > 100) {
                throw new Error("Allowed role mentions cannot exceed 100.");
            }
            result.roles = allowed.roles;
        }
        if (allowed.users === true) {
            result.parse.push("users");
        } else if (Array.isArray(allowed.users)) {
            if (allowed.users.length > 100) {
                throw new Error("Allowed user mentions cannot exceed 100.");
            }
            result.users = allowed.users;
        }
        if (allowed.repliedUser !== undefined) {
            result.replied_user = allowed.repliedUser;
        }
        return result;
    }
}