const { IncomingWebhook, IncomingWebhookResult } = require(`@slack/webhook`);
const { failedAttachment, passedAttachment } = require(`./util`);
const fs = require('fs');
const AdmZip = require("adm-zip");

const { WebClient, LogLevel } = require("@slack/web-api");


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
        ++this.tests;
        if (this.tests <= 1 && !this.testNameFull) {
            this.testNameFull = test.parent ??  test.fullName.replace(test.description, '');
        }
        this.testTitle = test.title ?? test.description;
    }

    async afterTest(test, context, results) {
        test._currentRetry = results.retries.attempts;
        test._retries = results.retries.limit;
        if (test._currentRetry >= 0 && !results.passed) {
            --this.tests;
            if(test._currentRetry === test._retries || test._retries === -1) {
                let testError = results.error //.matcherResult.message().replace(/[\u001b\u009b][-[+()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, "");
                ++this.failedTests;
                ++this.tests;
                const attach = failedAttachment(test, testError.toString(), results);
                // this.attachment.push(attach);
                return;
            }
            return;
        }
            ++this.passedTests;

    }

    async after() {
        this.attachment[0].title = `${this.testNameFull}`;
        this.attachment[0].color = `#ffc107`;
        const req = this.attachment.push({author_name: `Total tests: ${this.tests} | Total passed: ${this.passedTests} | Total failed: ${this.failedTests}`, color: `#4366c7` });

            await this.webhook.send({ attachments: this.attachment });
            return;

      }


}

module.exports = SlackService;