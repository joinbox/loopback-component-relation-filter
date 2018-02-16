const path = require('path');

const Microservice = require('@joinbox/loopback-microservice');

before(async function() {
    const appRootDir = path.resolve(__dirname, '../server');
    const env = 'test';
    const options = {
        appRootDir,
        env,
    };
    this.service = await Microservice.boot(options);
    this.models = this.service.app.models;
});