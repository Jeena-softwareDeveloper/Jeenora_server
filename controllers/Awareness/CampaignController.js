const Campaign = require('../../models/Awareness/Subscriber/Campaign');
const Subscriber = require('../../models/Awareness/Subscriber/Subscriber');
const SubscriberCategory = require('../../models/Awareness/Subscriber/SubscriberCategory');
const EmailTemplate = require('../../models/Awareness/Subscriber/EmailTemplate');
const Analytics = require('../../models/Awareness/Subscriber/AnalyticsModel');
const { sendWhatsApp, isWhatsAppReady, analyzePhoneNumber } = require('./WhatsappController');
const nodemailer = require('nodemailer');
const mongoose = require('mongoose');
const cron = require('node-cron');
const moment = require("moment-timezone");
const { google } = require('googleapis');

// ==================== GLOBAL VARIABLES ====================
const scheduledCampaigns = new Map();
const recurringCampaigns = new Map();

// ==================== UTILITY FUNCTIONS ====================
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const generateTrackingPixel = (campaignId, recipient) => {
  const pixelUrl = `${process.env.BASE_URL}/api/tracking/pixel?campaign=${campaignId}&recipient=${encodeURIComponent(recipient)}`;
  return `<img src="${pixelUrl}" width="1" height="1" style="display:none" alt=""/>`;
};

const getDateRange = (period) => {
  const now = new Date();
  const start = new Date();

  switch (period) {
    case '7d':
      start.setDate(now.getDate() - 7);
      break;
    case '30d':
      start.setDate(now.getDate() - 30);
      break;
    case '90d':
      start.setDate(now.getDate() - 90);
      break;
    case '1y':
      start.setFullYear(now.getFullYear() - 1);
      break;
    default:
      start.setDate(now.getDate() - 30);
  }

  return { start, end: now };
};

// ==================== EMAIL SERVICE ====================
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS
    }
  });
};

let transporter = createTransporter();

const sendEmail = async (to, subject, message, campaignId = null, attachments = []) => {
  try {
    if (!validateEmail(to)) {
      console.error(`❌ INVALID EMAIL: ${to}`);
      return { success: false, error: 'Invalid email address' };
    }

    let finalMessage = message;
    if (campaignId) {
      const trackingPixel = generateTrackingPixel(campaignId, to);
      finalMessage = finalMessage.includes('</body>')
        ? finalMessage.replace('</body>', `${trackingPixel}</body>`)
        : `${finalMessage}${trackingPixel}`;
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to,
      subject,
      html: finalMessage,
      text: message.replace(/<[^>]*>/g, ''),
      attachments
    };

    const result = await transporter.sendMail(mailOptions);

    if (campaignId) {
      await Analytics.create({
        campaignId,
        type: 'email',
        event: 'sent',
        recipient: to,
        messageId: result.messageId,
        timestamp: new Date()
      });
    }

    console.log(`📧 EMAIL SENT TO: ${to}`);
    return { success: true, messageId: result.messageId };
  } catch (err) {
    console.error(`❌ EMAIL FAILED: ${to}`, err.message);

    if (campaignId) {
      await Analytics.create({
        campaignId,
        type: 'email',
        event: 'failed',
        recipient: to,
        error: err.message,
        timestamp: new Date()
      });
    }

    return { success: false, error: err.message };
  }
};

// ==================== CAMPAIGN CRUD OPERATIONS ====================
const createCampaign = async (req, res) => {
  try {
    const {
      title,
      mode,
      subject,
      message,
      categoryIds = [],
      contacts = [],
      scheduleType = 'immediate',
      scheduledDate = null,
      scheduledTime = '09:00',
      recurringPattern = 'daily',
      repeatCount = 1,
      recurrenceConfig = {},
      daysOfWeek = [],
      dayOfMonth = 1,
      mediaUrl = null,
      templateId = null,
      trackingEnabled = true,
      sendOptions = {}
    } = req.body;

    // Ensure mediaUrl is HTTPS
    let finalMediaUrl = mediaUrl;
    if (finalMediaUrl && finalMediaUrl.includes('http://')) {
      finalMediaUrl = finalMediaUrl.replace('http://', 'https://');
    }

    console.log("📨 Received campaign data:", {
      title, mode, scheduleType, scheduledDate, contactsCount: contacts?.length,
      recurrenceConfig: recurrenceConfig
    });

    // Validation
    if (!title || !mode || !message) {
      return res.status(400).json({
        success: false,
        error: 'Title, mode, and message are required'
      });
    }

    if (!['email', 'whatsapp'].includes(mode)) {
      return res.status(400).json({
        success: false,
        error: 'Mode must be "email" or "whatsapp"'
      });
    }

    if (mode === 'email' && !subject) {
      return res.status(400).json({
        success: false,
        error: 'Subject is required for email campaigns'
      });
    }

    // Validate recurring campaign data
    if (scheduleType === 'recurring') {
      if (!recurrenceConfig.startDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date is required for recurring campaigns'
        });
      }

      const dailyMode = recurrenceConfig.dailyMode || 'single';
      const perDayCount = parseInt(recurrenceConfig.perDayCount) || 1;

      if (dailyMode === 'multiple') {
        if (perDayCount < 1 || perDayCount > 100) {
          return res.status(400).json({
            success: false,
            error: 'Messages per day must be between 1 and 100'
          });
        }

        if (perDayCount > 1) {
          const intervalMinutes = parseInt(recurrenceConfig.intervalMinutes) || 0;
          if (intervalMinutes < 0 || intervalMinutes > 1440) {
            return res.status(400).json({
              success: false,
              error: 'Interval must be between 0 and 1440 minutes'
            });
          }
        }
      }

      if (recurringPattern === 'weekly' && (!daysOfWeek || daysOfWeek.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Days of week are required for weekly recurring campaigns'
        });
      }

      if (recurringPattern === 'monthly' && (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31)) {
        return res.status(400).json({
          success: false,
          error: 'Valid day of month (1-31) is required for monthly recurring campaigns'
        });
      }

      const repeatCountValue = parseInt(recurrenceConfig.repeatCount) || parseInt(repeatCount) || 5;
      if (repeatCountValue < 1 || repeatCountValue > 365) {
        return res.status(400).json({
          success: false,
          error: 'Repeat count must be between 1 and 365 days'
        });
      }
    }

    // Get subscribers from categories
    let categoryEmails = [];
    let categoryPhones = [];

    if (categoryIds && categoryIds.length > 0) {
      const subscribers = await Subscriber.find({ category: { $in: categoryIds } });

      categoryEmails = subscribers
        .map(s => s.email)
        .filter(email => email && validateEmail(email));

      categoryPhones = subscribers
        .map(s => s.phone)
        .filter(phone => phone && analyzePhoneNumber(phone).isValid)
        .map(phone => analyzePhoneNumber(phone).formatted);
    }

    // Validate manual contacts
    const validContacts = contacts ? contacts.filter(contact => {
      if (mode === 'email') {
        return contact.email && validateEmail(contact.email);
      } else {
        const phoneToCheck = contact.countryCode ? contact.countryCode + contact.phone : contact.phone;
        return phoneToCheck && analyzePhoneNumber(phoneToCheck).isValid;
      }
    }) : [];

    const manualEmails = validContacts.map(c => c.email).filter(email => email);
    const manualPhones = validContacts.map(contact => {
      if (mode === 'whatsapp' && contact.phone) {
        const fullPhone = contact.countryCode ? contact.countryCode + contact.phone : contact.phone;
        return analyzePhoneNumber(fullPhone).formatted;
      }
      return null;
    }).filter(phone => phone);

    const allEmails = [...new Set([...categoryEmails, ...manualEmails])];
    const allPhones = [...new Set([...categoryPhones, ...manualPhones])];

    if (mode === 'email' && allEmails.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email recipients found'
      });
    }

    if (mode === 'whatsapp' && allPhones.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid phone recipients found'
      });
    }

    // Handle scheduled date and time
    let finalScheduledDate = null;
    if (scheduleType === 'scheduled' && scheduledDate) {
      try {
        let dateToParse = scheduledDate;

        if (scheduledDate instanceof Date) {
          finalScheduledDate = scheduledDate;
        } else if (typeof scheduledDate === 'string' && scheduledDate.includes('T')) {
          finalScheduledDate = new Date(scheduledDate);
        } else if (typeof scheduledDate === 'string') {
          const dateTimeString = `${scheduledDate}T${scheduledTime || '09:00'}`;
          finalScheduledDate = new Date(dateTimeString);
        }

        if (!finalScheduledDate || isNaN(finalScheduledDate.getTime())) {
          return res.status(400).json({
            success: false,
            error: 'Invalid scheduled date/time format'
          });
        }
      } catch (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid scheduled date/time format'
        });
      }
    }

    // Handle template ID
    let finalTemplateId = templateId;
    if (!finalTemplateId || finalTemplateId === "" || finalTemplateId === "null") {
      finalTemplateId = null;
    }

    // Determine initial status
    let initialStatus = 'pending';
    if (scheduleType === 'scheduled') {
      const now = new Date();
      if (finalScheduledDate && finalScheduledDate > now) {
        initialStatus = 'scheduled';
      }
    } else if (scheduleType === 'recurring') {
      initialStatus = 'scheduled';
    }

    // Build recurrence config for recurring campaigns
    let finalRecurrenceConfig = undefined;
    if (scheduleType === 'recurring') {
      const dailyMode = recurrenceConfig.dailyMode || 'single';
      const perDayCount = parseInt(recurrenceConfig.perDayCount) || 1;
      const calculatedDailyMode = perDayCount > 1 ? 'multiple' : dailyMode;
      const finalPerDayCount = calculatedDailyMode === 'multiple' ?
        Math.min(Math.max(perDayCount, 1), 100) : 1;

      const intervalMinutes = calculatedDailyMode === 'multiple' ?
        Math.min(Math.max(parseInt(recurrenceConfig.intervalMinutes) || 0, 0), 1440) : 0;

      const repeatCountValue = Math.min(Math.max(
        parseInt(recurrenceConfig.repeatCount) || parseInt(repeatCount) || 5,
        1
      ), 365);

      finalRecurrenceConfig = {
        startDate: recurrenceConfig.startDate || new Date().toISOString().split('T')[0],
        startTime: recurrenceConfig.startTime || '09:00',
        timezone: recurrenceConfig.timezone || 'Asia/Kolkata',
        dailyMode: calculatedDailyMode,
        perDayCount: finalPerDayCount,
        intervalMinutes: intervalMinutes,
        scheduleDays: recurrenceConfig.scheduleDays || recurringPattern || 'daily',
        repeatCount: repeatCountValue
      };

      console.log('🔄 Built recurrence config:', finalRecurrenceConfig);
    }

    const campaignData = {
      title,
      mode,
      subject: mode === 'email' ? subject : undefined,
      message,
      category: categoryIds,
      contacts: validContacts,
      emails: allEmails,
      phones: allPhones,
      status: initialStatus,
      totalRecipients: mode === 'email' ? allEmails.length : allPhones.length,
      scheduleType,
      scheduledDate: finalScheduledDate,
      scheduledTime: scheduleType === 'scheduled' ? scheduledTime : undefined,
      recurringPattern: scheduleType === 'recurring' ? recurringPattern : undefined,
      repeatCount: scheduleType === 'recurring' ? repeatCount : 1,
      daysOfWeek: scheduleType === 'recurring' && recurringPattern === 'weekly' ? daysOfWeek : undefined,
      dayOfMonth: scheduleType === 'recurring' && recurringPattern === 'monthly' ? dayOfMonth : undefined,
      recurrenceConfig: finalRecurrenceConfig,
      currentRepeat: 0,
      mediaUrl: finalMediaUrl,
      templateId: finalTemplateId,
      trackingEnabled,
      sendOptions: {
        delayBetweenMessages: sendOptions.delayBetweenMessages || (mode === 'whatsapp' ? 2000 : 1000),
        maxRetries: sendOptions.maxRetries || 1,
        retryDelay: sendOptions.retryDelay || 300000,
        batchSize: sendOptions.batchSize || (mode === 'whatsapp' ? 5 : 10)
      },
      isActive: true
    };

    console.log("💾 Creating campaign with data:", {
      title: campaignData.title,
      mode: campaignData.mode,
      scheduleType: campaignData.scheduleType,
      status: campaignData.status,
      totalRecipients: campaignData.totalRecipients,
      recurrenceConfig: campaignData.recurrenceConfig
    });

    const campaign = await Campaign.create(campaignData);
    const populatedCampaign = await Campaign.findById(campaign._id)
      .populate('category')
      .populate('templateId');

    // Schedule campaign based on type
    if (scheduleType === 'scheduled' && initialStatus === 'scheduled') {
      await scheduleCampaign(campaign._id);
    } else if (scheduleType === 'recurring') {
      await scheduleRecurringCampaign(campaign._id);
    }

    // Start immediate campaigns
    if (scheduleType === 'immediate' || initialStatus === 'pending') {
      console.log('🚀 Starting immediate campaign...');
      setTimeout(() => {
        sendCampaignToRecipients(campaign);
      }, 1000);
    }

    res.status(201).json({
      success: true,
      message: `Campaign created successfully and ${scheduleType === 'immediate' ? 'started' : 'scheduled'}`,
      campaign: populatedCampaign
    });
  } catch (err) {
    console.error('❌ Create campaign error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to create campaign: ' + err.message
    });
  }
};

