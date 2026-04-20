const JobPost = require('../../../models/hire/JobPostModel')
const AutoMatchLog = require('../../../models/hire/autoMatchLogModel')
const HireUser = require('../../../models/hire/hireUserModel')
const { responseReturn } = require('../../../utiles/response')
class AutoMatchService {

    runAutoMatch = async (jobId) => {
        try {
            console.log('Starting auto-match for job:', jobId)

            const job = await JobPost.findById(jobId).populate('employerId')

            if (!job) {
                throw new Error('Job not found')
            }

            if (!job.employerId) {
                throw new Error('Employer not found for this job')
            }

            const employer = job.employerId

            // Initialize subscription if it doesn't exist
            if (!employer.subscription) {
                employer.subscription = {
                    plan: 'Free',
                    status: 'active',
                    creditsLeft: 0
                }
                await employer.save()
            }

            const requiredCredits = job.maxCandidatesToPing;
            if (employer.subscription.creditsLeft < requiredCredits) {
                throw new Error(`Insufficient credits. Required: ${requiredCredits}, Available: ${employer.subscription.creditsLeft}`)
            }

            // Find potential candidates
            const candidates = await HireUser.find({
                role: 'JOB_SEEKER',
                $or: [
                    { location: { $regex: job.location, $options: 'i' } },
                    { headline: { $regex: job.skill, $options: 'i' } }
                ]
            }).limit(job.maxCandidatesToPing)

            const logs = []
            for (const candidate of candidates) {
                const log = await AutoMatchLog.create({
                    jobId: job._id,
                    applicantId: candidate._id,
                    messageStatus: 'sent', // Mark as sent for system record
                    response: 'pending'
                })
                logs.push(log)
            }

            // Deduct credits
            await HireUser.findByIdAndUpdate(employer._id, {
                $inc: { 'subscription.creditsLeft': -requiredCredits }
            })

            console.log(`Auto-matched ${logs.length} candidates for job ${jobId}`)
            return { success: true, count: logs.length }

        } catch (error) {
            console.error('Auto-match service error:', error)
            throw error
        }
    }


    notifyEmployer = async (employerId, applicant, job) => {
        try {
            console.log(`Notifying employer ${employerId} about interested candidate ${applicant.name} for job ${job.title}`)
            return true
        } catch (error) {
            console.error('Employer notification error:', error)
        }
    }

    addEmployerCredits = async (employerId, credits) => {
        try {
            const employer = await HireUser.findById(employerId)

            if (!employer) {
                throw new Error('Employer not found')
            }

            // Initialize subscription if it doesn't exist
            if (!employer.subscription) {
                employer.subscription = {
                    plan: 'Free',
                    status: 'active',
                    creditsLeft: 0
                }
            }

            // Update credits
            const updatedEmployer = await HireUser.findByIdAndUpdate(
                employerId,
                {
                    $inc: {
                        'subscription.creditsLeft': credits
                    }
                },
                { new: true }
            )

            console.log(`Added ${credits} credits to employer ${employerId}. New balance: ${updatedEmployer.subscription.creditsLeft}`)

            return {
                success: true,
                employer: updatedEmployer.name,
                newBalance: updatedEmployer.subscription.creditsLeft
            }
        } catch (error) {
            console.error('Add employer credits error:', error)
            throw error
        }
    }
}

module.exports = new AutoMatchService()
