const express = require('express');
const router = express.Router();
const path = require('path');

// Try to mount swagger UI at module load. If dependencies are missing, expose a fallback route with instructions.
try {
  const swaggerUi = require('swagger-ui-express');
  const YAML = require('yamljs');
  const specPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  const swaggerDocument = YAML.load(specPath);

  // Serve the swagger UI at the router root. This correctly handles static asset paths when mounted
  // at a path like /api/docs.
  router.use('/', swaggerUi.serve);
  router.get('/', swaggerUi.setup(swaggerDocument));
} catch (err) {
  // If swagger packages are not installed, provide a helpful message at the docs endpoint.
  router.get('/', (req, res) => {
    res.status(500).json({
      success: false,
      message: 'Swagger UI is not available. Install dev dependencies: npm install --save-dev swagger-ui-express yamljs',
      error: err.message
    });
  });
}

module.exports = router;