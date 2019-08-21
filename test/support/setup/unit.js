const path = require('path');
const { before } = require('mocha');

const Microservice = require('@joinbox/loopback-microservice');

before(async function() {
    const appRootDir = path.resolve(__dirname, '../server');
    const env = 'test';
    const boot = {
        appRootDir,
        env,
    };
    this.service = await Microservice.boot({ boot });
    this.models = this.service.app.models;
});
