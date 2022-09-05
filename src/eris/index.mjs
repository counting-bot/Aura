import ErisClient from "./lib/Client.mjs";

function Eris(token, options) {
    return new ErisClient(token, options);
}

Eris.Client = ErisClient;
Eris.VERSION = "0.17.2-dev";

export default Eris
export const Client = ErisClient
export const VERSION = "0.17.2-dev"