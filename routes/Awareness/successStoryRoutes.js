const SuccessStoryController = require('../../controllers/Awareness/SuccessStoryController')
const router = require('express').Router()
const { authMiddleware } = require('../../middlewares/authMiddleware')



router.post('/successstory-add',authMiddleware, SuccessStoryController.add_story) 
 router.get('/successstorys',SuccessStoryController.get_stories) 

 router.get('/successstorys/:id',SuccessStoryController.get_story) 
 router.put('/successstory-update/:id',authMiddleware, SuccessStoryController.update_story) 
 router.delete('/successstory/:id', SuccessStoryController.delete_story)
 router.patch('/successstory-toggle-status/:id', authMiddleware, SuccessStoryController.toggle_status)

module.exports = router

