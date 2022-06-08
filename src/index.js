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
                this.attachment.push(attach);
                return;
            }
            return;
        }

        if (results.passed && !this.options.notifyOnlyOnFailure === true) {
            ++this.passedTests;
            this.attachment.push(passedAttachment(test, results));
        }else{
            ++this.passedTests;
        }
    }

    async after() {
        this.attachment[0].title = `${this.testNameFull}`;
        this.attachment[0].color = `#ffc107`;
        const req = this.attachment.push({author_name: `Total tests: ${this.tests} | Total passed: ${this.passedTests} | Total failed: ${this.failedTests}`, color: `#4366c7` });
        if (this.failedTests > 0 && this.options.notifyOnlyOnFailure === true) {
            await this.webhook.send({ attachments: this.attachment });
            return;
        }
        if(!this.options.notifyOnlyOnFailure === true) {
            await this.webhook.send({ attachments: this.attachment });
        }
      }

    async afterSession(){
        if(this.options.uploadFile === true){
            const zip = new AdmZip();
            const outputFile = "./allure-results/test.zip";
            zip.addLocalFolder("./allure-results");
            zip.writeZip(outputFile);
            console.log(`Created ${outputFile} successfully`);

            // WebClient instantiates a client that can call API methods
            // When using Bolt, you can use either `app.client` or the `client` passed to listeners.
            const client = new WebClient(this.options.botToken, {
                // LogLevel can be imported and used to make debugging simpler
                logLevel: LogLevel.DEBUG
            });
            const name = fs.readdirSync(this.options.pathFile);
            // The name of the file you're going to upload
            // const fileName = this.options.pathFile + name[0];
            const fileName = './allure-results/test.zip';
            // ID of channel that you want to upload file to
            const channelId = this.options.channelId;
            try {
            // Call the files.upload method using the WebClient
            const result = await client.files.upload({
                // channels can be a list of one to many strings
                channels: channelId,
                initial_comment: "Here\'s test result file :smile:",
                // Include your filename in a ReadStream here
                file: fs.createReadStream(fileName)
            });
                // console.log(result);
            }
            catch (error) {
                console.error(error);
            }
        }
    }
}

module.exports = SlackService;