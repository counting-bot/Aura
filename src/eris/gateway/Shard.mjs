import Bucket from "../rest/Bucket.mjs";
import Channel from "../structures/Channel.mjs";
import GuildChannel from "../structures/GuildChannel.mjs";
import Message from "../structures/Message.mjs";
import { GATEWAY_VERSION, GatewayOPCodes, Intents, InteractionTypes } from "../Constants.mjs";
import User from "../structures/User.mjs";
import ThreadChannel from "../structures/ThreadChannel.mjs";

import CommandInteraction from "../structures/CommandInteraction.mjs";
import ComponentInteraction from "../structures/ComponentInteraction.mjs";

import WebSocket from "ws";
import EventEmitter from "events";

/**
* Represents a shard
* @extends EventEmitter
* @prop {Number} id The ID of the shard
* @prop {Boolean} connecting Whether the shard is connecting
* @prop {Array<String>?} discordServerTrace Debug trace of Discord servers
* @prop {Number} lastHeartbeatReceived Last time Discord acknowledged a heartbeat, null if shard has not sent heartbeat yet
* @prop {Number} lastHeartbeatSent Last time shard sent a heartbeat, null if shard has not sent heartbeat yet
* @prop {Number} latency The current latency between the shard and Discord, in milliseconds
* @prop {Boolean} ready Whether the shard is ready
* @prop {String} status The status of the shard. "disconnected"/"connecting"/"handshaking"/"ready"/"identifying"/"resuming"
*/
export default class Shard extends EventEmitter {
    constructor(id, client) {
        super();

        this.id = id;
        this.client = client;

        this.onPacket = this.onPacket.bind(this);
        this._onWSOpen = this._onWSOpen.bind(this);
        this._onWSMessage = this._onWSMessage.bind(this);
        this._onWSError = this._onWSError.bind(this);
        this._onWSClose = this._onWSClose.bind(this);

        this.hardReset();
    }

    checkReady() {
        if(!this.ready) {
            if(this.guildSyncQueue.length > 0) {
                this.requestGuildSync(this.guildSyncQueue);
                this.guildSyncQueue = [];
                this.guildSyncQueueLength = 1;
                return;
            }
            if(this.unsyncedGuilds > 0) {
                return;
            }
            if(this.getAllUsersQueue.length > 0) {
                this.requestGuildMembers(this.getAllUsersQueue);
                this.getAllUsersQueue = [];
                this.getAllUsersLength = 1;
                return;
            }
            if(Object.keys(this.getAllUsersCount).length === 0) {
                this.ready = true;
                /**
                * Fired when the shard turns ready
                * @event Shard#ready
                */
                super.emit("ready");
            }
        }
    }

    /**
    * Tells the shard to connect
    */
    connect() {
        if(this.ws && this.ws.readyState != WebSocket.CLOSED) {
            this.emit("error", new Error("Existing connection detected"), this.id);
            return;
        }
        ++this.connectAttempts;
        this.connecting = true;
        return this.initializeWS();
    }

    createGuild(_guild) {
        this.client.guildShardMap[_guild.id] = this.id;
        return this.client.guilds.add(_guild, this.client, true);
    }

