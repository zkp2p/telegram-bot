const express = require('express');
const cors = require('cors');
const config = require('../config');

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
  const server = app.listen(config.PORT, () => {
    console.log(`🌐 API server running on port ${config.PORT}`);
  });

  return { app, server };
}

module.exports = {
  createApiServer,
  startApiServer
};