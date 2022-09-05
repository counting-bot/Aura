export class BaseClusterWorker {
    /** The Eris client */
    bot;
    /** ID of the cluster */
    clusterID;
    /** ID of the worker */
    workerID;
    ipc;
    /**
     * Graceful shutdown of the cluster. Have a function within your bot class called `shutdown` to use this.
     * @see {@link BaseClusterWorker} See for an example
     * @param done Call this function when your shutdown function is complete.
    */
    shutdown;
    /**
     * Function to handle commands. Have a function called `handleCommand` to your cluster class to handle commands.
     * @see {@link BaseClusterWorker} See for an example
     * @param data Data sent in the command
    */
    handleCommand;
    constructor(setup) {
        this.bot = setup.bot;
        this.clusterID = setup.clusterID;
        this.workerID = setup.workerID;
        this.ipc = setup.ipc;
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