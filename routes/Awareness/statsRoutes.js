const StatsController = require('../../controllers/Awareness/StatsController');
const router = require('express').Router();

router.get('/stats', StatsController.get_stats);

module.exports = router;
