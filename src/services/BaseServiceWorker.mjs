/**
 * The base class for a service
 * @example
 * ```
 * const { BaseServiceWorker } = require('eris-fleet');
 *
 * module.exports = class ServiceWorker extends BaseServiceWorker {
 * 	constructor(setup) {
 * 		// Do not delete this super.
 * 		super(setup);
 *
 * 		// Run this function when your service is ready for use. This MUST be run for the worker spawning to continue.
 * 		this.serviceReady();
 *
 * 		// Demonstration of the properties the service has (Keep reading for info on IPC):
 * 		// ID of the worker
 * 		console.log(this.workerID);
 * 		// The name of the service
 * 		console.log(this.serviceName);
 * 	}
 * 	// This is the function which will handle commands. In this example the data is {"smileyFace": ":)"}
 * 	async handleCommand(dataSentInCommand) {
 * 		// Return a response if you want to respond
 * 		return dataSentInCommand.smileyFace;
 * 	}
 * 	shutdown(done) {
 * 		// Optional function to gracefully shutdown things if you need to.
 * 		done(); // Use this function when you are done gracefully shutting down.
 * 	}
 * }
 * ```
 */
export class BaseServiceWorker {
    /** ID of the worker */
    workerID;
    ipc;
    /** Unique name given to the service */
    serviceName;
    /** Function to report a service being ready */
    serviceReady;
    /** Function to report error during service launch
     * @param error Error to report
     */
    serviceStartingError;
    /** @hidden */
    readyPromise;
    /**
     * Function to handle commands. Have a function called `handleCommand` to your service class to handle commands.
     * @see {@link BaseServiceWorker} See for an example
     * @param data Data sent in the command
    */
    handleCommand;
    /**
     * Graceful shutdown of the service. Have a function within your bot class called `shutdown` to use this.
     *
     * To handle errors, return something similar to the following: `{err: "error here"}`
     * @see {@link BaseServiceWorker} See for an example
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown;
    constructor(setup) {
        this.serviceName = setup.serviceName;
        this.workerID = setup.workerID;
        this.ipc = setup.ipc;
        this.readyPromise = new Promise((resolve, reject) => {
            this.serviceReady = () => {
                resolve(undefined);
            };
            this.serviceStartingError = (err) => {
                reject(err);
            };
        });
    }
    /**
     * Where evals are run from
     * @internal
     */
    runEval(stringToEvaluate) {
        return new Promise((res, rej) => {
            const run = async () => {
                try {
                    const result = await eval(stringToEvaluate);
                    res(result);
                }
                catch (e) {
                    rej(e);
                }
            };
            run();
        });
    }
}