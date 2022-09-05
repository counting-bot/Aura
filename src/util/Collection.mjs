/** Collection-ish */
export class Collection extends Map {
    constructor(iterable) {
        super(iterable);
    }
    find(func) {
        for (const item of this.values()) {
            if (func(item)) {
                return item;
            }
        }
        return undefined;
    }
}