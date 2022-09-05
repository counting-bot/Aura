import Base from "./Base.mjs";

/**
* Represents an invite. Some properties are only available when fetching invites from channels, which requires the Manage Channel permission.
* @prop {TextChannel | NewsChannel | TextVoiceChannel | GroupChannel | StageChannel | Object} channel Info on the invite channel
* @prop {String} channel.id The ID of the invite's channel
* @prop {String?} channel.name The name of the invite's channel
* @prop {Number} channel.type The type of the invite's channel
* @prop {String?} channel.icon The icon of a channel (group dm)
* @prop {String} code The invite code
* @prop {Number?} createdAt Timestamp of invite creation
* @prop {Guild?} guild Info on the invite guild
* @prop {User?} inviter The invite creator
* @prop {Number?} maxAge How long the invite lasts in seconds
* @prop {Number?} maxUses The max number of invite uses
* @prop {Number?} memberCount The **approximate** member count for the guild
* @prop {Number?} presenceCount The **approximate** presence count for the guild
* @prop {Object?} stageInstance The active public stage instance data for the stage channel this invite is for
* @prop {String?} targetApplicationID The target application id
* @prop {Number?} targetType The type of the target application
* @prop {User?} targetUser The user whose stream is displayed for the invite (voice channel only)
* @prop {Boolean?} temporary Whether the invite grants temporary membership or not
* @prop {Number?} uses The number of invite uses
*/
export default class Invite extends Base {
    constructor(data, client) {
        super();
        this.code = data.code;
    }
}
