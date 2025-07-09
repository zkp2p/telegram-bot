const express = require('express');
const cors = require('cors');
const config = require('../config');
const fs = require('fs');
const http = require('http');
const https = require('https');


// Routes
const contractsRoutes = require('./routes/contracts');
const healthRoutes = require('./routes/health');

function createApiServer() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Routes
  app.use('/api', contractsRoutes);
  app.use('/api', healthRoutes);

  return app;
}

function startApiServer() {
  const app = createApiServer();

  // Start the Express server
  let server;
  if (config.PRODUCTION) {
    const sslPath = `/etc/letsencrypt/live/${config.DOMAIN}`;
    const key = fs.readFileSync(`${sslPath}/privkey.pem`, 'utf-8');
    const cert = fs.readFileSync(`${sslPath}/fullchain.pem`, 'utf-8');
    const credentials = { key, cert };
    server = https.createServer(credentials, app).listen(config.PORT, () => {
      console.log(`🔒 HTTPS server running on port ${config.PORT}`);
    });
  } else {
    // HTTP setup
    server = http.createServer(app).listen(config.PORT, '0.0.0.0', () => {
      console.log(`🔓 HTTP server running on port ${config.PORT}`);
    });
  }

  return { app, server };
}

module.exports = {
  createApiServer,
  startApiServer
};