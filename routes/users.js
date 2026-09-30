var express = require('express');
var router = express.Router();

/* Placeholder — all user operations are handled by /auth and /admin routes. */
router.get('/', function(req, res) {
  res.status(404).json({ success: false, message: 'Not found.' });
});

module.exports = router;
