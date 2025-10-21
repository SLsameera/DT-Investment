const express = require('express');
const router = express.Router();

// Placeholder routes for collections
router.get('/', (req, res) => {
  res.json({ success: true, data: [], message: 'Collections endpoint' });
});

module.exports = router;