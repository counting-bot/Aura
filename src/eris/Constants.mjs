export const GATEWAY_VERSION = 10;
export const REST_VERSION = 10;
export const BASE_URL = "https://discord.com";
export const API_URL = `${BASE_URL}/api/v${REST_VERSION}`;
export const VERSION = "0.17.2-dev";
export const USER_AGENT = `DiscordBot (https://github.com/abalabahaha/eris, ${VERSION})`;
export const RESTMethods = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE"
] 

export const GatewayOPCodes = {
    DISPATCH:              0,
    HEARTBEAT:             1,
    IDENTIFY:              2,
    PRESENCE_UPDATE:       3,
    RESUME:                6,
    RECONNECT:             7,
    REQUEST_GUILD_MEMBERS: 8,
    INVALID_SESSION:       9,
    HELLO:                 10,
    HEARTBEAT_ACK:         11,
    SYNC_GUILD:            12,
};

export const Intents = {
    guilds:                 1 << 0,
    guildMembers:           1 << 1,
    guildBans:              1 << 2,
    guildEmojisAndStickers: 1 << 3,
    guildIntegrations:      1 << 4,
    guildWebhooks:          1 << 5,
    guildInvites:           1 << 6,
    guildVoiceStates:       1 << 7,
    guildPresences:         1 << 8,
    guildMessages:          1 << 9,
    guildMessageReactions:  1 << 10,
    guildMessageTyping:     1 << 11,
    directMessages:         1 << 12,
    directMessageReactions: 1 << 13,
    directMessageTyping:    1 << 14,
    messageContent:         1 << 15
};

export const InteractionResponseTypes = {
    PONG:                                    1,
    CHANNEL_MESSAGE_WITH_SOURCE:             4,
    DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE:    5,
    DEFERRED_UPDATE_MESSAGE:                 6,
    UPDATE_MESSAGE:                          7,
    APPLICATION_COMMAND_AUTOCOMPLETE_RESULT: 8
};

export const InteractionTypes = {
    PING:                             1,
    APPLICATION_COMMAND:              2,
    MESSAGE_COMPONENT:                3,
    APPLICATION_COMMAND_AUTOCOMPLETE: 4
};

const PermissionsOBJ = {
    createInstantInvite:     1n << 0n,
    kickMembers:             1n << 1n,
    banMembers:              1n << 2n,
    administrator:           1n << 3n,
    manageChannels:          1n << 4n,
    manageGuild:             1n << 5n,
    addReactions:            1n << 6n,
    viewAuditLog:            1n << 7n,
    voicePrioritySpeaker:    1n << 8n,
    voiceStream:             1n << 9n,
    viewChannel:             1n << 10n,
    sendMessages:            1n << 11n,
    sendTTSMessages:         1n << 12n,
    manageMessages:          1n << 13n,
    embedLinks:              1n << 14n,
    attachFiles:             1n << 15n,
    readMessageHistory:      1n << 16n,
    mentionEveryone:         1n << 17n,
    useExternalEmojis:       1n << 18n,
    viewGuildInsights:       1n << 19n,
    voiceConnect:            1n << 20n,
    voiceSpeak:              1n << 21n,
    voiceMuteMembers:        1n << 22n,
    voiceDeafenMembers:      1n << 23n,
    voiceMoveMembers:        1n << 24n,
    voiceUseVAD:             1n << 25n,
    changeNickname:          1n << 26n,
    manageNicknames:         1n << 27n,
    manageRoles:             1n << 28n,
    manageWebhooks:          1n << 29n,
    manageEmojisAndStickers: 1n << 30n,
    useApplicationCommands:  1n << 31n,
    voiceRequestToSpeak:     1n << 32n,
    manageEvents:            1n << 33n,
    manageThreads:           1n << 34n,
    createPublicThreads:     1n << 35n,
    createPrivateThreads:    1n << 36n,
    useExternalStickers:     1n << 37n,
    sendMessagesInThreads:   1n << 38n,
    startEmbeddedActivities: 1n << 39n,
    moderateMembers:         1n << 40n
};
PermissionsOBJ.allGuild = PermissionsOBJ.kickMembers
    | PermissionsOBJ.banMembers
    | PermissionsOBJ.administrator
    | PermissionsOBJ.manageChannels
    | PermissionsOBJ.manageGuild
    | PermissionsOBJ.viewAuditLog
    | PermissionsOBJ.viewGuildInsights
    | PermissionsOBJ.changeNickname
    | PermissionsOBJ.manageNicknames
    | PermissionsOBJ.manageRoles
    | PermissionsOBJ.manageWebhooks
    | PermissionsOBJ.manageEmojisAndStickers
    | PermissionsOBJ.manageEvents
    | PermissionsOBJ.moderateMembers;
    PermissionsOBJ.allText = PermissionsOBJ.createInstantInvite
    | PermissionsOBJ.manageChannels
    | PermissionsOBJ.addReactions
    | PermissionsOBJ.viewChannel
    | PermissionsOBJ.sendMessages
    | PermissionsOBJ.sendTTSMessages
    | PermissionsOBJ.manageMessages
    | PermissionsOBJ.embedLinks
    | PermissionsOBJ.attachFiles
    | PermissionsOBJ.readMessageHistory
    | PermissionsOBJ.mentionEveryone
    | PermissionsOBJ.useExternalEmojis
    | PermissionsOBJ.manageRoles
    | PermissionsOBJ.manageWebhooks
    | PermissionsOBJ.useApplicationCommands
    | PermissionsOBJ.manageThreads
    | PermissionsOBJ.createPublicThreads
    | PermissionsOBJ.createPrivateThreads
    | PermissionsOBJ.useExternalStickers
    | PermissionsOBJ.sendMessagesInThreads;
PermissionsOBJ.all = PermissionsOBJ.allGuild | PermissionsOBJ.allText;
export const Permissions = PermissionsOBJ;