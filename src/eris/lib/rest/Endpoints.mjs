import { REST_VERSION } from "../Constants.mjs";

export const BASE_URL = "/api/v" + REST_VERSION;
export const CDN_URL = "https://cdn.discordapp.com";
export const CLIENT_URL = "https://discord.com";

export const COMMAND =                              (applicationID, commandID) => `/applications/${applicationID}/commands/${commandID}`;
export const COMMANDS =                                        (applicationID) => `/applications/${applicationID}/commands`;
export const COMMAND_PERMISSIONS =         (applicationID, guildID, commandID) => `/applications/${applicationID}/guilds/${guildID}/commands/${commandID}/permissions`;
export const CHANNEL =                                                (chanID) => `/channels/${chanID}`;
export const CHANNEL_INVITES =                                        (chanID) => `/channels/${chanID}/invites`;
export const CHANNEL_MESSAGE_REACTION_USER = (chanID, msgID, reaction, userID) => `/channels/${chanID}/messages/${msgID}/reactions/${reaction}/${userID}`;
export const CHANNEL_MESSAGE =                                 (chanID, msgID) => `/channels/${chanID}/messages/${msgID}`;
export const CHANNEL_MESSAGES =                                       (chanID) => `/channels/${chanID}/messages`;
export const CHANNEL_PERMISSION =                             (chanID, overID) => `/channels/${chanID}/permissions/${overID}`;
export const CHANNEL_WEBHOOKS =                                       (chanID) => `/channels/${chanID}/webhooks`;
export const CHANNELS =                                                           "/channels";
export const GATEWAY =                                                            "/gateway";
export const GATEWAY_BOT =                                                        "/gateway/bot";
export const GUILD_BAN =                                   (guildID, memberID) => `/guilds/${guildID}/bans/${memberID}`;
export const GUILD_CHANNELS =                                        (guildID) => `/guilds/${guildID}/channels`;
export const GUILD_COMMAND =               (applicationID, guildID, commandID) => `/applications/${applicationID}/guilds/${guildID}/commands/${commandID}`;
export const GUILD_COMMAND_PERMISSIONS =                    (applicationID, guildID) => `/applications/${applicationID}/guilds/${guildID}/commands/permissions`;
export const GUILD_MEMBER =                                (guildID, memberID) => `/guilds/${guildID}/members/${memberID}`;
export const GUILD_MEMBER_ROLE =                   (guildID, memberID, roleID) => `/guilds/${guildID}/members/${memberID}/roles/${roleID}`;
export const GUILD_WEBHOOKS =                                        (guildID) => `/guilds/${guildID}/webhooks`;
export const GUILD_WELCOME_SCREEN =                                  (guildID) => `/guilds/${guildID}/welcome-screen`;
export const INTERACTION_RESPOND =                 (interactID, interactToken) => `/interactions/${interactID}/${interactToken}/callback`;
export const OAUTH2_APPLICATION =                                      (appID) => `/oauth2/applications/${appID}`;
export const THREAD_MEMBER =                               (channelID, userID) => `/channels/${channelID}/thread-members/${userID}`;
export const THREAD_MEMBERS =                                      (channelID) => `/channels/${channelID}/thread-members`;
export const THREAD_WITH_MESSAGE =                          (channelID, msgID) => `/channels/${channelID}/messages/${msgID}/threads`;
export const THREAD_WITHOUT_MESSAGE =                              (channelID) => `/channels/${channelID}/threads`;
export const THREADS_ARCHIVED =                              (channelID, type) => `/channels/${channelID}/threads/archived/${type}`;
export const THREADS_ARCHIVED_JOINED =                             (channelID) => `/channels/${channelID}/users/@me/threads/archived/private`;
export const THREADS_GUILD_ACTIVE =                                  (guildID) => `/guilds/${guildID}/threads/active`;
export const USER_CHANNELS =                                          (userID) => `/users/${userID}/channels`;
export const WEBHOOK =                                                (hookID) => `/webhooks/${hookID}`;
export const WEBHOOK_MESSAGE =                          (hookID, token, msgID) => `/webhooks/${hookID}/${token}/messages/${msgID}`;
export const WEBHOOK_TOKEN =                                   (hookID, token) => `/webhooks/${hookID}/${token}`;
export const WEBHOOK_TOKEN_SLACK =                             (hookID, token) => `/webhooks/${hookID}/${token}/slack`;

// CDN Endpoints
export const DEFAULT_USER_AVATAR =                         (userDiscriminator) => `/embed/avatars/${userDiscriminator}`;
export const GUILD_ICON =                                 (guildID, guildIcon) => `/icons/${guildID}/${guildIcon}`;
export const USER_AVATAR =                                (userID, userAvatar) => `/avatars/${userID}/${userAvatar}`;