const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('🔄 Updating campaign:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }

    const existingCampaign = await Campaign.findById(id);
    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (existingCampaign.status === 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot update a campaign that is currently sending'
      });
    }

    const updateData = { ...req.body };

    // Ensure mediaUrl is HTTPS if present
    if (updateData.mediaUrl && updateData.mediaUrl.includes('http://')) {
      updateData.mediaUrl = updateData.mediaUrl.replace('http://', 'https://');
    }

    console.log('📝 Processing update data:', updateData);

    // Clear existing schedules
    clearCampaignSchedules(id);

    // Handle different schedule types
    if (updateData.scheduleType === 'scheduled' && updateData.scheduledDate) {
      console.log('📅 Handling scheduled campaign update');

      let scheduledDateTime;

      if (updateData.scheduledDate instanceof Date) {
        scheduledDateTime = updateData.scheduledDate;
      } else if (typeof updateData.scheduledDate === 'string') {
        if (updateData.scheduledDate.includes('T')) {
          scheduledDateTime = new Date(updateData.scheduledDate);
        } else {
          const dateTimeString = `${updateData.scheduledDate}T${updateData.scheduledTime || '09:00'}`;
          scheduledDateTime = new Date(dateTimeString);
        }
      }

      if (!scheduledDateTime || isNaN(scheduledDateTime.getTime())) {
        return res.status(400).json({
          success: false,
          error: 'Invalid scheduled date/time format'
        });
      }

      updateData.scheduledDate = scheduledDateTime;
      const now = new Date();

      console.log('🕐 Current time:', now);
      console.log('🕐 Scheduled time:', scheduledDateTime);

      if (scheduledDateTime > now) {
        updateData.status = 'scheduled';
        updateData.isActive = true;
        console.log('⏰ Campaign scheduled for future');
      } else {
        updateData.status = 'pending';
        updateData.isActive = true;
        console.log('⚠️ Scheduled time passed, setting to pending');
      }
    }
    else if (updateData.scheduleType === 'recurring') {
      console.log('🔄 Handling recurring campaign update');

      // Validate recurring data
      if (!updateData.recurrenceConfig?.startDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date is required for recurring campaigns'
        });
      }

      const dailyMode = updateData.recurrenceConfig.dailyMode || 'single';
      const perDayCount = parseInt(updateData.recurrenceConfig.perDayCount) || 1;

      if (dailyMode === 'multiple') {
        if (perDayCount < 1 || perDayCount > 100) {
          return res.status(400).json({
            success: false,
            error: 'Messages per day must be between 1 and 100'
          });
        }

        if (perDayCount > 1) {
          const intervalMinutes = parseInt(updateData.recurrenceConfig.intervalMinutes) || 0;
          if (intervalMinutes < 0 || intervalMinutes > 1440) {
            return res.status(400).json({
              success: false,
              error: 'Interval must be between 0 and 1440 minutes'
            });
          }
        }
      }

      if (updateData.recurringPattern === 'weekly' && (!updateData.daysOfWeek || updateData.daysOfWeek.length === 0)) {
        return res.status(400).json({
          success: false,
          error: 'Days of week are required for weekly recurring campaigns'
        });
      }
      if (updateData.recurringPattern === 'monthly' && !updateData.dayOfMonth) {
        return res.status(400).json({
          success: false,
          error: 'Day of month is required for monthly recurring campaigns'
        });
      }

      const repeatCountValue = parseInt(updateData.recurrenceConfig.repeatCount) || parseInt(updateData.repeatCount) || 5;
      if (repeatCountValue < 1 || repeatCountValue > 365) {
        return res.status(400).json({
          success: false,
          error: 'Repeat count must be between 1 and 365 days'
        });
      }

      // Build recurrence config
      const calculatedDailyMode = perDayCount > 1 ? 'multiple' : dailyMode;
      const finalPerDayCount = calculatedDailyMode === 'multiple' ?
        Math.min(Math.max(perDayCount, 1), 100) : 1;

      const intervalMinutes = calculatedDailyMode === 'multiple' ?
        Math.min(Math.max(parseInt(updateData.recurrenceConfig.intervalMinutes) || 0, 0), 1440) : 0;

      updateData.recurrenceConfig = {
        startDate: updateData.recurrenceConfig.startDate || new Date().toISOString().split('T')[0],
        startTime: updateData.recurrenceConfig.startTime || '09:00',
        timezone: updateData.recurrenceConfig.timezone || 'Asia/Kolkata',
        dailyMode: calculatedDailyMode,
        perDayCount: finalPerDayCount,
        intervalMinutes: intervalMinutes,
        scheduleDays: updateData.recurrenceConfig.scheduleDays || updateData.recurringPattern || 'daily',
        repeatCount: repeatCountValue
      };

      updateData.status = 'scheduled';
      updateData.isActive = true;
      updateData.currentRepeat = 0;
      updateData.completedAt = null;

      console.log('🔄 Updated recurrence config:', updateData.recurrenceConfig);
    }
    else if (updateData.scheduleType === 'immediate') {
      console.log('🚀 Handling immediate campaign update');
      updateData.scheduledDate = null;
      updateData.scheduledTime = null;
      updateData.recurrenceConfig = null;
      updateData.recurringPattern = null;
      updateData.repeatCount = null;
      updateData.daysOfWeek = null;
      updateData.dayOfMonth = null;
      updateData.status = 'pending';
    } else {
      // For scheduled campaigns that are not recurring, clear recurrence data
      updateData.recurrenceConfig = null;
      updateData.recurringPattern = null;
      updateData.repeatCount = null;
      updateData.daysOfWeek = null;
      updateData.dayOfMonth = null;
    }

    console.log('💾 Saving campaign to database...');

    // Update the campaign
    const campaign = await Campaign.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('category').populate('templateId');

    console.log('✅ Campaign updated successfully:', campaign._id);
    console.log('📊 Campaign status:', campaign.status);
    console.log('📈 Campaign isActive:', campaign.isActive);
    console.log('🔄 Campaign recurrenceConfig:', campaign.recurrenceConfig);

    // Schedule the campaign based on new settings
    if (campaign.scheduleType === 'scheduled' && campaign.status === 'scheduled') {
      await scheduleCampaign(campaign._id);
      console.log('✅ New schedule set for scheduled campaign');
    } else if (campaign.scheduleType === 'recurring') {
      await scheduleRecurringCampaign(campaign._id);
      console.log('✅ New schedule set for recurring campaign');
    } else if ((campaign.scheduleType === 'immediate' && campaign.status === 'pending') ||
      (campaign.scheduleType === 'scheduled' && campaign.status === 'pending')) {
      console.log('🚀 Starting campaign immediately...');
      setTimeout(() => {
        sendCampaignToRecipients(campaign);
      }, 1000);
    }

    res.json({
      success: true,
      message: 'Campaign updated successfully',
      campaign
    });

  } catch (err) {
    console.error('❌ Update campaign error:', err);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({
        success: false,
        error: `Validation failed: ${errors.join(', ')}`
      });
    }

    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'Campaign with this title already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: err.message || 'Failed to update campaign'
    });
  }
};

