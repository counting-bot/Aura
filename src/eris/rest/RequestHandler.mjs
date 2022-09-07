import SequentialBucket from "./SequentialBucket.mjs";
import DiscordRESTError from "./DiscordRESTError.mjs";
import DiscordHTTPError from "./DiscordHTTPError.mjs";
import { API_URL, USER_AGENT } from "../Constants.mjs";
import Base from "../structures/Base.mjs";

export default class RequestHandler {
    globalBlock = false;
    latencyRef;
    options;
    ratelimits = {};
    readyQueue = [];
    constructor(client, options = {}, token) {
        if (options && options.baseURL && options.baseURL.endsWith("/"))
            options.baseURL = options.baseURL.slice(0, -1);
        this.client = client;
        this.client.auth=token

        this.options = {
            agent: options.agent,
            baseURL: API_URL,
            disableLatencyCompensation: !!options.disableLatencyCompensation,
            host: options.host ? options.host : options.baseURL ? new URL(options.baseURL).host : new URL(API_URL).host,
            latencyThreshold: options.latencyThreshold ?? 30000,
            ratelimiterOffset: options.ratelimiterOffset ?? 0,
            requestTimeout: options.requestTimeout ?? 15000,
            userAgent: options.userAgent || USER_AGENT
        };
        this.latencyRef = {
            lastTimeOffsetCheck: 0,
            latency: options.ratelimiterOffset || 0,
            raw: new Array(10).fill(options.ratelimiterOffset),
            timeOffsets: new Array(10).fill(0),
            timeoffset: 0
        };
    }
    getRoute(path, method) {
        let route = path.replace(/\/([a-z-]+)\/(?:[\d]{15,21})/g, function (match, p) {
            return p === "channels" || p === "guilds" || p === "webhooks" ? match : `/${p}/:id`;
        }).replace(/\/reactions\/[^/]+/g, "/reactions/:id").replace(/\/reactions\/:id\/[^/]+/g, "/reactions/:id/:userID").replace(/^\/webhooks\/(\d+)\/[A-Za-z0-9-_]{64,}/, "/webhooks/$1/:token");
        if (method === "DELETE" && route.endsWith("/messages/:id")) {
            const messageID = path.slice(path.lastIndexOf("/") + 1);
            const createdAt = Base.getCreatedAt(messageID).getTime();
            if (Date.now() - this.latencyRef.latency - createdAt >= 1000 * 60 * 60 * 24 * 14)
                method += "_OLD";
            else if (Date.now() - this.latencyRef.latency - createdAt <= 1000 * 10)
                method += "_NEW";
            route = method + route;
        }
        else if (method === "GET" && /\/guilds\/[0-9]+\/channels$/.test(route)) {
            route = "/guilds/:id/channels";
        }
        if (method === "PUT" || method === "DELETE") {
            const index = route.indexOf("/reactions");
            if (index !== -1)
                route = "MODIFY" + route.slice(0, index + 10);
        }
        return route;
    }
    globalUnblock() {
        this.globalBlock = false;
        while (this.readyQueue.length > 0)
            this.readyQueue.shift()();
    }
    /** same as `request`, but with `auth` always set to `true`. */
    async authRequest(options) {
        return this.request({
            ...options,
            auth: true
        });
    }
    /**
     * Make a request. `null` will be returned if the request results in a `204 NO CONTENT`.
     * @param options The options for the request.
     */
    async request(options) {
        options.method = options.method.toUpperCase();
        const _stackHolder = {};
        Error.captureStackTrace(_stackHolder);
        if (!options.path.startsWith("/"))
            options.path = `/${options.path}`;
        const route = options.route || this.getRoute(options.path, options.method);
        if (!this.ratelimits[route])
            this.ratelimits[route] = new SequentialBucket(1, this.latencyRef);
        let attempts = 0;
        return new Promise((resolve, reject) => {
            async function attempt(cb) {
                const headers = {};
                try {
                    if (typeof options.auth === "string")
                        headers.Authorization = options.auth;
                    else if (options.auth && this.client.auth)
                        headers.Authorization = this.client.auth;
                    if (options.reason)
                        headers["X-Audit-Log-Reason"] = encodeURIComponent(options.reason);
                    let reqBody;
                    if (options.method !== "GET") {
                        let stringBody;
                        if (options.json)
                            stringBody = JSON.stringify(options.json, (k, v) => typeof v === "bigint" ? v.toString() : v);
                        if (options.form)
                            reqBody = options.form;
                        if (options.json) {
                            reqBody = stringBody;
                            headers["Content-Type"] = "application/json";
                        }
                    }
                    if (this.options.host)
                        headers.Host = this.options.host;
                    const url = `${this.options.baseURL}${options.path}${options.query && Array.from(options.query.keys()).length > 0 ? `?${options.query.toString()}` : ""}`;
                    let latency = Date.now();
                    const controller = new AbortController();
                    let timeout;
                    if (this.options.requestTimeout > 0 && this.options.requestTimeout !== Infinity)
                        timeout = setTimeout(() => controller.abort(), this.options.requestTimeout);
                    const res = await fetch(url, {
                        method: options.method,
                        headers,
                        body: reqBody,
                        dispatcher: this.options.agent || undefined,
                        signal: controller.signal
                    });
                    if (timeout)
                        clearTimeout(timeout);
                    latency = Date.now() - latency;
                    if (!this.options.disableLatencyCompensation) {
                        this.latencyRef.raw.push(latency);
                        this.latencyRef.latency = this.latencyRef.latency - ~~(this.latencyRef.raw.shift() / 10) + ~~(latency / 10);
                    }
                    let resBody;
                    if (res.status === 204)
                        resBody = null;
                    else {
                        if (res.headers.get("content-type") === "application/json") {
                            const b = await res.text();
                            try {
                                resBody = JSON.parse(b);
                            }
                            catch (err) {
                                this.client.emit("error", err);
                                resBody = b;
                            }
                        }
                        else
                            resBody = Buffer.from(await res.arrayBuffer());
                    }
                    this.client.emit("request", {
                        method: options.method,
                        path: options.path,
                        route,
                        withAuth: !!options.auth,
                        requestBody: reqBody,
                        responseBody: resBody
                    });
                    const headerNow = Date.parse(res.headers.get("date"));
                    const now = Date.now();
                    if (this.latencyRef.lastTimeOffsetCheck < (Date.now() - 5000)) {
                        const timeOffset = headerNow + 500 - (this.latencyRef.lastTimeOffsetCheck = Date.now());
                        if (this.latencyRef.timeoffset - this.latencyRef.latency >= this.options.latencyThreshold && timeOffset - this.latencyRef.latency >= this.options.latencyThreshold) {
                            this.client.emit("warn", `Your clock is ${this.latencyRef.timeoffset}ms behind Discord's server clock. Please check your connection and system time.`);
                        }
                        this.latencyRef.timeoffset = this.latencyRef.timeoffset - ~~(this.latencyRef.timeOffsets.shift() / 10) + ~~(timeOffset / 10);
                        this.latencyRef.timeOffsets.push(timeOffset);
                    }
                    if (res.headers.has("x-ratelimit-limit"))
                        this.ratelimits[route].limit = Number(res.headers.get("x-ratelimit-limit"));
                    if (options.method !== "GET" && (!res.headers.has("x-ratelimit-remaining") || !res.headers.has("x-ratelimit-limit")) && this.ratelimits[route].limit !== 1) {
                        this.client.emit("debug", [`Missing ratelimit headers for SequentialBucket(${this.ratelimits[route].remaining}/${this.ratelimits[route].limit}) with non-default limit\n`,
                            `${res.status} ${res.headers.get("content-type")}: ${options.method} ${route} | ${res.headers.get("cf-ray")}\n`,
                            `content-type = ${res.headers.get("content-type")}\n`,
                            `x-ratelimit-remaining = " + ${res.headers.get("x-ratelimit-remaining")}\n`,
                            `x-ratelimit-limit = " + ${res.headers.get("x-ratelimit-limit")}\n`,
                            `x-ratelimit-reset = " + ${res.headers.get("x-ratelimit-reset")}\n`,
                            `x-ratelimit-global = " + ${res.headers.get("x-ratelimit-global")}`].join("\n"));
                    }
                    this.ratelimits[route].remaining = !res.headers.has("x-ratelimit-remaining") ? 1 : Number(res.headers.get("x-ratelimit-remaining")) || 0;
                    const retryAfter = Number(res.headers.get("x-ratelimit-reset-after") || res.headers.get("retry-after") || 0) * 1000;
                    if (retryAfter >= 0) {
                        if (res.headers.has("x-ratelimit-global")) {
                            this.globalBlock = true;
                            setTimeout(this.globalUnblock.bind(this), retryAfter || 1);
                        }
                        else
                            this.ratelimits[route].reset = (retryAfter || 1) + now;
                    }
                    else if (res.headers.has("x-ratelimit-reset")) {
                        let resetTime = Number(res.headers.get("x-ratelimit-reset")) * 1000;
                        if (route.endsWith("/reactions/:id") && (resetTime - headerNow) === 1000)
                            resetTime = now + 250;
                        this.ratelimits[route].reset = Math.max(resetTime - this.latencyRef.latency, now);
                    }
                    else
                        this.ratelimits[route].reset = now;
                    if (res.status !== 429)
                        this.client.emit("debug", `${now} ${route} ${res.status}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${this.ratelimits[route].reset} (${this.ratelimits[route].reset - now}ms left)`);
                    if (res.status > 300) {
                        if (res.status === 429) {
                            let delay = retryAfter;
                            if (res.headers.get("x-ratelimit-scope") === "shared") {
                                try {
                                    delay = resBody.retry_after * 1000;
                                }
                                catch (err) {
                                    reject(err);
                                }
                            }
                            this.client.emit("debug", `${res.headers.has("x-ratelimit-global") ? "Global" : "Unexpected"} RateLimit: ${JSON.stringify(resBody)}\n${now} ${route} ${res.status}: ${latency}ms (${this.latencyRef.latency}ms avg) | ${this.ratelimits[route].remaining}/${this.ratelimits[route].limit} left | Reset ${delay} (${this.ratelimits[route].reset - now}ms left) | Scope ${res.headers.get("x-ratelimit-scope")}`);
                            if (delay) {
                                setTimeout(() => {
                                    cb();
                                    this.request(options).then(resolve).catch(reject);
                                }, delay);
                                return;
                            }
                            else {
                                cb();
                                this.request(options).then(resolve).catch(reject);
                                return;
                            }
                        }
                        else if (res.status === 502 && ++attempts < 4) {
                            this.client.emit("debug", `Unexpected 502 on ${options.method} ${route}`);
                            setTimeout(() => {
                                this.request(options).then(resolve).catch(reject);
                            }, Math.floor(Math.random() * 1900 + 100));
                            return cb();
                        }
                        cb();
                        let { stack } = _stackHolder;
                        if (stack.startsWith("Error\n"))
                            stack = stack.substring(6);
                        let err;
                        if (resBody && typeof resBody === "object" && "code" in resBody) {
                            err = new DiscordRESTError(res, resBody, options.method, stack);
                        }
                        else {
                            err = new DiscordHTTPError(res, resBody, options.method, stack);
                        }
                        reject(err);
                        return;
                    }
                    cb();
                    resolve(resBody);
                }
                catch (err) {
                    if (err instanceof Error && err.constructor.name === "DOMException" && err.name === "AbortError") {
                        cb();
                        reject(new Error(`Request Timed Out (>${this.options.requestTimeout}ms) on ${options.method} ${options.path}`));
                    }
                    this.client.emit("error", err);
                }
            }
            if (this.globalBlock && options.auth) {
                (options.priority ? this.readyQueue.unshift.bind(this.readyQueue) : this.readyQueue.push.bind(this.readyQueue))(() => {
                    this.ratelimits[route].queue(attempt.bind(this), options.priority);
                });
            }
            else
                this.ratelimits[route].queue(attempt.bind(this), options.priority);
        });
    }
}