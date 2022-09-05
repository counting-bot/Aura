export default class DiscordRESTError extends Error {
    code;
    method;
    name = "DiscordRESTError";
    resBody;
    response;
    constructor(res, resBody, method, stack) {
        super();
        this.code = Number(resBody.code);
        this.method = method;
        this.response = res;
        this.resBody = resBody;
        let message = "message" in resBody ? `${resBody.message} on ${this.method} ${this.path}` : `Unknown Error on ${this.method} ${this.path}`;
        if ("errors" in resBody)
            message += `\n ${DiscordRESTError.flattenErrors(resBody.errors).join("\n ")}`;
        else {
            const errors = DiscordRESTError.flattenErrors(resBody);
            if (errors.length > 0)
                message += `\n ${errors.join("\n ")}`;
        }
        Object.defineProperty(this, "message", {
            enumerable: false,
            value: message
        });
        if (stack)
            this.stack = `${this.name}: ${this.message}\n${stack}`;
        else
            Error.captureStackTrace(this, DiscordRESTError);
    }
    static flattenErrors(errors, keyPrefix = "") {
        let messages = [];
        for (const fieldName in errors) {
            if (!Object.hasOwn(errors, fieldName) || fieldName === "message" || fieldName === "code")
                continue;
            if ("_errors" in errors[fieldName])
                messages = messages.concat(errors[fieldName]._errors.map((err) => `${`${keyPrefix}${fieldName}`}: ${err.message}`));
            else if (Array.isArray(errors[fieldName]))
                messages = messages.concat(errors[fieldName].map((str) => `${`${keyPrefix}${fieldName}`}: ${str}`));
            else if (typeof errors[fieldName] === "object")
                messages = messages.concat(DiscordRESTError.flattenErrors(errors[fieldName], `${keyPrefix}${fieldName}.`));
        }
        return messages;
    }
    get headers() { return this.response.headers; }
    get path() { return new URL(this.response.url).pathname; }
    get status() { return this.response.status; }
    get statusText() { return this.response.statusText; }
    toJSON() {
        return {
            message: this.message,
            method: this.method,
            name: this.name,
            resBody: this.resBody,
            stack: this.stack || ""
        };
    }
}