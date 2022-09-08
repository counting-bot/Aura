/**
 * Provides utilities for working with many Discord structures
 * @prop {string} id A Discord snowflake identifying the object
 * @prop {Number} createdAt Timestamp of structure creation
 */
 export default class Base {
    constructor(id) {
        if(id) {
            this.id = id;
        }
    }

    get createdAt() {
        return Base.getCreatedAt(this.id);
    }

    /**
     * Calculates the timestamp in milliseconds associated with a Discord ID/snowflake
     * @param {String} id The ID of a structure
     * @returns {Number}
     */
    static getCreatedAt(id) {
        return new Date(Base.getDiscordEpoch(id) + 1420070400000);
    }

    /**
     * Gets the number of milliseconds since epoch represented by an ID/snowflake
     * @param {string} id The ID of a structure
     * @returns {number}
     */
    static getDiscordEpoch(id) {
        return Number(BigInt(id) / 4194304n);
    }
}