const router = require('express').Router();
const communityController = require('../../controllers/Awareness/CommunityController');
const { authMiddleware } = require('../../middlewares/authMiddleware');

router.get('/community/posts', communityController.get_posts);
router.get('/community/posts/:id', communityController.get_post_detail);
router.get('/community/sidebar', communityController.get_community_sidebar);
router.post('/community-posts-add', authMiddleware, communityController.add_post);
router.post('/community/posts/:id/vote', authMiddleware, communityController.handle_vote);
router.post('/community/posts/:id/comment', authMiddleware, communityController.add_comment);
router.post('/community/posts/:id/comments/:commentId/vote', authMiddleware, communityController.handle_comment_vote);
router.post('/community/posts/:id/comments/:commentId/reply', authMiddleware, communityController.add_reply);
router.put('/community/posts/:id', authMiddleware, communityController.update_post);
router.delete('/community/posts/:id', authMiddleware, communityController.delete_post);

module.exports = router;
