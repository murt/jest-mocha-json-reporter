const fs = require("fs");
const path = require("path");
const mkdirp = require("mkdirp");

class JestMochaJsonReporter {

    /**
     * @public
     * @type {object}
     */
    get options () {
        return this._options || {};
    }

    /**
     * @constructor
     */
    constructor (globalConfig, options) {
        this._options = Object.assign({
            output: process.env.JEST_FILE || "mocha.json",
            pretty: true,
            console: true,
            bamboo: false,
            indent: 2,
        }, options);
    }

    /**
     * @inheritDoc
     */
    onRunComplete (contexts, results) {
        // Check for test exec errors first and throw if necessary
        if (results.testResults.some(tr => tr.testExecError)) {
            throw new Error(results.testResults.find(tr => tr.testExecError).message);
        } else {
            const res = JSON.stringify(this.parseResults(results), null, this.options.pretty ? this.options.indent : 0);

            // Log the output to the console - there is no distinction made with error logging nor is the output
            // colorised in any way.
            if (this.options.console) {
                console.log(res);
            }

            // Write to the test results file. Will overwrite any previous test results output. Create the
            // parent directory if it does not exist.
            if (this.options.output) {
                mkdirp.sync(path.dirname(this.options.output));
                fs.writeFileSync(this.options.output, res, "utf-8");
            }
        }
    }

    /**
     * @private
     * @returns {object}
     */
    parseResults (results) {
        const allResults = Array.prototype.concat.apply([], results.testResults.map(tr => tr.testResults))
        return {
            stats: {
                tests: results.numTotalTests,
                passes: results.numPassedTests,
                failures: results.numFailedTests,
                duration: Date.now() - results.startTime,
                start: new Date(results.startTime),
                end: new Date(),
            },
            passes: allResults.filter(tr => tr.status === "passed").map(this.formatResult.bind(this)),
            failures: allResults.filter(tr => tr.status === "failed").map(this.formatResult.bind(this)),

            // Bamboo expects "skipped" instead of "pending" when parsing results.
            [this.options.bamboo ? "skipped" : "pending"]: allResults.filter(tr => tr.status === "pending")
            .map(this.formatResult.bind(this)),
        };
    }

    /**
     * Format a single test result.
     *
     * Note that if the error property is undefined it will be removed when stringifying the JSON output.
     *
     * @private
     * @returns {object}
     */
    formatResult (result) {
        return {
            title: result.title,
            // Full name is the preferred value, otherwise construct one from ancestor names and title
            fullTitle: result.fullName || `${result.ancestorTitles.join(" ")} ${result.title}`,
            // perfStats appears to be an older property, duration is the currently working one
            // It is possible for duration to be 0 and so a simple boolean check won't work
            duration: result.hasOwnProperty("duration") ? result.duration : result.perfStats.end - result.perfStats.start,
            errorCount: result.failureMessages.filter(Boolean).length,
            error: result.failureMessages.filter(Boolean).length ? this.formatFailureMessages(result.failureMessages.filter(Boolean)) : undefined,
        };
    }

    /**
     * @private
     * @returns {string}
     */
    formatFailureMessages (messages) {
        return `${messages.length} ${messages.length === 1 ? `failure` : `failures`}: \n`
            + messages.map((msg, i) => `${i+1} failed: ${msg}`).join("\n")
    }

}

module.exports = JestMochaJsonReporter;
