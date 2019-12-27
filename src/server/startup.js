const agileLog = require('agile-log');

const log = agileLog.getLogger('app');

const webServer = require('./webServer');

module.exports = {
  async start() {
    log.info('starting...');
    await webServer.start();
    log.info('all service started');
  }
};
