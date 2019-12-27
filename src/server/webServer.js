const express = require('express');
const cookieParser = require('cookie-parser');

const http = require('http');

const agileLog = require('agile-log');

const log = agileLog.getLogger('app');

module.exports = {
  async start() {
    const expressApp = express();

    expressApp.use(express.json());
    expressApp.use(express.urlencoded({ extended: false }));
    expressApp.use(cookieParser());

    const routes = require('../routes/index');

    routes(expressApp);

    expressApp.use((req, res) => {
      log.error(req.path, req.body);
      res.status(500);
      res.send({
        code: '500',
        message: '500'
      });
    });

    const serverPort = 3000;

    const server = http.createServer(expressApp);

    server.listen(serverPort);
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }
      switch (error.code) {
        case 'EACCES':
          log.error(`${serverPort} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          log.error(`${serverPort} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });
    server.on('listening', () => {
      const addr = server.address();
      const bind =
        typeof addr === 'string' ? `pipe ${addr}` : `port ${addr.port}`;
      log.info(`Listening on ${bind}`);
    });
  }
};
