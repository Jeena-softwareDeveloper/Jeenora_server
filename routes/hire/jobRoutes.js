const express = require('express')
const router = express.Router()
const jobController = require('../../controllers/hire/jobController')
const automatchService = require('../../controllers/hire/Services/autoMatchService')
const { authMiddleware, adminMiddleware } = require('../../middlewares/authMiddleware')

// Public/Feed
router.get('/', jobController.getFeed)

// specific routes must be before /:id
router.get('/employer', authMiddleware, jobController.getEmployerJobs)
router.get('/application/list', authMiddleware, jobController.getAppliedJobs)

router.post('/', authMiddleware, jobController.createJob)
router.get('/:id', jobController.getJob)
router.patch('/:id/close', authMiddleware, jobController.closeJob)

// User Actions
router.post('/:id/apply', authMiddleware, jobController.applyJob) // #swagger.tags = ['Hire Jobs']
router.post('/:id/save', authMiddleware, jobController.saveJob) // #swagger.tags = ['Hire Jobs']
router.post('/:id/unlock', authMiddleware, jobController.unlockJob) // #swagger.tags = ['Hire Jobs']


// Auto-match routes
router.post('/:id/automatch', authMiddleware, jobController.triggerAutoMatch) // #swagger.tags = ['Hire Jobs']
router.get('/:id/matches', authMiddleware, jobController.getMatches) // #swagger.tags = ['Hire Jobs']

// Applicant reply webhook
router.post('/webhook/reply', async (req, res) => {
    try {
        const { phone, text, matchLogId } = req.body

        const result = await automatchService.handleApplicantReply(phone, text, matchLogId)

        res.status(200).json({
            success: true,
            ...result
        })
    } catch (error) {
        console.error('Webhook error:', error)
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

// Messages
const jobMessageController = require('../../controllers/hire/jobMessageController')
router.post('/messages/send', authMiddleware, jobMessageController.sendMessage)
router.get('/messages/:applicationId', authMiddleware, jobMessageController.getMessages)

router.post('/admin/credits', authMiddleware, async (req, res) => {
    try {
        const { employerId, credits } = req.body

        const result = await automatchService.addEmployerCredits(employerId, credits)

        res.status(200).json({
            success: true,
            ...result
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        })
    }
})

module.exports = router