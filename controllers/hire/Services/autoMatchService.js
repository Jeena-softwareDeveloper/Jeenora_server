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

        const requiredCredits = job.maxCandidatesToPing
        const messageCost = 10

        if (employer.subscription.creditsLeft < requiredCredits) {
            throw new Error(`Insufficient credits. Required: ${requiredCredits}, Available: ${employer.subscription.creditsLeft}`)
        }

        // ... rest of the function remains the same
    } catch (error) {
        console.error('Auto-match service error:', error)
        throw error
    }
}

    sendWhatsAppMessage = async (applicant, job, matchLogId) => {
        try {
            const message = `🎯 Job Opportunity: ${job.title}

💼 Skill: ${job.skill}
📍 Location: ${job.location}
📅 Experience: ${job.experienceLevel}

${job.description}

📅 Interview: ${job.interviewDateTime ? new Date(job.interviewDateTime).toLocaleString() : 'To be scheduled'}
📍 Venue: ${job.interviewVenue || 'To be confirmed'}

Reply:
✅ YES - Interested
❌ NO - Not interested
🛑 STOP - Opt out

Match ID: ${matchLogId}`

            console.log(`WhatsApp message for ${applicant.phone}:`, message)
            
            const success = Math.random() > 0.1
            
            if (success) {
                await AutoMatchLog.findByIdAndUpdate(matchLogId, {
                    messageProviderId: `wa_${Date.now()}`,
                    messageStatus: 'sent'
                })
                return true
            } else {
                await AutoMatchLog.findByIdAndUpdate(matchLogId, {
                    messageStatus: 'failed',
                    retryCount: 1
                })
                return false
            }

        } catch (error) {
            console.error('WhatsApp message sending error:', error)
            return false
        }
    }

    handleApplicantReply = async (phone, text, matchLogId = null) => {
        try {
            console.log('Processing applicant reply:', { phone, text, matchLogId })

            const applicant = await HireUser.findOne({ phone })
            if (!applicant) {
                throw new Error('Applicant not found')
            }

            let matchLog

            if (matchLogId) {
                matchLog = await AutoMatchLog.findById(matchLogId)
                    .populate('jobId')
            } else {
                matchLog = await AutoMatchLog.findOne({
                    applicantId: applicant._id,
                    response: 'pending'
                })
                .populate('jobId')
                .sort({ sentAt: -1 })
            }

            if (!matchLog) {
                throw new Error('No pending job match found')
            }

            const responseText = text.toLowerCase().trim()
            let response = 'no_response'
            let responseMessage = ''

            if (responseText.includes('yes') || responseText.includes('interested')) {
                response = 'interested'
                responseMessage = 'Candidate is interested'
                
                await this.notifyEmployer(matchLog.jobId.employerId, applicant, matchLog.jobId)
                
            } else if (responseText.includes('no') || responseText.includes('not interested')) {
                response = 'not_interested'
                responseMessage = 'Candidate is not interested'
                
            } else if (responseText.includes('stop') || responseText.includes('opt out')) {
                response = 'opted_out'
                responseMessage = 'Candidate opted out'
                
                await HireUser.findByIdAndUpdate(applicant._id, {
                    availabilityStatus: 'opted_out',
                    jobAlertsEnabled: false
                })
            } else {
                responseMessage = `Unknown response: ${text}`
            }

            await AutoMatchLog.findByIdAndUpdate(matchLog._id, {
                response: response,
                responseMessage: responseMessage,
                responseAt: new Date()
            })

            if (response === 'interested') {
                await JobPost.findByIdAndUpdate(matchLog.jobId._id, {
                    $inc: { positiveResponses: 1 }
                })
            }

            console.log(`Applicant reply processed: ${response} - ${responseMessage}`)
            
            return {
                success: true,
                response,
                message: responseMessage,
                applicant: applicant.name,
                job: matchLog.jobId.title
            }

        } catch (error) {
            console.error('Handle applicant reply error:', error)
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