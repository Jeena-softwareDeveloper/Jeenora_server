const router = require('express').Router();
const RewardController = require('../../controllers/Awareness/RewardController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/my-points', authMiddleware, RewardController.get_my_points);
router.post('/claim/:rewardId', authMiddleware, RewardController.claim_reward);
router.post('/seed', RewardController.seed_rewards);

module.exports = router;
