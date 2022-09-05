import Base from "./Base.mjs";
import * as Endpoints from "../rest/Endpoints.mjs";

/**
* Represents a user
* @prop {Number?} accentColor The user's banner color, or null if no banner color (REST only)
* @prop {String?} avatar The hash of the user's avatar, or null if no avatar
* @prop {String} avatarURL The URL of the user's avatar which can be either a JPG or GIF
* @prop {String?} banner The hash of the user's banner, or null if no banner (REST only)
* @prop {String?} bannerURL The URL of the user's banner
* @prop {Boolean} bot Whether the user is an OAuth bot or not
* @prop {Number} createdAt Timestamp of the user's creation
* @prop {String} defaultAvatar The hash for the default avatar of a user if there is no avatar set
* @prop {String} defaultAvatarURL The URL of the user's default avatar
* @prop {String} discriminator The discriminator of the user
* @prop {String} id The ID of the user
* @prop {String} mention A string that mentions the user
* @prop {Number?} publicFlags Publicly visible flags for this user
* @prop {String} staticAvatarURL The URL of the user's avatar (always a JPG)
* @prop {Boolean} system Whether the user is an official Discord system user (e.g. urgent messages)
* @prop {String} username The username of the user
*/
export default class User extends Base {
    constructor(data, client) {
        super(data.id);

        this.bot = !!data.bot;
        this.system = !!data.system;
        this.update(data);
    }

    update(data) {
        if(data.avatar !== undefined) {
            this.avatar = data.avatar;
        }
        if(data.username !== undefined) {
            this.username = data.username;
        }
        if(data.discriminator !== undefined) {
            this.discriminator = data.discriminator;
        }
    }

    get avatarURL() {
        const url = Endpoints.USER_AVATAR(this.id, this.avatar)
        return this.avatar ? `${Endpoints.CDN_URL}${url}.${url.includes("/a_") ? "gif" : "jpg"}?size=128` : `${Endpoints.CDN_URL}${Endpoints.DEFAULT_USER_AVATAR(this.discriminator % 5)}.png`;
    }
}