const getCampaigns = async (req, res) => {
  try {
    const { status, mode, scheduleType, isActive, page = 1, limit = 10, search } = req.query;

    let query = {};

    if (status) query.status = status;
    if (mode) query.mode = mode;
    if (scheduleType) query.scheduleType = scheduleType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const campaigns = await Campaign.find(query)
      .populate('category')
      .populate('templateId')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Campaign.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      campaigns
    });
  } catch (err) {
    console.error('Get campaigns error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(id)
      .populate('category')
      .populate('templateId');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    res.json({
      success: true,
      campaign
    });
  } catch (err) {
    console.error('Get campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};



const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete a campaign that is currently being sent'
      });
    }

    clearCampaignSchedules(id);
    await Campaign.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Campaign deleted successfully'
    });
  } catch (err) {
    console.error('Delete campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==================== CAMPAIGN ACTIONS ====================
const startCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already sending'
      });
    }

    if (campaign.mode === 'whatsapp' && !isWhatsAppReady()) {
      return res.status(400).json({
        success: false,
        error: 'WhatsApp is not connected. Please connect WhatsApp first.'
      });
    }

    clearCampaignSchedules(id);

    campaign.status = 'sending';
    campaign.startedAt = new Date();
    await campaign.save();

    sendCampaignToRecipients(campaign);

    res.json({
      success: true,
      message: 'Campaign started successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Start campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const stopCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.status !== 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Campaign is not currently sending'
      });
    }

    campaign.status = 'stopped';
    await campaign.save();

    res.json({
      success: true,
      message: 'Campaign stopped successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Stop campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.status === 'sending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot pause a campaign that is currently sending. Please stop it first.'
      });
    }

    if (!campaign.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already paused'
      });
    }

    campaign.isActive = false;
    campaign.status = 'paused';
    clearCampaignSchedules(id);
    await campaign.save();

    res.json({
      success: true,
      message: 'Campaign paused successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Pause campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    if (campaign.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Campaign is already active'
      });
    }

    campaign.isActive = true;

    if (campaign.scheduleType === 'scheduled') {
      campaign.status = 'scheduled';
      await scheduleCampaign(campaign._id);
    } else if (campaign.scheduleType === 'recurring') {
      campaign.status = 'scheduled';
      await scheduleRecurringCampaign(campaign._id);
    } else {
      campaign.status = 'pending';
    }

    await campaign.save();

    res.json({
      success: true,
      message: 'Campaign resumed successfully',
      campaign: await campaign.populate('category')
    });
  } catch (err) {
    console.error('Resume campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const resendCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const { resetAnalytics = true } = req.body;

    console.log('🔄 Resending campaign:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID format'
      });
    }

    const existingCampaign = await Campaign.findById(id)
      .populate('category')
      .populate('templateId');

    if (!existingCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const updateData = {
      status: 'pending',
      startedAt: null,
      completedAt: null,
      results: [],
      successCount: 0,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      deliveredCount: 0,
      readCount: 0,
      currentRepeat: 0,
      lastSentAt: null,
      error: null,
      isActive: true,
    };

    if (existingCampaign.scheduleType === 'recurring') {
      updateData.currentRepeat = 0;
    }

    await Campaign.findByIdAndUpdate(id, updateData, { new: false });
    const refreshedCampaign = await Campaign.findById(id)
      .populate('category')
      .populate('templateId');

    console.log('📇 Final contacts count:', refreshedCampaign.contacts?.length || 0);

    if (resetAnalytics) {
      await Analytics.deleteMany({ campaignId: id });
      console.log('📊 Analytics reset for campaign:', id);
    }

    clearCampaignSchedules(id);

    if (refreshedCampaign.scheduleType === 'scheduled') {
      await scheduleCampaign(id);
    } else if (refreshedCampaign.scheduleType === 'recurring') {
      await scheduleRecurringCampaign(id);
    }

    if (refreshedCampaign.scheduleType === 'immediate') {
      console.log('🚀 Starting immediate resend of campaign:', refreshedCampaign.title);
      setTimeout(() => {
        sendCampaignToRecipients(refreshedCampaign);
      }, 1000);
    }

    res.json({
      success: true,
      message: 'Campaign reset for resending successfully',
      campaign: refreshedCampaign,
    });
  } catch (err) {
    console.error('❌ Resend campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

const duplicateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      newTitle,
      scheduleType = 'immediate',
      scheduledDate = null,
      scheduledTime = '09:00'
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }

    const originalCampaign = await Campaign.findById(id);
    if (!originalCampaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const duplicateData = {
      ...originalCampaign.toObject(),
      _id: new mongoose.Types.ObjectId(),
      title: newTitle || `${originalCampaign.title} - Copy`,
      status: scheduleType === 'immediate' ? 'pending' : 'scheduled',
      scheduleType,
      scheduledDate: scheduleType === 'scheduled' ? scheduledDate : null,
      scheduledTime: scheduleType === 'scheduled' ? scheduledTime : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      startedAt: null,
      completedAt: null,
      lastSentAt: null,
      currentRepeat: 0,
      successCount: 0,
      failedCount: 0,
      openedCount: 0,
      clickedCount: 0,
      deliveredCount: 0,
      readCount: 0,
      results: [],
      error: null,
      parentCampaign: id,
      isActive: true
    };

    delete duplicateData.__v;
    delete duplicateData.analytics;

    const duplicatedCampaign = await Campaign.create(duplicateData);
    const populatedCampaign = await duplicatedCampaign.populate('category templateId');

    if (scheduleType === 'scheduled') {
      await scheduleCampaign(duplicatedCampaign._id);
    } else if (scheduleType === 'recurring') {
      await scheduleRecurringCampaign(duplicatedCampaign._id);
    } else if (scheduleType === 'immediate') {
      sendCampaignToRecipients(duplicatedCampaign);
    }

    res.json({
      success: true,
      message: 'Campaign duplicated successfully',
      campaign: populatedCampaign
    });
  } catch (err) {
    console.error('Duplicate campaign error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getCampaignStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(id)
      .populate('category')
      .populate('templateId');

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const analytics = await Analytics.find({ campaignId: id });

    const calculateEstimatedCompletion = (campaign) => {
      if (campaign.status !== 'sending') return null;
      const startedAt = new Date(campaign.startedAt);
      const now = new Date();
      const elapsed = now - startedAt;
      const completed = campaign.successCount + campaign.failedCount;
      const remaining = campaign.totalRecipients - completed;
      if (completed === 0) return null;
      const rate = completed / (elapsed / 1000);
      const estimatedSeconds = remaining / rate;
      return new Date(now.getTime() + estimatedSeconds * 1000);
    };

    const statusData = {
      campaign: campaign,
      analytics: {
        total: analytics.length,
        sent: analytics.filter(a => a.event === 'sent').length,
        delivered: analytics.filter(a => a.event === 'delivered').length,
        read: analytics.filter(a => a.event === 'read').length,
        clicked: analytics.filter(a => a.event === 'clicked').length,
        failed: analytics.filter(a => a.event === 'failed').length,
        opened: analytics.filter(a => a.event === 'opened').length
      },
      progress: {
        total: campaign.totalRecipients,
        completed: campaign.successCount + campaign.failedCount,
        percentage: campaign.totalRecipients > 0
          ? Math.round(((campaign.successCount + campaign.failedCount) / campaign.totalRecipients) * 100)
          : 0
      },
      estimatedCompletion: calculateEstimatedCompletion(campaign)
    };

    res.json({
      success: true,
      ...statusData
    });
  } catch (err) {
    console.error('Get campaign status error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getCampaignStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    const stats = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: null,
          totalCampaigns: { $sum: 1 },
          totalEmails: { $sum: { $cond: [{ $eq: ['$mode', 'email'] }, '$totalRecipients', 0] } },
          totalWhatsApps: { $sum: { $cond: [{ $eq: ['$mode', 'whatsapp'] }, '$totalRecipients', 0] } },
          successfulCampaigns: {
            $sum: {
              $cond: [{ $in: ['$status', ['sent', 'completed']] }, 1, 0]
            }
          },
          failedCampaigns: {
            $sum: {
              $cond: [{ $eq: ['$status', 'failed'] }, 1, 0]
            }
          },
          totalRecipients: { $sum: '$totalRecipients' },
          avgSuccessRate: { $avg: { $cond: [{ $gt: ['$totalRecipients', 0] }, { $divide: ['$successCount', '$totalRecipients'] }, 0] } }
        }
      }
    ]);

    const modeStats = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$mode',
          count: { $sum: 1 },
          totalRecipients: { $sum: '$totalRecipients' },
          avgSuccessRate: { $avg: { $cond: [{ $gt: ['$totalRecipients', 0] }, { $divide: ['$successCount', '$totalRecipients'] }, 0] } }
        }
      }
    ]);

    const statusStats = await Campaign.aggregate([
      {
        $match: {
          createdAt: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      overview: stats[0] || {
        totalCampaigns: 0,
        totalEmails: 0,
        totalWhatsApps: 0,
        successfulCampaigns: 0,
        failedCampaigns: 0,
        totalRecipients: 0,
        avgSuccessRate: 0
      },
      byMode: modeStats,
      byStatus: statusStats,
      period,
      dateRange
    });
  } catch (err) {
    console.error('Get campaign stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==================== EMAIL INTEGRATION ====================
const sendSingleEmail = async (req, res) => {
  try {
    const { to, subject, message, templateId, attachments = [] } = req.body;

    if (!to || !subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'To, subject, and message are required'
      });
    }

    if (!validateEmail(to)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email address'
      });
    }

    let finalMessage = message;

    if (templateId) {
      const template = await EmailTemplate.findById(templateId);
      if (template) {
        finalMessage = template.content.replace('{{message}}', message);
      }
    }

    const result = await sendEmail(to, subject, finalMessage, null, attachments);

    if (result.success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (err) {
    console.error('Send single email error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const sendBulkEmail = async (req, res) => {
  try {
    const {
      recipients,
      subject,
      message,
      templateId,
      batchSize = 10,
      delayBetweenBatches = 2000
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid recipients array is required'
      });
    }

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        error: 'Subject and message are required'
      });
    }

    const validRecipients = recipients.filter(email => validateEmail(email));
    const invalidRecipients = recipients.filter(email => !validateEmail(email));

    if (validRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid email addresses found'
      });
    }

    let template = null;
    if (templateId) {
      template = await EmailTemplate.findById(templateId);
    }

    const results = {
      total: recipients.length,
      valid: validRecipients.length,
      invalid: invalidRecipients.length,
      sent: 0,
      failed: 0,
      invalidRecipients: invalidRecipients,
      details: []
    };

    for (let i = 0; i < validRecipients.length; i += batchSize) {
      const batch = validRecipients.slice(i, i + batchSize);

      const batchPromises = batch.map(async (email) => {
        try {
          let finalMessage = template
            ? template.content.replace('{{message}}', message)
            : message;

          const result = await sendEmail(email, subject, finalMessage);

          return {
            recipient: email,
            success: result.success,
            messageId: result.messageId,
            error: result.error
          };
        } catch (error) {
          return {
            recipient: email,
            success: false,
            error: error.message
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          const emailResult = result.value;
          results.details.push(emailResult);

          if (emailResult.success) {
            results.sent++;
          } else {
            results.failed++;
          }
        }
      });

      if (i + batchSize < validRecipients.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    res.json({
      success: true,
      message: `Bulk email completed: ${results.sent} sent, ${results.failed} failed`,
      results
    });
  } catch (err) {
    console.error('Send bulk email error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getEmailTemplates = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;

    let query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const templates = await EmailTemplate.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await EmailTemplate.countDocuments(query);

    res.json({
      success: true,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      templates
    });
  } catch (err) {
    console.error('Get email templates error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const createEmailTemplate = async (req, res) => {
  try {
    const { name, subject, content, category, isActive = true } = req.body;

    if (!name || !subject || !content) {
      return res.status(400).json({
        success: false,
        error: 'Name, subject, and content are required'
      });
    }

    const existingTemplate = await EmailTemplate.findOne({ name });
    if (existingTemplate) {
      return res.status(400).json({
        success: false,
        error: 'Template with this name already exists'
      });
    }

    const template = await EmailTemplate.create({
      name,
      subject,
      content,
      category,
      isActive,
      createdBy: req.user?.id || 'system'
    });

    res.status(201).json({
      success: true,
      message: 'Email template created successfully',
      template
    });
  } catch (err) {
    console.error('Create email template error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==================== GMAIL OAUTH ====================
const gmailAuth = async (req, res) => {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });

    res.json({
      success: true,
      authUrl,
      message: 'Redirect user to this URL for Gmail authentication'
    });
  } catch (err) {
    console.error('Gmail auth error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const gmailCallback = async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    // Store tokens securely (in database or secure storage)
    // For now, we'll just return them
    // In production, encrypt and store these tokens

    res.json({
      success: true,
      message: 'Gmail authentication successful',
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: tokens.expiry_date
      }
    });
  } catch (err) {
    console.error('Gmail callback error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==================== ANALYTICS & MONITORING ====================
const getCampaignAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const { period = '30d' } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid campaign ID'
      });
    }

    const campaign = await Campaign.findById(id);
    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Campaign not found'
      });
    }

    const dateRange = getDateRange(period);

    const analytics = await Analytics.aggregate([
      {
        $match: {
          campaignId: new mongoose.Types.ObjectId(id),
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
          uniqueRecipients: { $addToSet: '$recipient' }
        }
      }
    ]);

    const timelineData = await Analytics.aggregate([
      {
        $match: {
          campaignId: new mongoose.Types.ObjectId(id),
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            event: '$event'
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.date': 1 }
      }
    ]);

    const recipientEngagement = await Analytics.aggregate([
      {
        $match: {
          campaignId: new mongoose.Types.ObjectId(id),
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$recipient',
          events: { $push: '$event' },
          firstEvent: { $min: '$timestamp' },
          lastEvent: { $max: '$timestamp' }
        }
      },
      {
        $project: {
          recipient: '$_id',
          _id: 0,
          eventCount: { $size: '$events' },
          hasOpened: { $in: ['opened', '$events'] },
          hasClicked: { $in: ['clicked', '$events'] },
          hasReplied: { $in: ['replied', '$events'] },
          engagementScore: {
            $add: [
              { $cond: [{ $in: ['opened', '$events'] }, 1, 0] },
              { $cond: [{ $in: ['clicked', '$events'] }, 2, 0] },
              { $cond: [{ $in: ['replied', '$events'] }, 3, 0] }
            ]
          }
        }
      },
      {
        $sort: { engagementScore: -1 }
      }
    ]);

    res.json({
      success: true,
      campaign: {
        id: campaign._id,
        title: campaign.title,
        mode: campaign.mode,
        status: campaign.status,
        totalRecipients: campaign.totalRecipients
      },
      summary: analytics.reduce((acc, curr) => {
        acc[curr._id] = {
          count: curr.count,
          uniqueRecipients: curr.uniqueRecipients.length
        };
        return acc;
      }, {}),
      timeline: timelineData,
      recipientEngagement,
      period,
      dateRange
    });
  } catch (err) {
    console.error('Get campaign analytics error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getWhatsAppStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    const stats = await Analytics.aggregate([
      {
        $match: {
          type: 'whatsapp',
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
          uniqueRecipients: { $addToSet: '$recipient' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      dateRange,
      stats: stats.reduce((acc, curr) => {
        acc[curr._id] = {
          count: curr.count,
          uniqueRecipients: curr.uniqueRecipients.length
        };
        return acc;
      }, {})
    });
  } catch (err) {
    console.error('Get WhatsApp stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getGmailStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    const stats = await Analytics.aggregate([
      {
        $match: {
          type: 'email',
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $group: {
          _id: '$event',
          count: { $sum: 1 },
          uniqueRecipients: { $addToSet: '$recipient' }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      dateRange,
      stats: stats.reduce((acc, curr) => {
        acc[curr._id] = {
          count: curr.count,
          uniqueRecipients: curr.uniqueRecipients.length
        };
        return acc;
      }, {})
    });
  } catch (err) {
    console.error('Get Gmail stats error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const generateReports = async (req, res) => {
  try {
    const { type = 'campaign', format = 'json', period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    let reportData = {};

    if (type === 'campaign') {
      reportData = await Campaign.aggregate([
        {
          $match: {
            createdAt: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: null,
            totalCampaigns: { $sum: 1 },
            totalRecipients: { $sum: '$totalRecipients' },
            totalSuccess: { $sum: '$successCount' },
            totalFailed: { $sum: '$failedCount' },
            avgSuccessRate: {
              $avg: {
                $cond: [
                  { $gt: ['$totalRecipients', 0] },
                  { $divide: ['$successCount', '$totalRecipients'] },
                  0
                ]
              }
            }
          }
        }
      ]);
    } else if (type === 'engagement') {
      reportData = await Analytics.aggregate([
        {
          $match: {
            timestamp: { $gte: dateRange.start, $lte: dateRange.end }
          }
        },
        {
          $group: {
            _id: '$type',
            totalEvents: { $sum: 1 },
            uniqueRecipients: { $addToSet: '$recipient' },
            opens: { $sum: { $cond: [{ $eq: ['$event', 'opened'] }, 1, 0] } },
            clicks: { $sum: { $cond: [{ $eq: ['$event', 'clicked'] }, 1, 0] } },
            replies: { $sum: { $cond: [{ $eq: ['$event', 'replied'] }, 1, 0] } }
          }
        }
      ]);
    }

    res.json({
      success: true,
      type,
      format,
      period,
      dateRange,
      report: reportData
    });
  } catch (err) {
    console.error('Generate reports error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const getComprehensiveAnalytics = async (req, res) => {
  try {
    const { period = '30d', mode, groupBy = 'day' } = req.query;
    const dateRange = getDateRange(period);

    let matchQuery = {
      createdAt: { $gte: dateRange.start, $lte: dateRange.end }
    };

    if (mode) {
      matchQuery.mode = mode;
    }

    const campaignPerformance = await Campaign.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$mode',
          totalCampaigns: { $sum: 1 },
          totalRecipients: { $sum: '$totalRecipients' },
          avgSuccessRate: {
            $avg: {
              $cond: [
                { $gt: ['$totalRecipients', 0] },
                { $divide: ['$successCount', '$totalRecipients'] },
                0
              ]
            }
          },
          totalSuccess: { $sum: '$successCount' },
          totalFailed: { $sum: '$failedCount' }
        }
      }
    ]);

    const format = groupBy === 'day' ? '%Y-%m-%d' : groupBy === 'month' ? '%Y-%m' : '%Y-%U';

    const timelineData = await Campaign.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: {
            date: { $dateToString: { format, date: '$createdAt' } },
            mode: '$mode'
          },
          campaignCount: { $sum: 1 },
          recipientCount: { $sum: '$totalRecipients' },
          successCount: { $sum: '$successCount' }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    const engagementMetrics = await Analytics.aggregate([
      {
        $match: {
          timestamp: { $gte: dateRange.start, $lte: dateRange.end }
        }
      },
      {
        $lookup: {
          from: 'campaigns',
          localField: 'campaignId',
          foreignField: '_id',
          as: 'campaign'
        }
      },
      {
        $unwind: '$campaign'
      },
      {
        $group: {
          _id: '$campaign.mode',
          totalEvents: { $sum: 1 },
          uniqueRecipients: { $addToSet: '$recipient' },
          opens: { $sum: { $cond: [{ $eq: ['$event', 'opened'] }, 1, 0] } },
          clicks: { $sum: { $cond: [{ $eq: ['$event', 'clicked'] }, 1, 0] } },
          replies: { $sum: { $cond: [{ $eq: ['$event', 'replied'] }, 1, 0] } }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      dateRange,
      campaignPerformance,
      timelineData,
      engagementMetrics: engagementMetrics.reduce((acc, curr) => {
        acc[curr._id] = {
          totalEvents: curr.totalEvents,
          uniqueRecipients: curr.uniqueRecipients.length,
          opens: curr.opens,
          clicks: curr.clicks,
          replies: curr.replies,
          openRate: curr.uniqueRecipients.length > 0 ? (curr.opens / curr.uniqueRecipients.length) : 0,
          clickRate: curr.uniqueRecipients.length > 0 ? (curr.clicks / curr.uniqueRecipients.length) : 0
        };
        return acc;
      }, {}),
      summary: {
        totalCampaigns: campaignPerformance.reduce((sum, item) => sum + item.totalCampaigns, 0),
        totalRecipients: campaignPerformance.reduce((sum, item) => sum + item.totalRecipients, 0),
        totalSuccess: campaignPerformance.reduce((sum, item) => sum + item.totalSuccess, 0),
        overallSuccessRate: campaignPerformance.reduce((sum, item) => sum + item.totalSuccess, 0) /
          (campaignPerformance.reduce((sum, item) => sum + item.totalRecipients, 0) || 1)
      }
    });
  } catch (err) {
    console.error('Get comprehensive analytics error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==================== TRACKING ====================
const trackEmailOpenPixel = async (req, res) => {
  try {
    const { campaign, recipient } = req.query;

    if (!campaign || !recipient) {
      return res.status(400).send('Missing parameters');
    }

    await Analytics.create({
      campaignId: campaign,
      type: 'email',
      event: 'opened',
      recipient: decodeURIComponent(recipient),
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    await Campaign.findByIdAndUpdate(campaign, {
      $inc: { openedCount: 1 }
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  } catch (err) {
    console.error('Track email open error:', err);
    res.setHeader('Content-Type', 'image/png');
    res.send(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'));
  }
};

const trackEmailClickRedirect = async (req, res) => {
  try {
    const { campaign, recipient, url } = req.query;

    if (!campaign || !recipient || !url) {
      return res.status(400).send('Missing parameters');
    }

    const decodedUrl = decodeURIComponent(url);

    await Analytics.create({
      campaignId: campaign,
      type: 'email',
      event: 'clicked',
      recipient: decodeURIComponent(recipient),
      metadata: { url: decodedUrl },
      timestamp: new Date(),
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip
    });

    await Campaign.findByIdAndUpdate(campaign, {
      $inc: { clickedCount: 1 }
    });

    res.redirect(decodedUrl);
  } catch (err) {
    console.error('Track email click error:', err);
    res.redirect(url ? decodeURIComponent(url) : '/');
  }
};

// ==================== UTILITY ====================
const healthCheck = async (req, res) => {
  try {
    const checks = {
      database: false,
      whatsapp: false,
      email: false,
      cron: false
    };

    try {
      await mongoose.connection.db.admin().ping();
      checks.database = true;
    } catch (err) {
      console.error('Database health check failed:', err);
    }

    checks.whatsapp = isWhatsAppReady();

    try {
      await transporter.verify();
      checks.email = true;
    } catch (err) {
      console.error('Email health check failed:', err);
    }

    checks.cron = scheduledCampaigns.size >= 0 && recurringCampaigns.size >= 0;

    const allHealthy = Object.values(checks).every(check => check);

    res.json({
      success: true,
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
      stats: {
        scheduledCampaigns: scheduledCampaigns.size,
        recurringCampaigns: recurringCampaigns.size,
        totalCampaigns: await Campaign.countDocuments(),
        activeCampaigns: await Campaign.countDocuments({ isActive: true })
      },
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: err.message
    });
  }
};

const validatePhoneNumber = (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required'
      });
    }

    const analysis = analyzePhoneNumber(phoneNumber);

    res.json({
      success: true,
      phoneNumber,
      ...analysis
    });
  } catch (err) {
    console.error('Validate phone number error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

const validateCampaignData = async (req, res) => {
  try {
    const campaignData = req.body;
    const errors = [];

    if (!campaignData.title) errors.push('Title is required');
    if (!campaignData.mode) errors.push('Mode is required');
    if (!campaignData.message) errors.push('Message is required');

    if (campaignData.mode === 'email' && !campaignData.subject) {
      errors.push('Subject is required for email campaigns');
    }

    if (campaignData.scheduleType === 'scheduled') {
      const { scheduledDate } = campaignData;

      if (!scheduledDate) {
        errors.push('Scheduled date is required for scheduled campaigns');
      } else {
        let parsedDate;

        try {
          if (scheduledDate instanceof Date) {
            parsedDate = scheduledDate;
          } else if (typeof scheduledDate === 'string' || typeof scheduledDate === 'number') {
            parsedDate = new Date(scheduledDate);
          }

          if (!(parsedDate instanceof Date) || isNaN(parsedDate.getTime())) {
            errors.push(`Invalid scheduled date format: ${scheduledDate}`);
          }
        } catch (err) {
          errors.push(`Invalid scheduled date format: ${scheduledDate}`);
        }
      }
    }

    if (campaignData.scheduleType === 'recurring') {

      if (!campaignData.recurrenceConfig?.startDate) {
        newErrors.startDate = 'Start date is required for recurring campaigns';
      }

      const dailyMode = campaignData.recurrenceConfig?.dailyMode || 'single';

      if (dailyMode === 'multiple') {
        const perDayCount = campaignData.recurrenceConfig?.perDayCount || 1;
        if (perDayCount < 1 || perDayCount > 100) {
          newErrors.perDay
        } Count = 'Messages per day must be between 1 and 100';
      }

      if (perDayCount > 1) {
        const intervalMinutes = campaignData.recurrenceConfig?.intervalMinutes || 0;
        if (intervalMinutes < 0 || intervalMinutes > 1440) {
          newErrors.intervalMinutes = 'Interval must be between 0 and 1440 minutes';
        }
      }

      if (!campaignData.recurringPattern) {
        errors.push('Recurring pattern is required for recurring campaigns');
      }
      if (campaignData.recurringPattern === 'weekly' &&
        (!campaignData.daysOfWeek || campaignData.daysOfWeek.length === 0)) {
        errors.push('Days of week are required for weekly recurring campaigns');
      }
      if (campaignData.recurringPattern === 'monthly' && !campaignData.dayOfMonth) {
        errors.push('Day of month is required for monthly recurring campaigns');
      }
    }

    if (campaignData.mode === 'email') {
      const hasCategories = campaignData.categoryIds && campaignData.categoryIds.length > 0;
      const hasContacts = campaignData.contacts && campaignData.contacts.length > 0;

      if (!hasCategories && !hasContacts) {
        errors.push('Either categories or contacts are required for email campaigns');
      }
    }

    if (campaignData.mode === 'whatsapp' && !isWhatsAppReady()) {
      errors.push('WhatsApp is not connected. Please connect WhatsApp first.');
    }

    res.json({
      success: errors.length === 0,
      errors,
      valid: errors.length === 0
    });
  } catch (err) {
    console.error('Validate campaign data error:', err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
};

// ==================== INTERNAL FUNCTIONS ====================
const clearCampaignSchedules = (campaignId) => {
  if (scheduledCampaigns.has(campaignId)) {
    const scheduled = scheduledCampaigns.get(campaignId);
    if (scheduled) {
      clearTimeout(scheduled);
    }
    scheduledCampaigns.delete(campaignId);
  }

  if (recurringCampaigns.has(campaignId)) {
    const recurring = recurringCampaigns.get(campaignId);
    if (recurring && Array.isArray(recurring)) {
      recurring.forEach(task => task.stop());
    }
    recurringCampaigns.delete(campaignId);
  }
};

const scheduleCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || campaign.status !== 'scheduled' || !campaign.isActive) {
      console.log(`❌ Campaign not eligible for scheduling:`, {
        exists: !!campaign,
        status: campaign?.status,
        isActive: campaign?.isActive
      });
      return;
    }

    let scheduledTime;

    if (campaign.scheduledDate instanceof Date) {
      scheduledTime = campaign.scheduledDate.getTime();
    } else if (typeof campaign.scheduledDate === 'string') {
      scheduledTime = new Date(campaign.scheduledDate).getTime();
    } else {
      console.error('❌ Invalid scheduledDate format:', campaign.scheduledDate);
      campaign.status = 'failed';
      campaign.error = 'Invalid scheduled date format';
      await campaign.save();
      return;
    }

    const now = Date.now();
    const delay = scheduledTime - now;

    console.log(`📅 Campaign ${campaign.title} scheduling:`, {
      scheduledTime: new Date(scheduledTime),
      now: new Date(now),
      delay: delay / 1000 / 60 + ' minutes from now'
    });

    if (delay > 0) {
      clearCampaignSchedules(campaignId);

      const timeoutId = setTimeout(async () => {
        try {
          console.log(`⏰ Executing scheduled campaign: ${campaign.title}`);
          const freshCampaign = await Campaign.findById(campaignId);
          if (!freshCampaign || !freshCampaign.isActive) {
            console.log(`⏹️ Campaign no longer active: ${campaign.title}`);
            return;
          }

          await executeScheduledCampaign(freshCampaign);
        } catch (error) {
          console.error(`❌ Scheduled campaign execution failed: ${error.message}`);
          await Campaign.findByIdAndUpdate(campaignId, {
            status: 'failed',
            error: error.message
          });
        } finally {
          scheduledCampaigns.delete(campaignId);
        }
      }, delay);

      scheduledCampaigns.set(campaignId, timeoutId);
      console.log(`📅 Campaign ${campaign.title} scheduled for ${new Date(scheduledTime)}`);
    } else {
      console.log(`⚠️ Scheduled time passed, marking as pending: ${campaign.title}`);
      campaign.status = 'pending';
      await campaign.save();
    }
  } catch (error) {
    console.error(`❌ Error scheduling campaign: ${error.message}`);
    await Campaign.findByIdAndUpdate(campaignId, {
      status: 'failed',
      error: `Scheduling error: ${error.message}`
    });
  }
};

const executeScheduledCampaign = async (campaign) => {
  try {
    campaign.status = 'sending';
    await campaign.save();

    await sendCampaignToRecipients(campaign);

    return true;
  } catch (error) {
    console.error(`❌ Scheduled campaign failed: ${error.message}`);
    campaign.status = 'failed';
    campaign.error = error.message;
    await campaign.save();
    return false;
  }
};


// Execute N messages sequentially for one day (handles intervalMinutes === 0 as 1s gaps)
const executeMultipleMessagesForDay = async (campaignId, perDayCount, intervalMinutes, totalExpectedMessages) => {
  try {
    let campaign = await Campaign.findById(campaignId);
    if (!campaign || !campaign.isActive) {
      console.log(`⏹️ Campaign inactive or missing: ${campaignId}`);
      return;
    }

    console.log(`🚀 [${campaign.title}] Starting ${perDayCount} messages today (interval ${intervalMinutes} min)`);

    for (let i = 0; i < perDayCount; i++) {
      // Reload fresh data every loop
      campaign = await Campaign.findById(campaignId);
      if (!campaign || !campaign.isActive) {
        console.log(`⏹️ Stopping: campaign not active at iteration ${i + 1}`);
        break;
      }

      // Prevent sending beyond totalExpectedMessages
      const already = campaign.currentRepeat || 0;
      if (already >= totalExpectedMessages) {
        console.log(`🔁 Already reached total (${already}/${totalExpectedMessages}) — stopping`);
        campaign.status = 'completed';
        campaign.isActive = false;
        await campaign.save();
        break;
      }

      console.log(`📤 [${campaign.title}] Sending message ${already + 1}/${totalExpectedMessages}`);

      // 👇 Await sending — important to avoid overlapping sends
      const results = await sendCampaignToRecipients(campaign);

      // Update progress
      const successful = Array.isArray(results) ? results.filter(r => r.status === 'sent').length : 0;
      const failed = Array.isArray(results) ? results.filter(r => r.status === 'failed').length : 0;

      campaign.currentRepeat = already + 1;
      campaign.lastSentAt = new Date();
      campaign.successCount = (campaign.successCount || 0) + successful;
      campaign.failedCount = (campaign.failedCount || 0) + failed;

      if (campaign.currentRepeat >= totalExpectedMessages) {
        campaign.status = 'completed';
        campaign.isActive = false;
        campaign.completedAt = new Date();
      } else {
        campaign.status = 'scheduled';
      }

      await campaign.save();

      console.log(`✅ [${campaign.title}] Sent ${campaign.currentRepeat}/${totalExpectedMessages} (Success ${successful}, Failed ${failed})`);

      // Delay before next message — only if more remain today
      if (i < perDayCount - 1) {
        const waitMs = intervalMinutes > 0 ? intervalMinutes * 60 * 1000 : 1000;
        console.log(`⏳ Waiting ${waitMs / 1000}s before next send...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
      }
    }

  } catch (err) {
    console.error('❌ executeMultipleMessagesForDay error:', err);
  }
};


// Execute a single message (used for single-per-day mode)
const executeSingleMessage = async (campaignId, totalExpectedMessages) => {
  try {
    const live = await Campaign.findById(campaignId);
    if (!live || !live.isActive) return;

    console.log(`🚀 executeSingleMessage: ${live.title}`);

    const results = await sendCampaignToRecipients(live);

    const successful = Array.isArray(results) ? results.filter(r => r.status === 'sent').length : 0;
    const failed = Array.isArray(results) ? results.filter(r => r.status === 'failed').length : 0;

    live.currentRepeat = (live.currentRepeat || 0) + 1;
    live.lastSentAt = new Date();
    live.successCount = (live.successCount || 0) + successful;
    live.failedCount = (live.failedCount || 0) + failed;

    if (live.currentRepeat >= totalExpectedMessages) {
      live.status = 'completed';
      live.isActive = false;
      live.completedAt = new Date();
    } else {
      live.status = 'pending';
    }

    await live.save();
    console.log(`✅ Sent single message ${live.currentRepeat}/${totalExpectedMessages} for "${live.title}"`);
  } catch (err) {
    console.error('❌ executeSingleMessage error:', err);
  }
};

// ---------- SCHEDULER ----------

const scheduleRecurringCampaign = async (campaignId) => {
  try {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign || campaign.scheduleType !== "recurring") {
      console.log("❌ Campaign not eligible for recurring scheduling:", { exists: !!campaign, scheduleType: campaign?.scheduleType });
      return;
    }

    // Fix for reactivating
    if (campaign.status === 'completed' && campaign.isActive === false) {
      campaign.status = 'scheduled';
      campaign.isActive = true;
      campaign.currentRepeat = 0;
      campaign.completedAt = null;
      await campaign.save();
    }

    if (!campaign.isActive) {
      console.log(`⏹️ Campaign not active: ${campaign.title}`);
      return;
    }

    clearCampaignSchedules(campaignId);

    const cfg = campaign.recurrenceConfig || {};
    const startDate = cfg.startDate || moment().format('YYYY-MM-DD');
    const startTime = cfg.startTime || '09:00';
    const dailyMode = cfg.dailyMode || 'single';
    const perDayCount = parseInt(cfg.perDayCount || 1, 10) || 1;
    //const intervalMinutes = parseInt(cfg.intervalMinutes || 0, 10) || 0;
    const intervalMinutes =
      cfg.intervalMinutes === undefined || cfg.intervalMinutes === null
        ? 30
        : parseInt(cfg.intervalMinutes, 10);

    const repeatCount = parseInt(cfg.repeatCount || campaign.repeatCount || 5, 10) || 1;
    const timezone = cfg.timezone || 'Asia/Kolkata';

    const base = moment.tz(`${startDate} ${startTime}`, timezone);
    const tasks = [];

    // total expected messages across whole campaign
    const totalExpected = (dailyMode === 'multiple') ? repeatCount * perDayCount : repeatCount;

    console.log(`🔄 Scheduling "${campaign.title}" — mode:${dailyMode} perDay:${perDayCount} interval:${intervalMinutes} repeatDays:${repeatCount} totalExpected:${totalExpected}`);

    // For each day schedule a single cron job. The cron job will execute the perDay logic.
    for (let day = 0; day < repeatCount; day++) {
      const dayTime = base.clone().add(day, 'days');

      // skip past times
      if (!dayTime.isAfter(moment())) {
        console.log(`⏭️ Skipping day ${day + 1} (time in past): ${dayTime.format()}`);
        continue;
      }

      const cronExp = `${dayTime.minutes()} ${dayTime.hours()} ${dayTime.date()} ${dayTime.month() + 1} *`;

      console.log(`🕒 Scheduling day ${day + 1} cron: ${cronExp} (${dayTime.format('YYYY-MM-DD HH:mm')} ${timezone})`);

      // The cron callback decides whether to run single or multiple messages.
      const task = cron.schedule(cronExp, async () => {
        try {
          console.log(`🔔 CRON fired for campaign ${campaign.title} (day ${day + 1})`);

          if (dailyMode === 'single') {
            await executeSingleMessage(campaignId, totalExpected);
          } else {
            // multiple
            await executeMultipleMessagesForDay(campaignId, perDayCount, intervalMinutes, totalExpected);
          }
        } catch (err) {
          console.error('❌ Cron callback error:', err);
        }
      }, { timezone });

      tasks.push(task);
    }

    recurringCampaigns.set(campaignId, tasks);
    console.log(`✅ ${tasks.length} cron jobs scheduled for "${campaign.title}"`);
  } catch (err) {
    console.error('❌ scheduleRecurringCampaign error:', err);
  }
};


// Execute single recurring campaign message
const executeRecurringCampaign = async (campaignId, totalExpectedMessages) => {
  try {
    const liveCampaign = await Campaign.findById(campaignId);

    if (!liveCampaign || !liveCampaign.isActive) {
      console.log(`⏹️ Campaign inactive: ${campaignId}`);
      return;
    }

    console.log(`🚀 Executing recurring campaign: ${liveCampaign.title}`);
    console.log(`📊 Progress: ${liveCampaign.currentRepeat || 0}/${totalExpectedMessages}`);

    // Send the campaign
    const results = await sendCampaignToRecipients(liveCampaign);

    if (results && results.length > 0) {
      // Update campaign stats
      liveCampaign.currentRepeat = (liveCampaign.currentRepeat || 0) + 1;
      liveCampaign.lastSentAt = new Date();

      // Update success/failed counts from results
      const successfulSends = results.filter(r => r.status === 'sent').length;
      const failedSends = results.filter(r => r.status === 'failed').length;

      liveCampaign.successCount = (liveCampaign.successCount || 0) + successfulSends;
      liveCampaign.failedCount = (liveCampaign.failedCount || 0) + failedSends;

      await liveCampaign.save();

      console.log(`✅ Sent message ${liveCampaign.currentRepeat} of ${totalExpectedMessages} for "${liveCampaign.title}"`);
      console.log(`📊 Successful: ${successfulSends}, Failed: ${failedSends}`);

      // Check if campaign should be completed
      if (liveCampaign.currentRepeat >= totalExpectedMessages) {
        console.log(`🎉 Campaign completed all ${totalExpectedMessages} sends!`);
        liveCampaign.status = "completed";
        liveCampaign.isActive = false;
        liveCampaign.completedAt = new Date();
        await liveCampaign.save();

        // Clear all schedules for this campaign
        clearCampaignSchedules(campaignId);
      }
    } else {
      console.log(`❌ No results from sendCampaignToRecipients for "${liveCampaign.title}"`);
    }
  } catch (error) {
    console.error(`❌ Failed recurring send: ${error.message}`);
  }
};

// Execute multiple messages immediately for a single cron trigger
const executeMultipleMessagesImmediately = async (campaignId, messagesPerDay, totalExpectedMessages) => {
  try {
    const liveCampaign = await Campaign.findById(campaignId);

    if (!liveCampaign || !liveCampaign.isActive) {
      console.log(`⏹️ Campaign inactive: ${campaignId}`);
      return;
    }

    console.log(`🚀 Executing ${messagesPerDay} messages immediately for: ${liveCampaign.title}`);
    console.log(`📊 Progress: ${liveCampaign.currentRepeat || 0}/${totalExpectedMessages}`);

    let successfulSends = 0;
    let failedSends = 0;

    // Send multiple messages in sequence
    for (let i = 0; i < messagesPerDay; i++) {
      try {
        const results = await sendCampaignToRecipients(liveCampaign);

        if (results && results.length > 0) {
          const batchSuccessful = results.filter(r => r.status === 'sent').length;
          const batchFailed = results.filter(r => r.status === 'failed').length;

          successfulSends += batchSuccessful;
          failedSends += batchFailed;

          // Update campaign stats after each message
          liveCampaign.currentRepeat = (liveCampaign.currentRepeat || 0) + 1;
          liveCampaign.lastSentAt = new Date();
          liveCampaign.successCount = (liveCampaign.successCount || 0) + batchSuccessful;
          liveCampaign.failedCount = (liveCampaign.failedCount || 0) + batchFailed;
          await liveCampaign.save();

          console.log(`✅ Sent message ${liveCampaign.currentRepeat} of ${totalExpectedMessages} for "${liveCampaign.title}"`);

          // Check if we've reached the total
          if (liveCampaign.currentRepeat >= totalExpectedMessages) {
            console.log(`🎉 Campaign completed all ${totalExpectedMessages} sends!`);
            liveCampaign.status = "completed";
            liveCampaign.isActive = false;
            liveCampaign.completedAt = new Date();
            await liveCampaign.save();

            // Clear all schedules for this campaign
            clearCampaignSchedules(campaignId);
            break; // Stop the loop
          }
        }

        // Small delay between immediate sends (100ms) to avoid overwhelming the system
        if (i < messagesPerDay - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (error) {
        console.error(`❌ Error in message ${i + 1}: ${error.message}`);
        failedSends++;
      }
    }

    console.log(`📊 Batch completed - Successful: ${successfulSends}, Failed: ${failedSends}`);
  } catch (error) {
    console.error(`❌ Failed multiple message send: ${error.message}`);
  }
};

const sendCampaignToRecipients = async (campaign) => {
  try {
    // Build recipients list (validate)
    let recipients = [];

    if (campaign.contacts && Array.isArray(campaign.contacts)) {
      if (campaign.mode === 'email') {
        recipients = campaign.contacts
          .map(c => c.email?.trim())
          .filter(e => e && validateEmail(e));
      } else {
        recipients = campaign.contacts
          .map(c => {
            const phoneToCheck = c.countryCode ? c.countryCode + c.phone : c.phone;
            return phoneToCheck?.trim();
          })
          .filter(p => p && analyzePhoneNumber(p).isValid);
      }
    } else {
      recipients = campaign.mode === 'email'
        ? (campaign.emails || []).filter(email => validateEmail(email))
        : (campaign.phones || []).filter(phone => analyzePhoneNumber(phone).isValid);
    }

    console.log(`📞 Sending to ${recipients.length} recipients for campaign: ${campaign.title}`);

    if (recipients.length === 0) {
      console.error(`❌ No recipients available for campaign: ${campaign.title}`);
      // For recurring campaigns we keep it as failed because nothing to send is an actual error.
      await Campaign.findByIdAndUpdate(campaign._id, {
        status: 'failed',
        error: 'No valid recipients found'
      });
      return [];
    }

    const BATCH_SIZE = campaign.sendOptions?.batchSize || (campaign.mode === 'email' ? 5 : 3);
    const BATCH_DELAY = campaign.sendOptions?.delayBetweenMessages || (campaign.mode === 'email' ? 2000 : 5000);

    const results = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);

      try {
        const batchPromises = batch.map(recipient => {
          if (campaign.mode === 'email') {
            return sendWithRetry(
              () => sendEmail(recipient, campaign.subject, campaign.message, campaign._id),
              campaign.sendOptions
            );
          } else {
            return sendWithRetry(
              () => sendWhatsApp(recipient, campaign.message, campaign.mediaUrl, campaign._id),
              campaign.sendOptions
            );
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        batchResults.forEach((result, index) => {
          const recipient = batch[index];
          const status = result.status === 'fulfilled' && result.value && result.value.success ? 'sent' : 'failed';
          const error = result.status === 'rejected' ? (result.reason && result.reason.message) :
            (result.status === 'fulfilled' && result.value && !result.value.success ? result.value.error : undefined);

          results.push({
            recipient,
            status,
            error,
            sentAt: new Date(),
            attempt: 1,
            messageId: result.status === 'fulfilled' ? (result.value && result.value.messageId) : undefined
          });
        });

        // Periodic progress save (avoid saving too often)
        if (i % (BATCH_SIZE * 3) === 0) {
          try {
            // reload fresh doc before saving
            const fresh = await Campaign.findById(campaign._id);
            if (fresh) {
              fresh.results = (fresh.results || []).concat(results);
              fresh.successCount = (fresh.successCount || 0) + results.filter(r => r.status === 'sent').length;
              fresh.failedCount = (fresh.failedCount || 0) + results.filter(r => r.status === 'failed').length;
              fresh.lastSentAt = new Date();
              await fresh.save();
            }
          } catch (saveError) {
            console.error('❌ Error saving campaign progress:', saveError.message);
          }
        }

        // Delay between batches
        if (i + BATCH_SIZE < recipients.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      } catch (batchError) {
        console.error(`❌ Batch failed:`, batchError);
        batch.forEach(recipient => {
          results.push({
            recipient,
            status: 'failed',
            error: 'Batch processing error: ' + (batchError && batchError.message),
            sentAt: new Date(),
            attempt: 1
          });
        });
      }
    }

    // After sending all batches, merge results and update counts/timestamps
    const freshCampaign = await Campaign.findById(campaign._id);
    if (!freshCampaign) {
      console.error('❌ Campaign not found when updating results:', campaign._id);
      return results;
    }

    // Merge results
    freshCampaign.results = (freshCampaign.results || []).concat(results);

    // Recalculate success/failed counts from results array (safer)
    freshCampaign.successCount = (freshCampaign.results || []).filter(r => r.status === 'sent').length;
    freshCampaign.failedCount = (freshCampaign.results || []).filter(r => r.status === 'failed').length;
    freshCampaign.lastSentAt = new Date();

    // Decide status update based on schedule type:
    // - recurring: leave scheduler to decide completion; we keep campaign pending
    // - immediate/scheduled (one-off): mark sent/completed
    if (freshCampaign.scheduleType === 'recurring') {
      // keep as pending so scheduler controls next runs / completion
      freshCampaign.status = freshCampaign.status === 'sending' ? 'pending' : freshCampaign.status || 'pending';
      // do NOT set isActive = false or completedAt here
    } else {
      // For one-off sends, mark as final
      freshCampaign.status = 'sent';
      freshCampaign.completedAt = new Date();
      freshCampaign.isActive = false;
    }

    await freshCampaign.save();

    console.log(`✅ Campaign ${freshCampaign.title} updated: success=${freshCampaign.successCount} failed=${freshCampaign.failedCount}`);
    return results;
  } catch (error) {
    console.error('❌ Error in sendCampaignToRecipients:', error);
    try {
      await Campaign.findByIdAndUpdate(campaign._id, {
        status: 'failed',
        error: error.message
      });
    } catch (e) {
      console.error('❌ Error updating campaign on failure:', e);
    }
    return [];
  }
};


const sendWithRetry = async (sendFn, options, retryCount = 0) => {
  const maxRetries = options?.maxRetries || 1;

  try {
    const result = await sendFn();
    return result;
  } catch (error) {
    if (retryCount < maxRetries) {
      console.log(`🔄 Retrying... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, options.retryDelay || 300000));
      return sendWithRetry(sendFn, options, retryCount + 1);
    }
    return { success: false, error: error.message };
  }
};

// ==================== EXPORTS ====================
module.exports = {
  // Campaign CRUD
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,

  // Campaign Actions
  startCampaign,
  stopCampaign,
  pauseCampaign,
  resumeCampaign,
  resendCampaign,
  duplicateCampaign,
  getCampaignStatus,
  getCampaignStats,

  // Email Integration
  sendSingleEmail,
  sendBulkEmail,
  getEmailTemplates,
  createEmailTemplate,

  // Gmail OAuth
  gmailAuth,
  gmailCallback,

  // Analytics & Monitoring
  getCampaignAnalytics,
  getWhatsAppStats,
  getGmailStats,
  generateReports,
  getComprehensiveAnalytics,

  // Tracking
  trackEmailOpen: trackEmailOpenPixel,
  trackEmailClick: trackEmailClickRedirect,

  // Utility
  healthCheck,
  validatePhoneNumber,
  validateCampaignData,
  validateEmail
};