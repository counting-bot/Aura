import cluster from "cluster";
import { inspect } from "util";
import { IPC } from "../util/IPC.mjs";
export class Service {
    path;
    serviceName;
    app;
    timeout;
    whatToLog;
    ipc;
    connectedTimestamp;
    ServiceWorker;
    constructor(input) {
        this.ipc = new IPC({ fetchTimeout: input.fetchTimeout });
        if (input.overrideConsole) {
            console.log = (str) => { this.ipc.log(str); };
            console.info = (str) => { this.ipc.info(str); };
            console.debug = (str) => { this.ipc.debug(str); };
            console.error = (str) => { this.ipc.error(str); };
            console.warn = (str) => { this.ipc.warn(str); };
        }
        // Spawns
        process.on("uncaughtException", (err) => {
            this.ipc.error(err);
        });
        process.on("unhandledRejection", (reason, promise) => {
            this.ipc.error("Unhandled Rejection at: " + inspect(promise) + " reason: " + reason);
        });
        if (process.send)
            process.send({ op: "launched" });
        process.on("message", async (message) => {
            if (message.op) {
                switch (message.op) {
                    case "connect": {
                        const connectMessage = message;
                        this.path = connectMessage.path;
                        this.serviceName = connectMessage.serviceName;
                        this.timeout = connectMessage.timeout;
                        this.whatToLog = connectMessage.whatToLog;
                        if (!this.path) {
                            this.ServiceWorker = input.servicesToCreate.find(s => s.name === this.serviceName).ServiceWorker;
                        }
                        this.loadCode();
                        break;
                    }
                    case "return": {
                        if (this.app)
                            this.ipc.emit(message.id, message.value);
                        break;
                    }
                    case "command": {
                        const noHandle = () => {
                            const res = { err: `Service ${this.serviceName} cannot handle commands!` };
                            if (process.send)
                                process.send({ op: "return", value: {
                                        id: message.command.UUID,
                                        value: res,
                                        serviceName: this.serviceName
                                    }, UUID: message.UUID });
                            this.ipc.error("I can't handle commands!");
                        };
                        if (this.app) {
                            if (this.app.handleCommand) {
                                const res = await this.app.handleCommand(message.command.msg);
                                if (message.command.receptive) {
                                    if (process.send)
                                        process.send({ op: "return", value: {
                                                id: message.command.UUID,
                                                value: res,
                                                serviceName: this.serviceName
                                            }, UUID: message.UUID });
                                }
                            }
                            else {
                                noHandle();
                            }
                        }
                        else {
                            noHandle();
                        }
                        break;
                    }
                    case "eval": {
                        const errorEncountered = (err) => {
                            if (message.request.receptive) {
                                if (process.send)
                                    process.send({ op: "return", value: {
                                            id: message.request.UUID,
                                            value: { err },
                                            serviceName: this.serviceName
                                        }, UUID: message.UUID });
                            }
                        };
                        if (this.app) {
                            this.app.runEval(message.request.stringToEvaluate)
                                .then((res) => {
                                if (message.request.receptive) {
                                    if (process.send)
                                        process.send({ op: "return", value: {
                                                id: message.request.UUID,
                                                value: res,
                                                serviceName: this.serviceName
                                            }, UUID: message.UUID });
                                }
                            }).catch((error) => {
                                errorEncountered(error);
                            });
                        }
                        else {
                            errorEncountered("Cluster is not ready!");
                        }
                        break;
                    }
                    case "shutdown": {
                        if (this.app) {
                            if (this.app.shutdown) {
                                // Ask app to shutdown
                                this.app.shutdown(() => {
                                    if (process.send)
                                        process.send({ op: "shutdown" });
                                });
                            }
                            else {
                                if (process.send)
                                    process.send({ op: "shutdown" });
                            }
                        }
                        else {
                            if (process.send)
                                process.send({ op: "shutdown" });
                        }
                        break;
                    }
                    case "collectStats": {
                        if (process.send)
                            process.send({ op: "collectStats", stats: {
                                    uptime: this.connectedTimestamp ? new Date().getTime() - this.connectedTimestamp : 0,
                                    ram: process.memoryUsage().rss / 1e6,
                                    ipcLatency: new Date().getTime()
                                } });
                        break;
                    }
                }
            }
        });
    }
    async loadCode() {
        if (this.app)
            return;
        if (this.whatToLog.includes("service_start"))
            this.ipc.log(`Starting service ${this.serviceName}`);
        let App;
        if (this.ServiceWorker) {
            App = this.ServiceWorker;
            try {
                this.app = new App({ serviceName: this.serviceName, workerID: cluster.worker.id, ipc: this.ipc });
            }
            catch (e) {
                this.ipc.error(e);
                process.exit(1);
            }
        }
        else {
            try {
                App = await import(this.path);
                if (App.ServiceWorker) {
                    App = App.ServiceWorker;
                }
                else {
                    App = App.default ? App.default : App;
                }
                this.app = new App({ serviceName: this.serviceName, workerID: cluster.worker.id, ipc: this.ipc });
            }
            catch (e) {
                this.ipc.error(e);
                process.exit(1);
            }
        }
        let timeout;
        if (this.timeout !== 0) {
            timeout = setTimeout(() => {
                this.ipc.error(`Service ${this.serviceName} took too long to start.`);
                process.exit(1);
            }, this.timeout);
        }
        if (this.app)
            this.app.readyPromise.then(() => {
                if (process.send)
                    process.send({ op: "connected" });
                if (process.send)
                    process.send({ op: "codeLoaded" });
                if (timeout)
                    clearTimeout(timeout);
                this.connectedTimestamp = new Date().getTime();
            }).catch((e) => {
                this.ipc.error(e);
                process.exit(1);
            });
    }
}