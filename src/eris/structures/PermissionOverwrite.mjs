import Permission from "./Permission.mjs";

/**
* Represents a permission overwrite
* @extends Permission
* @prop {String} id The ID of the overwrite
* @prop {Number} type The type of the overwrite, either 1 for "member" or 0 for "role"
*/
export default class PermissionOverwrite extends Permission {
    constructor(data) {
        super(data.allow, data.deny);
        this.id = data.id;
        this.type = data.type;
    }
}