    /**
    * Disconnects the shard
    * @arg {Object?} [options] Shard disconnect options
    * @arg {String | Boolean} [options.reconnect] false means destroy everything, true means you want to reconnect in the future, "auto" will autoreconnect
    * @arg {Error} [error] The error that causes the disconnect
    */
    disconnect(options = {}, error) {
        if(!this.ws) {
            return;
        }

        if(this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if(this.ws.readyState !== WebSocket.CLOSED) {
            this.ws.removeListener("message", this._onWSMessage);
            this.ws.removeListener("close", this._onWSClose);
            try {
                if(options.reconnect && this.sessionID) {
                    if(this.ws.readyState === WebSocket.OPEN) {
                        this.ws.close(4901, "Eris: reconnect");
                    } else {
                        this.emit("debug", `Terminating websocket (state: ${this.ws.readyState})`, this.id);
                        this.ws.terminate();
                    }
                } else {
                    this.ws.close(1000, "Eris: normal");
                }
            } catch(err) {
                this.emit("error", err, this.id);
            }
        }
        this.ws = null;
        this.reset();

        if(error) {
            this.emit("error", error, this.id);
        }

        /**
        * Fired when the shard disconnects
        * @event Shard#disconnect
        * @prop {Error?} err The error, if any
        */
        super.emit("disconnect", error);

        if(this.sessionID && this.connectAttempts >= this.client.options.maxResumeAttempts) {
            this.emit("debug", `Automatically invalidating session due to excessive resume attempts | Attempt ${this.connectAttempts}`, this.id);
            this.sessionID = null;
            this.resumeURL = null;
        }

        if(options.reconnect === "auto" && this.client.options.autoreconnect) {
            /**
            * Fired when stuff happens and gives more info
            * @event Client#debug
            * @prop {String} message The debug message
            * @prop {Number} id The ID of the shard
            */
            if(this.sessionID) {
                this.emit("debug", `Immediately reconnecting for potential resume | Attempt ${this.connectAttempts}`, this.id);
                this.client.shards.connect(this);
            } else {
                this.emit("debug", `Queueing reconnect in ${this.reconnectInterval}ms | Attempt ${this.connectAttempts}`, this.id);
                setTimeout(() => {
                    this.client.shards.connect(this);
                }, this.reconnectInterval);
                this.reconnectInterval = Math.min(Math.round(this.reconnectInterval * (Math.random() * 2 + 1)), 30000);
            }
        } else if(!options.reconnect) {
            this.hardReset();
        }
    }

    /**
    * Updates the bot's status on all guilds the shard is in
    * @arg {String} [status] Sets the bot's status, either "online", "idle", "dnd", or "invisible"
    * @arg {Array | Object} [activities] Sets the bot's activities. A single activity object is also accepted for backwards compatibility
    * @arg {String} activities[].name The name of the activity
    * @arg {Number} activities[].type The type of the activity. 0 is playing, 1 is streaming (Twitch only), 2 is listening, 3 is watching, 5 is competing in
    * @arg {String} [activities[].url] The URL of the activity
    */
    editStatus(status, activities) {
        if(activities === undefined && typeof status === "object") {
            activities = status;
            status = undefined;
        }
        if(status) {
            this.presence.status = status;
        }
        if(activities === null) {
            activities = [];
        } else if(activities && !Array.isArray(activities)) {
            activities = [activities];
        }
        if(activities !== undefined) {
            if(activities.length > 0 && !activities[0].hasOwnProperty("type")) {
                activities[0].type = activities[0].url ? 1 : 0;
            }
            this.presence.activities = activities;
        }

        this.sendStatusUpdate();
    }

    emit(event, ...args) {
        this.client.emit.call(this.client, event, ...args);
        if(event !== "error" || this.listeners("error").length > 0) {
            super.emit.call(this, event, ...args);
        }
    }

    getGuildMembers(guildID, timeout) {
        if(this.getAllUsersCount.hasOwnProperty(guildID)) {
            throw new Error("Cannot request all members while an existing request is processing");
        }
        this.getAllUsersCount[guildID] = true;
        // Using intents, request one guild at a time
        if(this.client.options.intents) {
            if(!(this.client.options.intents & Intents.guildMembers)) {
                throw new Error("Cannot request all members without guildMembers intent");
            }
            this.requestGuildMembers([guildID], timeout);
        } else {
            if(this.getAllUsersLength + 3 + guildID.length > 4048) { // 4096 - "{\"op\":8,\"d\":{\"guild_id\":[],\"query\":\"\",\"limit\":0}}".length + 1 for lazy comma offset
                this.requestGuildMembers(this.getAllUsersQueue);
                this.getAllUsersQueue = [guildID];
                this.getAllUsersLength = 1 + guildID.length + 3;
            } else {
                this.getAllUsersQueue.push(guildID);
                this.getAllUsersLength += guildID.length + 3;
            }
        }
    }

    hardReset() {
        this.reset();
        this.seq = 0;
        this.sessionID = null;
        this.resumeURL = null;
        this.reconnectInterval = 1000;
        this.connectAttempts = 0;
        this.ws = null;
        this.heartbeatInterval = null;
        this.guildCreateTimeout = null;
        this.globalBucket = new Bucket(120, 60000, {reservedTokens: 5});
        this.presenceUpdateBucket = new Bucket(5, 20000);
        this.presence = JSON.parse(JSON.stringify(this.client.presence)); // Fast copy
        Object.defineProperty(this, "_token", {
            configurable: true,
            enumerable: false,
            writable: true,
            value: this.client._token
        });
    }

    heartbeat(normal) {
        // Can only heartbeat after identify/resume succeeds, session will be killed otherwise, discord/discord-api-docs#1619
        if(this.status === "resuming" || this.status === "identifying") {
            return;
        }
        if(normal) {
            if(!this.lastHeartbeatAck) {
                this.emit("debug", "Heartbeat timeout; " + JSON.stringify({
                    lastReceived: this.lastHeartbeatReceived,
                    lastSent: this.lastHeartbeatSent,
                    interval: this.heartbeatInterval,
                    status: this.status,
                    timestamp: Date.now()
                }));
                return this.disconnect({
                    reconnect: "auto"
                }, new Error("Server didn't acknowledge previous heartbeat, possible lost connection"));
            }
            this.lastHeartbeatAck = false;
        }
        this.lastHeartbeatSent = Date.now();
        this.sendWS(GatewayOPCodes.HEARTBEAT, this.seq, true);
    }

    identify() {
        this.status = "identifying";
        const identify = {
            token: this._token,
            v: GATEWAY_VERSION,
            compress: false,
            large_threshold: this.client.options.largeThreshold,
            intents: this.client.options.intents,
            properties: {
                "os": process.platform,
                "browser": "Eris",
                "device": "Eris"
            }
        };
        if(this.client.options.maxShards > 1) {
            identify.shard = [this.id, this.client.options.maxShards];
        }
        if(this.presence.status) {
            identify.presence = this.presence;
        }
        this.sendWS(GatewayOPCodes.IDENTIFY, identify);
    }

    initializeWS() {
        if(!this._token) {
            return this.disconnect(null, new Error("Token not specified"));
        }

        this.status = "connecting";
        if(this.sessionID) {
            if(!this.resumeURL) {
                this.emit("warn", "Resume url is not currently present. Discord may disconnect you quicker.");
            }
            this.ws = new WebSocket(this.resumeURL || this.client.gatewayURL, this.client.options.ws);
        } else {
            this.ws = new WebSocket(this.client.gatewayURL, this.client.options.ws);
        }
        this.ws.on("open", this._onWSOpen);
        this.ws.on("message", this._onWSMessage);
        this.ws.on("error", this._onWSError);
        this.ws.on("close", this._onWSClose);

        this.connectTimeout = setTimeout(() => {
            if(this.connecting) {
                this.disconnect({
                    reconnect: "auto"
                }, new Error("Connection timeout"));
            }
        }, this.client.options.connectionTimeout);
    }

    onPacket(packet) {
        if(this.listeners("rawWS").length > 0 || this.client.listeners("rawWS").length) {
            /**
            * Fired when the shard receives a websocket packet
            * @event Client#rawWS
            * @prop {Object} packet The packet
            * @prop {Number} id The ID of the shard
            */
            this.emit("rawWS", packet, this.id);
        }

        if(packet.s) {
            if(packet.s > this.seq + 1 && this.ws && this.status !== "resuming") {
                /**
                * Fired to warn of something weird but non-breaking happening
                * @event Client#warn
                * @prop {String} message The warning message
                * @prop {Number} id The ID of the shard
                */
                this.emit("warn", `Non-consecutive sequence (${this.seq} -> ${packet.s})`, this.id);
            }
            this.seq = packet.s;
        }

        switch(packet.op) {
            case GatewayOPCodes.DISPATCH: {
                this.wsEvent(packet);
                break;
            }
            case GatewayOPCodes.HEARTBEAT: {
                this.heartbeat();
                break;
            }
            case GatewayOPCodes.INVALID_SESSION: {
                this.seq = 0;
                this.sessionID = null;
                this.resumeURL = null;
                this.emit("warn", "Invalid session, reidentifying!", this.id);
                this.identify();
                break;
            }
            case GatewayOPCodes.RECONNECT: {
                this.emit("debug", "Reconnecting due to server request", this.id);
                this.disconnect({
                    reconnect: "auto"
                });
                break;
            }
            case GatewayOPCodes.HELLO: {
                if(packet.d.heartbeat_interval > 0) {
                    if(this.heartbeatInterval) {
                        clearInterval(this.heartbeatInterval);
                    }
                    this.heartbeatInterval = setInterval(() => this.heartbeat(true), packet.d.heartbeat_interval);
                }

                this.discordServerTrace = packet.d._trace;
                this.connecting = false;
                if(this.connectTimeout) {
                    clearTimeout(this.connectTimeout);
                }
                this.connectTimeout = null;

                if(this.sessionID) {
                    this.resume();
                } else {
                    this.identify();
                    // Cannot heartbeat when resuming, discord/discord-api-docs#1619
                    this.heartbeat();
                }
                /**
                * Fired when a shard receives an OP:10/HELLO packet
                * @event Client#hello
                * @prop {Array<String>} trace The Discord server trace of the gateway and session servers
                * @prop {Number} id The ID of the shard
                */
                this.emit("hello", packet.d._trace, this.id);
                break; /* eslint-enable no-unreachable */
            }
            case GatewayOPCodes.HEARTBEAT_ACK: {
                this.lastHeartbeatAck = true;
                this.lastHeartbeatReceived = Date.now();
                this.latency = this.lastHeartbeatReceived - this.lastHeartbeatSent;
                break;
            }
            default: {
                this.emit("unknown", packet, this.id);
                break;
            }
        }
    }

    requestGuildMembers(guildID, options) {
        const opts = {
            guild_id: guildID,
            limit: (options && options.limit) || 0,
            user_ids: options && options.userIDs,
            query: options && options.query,
            nonce: Date.now().toString() + Math.random().toString(36),
            presences: options && options.presences
        };
        if(!opts.user_ids && !opts.query) {
            opts.query = "";
        }
        if(!opts.query && !opts.user_ids && (this.client.options.intents && !(this.client.options.intents & Intents.guildMembers))) {
            throw new Error("Cannot request all members without guildMembers intent");
        }
        if(opts.presences && (this.client.options.intents && !(this.client.options.intents & Intents.guildPresences))) {
            throw new Error("Cannot request members presences without guildPresences intent");
        }
        if(opts.user_ids && opts.user_ids.length > 100) {
            throw new Error("Cannot request more than 100 users by their ID");
        }
        this.sendWS(GatewayOPCodes.REQUEST_GUILD_MEMBERS, opts);
        return new Promise((res) => this.requestMembersPromise[opts.nonce] = {
            res: res,
            received: 0,
            members: [],
            timeout: setTimeout(() => {
                res(this.requestMembersPromise[opts.nonce].members);
                delete this.requestMembersPromise[opts.nonce];
            }, (options && options.timeout) || this.client.options.requestTimeout)
        });
    }

    requestGuildSync(guildID) {
        this.sendWS(GatewayOPCodes.SYNC_GUILD, guildID);
    }

    reset() {
        this.connecting = false;
        this.ready = false;
        this.preReady = false;
        if(this.requestMembersPromise !== undefined) {
            for(const guildID in this.requestMembersPromise) {
                if(!this.requestMembersPromise.hasOwnProperty(guildID)) {
                    continue;
                }
                clearTimeout(this.requestMembersPromise[guildID].timeout);
                this.requestMembersPromise[guildID].res(this.requestMembersPromise[guildID].received);
            }
        }
        this.requestMembersPromise = {};
        this.getAllUsersCount = {};
        this.getAllUsersQueue = [];
        this.getAllUsersLength = 1;
        this.guildSyncQueue = [];
        this.guildSyncQueueLength = 1;
        this.unsyncedGuilds = 0;
        this.latency = Infinity;
        this.lastHeartbeatAck = true;
        this.lastHeartbeatReceived = null;
        this.lastHeartbeatSent = null;
        this.status = "disconnected";
        if(this.connectTimeout) {
            clearTimeout(this.connectTimeout);
        }
        this.connectTimeout = null;
    }

    restartGuildCreateTimeout() {
        if(this.guildCreateTimeout) {
            clearTimeout(this.guildCreateTimeout);
            this.guildCreateTimeout = null;
        }
        if(!this.ready) {
            if(this.client.unavailableGuilds.size === 0 && this.unsyncedGuilds === 0) {
                return this.checkReady();
            }
            this.guildCreateTimeout = setTimeout(() => {
                this.checkReady();
            }, this.client.options.guildCreateTimeout);
        }
    }

    resume() {
        this.status = "resuming";
        this.sendWS(GatewayOPCodes.RESUME, {
            token: this._token,
            session_id: this.sessionID,
            seq: this.seq
        });
    }

    sendStatusUpdate() {
        this.sendWS(GatewayOPCodes.PRESENCE_UPDATE, {
            activities: this.presence.activities,
            afk: !!this.presence.afk, // For push notifications
            since: this.presence.status === "idle" ? Date.now() : 0,
            status: this.presence.status
        });
    }

    sendWS(op, _data, priority = false) {
        if(this.ws && this.ws.readyState === WebSocket.OPEN) {
            let i = 0;
            let waitFor = 1;
            const func = () => {
                if(++i >= waitFor && this.ws && this.ws.readyState === WebSocket.OPEN) {
                    const data = JSON.stringify({op: op, d: _data});
                    this.ws.send(data);
                    if(_data.token) {
                        delete _data.token;
                    }
                    this.emit("debug", JSON.stringify({op: op, d: _data}), this.id);
                }
            };
            if(op === GatewayOPCodes.PRESENCE_UPDATE) {
                ++waitFor;
                this.presenceUpdateBucket.queue(func, priority);
            }
            this.globalBucket.queue(func, priority);
        }
    }

    wsEvent(packet) {
        switch(packet.t) { /* eslint-disable no-redeclare */ // (╯°□°）╯︵ ┻━┻
            case "PRESENCE_UPDATE": {
                if(packet.d.user.username !== undefined) {
                    let user = this.client.users.get(packet.d.user.id);
                    let oldUser = null;
                    if(user && (user.username !== packet.d.user.username || user.discriminator !== packet.d.user.discriminator || user.avatar !== packet.d.user.avatar)) {
                        oldUser = {
                            username: user.username,
                            discriminator: user.discriminator,
                            avatar: user.avatar
                        };
                    }
                    if(!user || oldUser) {
                        user = this.client.users.update(packet.d.user, this.client);
                        /**
                        * Fired when a user's avatar, discriminator or username changes
                        * @event Client#userUpdate
                        * @prop {User} user The updated user
                        * @prop {Object?} oldUser The old user data. If the user was uncached, this will be null
                        * @prop {String} oldUser.username The username of the user
                        * @prop {String} oldUser.discriminator The discriminator of the user
                        * @prop {String?} oldUser.avatar The hash of the user's avatar, or null if no avatar
                        */
                        this.emit("userUpdate", user, oldUser);
                    }
                }
                break;
            }
            case "MESSAGE_CREATE": {
                const channel = this.client.getChannel(packet.d.channel_id);
                if(channel) { // MESSAGE_CREATE just when deleting o.o
                    channel.lastMessageID = packet.d.id;
                    /**
                    * Fired when a message is created
                    * @event Client#messageCreate
                    * @prop {Message} message The message.
                    */
                    this.emit("messageCreate", channel.messages.add(packet.d, this.client));
                } else {
                    this.emit("messageCreate", new Message(packet.d, this.client));
                }
                break;
            }
            case "MESSAGE_UPDATE": {
                const channel = this.client.getChannel(packet.d.channel_id);
                if(!channel) {
                    packet.d.channel = {
                        id: packet.d.channel_id
                    };
                    this.emit("messageUpdate", packet.d, null);
                    break;
                }
                const message = channel.messages.get(packet.d.id);
                let oldMessage = null;
                if(message) {
                    oldMessage = {
                        attachments: message.attachments,
                        channelMentions: message.channelMentions,
                        content: message.content,
                        editedTimestamp: message.editedTimestamp,
                        embeds: message.embeds,
                        flags: message.flags,
                        mentionedBy: message.mentionedBy,
                        mentions: message.mentions,
                        pinned: message.pinned,
                        roleMentions: message.roleMentions,
                        tts: message.tts
                    };
                } else if(!packet.d.timestamp) {
                    packet.d.channel = channel;
                    this.emit("messageUpdate", packet.d, null);
                    break;
                }
                /**
                * Fired when a message is updated
                * @event Client#messageUpdate
                * @prop {Message} message The updated message. If oldMessage is null, it is recommended to discard this event, since the message data will be very incomplete (only `id` and `channel` are guaranteed). If the channel isn't cached, `channel` will be an object with an `id` key.
                * @prop {Object?} oldMessage The old message data. If the message was cached, this will return the full old message. Otherwise, it will be null
                * @prop {Array<Object>} oldMessage.attachments Array of attachments
                * @prop {Array<String>} oldMessage.channelMentions Array of mentions channels' ids.
                * @prop {String} oldMessage.content Message content
                * @prop {Number} oldMessage.editedTimestamp Timestamp of latest message edit
                * @prop {Array<Object>} oldMessage.embeds Array of embeds
                * @prop {Number} oldMessage.flags Old message flags (see constants)
                * @prop {Object} oldMessage.mentionedBy Object of if different things mention the bot user
                * @prop {Array<User>} oldMessage.mentions Array of mentioned users' ids
                * @prop {Boolean} oldMessage.pinned Whether the message was pinned or not
                * @prop {Array<String>} oldMessage.roleMentions Array of mentioned roles' ids.
                * @prop {Boolean} oldMessage.tts Whether to play the message using TTS or not
                */
                this.emit("messageUpdate", channel.messages.update(packet.d, this.client), oldMessage);
                break;
            }
            case "MESSAGE_DELETE": {
                const channel = this.client.getChannel(packet.d.channel_id);

                /**
                * Fired when a cached message is deleted
                * @event Client#messageDelete
                * @prop {Message | Object} message The message object. If the message is not cached, this will be an object with `id` and `channel` keys. If the channel is not cached, channel will be an object with an `id` key. If the uncached message is from a guild, the message will also contain a `guildID` key, and the channel will contain a `guild` with an `id` key. No other property is guaranteed.
                */
                this.emit("messageDelete", (channel && channel.messages.remove(packet.d)) || {
                    id: packet.d.id,
                    channel: channel || {
                        id: packet.d.channel_id,
                        guild: packet.d.guild_id ? {id: packet.d.guild_id} : undefined
                    },
                    guildID: packet.d.guild_id
                });
                break;
            }
            case "MESSAGE_DELETE_BULK": {
                const channel = this.client.getChannel(packet.d.channel_id);

                /**
                * Fired when a bulk delete occurs
                * @event Client#messageDeleteBulk
                * @prop {Array<Message> | Array<Object>} messages An array of (potentially partial) message objects. If a message is not cached, it will be an object with `id` and `channel` keys If the uncached messages are from a guild, the messages will also contain a `guildID` key, and the channel will contain a `guild` with an `id` key. No other property is guaranteed
                */
                this.emit("messageDeleteBulk", packet.d.ids.map((id) => (channel && channel.messages.remove({
                    id
                }) || {
                    id: id,
                    channel: {id: packet.d.channel_id, guild: packet.d.guild_id ? {id: packet.d.guild_id} : undefined},
                    guildID: packet.d.guild_id
                })));
                break;
            }
            case "GUILD_MEMBER_ADD": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) { // Eventual Consistency™ (╯°□°）╯︵ ┻━┻
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_MEMBER_ADD`);
                    break;
                }
                packet.d.id = packet.d.user.id;
                ++guild.memberCount;
                /**
                * Fired when a member joins a server
                * @event Client#guildMemberAdd
                * @prop {Guild} guild The guild
                * @prop {Member} member The member
                */
                this.emit("guildMemberAdd", guild, guild.members.add(packet.d, guild));
                break;
            }
            case "GUILD_MEMBER_UPDATE": {
                // Check for member update if guildPresences intent isn't set, to prevent emitting twice
                if(!(this.client.options.intents & Intents.guildPresences) && packet.d.user.username !== undefined) {
                    let user = this.client.users.get(packet.d.user.id);
                    let oldUser = null;
                    if(user && (user.username !== packet.d.user.username || user.discriminator !== packet.d.user.discriminator || user.avatar !== packet.d.user.avatar)) {
                        oldUser = {
                            username: user.username,
                            discriminator: user.discriminator,
                            avatar: user.avatar
                        };
                    }
                    if(!user || oldUser) {
                        user = this.client.users.update(packet.d.user, this.client);
                        this.emit("userUpdate", user, oldUser);
                    }
                }
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_MEMBER_UPDATE`);
                    break;
                }
                let member = guild.members.get(packet.d.id = packet.d.user.id);
                let oldMember = null;
                if(member) {
                    oldMember = {
                        avatar: member.avatar,
                        communicationDisabledUntil: member.communicationDisabledUntil,
                        roles: member.roles,
                        nick: member.nick,
                        premiumSince: member.premiumSince,
                        pending: member.pending
                    };
                }
                member = guild.members.update(packet.d, guild);
                /**
                * Fired when a member's guild avatar, roles or nickname are updated or they start boosting a server
                * @event Client#guildMemberUpdate
                * @prop {Guild} guild The guild
                * @prop {Member} member The updated member
                * @prop {Object?} oldMember The old member data, or null if the member wasn't cached
                * @prop {String?} oldMember.avatar The hash of the member's guild avatar, or null if no guild avatar
                * @prop {Number?} communicationDisabledUntil Timestamp of previous timeout expiry. If `null`, the member was not timed out
                * @prop {Array<String>} oldMember.roles An array of role IDs this member is a part of
                * @prop {String?} oldMember.nick The server nickname of the member
                * @prop {Number?} oldMember.premiumSince Timestamp of when the member boosted the guild
                * @prop {Boolean?} oldMember.pending Whether the member has passed the guild's Membership Screening requirements
                */
                this.emit("guildMemberUpdate", guild, member, oldMember);
                break;
            }
            case "GUILD_MEMBER_REMOVE": {
                if(packet.d.user.id === this.client.user.id) { // The bot is probably leaving
                    break;
                }
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    break;
                }
                --guild.memberCount;
                packet.d.id = packet.d.user.id;
                /**
                * Fired when a member leaves a server
                * @event Client#guildMemberRemove
                * @prop {Guild} guild The guild
                * @prop {Member | Object} member The member. If the member is not cached, this will be an object with `id` and `user` key
                */
                this.emit("guildMemberRemove", guild, guild.members.remove(packet.d) || {
                    id: packet.d.id,
                    user: new User(packet.d.user, this.client)
                });
                break;
            }
            case "GUILD_CREATE": {
                if(!packet.d.unavailable) {
                    const guild = this.createGuild(packet.d);
                    if(this.ready) {
                        if(this.client.unavailableGuilds.remove(packet.d)) {
                            /**
                            * Fired when a guild becomes available
                            * @event Client#guildAvailable
                            * @prop {Guild} guild The guild
                            */
                            this.emit("guildAvailable", guild);
                        } else {
                            /**
                            * Fired when a guild is created. This happens when:
                            * - the client creates a guild
                            * - the client joins a guild
                            * @event Client#guildCreate
                            * @prop {Guild} guild The guild
                            */
                            this.emit("guildCreate", guild);
                        }
                    } else {
                        this.client.unavailableGuilds.remove(packet.d);
                        this.restartGuildCreateTimeout();
                    }
                } else {
                    this.client.guilds.remove(packet.d);
                    /**
                    * Fired when an unavailable guild is created
                    * @event Client#unavailableGuildCreate
                    * @prop {UnavailableGuild} guild The unavailable guild
                    */
                    this.emit("unavailableGuildCreate", this.client.unavailableGuilds.add(packet.d, this.client));
                }
                break;
            }
            case "GUILD_UPDATE": {
                const guild = this.client.guilds.get(packet.d.id);
                if(!guild) {
                    this.emit("debug", `Guild ${packet.d.id} undefined in GUILD_UPDATE`);
                    break;
                }
                this.client.guilds.update(packet.d, this.client)
                break;
            }
            case "GUILD_DELETE": {
                delete this.client.guildShardMap[packet.d.id];
                const guild = this.client.guilds.remove(packet.d);
                if(guild) { // Discord sends GUILD_DELETE for guilds that were previously unavailable in READY
                    guild.channels.forEach((channel) => {
                        delete this.client.channelGuildMap[channel.id];
                    });
                }
                if(packet.d.unavailable) {
                    /**
                    * Fired when a guild becomes unavailable
                    * @event Client#guildUnavailable
                    * @prop {Guild} guild The guild
                    */
                    this.emit("guildUnavailable", this.client.unavailableGuilds.add(packet.d, this.client));
                } else {
                    /**
                    * Fired when a guild is deleted. This happens when:
                    * - the client left the guild
                    * - the client was kicked/banned from the guild
                    * - the guild was literally deleted
                    * @event Client#guildDelete
                    * @prop {Guild | Object} guild The guild. If the guild was not cached, it will be an object with an `id` key. No other property is guaranteed
                    */
                    this.emit("guildDelete", guild || {
                        id: packet.d.id
                    });
                }
                break;
            }
            case "GUILD_BAN_ADD": {
                /**
                * Fired when a user is banned from a guild
                * @event Client#guildBanAdd
                * @prop {Guild} guild The guild
                * @prop {User} user The banned user
                */
                this.emit("guildBanAdd", this.client.guilds.get(packet.d.guild_id), this.client.users.update(packet.d.user, this.client));
                break;
            }
            case "GUILD_ROLE_CREATE": {
                /**
                * Fired when a guild role is created
                * @event Client#guildRoleCreate
                * @prop {Guild} guild The guild
                * @prop {Role} role The role
                */
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_ROLE_CREATE`);
                    break;
                }
                this.emit("guildRoleCreate", guild, guild.roles.add(packet.d.role, guild));
                break;
            }
            case "GUILD_ROLE_UPDATE": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Guild ${packet.d.guild_id} undefined in GUILD_ROLE_UPDATE`);
                    break;
                }
                const role = guild.roles.add(packet.d.role, guild);
                if(!role) {
                    this.emit("debug", `Role ${packet.d.role} in guild ${packet.d.guild_id} undefined in GUILD_ROLE_UPDATE`);
                    break;
                }
                const oldRole = {
                    color: role.color,
                    hoist: role.hoist,
                    icon: role.icon,
                    managed: role.managed,
                    mentionable: role.mentionable,
                    name: role.name,
                    permissions: role.permissions,
                    position: role.position,
                    tags: role.tags,
                    unicodeEmoji: role.unicodeEmoji
                };
                /**
                * Fired when a guild role is updated
                * @event Client#guildRoleUpdate
                * @prop {Guild} guild The guild
                * @prop {Role} role The updated role
                * @prop {Object} oldRole The old role data
                * @prop {Number} oldRole.color The hex color of the role in base 10
                * @prop {Boolean} oldRole.hoist Whether users with this role are hoisted in the user list or not
                * @prop {String?} oldRole.icon The hash of the role's icon, or null if no icon
                * @prop {Boolean} oldRole.managed Whether a guild integration manages this role or not
                * @prop {Boolean} oldRole.mentionable Whether the role is mentionable or not
                * @prop {String} oldRole.name The name of the role
                * @prop {Permission} oldRole.permissions The permissions number of the role
                * @prop {Number} oldRole.position The position of the role
                * @prop {Object?} oldRole.tags The tags of the role
                * @prop {String?} oldRole.unicodeEmoji Unicode emoji for the role
                */
                this.emit("guildRoleUpdate", guild, guild.roles.update(packet.d.role, guild), oldRole);
                break;
            }
            case "GUILD_ROLE_DELETE": {
                /**
                * Fired when a guild role is deleted
                * @event Client#guildRoleDelete
                * @prop {Guild} guild The guild
                * @prop {Role} role The role
                */
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in GUILD_ROLE_DELETE`);
                    break;
                }
                if(!guild.roles.has(packet.d.role_id)) {
                    this.emit("debug", `Missing role ${packet.d.role_id} in GUILD_ROLE_DELETE`);
                    break;
                }
                this.emit("guildRoleDelete", guild, guild.roles.remove({id: packet.d.role_id}));
                break;
            }
            case "CHANNEL_CREATE": {
                const channel = Channel.from(packet.d, this.client);
                if (!channel){
                    break;
                }
                if(packet.d.guild_id) {
                    if(!channel.guild) {
                        channel.guild = this.client.guilds.get(packet.d.guild_id);
                        if(!channel.guild) {
                            this.emit("debug", `Received CHANNEL_CREATE for channel in missing guild ${packet.d.guild_id}`);
                            break;
                        }
                    }
                    channel.guild.channels.add(channel, this.client);
                    this.client.channelGuildMap[packet.d.id] = packet.d.guild_id;
                    /**
                    * Fired when a channel is created
                    * @event Client#channelCreate
                    * @prop {TextChannel | TextVoiceChannel | CategoryChannel | StoreChannel | NewsChannel | GuildChannel} channel The channel
                    */
                    this.emit("channelCreate", channel);
                } else {
                    this.emit("warn", new Error("Unhandled CHANNEL_CREATE type: " + JSON.stringify(packet, null, 2)));
                    break;
                }
                break;
            }
            case "CHANNEL_UPDATE": {
                let channel = this.client.getChannel(packet.d.id);
                if(!channel) {
                    break;
                }
                let oldChannel;
                if(channel instanceof GuildChannel) {
                    oldChannel = {
                        bitrate: channel.bitrate,
                        name: channel.name,
                        nsfw: channel.nsfw,
                        parentID: channel.parentID,
                        permissionOverwrites: channel.permissionOverwrites,
                        position: channel.position,
                        rateLimitPerUser: channel.rateLimitPerUser,
                        rtcRegion: channel.rtcRegion,
                        topic: channel.topic,
                        type: channel.type,
                        userLimit: channel.userLimit,
                        videoQualityMode: channel.videoQualityMode
                    };
                } else {
                    this.emit("warn", `Unexpected CHANNEL_UPDATE for channel ${packet.d.id} with type ${oldType}`);
                }
                const oldType = channel.type;
                if(oldType === packet.d.type) {
                    channel.update(packet.d);
                } else {
                    this.emit("debug", `Channel ${packet.d.id} changed from type ${oldType} to ${packet.d.type}`);
                    const newChannel = Channel.from(packet.d, this.client);
                    if (!newChannel){
                        break;
                    }
                    if(packet.d.guild_id) {
                        const guild = this.client.guilds.get(packet.d.guild_id);
                        if(!guild) {
                            this.emit("debug", `Received CHANNEL_UPDATE for channel in missing guild ${packet.d.guild_id}`);
                            break;
                        }
                        guild.channels.remove(channel);
                        guild.channels.add(newChannel, this.client);
                    } else if(channel.type === 1) {
                        this.client.privateChannels.remove(channel);
                        this.client.privateChannels.add(newChannel, this.client);
                    } else {
                        this.emit("warn", new Error("Unhandled CHANNEL_UPDATE type: " + JSON.stringify(packet, null, 2)));
                        break;
                    }
                    channel = newChannel;
                }

                /**
                * Fired when a channel is updated
                * @event Client#channelUpdate
                * @prop {TextChannel | TextVoiceChannel | CategoryChannel | StoreChannel | NewsChannel | GuildChannel | PrivateChannel} channel The updated channel
                * @prop {Object} oldChannel The old channel data
                * @prop {Number} oldChannel.bitrate The bitrate of the channel (voice channels only)
                * @prop {String} oldChannel.name The name of the channel
                * @prop {Boolean} oldChannel.nsfw Whether the channel is NSFW or not (text channels only)
                * @prop {String?} oldChannel.parentID The ID of the category this channel belongs to (guild channels only)
                * @prop {Collection} oldChannel.permissionOverwrites Collection of PermissionOverwrites in this channel (guild channels only)
                * @prop {Number} oldChannel.position The position of the channel (guild channels only)
                * @prop {Number?} oldChannel.rateLimitPerUser The ratelimit of the channel, in seconds. 0 means no ratelimit is enabled (text channels only)
                * @prop {String?} oldChannel.rtcRegion The RTC region ID of the channel (automatic when `null`) (voice channels only)
                * @prop {String?} oldChannel.topic The topic of the channel (text channels only)
                * @prop {Number} oldChannel.type The type of the old channel (text/news channels only)
                * @prop {Number?} oldChannel.userLimit The max number of users that can join the channel (voice channels only)
                * @prop {Number?} oldChannel.videoQualityMode The camera video quality mode of the channel (voice channels only)
                */
                this.emit("channelUpdate", channel, oldChannel);
                break;
            }
            case "CHANNEL_DELETE": {
                if(packet.d.type === 1 || packet.d.type === undefined) {
                    if(this.id === 0) {
                        const channel = this.client.privateChannels.remove(packet.d);
                        if(channel) {
                            delete this.client.privateChannelMap[channel.recipient.id];
                            /**
                            * Fired when a channel is deleted
                            * @event Client#channelDelete
                            * @prop {PrivateChannel | TextChannel | NewsChannel | TextVoiceChannel | CategoryChannel} channel The channel
                            */
                            this.emit("channelDelete", channel);
                        }
                    }
                } else if(packet.d.guild_id) {
                    delete this.client.channelGuildMap[packet.d.id];
                    const guild = this.client.guilds.get(packet.d.guild_id);
                    if(!guild) {
                        this.emit("debug", `Missing guild ${packet.d.guild_id} in CHANNEL_DELETE`);
                        break;
                    }
                    const channel = guild.channels.remove(packet.d);
                    if(!channel) {
                        break;
                    }
                    this.emit("channelDelete", channel);
                } else {
                    this.emit("warn", new Error("Unhandled CHANNEL_DELETE type: " + JSON.stringify(packet, null, 2)));
                }
                break;
            }
            case "GUILD_MEMBERS_CHUNK": {
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Received GUILD_MEMBERS_CHUNK, but guild ${packet.d.guild_id} is ` + (this.client.unavailableGuilds.has(packet.d.guild_id) ? "unavailable" : "missing"), this.id);
                    break;
                }

                const members = packet.d.members.map((member) => {
                    member.id = member.user.id;
                    return guild.members.add(member, guild);
                });

                if(packet.d.presences) {
                    packet.d.presences.forEach((presence) => {
                        const member = guild.members.get(presence.user.id);
                        if(member) {
                            member.update(presence);
                        }
                    });
                }

                if(this.requestMembersPromise.hasOwnProperty(packet.d.nonce)) {
                    this.requestMembersPromise[packet.d.nonce].members.push(...members);
                }

                if(packet.d.chunk_index >= packet.d.chunk_count - 1) {
                    if(this.requestMembersPromise.hasOwnProperty(packet.d.nonce)) {
                        clearTimeout(this.requestMembersPromise[packet.d.nonce].timeout);
                        this.requestMembersPromise[packet.d.nonce].res(this.requestMembersPromise[packet.d.nonce].members);
                        delete this.requestMembersPromise[packet.d.nonce];
                    }
                    if(this.getAllUsersCount.hasOwnProperty(guild.id)) {
                        delete this.getAllUsersCount[guild.id];
                        this.checkReady();
                    }
                }

                /**
                * Fired when Discord sends member chunks
                * @event Client#guildMemberChunk
                * @prop {Guild} guild The guild the chunked members are in
                * @prop {Array<Member>} members The members in the chunk
                */
                this.emit("guildMemberChunk", guild, members);

                this.lastHeartbeatAck = true;

                break;
            }
            case "RESUMED":
            case "READY": {
                this.connectAttempts = 0;
                this.reconnectInterval = 1000;

                this.connecting = false;
                if(this.connectTimeout) {
                    clearTimeout(this.connectTimeout);
                }
                this.connectTimeout = null;
                this.status = "ready";
                this.presence.status = "online";
                this.client.shards._readyPacketCB(this.id);
                if(packet.t === "RESUMED") {
                    // Can only heartbeat after resume succeeds, discord/discord-api-docs#1619
                    this.heartbeat();

                    this.preReady = true;
                    this.ready = true;

                    /**
                    * Fired when a shard finishes resuming
                    * @event Shard#resume
                    */
                    super.emit("resume");
                    break;
                } else {
                    this.resumeURL = `${packet.d.resume_gateway_url}?v=${GATEWAY_VERSION}&encoding=json`;
                }

                this.client.user = this.client.users.update(new User(packet.d.user, this.client), this.client);
                if(this.client.user.bot) {
                    this.client.bot = true;
                }

                if(packet.d._trace) {
                    this.discordServerTrace = packet.d._trace;
                }

                this.sessionID = packet.d.session_id;

                packet.d.guilds.forEach((guild) => {
                    if(guild.unavailable) {
                        this.client.guilds.remove(guild);
                        this.client.unavailableGuilds.add(guild, this.client, true);
                    } else {
                        this.client.unavailableGuilds.remove(this.createGuild(guild));
                    }
                });

                packet.d.private_channels.forEach((channel) => {
                    if(channel.type === undefined || channel.type === 1) {
                        this.client.privateChannelMap[channel.recipients[0].id] = channel.id;
                        this.client.privateChannels.add(channel, this.client, true);
                    } else {
                        this.emit("warn", new Error("Unhandled READY private_channel type: " + JSON.stringify(channel, null, 2)));
                    }
                });

                if(packet.d.presences) {
                    packet.d.presences.forEach((presence) => {
                        if(this.client.relationships.get(presence.user.id)) { // Avoid DM channel presences which are also in here
                            presence.id = presence.user.id;
                            this.client.relationships.update(presence, null, true);
                        }
                    });
                }

                this.client.application = packet.d.application;

                this.preReady = true;
                /**
                * Fired when a shard finishes processing the ready packet
                * @event Client#shardPreReady
                * @prop {Number} id The ID of the shard
                */
                this.emit("shardPreReady", this.id);

                if(this.client.unavailableGuilds.size > 0 && packet.d.guilds.length > 0) {
                    this.restartGuildCreateTimeout();
                } else {
                    this.checkReady();
                }

                break;
            }
            case "USER_UPDATE": {
                let user = this.client.users.get(packet.d.id);
                let oldUser = null;
                if(user) {
                    oldUser = {
                        username: user.username,
                        discriminator: user.discriminator,
                        avatar: user.avatar
                    };
                }
                user = this.client.users.update(packet.d, this.client);
                this.emit("userUpdate", user, oldUser);
                break;
            }
            case "THREAD_CREATE": {
                const channel = Channel.from(packet.d, this.client);
                if (!channel){
                    break;
                }
                if(!channel.guild) {
                    channel.guild = this.client.guilds.get(packet.d.guild_id);
                    if(!channel.guild) {
                        this.emit("debug", `Received THREAD_CREATE for channel in missing guild ${packet.d.guild_id}`);
                        break;
                    }
                }
                channel.guild.threads.add(channel, this.client);
                this.client.threadGuildMap[packet.d.id] = packet.d.guild_id;
                /**
                * Fired when a channel is created
                * @event Client#threadCreate
                * @prop {NewsThreadChannel | PrivateThreadChannel | PublicThreadChannel} channel The channel
                */
                this.emit("threadCreate", channel);
                break;
            }
            case "THREAD_UPDATE": {
                const channel = this.client.getChannel(packet.d.id);
                if(!channel) {
                    const thread = Channel.from(packet.d, this.client);
                    if (!thread){
                        break;
                    }
                    this.emit("threadUpdate", this.client.guilds.get(packet.d.guild_id).threads.add(thread, this.client), null);
                    this.client.threadGuildMap[packet.d.id] = packet.d.guild_id;
                    break;
                }
                if(!(channel instanceof ThreadChannel)) {
                    this.emit("warn", `Unexpected THREAD_UPDATE for channel ${packet.d.id} with type ${channel.type}`);
                    break;
                }
                const oldChannel = {
                    name: channel.name,
                    rateLimitPerUser: channel.rateLimitPerUser,
                    threadMetadata: channel.threadMetadata
                };
                channel.update(packet.d);

                /**
                * Fired when a thread channel is updated
                * @event Client#threadUpdate
                * @prop {NewsThreadChannel | PrivateThreadChannel | PublicThreadChannel} channel The updated channel
                * @prop {Object?} oldChannel The old thread channel. This will be null if the channel was uncached
                * @prop {String} oldChannel.name The name of the channel
                * @prop {Number} oldChannel.rateLimitPerUser The ratelimit of the channel, in seconds. 0 means no ratelimit is enabled
                * @prop {Object} oldChannel.threadMetadata Metadata for the thread
                * @prop {Number} oldChannel.threadMetadata.archiveTimestamp Timestamp when the thread's archive status was last changed, used for calculating recent activity
                * @prop {Boolean} oldChannel.threadMetadata.archived Whether the thread is archived
                * @prop {Number} oldChannel.threadMetadata.autoArchiveDuration Duration in minutes to automatically archive the thread after recent activity, either 60, 1440, 4320 or 10080
                * @prop {Boolean?} oldChannel.threadMetadata.locked Whether the thread is locked
                */
                this.emit("threadUpdate", channel, oldChannel);
                break;
            }
            case "THREAD_DELETE": {
                delete this.client.threadGuildMap[packet.d.id];
                const guild = this.client.guilds.get(packet.d.guild_id);
                if(!guild) {
                    this.emit("debug", `Missing guild ${packet.d.guild_id} in THREAD_DELETE`);
                    break;
                }
                const channel = guild.threads.remove(packet.d);
                if(!channel) {
                    break;
                }
                /**
                * Fired when a thread channel is deleted
                * @event Client#threadDelete
                * @prop {NewsThreadChannel | PrivateThreadChannel | PublicThreadChannel} channel The channel
                */
                this.emit("threadDelete", channel);
                break;
            }
            case "INTERACTION_CREATE": {
                switch(packet.d.type) {
                    case InteractionTypes.APPLICATION_COMMAND: {
                        this.emit("interactionCreate", new CommandInteraction(packet.d, this.client));
                    }
                    case InteractionTypes.MESSAGE_COMPONENT: {
                        this.emit("componentInteract", new ComponentInteraction(packet.d, this.client));
                    }
                }
                break;
            }
            default: {
                break;
            }
        }
    }

    _onWSClose(code, reason) {
        reason = reason.toString();
        this.emit("debug", "WS disconnected: " + JSON.stringify({
            code: code,
            reason: reason,
            status: this.status
        }));
        let err = !code || code === 1000 ? null : new Error(code + ": " + reason);
        let reconnect = "auto";
        if(code) {
            this.emit("debug", `${code === 1000 ? "Clean" : "Unclean"} WS close: ${code}: ${reason}`, this.id);
            if(code === 4001) {
                err = new Error("Gateway received invalid OP code");
            } else if(code === 4002) {
                err = new Error("Gateway received invalid message");
            } else if(code === 4003) {
                err = new Error("Not authenticated");
                this.sessionID = null;
                this.resumeURL = null;
            } else if(code === 4004) {
                err = new Error("Authentication failed");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
                this.emit("error", new Error(`Invalid token: ${this._token}`));
            } else if(code === 4005) {
                err = new Error("Already authenticated");
            } else if(code === 4006 || code === 4009) {
                err = new Error("Invalid session");
                this.sessionID = null;
                this.resumeURL = null;
            } else if(code === 4007) {
                err = new Error("Invalid sequence number: " + this.seq);
                this.seq = 0;
            } else if(code === 4008) {
                err = new Error("Gateway connection was ratelimited");
            } else if(code === 4010) {
                err = new Error("Invalid shard key");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 4011) {
                err = new Error("Shard has too many guilds (>2500)");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 4013) {
                err = new Error("Invalid intents specified");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 4014) {
                err = new Error("Disallowed intents specified");
                this.sessionID = null;
                this.resumeURL = null;
                reconnect = false;
            } else if(code === 1006) {
                err = new Error("Connection reset by peer");
            } else if(code !== 1000 && reason) {
                err = new Error(code + ": " + reason);
            }
            if(err) {
                err.code = code;
            }
        } else {
            this.emit("debug", "WS close: unknown code: " + reason, this.id);
        }
        this.disconnect({
            reconnect
        }, err);
    }

    _onWSError(err) {
        this.emit("error", err, this.id);
    }

    _onWSMessage(data) {
        try {
            return this.onPacket(JSON.parse(data.toString()));
        } catch(err) {
            this.emit("error", err, this.id);
        }
    }

    _onWSOpen() {
        this.status = "handshaking";
        /**
        * Fired when the shard establishes a connection
        * @event Client#connect
        * @prop {Number} id The ID of the shard
        */
        this.emit("connect", this.id);
        this.lastHeartbeatAck = true;
    }

}