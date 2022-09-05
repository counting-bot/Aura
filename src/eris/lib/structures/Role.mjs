import Base from "./Base.mjs";
import Permission from "./Permission.mjs";

/**
* Represents a role
* @prop {Number} color The hex color of the role in base 10
* @prop {Number} createdAt Timestamp of the role's creation
* @prop {Boolean} hoist Whether users with this role are hoisted in the user list or not
* @prop {String?} icon The hash of the role's icon, or null if no icon
* @prop {String?} iconURL The URL of the role's icon
* @prop {String} id The ID of the role
* @prop {Object} json Generates a JSON representation of the role permissions
* @prop {Guild} guild The guild that owns the role
* @prop {Boolean} managed Whether a guild integration manages this role or not
* @prop {String} mention A string that mentions the role
* @prop {Boolean} mentionable Whether the role is mentionable or not
* @prop {String} name The name of the role
* @prop {Permission} permissions The permissions representation of the role
* @prop {Number} position The position of the role
* @prop {Object?} tags The tags of the role
* @prop {String?} tags.bot_id The ID of the bot associated with the role
* @prop {String?} tags.integration_id The ID of the integration associated with the role
* @prop {Boolean?} tags.premium_subscriber Whether the role is the guild's premium subscriber role
* @prop {String?} unicodeEmoji Unicode emoji for the role
*/
export default class Role extends Base {
    constructor(data, guild) {
        super(data.id);
        this.update(data);
    }

    update(data) {
        if(data.permissions !== undefined) {
            this.permissions = new Permission(data.permissions);
        }
    }
}