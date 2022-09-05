import crypto from "crypto";
import { parseJSON, reconstructError, stringifyJSON } from "./Serialization.mjs";
export class CentralRequestHandler {
    timeout;
    ipc;
    requests;
    constructor(ipc, options) {
        this.timeout = options.timeout;
        this.ipc = ipc;
        this.requests = new Map();
        process.on("message", message => {
            if (message.op === "centralApiResponse") {
                const request = this.requests.get(message.id);
                if (request) {
                    message.value.value = parseJSON(message.value.valueSerialized);
                    request(message.value);
                }
            }
        });
    }
    request(method, url, auth, body, file, _route, short) {
        const UUID = crypto.randomBytes(16).toString("hex");
        let fileString;
        if (file) {
            if (file.file) {
                fileString = Buffer.from(file.file).toString("base64");
                file.file = "";
            }
        }
        const data = { method, url, auth, body, file, fileString, _route, short };
        const dataSerialized = stringifyJSON(data);
        if (process.send)
            process.send({ op: "centralApiRequest", request: { UUID, dataSerialized } });
        return new Promise((resolve, reject) => {
            // timeout
            const timeout = setTimeout(() => {
                this.requests.delete(UUID);
                reject(`Request timed out (>${this.timeout}ms)`);
            }, this.timeout);
            const callback = (r) => {
                this.requests.delete(UUID);
                clearTimeout(timeout);
                if (r.resolved) {
                    resolve(r.value);
                }
                else {
                    const value = r.value;
                    if (value.convertedErrorObject) {
                        reject(reconstructError(value.error));
                    }
                    else {
                        reject(value.error);
                    }
                }
            };
            this.requests.set(UUID, callback);
        });
    }
}