const { IncomingWebhook, IncomingWebhookResult } = require(`@slack/webhook`);
const { failedAttachment, passedAttachment } = require(`./util`);
const fs = require('fs');
const AdmZip = require("adm-zip");

const { WebClient, LogLevel } = require("@slack/web-api");
const path = 'allure-results/result.json'
let testResults = {
    psd: 0,
    fld: 0,
    tst: 0,
    //accessor property(setter)
    set passedResult(passed) {
        this.psd = passed;
    },
    set failedResult(failed) {
        this.fld = failed;
    },
    set testResult(test) {
        this.tst = test;
    },
    get passedResult(){
        return this.psd;
    },
    get failedResult(){
        return this.fld;
    },
    get testResult(){
        return this.tst;
    }
};

class SlackService {

    constructor(options) {
        this.options = options;
        this.webhook = this.options.webHookUrl
                        ? new IncomingWebhook(this.options.webHookUrl)
                        : (function() {
                            console.error(`[slack-error]: Slack webhook URL is not defined`);
                            return;
                        })();
        this.failedTests = 0;
        this.passedTests = 0;
        this.tests = 0;
        this.testNameFull = ``;
        this.attachment = [{
            pretext: `*${this.options.messageTitle || `Webdriverio Slack Reporter`}*`,
            title: "",
        }];
        this.testTitle = ``;
    }

    beforeTest(test) {
        // ++this.tests;
        testResults.testResult = testResults.tst+1;
        if (this.tests <= 1 && !this.testNameFull) {
            this.testNameFull = test.parent ??  test.fullName.replace(test.description, '');
        }
        this.testTitle = test.title ?? test.description;
    }

    async afterTest(test, context, results) {
        test._currentRetry = results.retries.attempts;
        test._retries = results.retries.limit;
        if (test._currentRetry >= 0 && !results.passed) {
            // --this.tests;
            testResults.testResult = testResults.tst-1;
            if(test._currentRetry === test._retries || test._retries === -1) {
                let testError = results.error //.matcherResult.message().replace(/[\u001b\u009b][-[+()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
               // ++this.failedTests;
                testResults.failedResult = testResults.fld+1;
               // ++this.tests;
                testResults.testResult = testResults.tst+1;
                const attach = failedAttachment(test, testError.toString(), results);
                // this.attachment.push(attach);
                return;
            }
            return;
        }
          // ++this.passedTests;
            testResults.passedResult = testResults.psd+1;

    }

    async onComplete() {
        let rawdata = fs.readFileSync(path);
        let res = JSON.parse(rawdata);
//        this.attachment[0].title = `${this.testNameFull}`;
//        this.attachment[0].color = `#ffc107`;
        const req = this.attachment.push({author_name: `Total tests: ${res.tests} | Total passed: ${res.passed} | Total failed: ${res.failed}`, color: `#4366c7` });

            await this.webhook.send({ attachments: this.attachment });
            return;

      }
    async afterSession() {
        fs.access(path, fs.F_OK, (err) => {
        if (err) {
            console.error(err)
            let result = {
                passed: testResults.passedResult,
                failed: testResults.failedResult,
                tests: testResults.testResult,
            };
            let data = JSON.stringify(result);
            fs.writeFileSync(path, data);
            return
        }

        let rawdata = fs.readFileSync(path);
        let res = JSON.parse(rawdata);
        let result = {
            passed: res.passed + testResults.passedResult,
            failed: res.failed + testResults.failedResult,
            tests: res.tests + testResults.testResult,
        };
        let data = JSON.stringify(result);
        fs.writeFileSync(path, data);
        })
    }

}

module.exports = SlackService;