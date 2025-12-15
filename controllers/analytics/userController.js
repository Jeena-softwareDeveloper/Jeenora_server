const { v4: uuidv4 } = require("uuid");
const User = require("../../models/analytics/User");
const Session = require("../../models/analytics/Session");
const Event = require("../../models/analytics/Event");
const Page = require("../../models/analytics/Pages");
const axios = require('axios');

// Enhanced Geolocation Service with better fallbacks
class GeolocationService {
  constructor() {
    this.services = [
      {
        name: 'ipapi',
        url: 'https://ipapi.co/json/',
        mapper: (data) => ({
          country: data.country_name || 'Unknown',
          city: data.city || 'Unknown',
          region: data.region || data.region_code || 'Unknown',
          timezone: data.timezone || 'Asia/Calcutta',
          ip: data.ip || 'Unknown',
          latitude: data.latitude,
          longitude: data.longitude
        })
      },
      {
        name: 'ip-api',
        url: 'http://ip-api.com/json/',
        mapper: (data) => ({
          country: data.country || 'Unknown',
          city: data.city || 'Unknown',
          region: data.regionName || data.region || 'Unknown',
          timezone: data.timezone || 'Asia/Calcutta',
          ip: data.query || 'Unknown',
          latitude: data.lat,
          longitude: data.lon
        })
      },
      {
        name: 'ipapi-com',
        url: 'https://api.ipapi.com/api/check?access_key=test', // Free tier without key
        mapper: (data) => ({
          country: data.country_name || 'Unknown',
          city: data.city || 'Unknown',
          region: data.region_name || data.region_code || 'Unknown',
          timezone: data.time_zone?.id || 'Asia/Calcutta',
          ip: data.ip || 'Unknown',
          latitude: data.latitude,
          longitude: data.longitude
        })
      }
    ];
  }

  async getLocationFromIP(ip = '') {
    console.log('📍 Starting IP geolocation for IP:', ip || 'auto-detect');

    // If we have a valid IP, try services with that IP
    if (ip && ip !== 'Unknown' && ip !== '127.0.0.1' && !ip.startsWith('192.168.') && !ip.startsWith('10.') && !ip.startsWith('172.')) {
      for (const service of this.services) {
        try {
          console.log(`📍 Trying ${service.name} with IP: ${ip}`);
          const response = await axios.get(`${service.url}?ip=${ip}`, {
            timeout: 3000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const data = response.data;

          if (data && this.isValidLocation(data)) {
            const location = service.mapper(data);
            console.log(`✅ Success from ${service.name}:`, {
              country: location.country,
              city: location.city,
              region: location.region
            });
            return location;
          }
        } catch (error) {
          console.warn(`❌ ${service.name} failed:`, error.message);
          continue;
        }
      }
    }

    // Try without specific IP (auto-detect)
    for (const service of this.services) {
      try {
        console.log(`📍 Trying ${service.name} with auto-detect`);
        const response = await axios.get(service.url, {
          timeout: 3000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        const data = response.data;

        if (data && this.isValidLocation(data)) {
          const location = service.mapper(data);
          console.log(`✅ Success from ${service.name} (auto-detect):`, {
            country: location.country,
            city: location.city,
            region: location.region
          });
          return location;
        }
      } catch (error) {
        console.warn(`❌ ${service.name} auto-detect failed:`, error.message);
        continue;
      }
    }

    // Final fallback with intelligent guessing
    return this.getIntelligentFallbackLocation(ip);
  }

  isValidLocation(data) {
    return data &&
      (data.country || data.country_name) &&
      data.country !== 'Unknown' &&
      data.country !== 'Reserved' &&
      data.country_name !== 'Unknown' &&
      data.country_name !== 'Reserved';
  }

  getIntelligentFallbackLocation(ip) {
    console.log('🔄 Using intelligent fallback location detection');

    // Detect common local IP patterns
    if (!ip || ip === 'Unknown') {
      return {
        country: 'India',
        city: 'Mumbai',
        region: 'Maharashtra',
        timezone: 'Asia/Calcutta',
        ip: 'Unknown',
        latitude: 19.0760,
        longitude: 72.8777
      };
    }

    if (ip === '127.0.0.1' || ip === '::1') {
      return {
        country: 'India',
        city: 'Localhost',
        region: 'Development',
        timezone: 'Asia/Calcutta',
        ip: ip,
        latitude: 19.0760,
        longitude: 72.8777
      };
    }

    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return {
        country: 'India',
        city: 'Local Network',
        region: 'Private IP',
        timezone: 'Asia/Calcutta',
        ip: ip,
        latitude: 19.0760,
        longitude: 72.8777
      };
    }

    // Default to India for any other case
    return {
      country: 'India',
      city: 'Mumbai',
      region: 'Maharashtra',
      timezone: 'Asia/Calcutta',
      ip: ip,
      latitude: 19.0760,
      longitude: 72.8777
    };
  }
}

const geolocationService = new GeolocationService();

// Enhanced Utility Functions
function getClientIP(req) {
  try {
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.headers['x-real-ip'] ||
      req.headers['x-client-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.connection?.socket?.remoteAddress ||
      req.ip ||
      'Unknown';

    console.log('🌐 Detected client IP:', ip);
    return ip;
  } catch (error) {
    console.error('❌ Error getting client IP:', error);
    return 'Unknown';
  }
}

function getTimezoneFromHeaders(req) {
  try {
    return (
      req.headers['timezone'] ||
      req.headers['x-timezone'] ||
      req.headers['utc-offset'] ||
      'Asia/Calcutta'
    );
  } catch (error) {
    return 'Asia/Calcutta';
  }
}

function getBrowserLanguage(req) {
  try {
    const acceptLanguage = req.headers['accept-language'];
    if (acceptLanguage) {
      return acceptLanguage.split(',')[0].split(';')[0];
    }
  } catch (error) {
    // Ignore error
  }
  return 'en-IN';
}

async function parseLocation(locationData, req) {
  const clientIP = getClientIP(req);
  const timezone = getTimezoneFromHeaders(req);
  const browserLanguage = getBrowserLanguage(req);

  console.log('📍 Location parsing started:', {
    hasLocationData: !!locationData,
    clientIP,
    timezone,
    browserLanguage
  });

  // Case 1: Frontend provides complete location data (preferred)
  if (locationData && typeof locationData === 'object') {
    const hasValidCountry = locationData.country && locationData.country !== 'Unknown';
    const hasCoords = locationData.latitude && locationData.longitude;
    const hasCity = locationData.city && locationData.city !== 'Unknown';

    if (hasValidCountry || hasCoords || hasCity) {
      const parsed = {
        country: locationData.country || 'India',
        city: locationData.city || 'Mumbai',
        region: locationData.region || locationData.state || 'Maharashtra',
        timezone: locationData.timezone || timezone,
        ip: locationData.ip || clientIP,
        latitude: locationData.latitude || null,
        longitude: locationData.longitude || null
      };

      console.log('✅ Using frontend-provided location:', parsed);
      return parsed;
    }
  }

  // Case 2: Try IP-based geolocation
  try {
    console.log('📍 Attempting IP-based geolocation...');
    const ipLocation = await geolocationService.getLocationFromIP(clientIP);

    if (ipLocation.country !== 'Unknown') {
      console.log('✅ Using IP-based location:', {
        country: ipLocation.country,
        city: ipLocation.city,
        region: ipLocation.region
      });
      return ipLocation;
    }
  } catch (error) {
    console.error('❌ IP geolocation failed:', error.message);
  }

  // Case 3: Intelligent fallback based on various signals
  console.log('🔄 Using intelligent fallback based on signals');

  // Detect location from browser language and timezone
  let detectedCountry = 'India';
  let detectedCity = 'Mumbai';
  let detectedRegion = 'Maharashtra';

  if (browserLanguage.includes('en-US') || timezone.includes('America')) {
    detectedCountry = 'United States';
    detectedCity = 'New York';
    detectedRegion = 'New York';
  } else if (browserLanguage.includes('en-GB') || timezone.includes('Europe/London')) {
    detectedCountry = 'United Kingdom';
    detectedCity = 'London';
    detectedRegion = 'England';
  } else if (browserLanguage.includes('en-IN') || timezone.includes('Asia/Calcutta') || timezone.includes('Asia/Kolkata')) {
    detectedCountry = 'India';
    detectedCity = 'Mumbai';
    detectedRegion = 'Maharashtra';
  }

  const intelligentLocation = {
    country: detectedCountry,
    city: detectedCity,
    region: detectedRegion,
    timezone: timezone,
    ip: clientIP,
    latitude: null,
    longitude: null
  };

  console.log('✅ Using intelligent fallback location:', intelligentLocation);
  return intelligentLocation;
}

// Rest of the utility functions (parseReferrer, updatePageMetrics, trackEvents, etc.)
function parseReferrer(referrerUrl) {
  if (!referrerUrl || referrerUrl === 'direct' || referrerUrl === '') {
    return {
      url: 'direct',
      source: 'direct',
      medium: 'none',
      campaign: 'direct',
      hostname: 'direct',
      is_direct: true
    };
  }

  try {
    const url = new URL(referrerUrl);
    const hostname = url.hostname.replace('www.', '');

    let source = 'direct';
    let medium = 'none';
    let campaign = 'organic';

    if (hostname.includes('google')) {
      source = 'google';
      medium = 'organic';
      const query = url.searchParams.get('q');
      campaign = query ? `search:${query.substring(0, 50)}` : 'organic';
    }
    else if (hostname.includes('bing')) {
      source = 'bing';
      medium = 'organic';
    }
    else if (hostname.includes('facebook')) {
      source = 'facebook';
      medium = 'social';
    }
    else if (hostname.includes('twitter') || hostname.includes('x.com')) {
      source = 'twitter';
      medium = 'social';
    }
    else if (hostname.includes('linkedin')) {
      source = 'linkedin';
      medium = 'social';
    }
    else if (hostname.includes('instagram')) {
      source = 'instagram';
      medium = 'social';
    }
    else if (hostname.includes('mail.') || hostname.includes('email') || hostname.includes('gmail')) {
      source = 'email';
      medium = 'email';
    }
    else {
      source = hostname;
      medium = 'referral';
    }

    const utmSource = url.searchParams.get('utm_source');
    const utmMedium = url.searchParams.get('utm_medium');
    const utmCampaign = url.searchParams.get('utm_campaign');
    const utmContent = url.searchParams.get('utm_content');
    const utmTerm = url.searchParams.get('utm_term');

    return {
      url: referrerUrl,
      source: utmSource || source,
      medium: utmMedium || medium,
      campaign: utmCampaign || campaign,
      content: utmContent,
      term: utmTerm,
      hostname: hostname,
      is_direct: false
    };
  } catch (error) {
    return {
      url: referrerUrl,
      source: 'direct',
      medium: 'none',
      campaign: 'direct',
      hostname: 'direct',
      is_direct: true
    };
  }
}

async function updatePageMetrics(pageData, duration, user_id, referrer) {
  try {
    if (!pageData || !pageData.url) return;

    const parsedReferrer = parseReferrer(referrer);

    let page = await Page.findOne({ page_url: pageData.url });

    if (page) {
      page.total_views += 1;
      page.total_time_spent += duration || 0;
      page.avg_duration = page.total_time_spent / page.total_views;
      page.last_viewed_at = new Date();

      if (parsedReferrer && parsedReferrer.source) {
        const referrerIndex = page.referrer_sources.findIndex(
          r => r.source === parsedReferrer.source
        );

        if (referrerIndex >= 0) {
          page.referrer_sources[referrerIndex].visits += 1;
          page.referrer_sources[referrerIndex].last_visit = new Date();
        } else {
          page.referrer_sources.push({
            source: parsedReferrer.source,
            medium: parsedReferrer.medium,
            campaign: parsedReferrer.campaign,
            visits: 1,
            first_visit: new Date(),
            last_visit: new Date()
          });
        }
      }

      const uniqueUsers = await Session.distinct('user_id', {
        'page_sequence.page_url': pageData.url
      });
      page.unique_users = uniqueUsers.length;

      await page.save();
    } else {
      const newPage = new Page({
        page_url: pageData.url,
        page_title: pageData.title || 'Unknown Page',
        total_views: 1,
        unique_users: 1,
        avg_duration: duration || 0,
        total_time_spent: duration || 0,
        last_viewed_at: new Date(),
        referrer_sources: parsedReferrer ? [{
          source: parsedReferrer.source,
          medium: parsedReferrer.medium,
          campaign: parsedReferrer.campaign,
          visits: 1,
          first_visit: new Date(),
          last_visit: new Date()
        }] : []
      });
      await newPage.save();
    }
  } catch (error) {
    console.error('❌ Error updating page metrics:', error);
  }
}

async function trackEvents(events, user_id, session_id) {
  try {
    const eventsWithIds = events.map(event => ({
      ...event,
      user_id,
      session_id,
      event_id: event.event_id || `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: event.timestamp || new Date()
    }));

    await Event.insertMany(eventsWithIds, { ordered: false });

    const totalEvents = events.length;
    const totalDuration = events.reduce((sum, event) => sum + (event.duration || 0), 0);

    await User.findOneAndUpdate(
      { user_id },
      {
        $inc: {
          'engagement.total_events': totalEvents,
          'engagement.total_time_spent': totalDuration
        }
      }
    );
  } catch (error) {
    console.error('❌ Error tracking events:', error);
  }
}

function shouldStartNewSessionByTimeout(session, now) {
  const sessionTimeout = 30 * 60 * 1000;
  const isTimedOut = (now - session.last_activity) > sessionTimeout;

  if (isTimedOut) {
    console.log('⏰ Session timed out, starting new session');
  }

  return isTimedOut;
}

function getActivityStatus(lastActiveAt) {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastActiveAt >= fiveMinutesAgo ? 'active' : 'offline';
}

// Enhanced Handler Functions with Better Location Updates
async function handleNewUser({ user_id, device, location, parsedReferrer, current_page, page_stay_duration, events, now, res }) {
  console.log('👤 Creating NEW user:', user_id);

  // Ensure location has proper values
  const ensuredLocation = {
    country: location.country || 'India',
    city: location.city || 'Mumbai',
    region: location.region || 'Maharashtra',
    timezone: location.timezone || 'Asia/Calcutta',
    ip: location.ip || 'Unknown',
    latitude: location.latitude || null,
    longitude: location.longitude || null
  };

  const user = new User({
    user_id,
    first_seen_at: now,
    last_seen_at: now,
    last_active_at: now,
    is_online: true,
    status: "new",
    device,
    location: ensuredLocation,
    referrer: parsedReferrer,
    engagement: {
      total_sessions: 1,
      total_time_spent: 0,
      total_events: 0,
      avg_session_time: 0,
      last_session_at: now
    }
  });

  const sessionData = {
    session_id: uuidv4(),
    user_id,
    start_time: now,
    is_active: true,
    last_activity: now,
    device_snapshot: device,
    location_snapshot: ensuredLocation,
    referrer: parsedReferrer,
    page_sequence: []
  };

  if (current_page?.url) {
    sessionData.page_sequence.push({
      page_url: current_page.url,
      page_title: current_page.title || 'Unknown',
      duration: 0,
      timestamp: now,
      referrer: parsedReferrer
    });

    updatePageMetrics(current_page, page_stay_duration, user_id, parsedReferrer).catch(console.error);
  }

  const [savedUser, newSession] = await Promise.all([
    user.save(),
    new Session(sessionData).save(),
    events.length > 0 ? trackEvents(events, user_id, sessionData.session_id) : Promise.resolve()
  ]);

  console.log('✅ New user created with ensured location:', ensuredLocation);

  return res.status(200).json({
    success: true,
    message: "New user session started",
    data: {
      user_id,
      status: "new",
      is_online: true,
      total_sessions: 1,
      total_events: events.length,
      current_session_id: newSession.session_id,
      referrer: parsedReferrer,
      location: ensuredLocation,
      last_active_at: now,
      session_timeout: 120000
    }
  });
}

async function handleReturningUser({ user, device, location, parsedReferrer, current_page, page_stay_duration, events, now, action_type, res, isReturning = false }) {
  console.log('👤 Handling returning user:', user.user_id);

  // Always update location with better data if available
  if (location && (location.country !== 'Unknown' || location.city !== 'Unknown')) {
    const updatedLocation = {
      country: location.country !== 'Unknown' ? location.country : user.location?.country || 'India',
      city: location.city !== 'Unknown' ? location.city : user.location?.city || 'Mumbai',
      region: location.region !== 'Unknown' ? location.region : user.location?.region || 'Maharashtra',
      timezone: location.timezone || user.location?.timezone || 'Asia/Calcutta',
      ip: location.ip !== 'Unknown' ? location.ip : user.location?.ip || 'Unknown',
      latitude: location.latitude || user.location?.latitude || null,
      longitude: location.longitude || user.location?.longitude || null
    };

    user.location = updatedLocation;
    console.log('📍 Updated user location:', updatedLocation);
  }

  user.last_seen_at = now;
  user.last_active_at = now;
  user.is_online = true;

  if (isReturning) {
    user.status = "returning";
    console.log('🎯 Marking user as RETURNING:', user.user_id);
  }

  switch (action_type) {
    case 'heartbeat':
      return await handleHeartbeat({ user, now, res, isReturning });

    case 'page_leave':
      return await handlePageLeave({ user, current_page, page_stay_duration, now, res, isReturning });

    case 'page_view':
    default:
      return await handlePageView({
        user, device, location, parsedReferrer, current_page,
        page_stay_duration, events, now, res, isReturning
      });
  }
}

async function handleHeartbeat({ user, now, res, isReturning }) {
  user.is_online = true;
  user.last_active_at = now;

  await Session.updateOne(
    { user_id: user.user_id, is_active: true },
    { last_activity: now }
  ).catch(console.error);

  await user.save();

  return res.json({
    success: true,
    message: "Heartbeat received",
    data: {
      user_id: user.user_id,
      is_online: true,
      status: user.status,
      location: user.location,
      last_active_at: now,
      session_timeout: 120000,
      is_returning: isReturning
    }
  });
}

async function handlePageView({ user, device, location, parsedReferrer, current_page, page_stay_duration, events, now, res, isReturning }) {
  let currentSession = await Session.findOne({
    user_id: user.user_id,
    is_active: true
  });

  let isNewSession = false;
  let sessionId;

  const shouldStartNewSession = !currentSession ||
    (isReturning && currentSession) ||
    shouldStartNewSessionByTimeout(currentSession, now);

  if (shouldStartNewSession) {
    if (currentSession) {
      currentSession.is_active = false;
      currentSession.end_time = now;
      currentSession.duration = currentSession.calculateDuration();
      await currentSession.save();
      console.log('📦 Ended previous session with duration:', currentSession.duration, 'seconds');
    }

    // Use user's current location for new session
    const sessionLocation = {
      country: user.location?.country || 'India',
      city: user.location?.city || 'Mumbai',
      region: user.location?.region || 'Maharashtra',
      timezone: user.location?.timezone || 'Asia/Calcutta',
      ip: user.location?.ip || 'Unknown',
      latitude: user.location?.latitude || null,
      longitude: user.location?.longitude || null
    };

    currentSession = new Session({
      session_id: uuidv4(),
      user_id: user.user_id,
      start_time: now,
      is_active: true,
      last_activity: now,
      device_snapshot: device,
      location_snapshot: sessionLocation,
      referrer: parsedReferrer,
      page_sequence: []
    });

    user.engagement.total_sessions += 1;
    user.engagement.last_session_at = now;
    isNewSession = true;

    console.log('🆕 Started new session for user:', user.user_id);
  } else {
    // Update existing session with better location if available
    if (location && location.country !== 'Unknown' && currentSession) {
      currentSession.location_snapshot = {
        ...currentSession.location_snapshot,
        ...location
      };
    }
  }

  if (currentSession && currentSession.is_active) {
    currentSession.duration = currentSession.calculateDuration();
    currentSession.last_activity = now;
  }

  if (current_page?.url) {
    if (currentSession.page_sequence.length > 0) {
      const lastPageIndex = currentSession.page_sequence.length - 1;
      const lastPage = currentSession.page_sequence[lastPageIndex];
      const timeSpentOnLastPage = Math.round((now - new Date(lastPage.timestamp)) / 1000);

      if (timeSpentOnLastPage > 0 && timeSpentOnLastPage < 3600) {
        currentSession.page_sequence[lastPageIndex].duration = timeSpentOnLastPage;
      }
    }

    currentSession.page_sequence.push({
      page_url: current_page.url,
      page_title: current_page.title || 'Unknown',
      duration: 0,
      timestamp: now,
      referrer: parsedReferrer
    });

    updatePageMetrics(current_page, page_stay_duration, user.user_id, parsedReferrer).catch(console.error);
  }

  sessionId = currentSession.session_id;

  user.is_online = true;
  user.last_seen_at = now;
  user.last_active_at = now;

  await Promise.all([
    currentSession.save(),
    user.save(),
    events.length > 0 ? trackEvents(events, user.user_id, sessionId) : Promise.resolve()
  ]);

  await user.updateEngagementMetrics();

  return res.json({
    success: true,
    message: isNewSession ? "New session started" : "Page view tracked",
    data: {
      user_id: user.user_id,
      is_online: true,
      status: user.status,
      total_sessions: user.engagement.total_sessions,
      total_time_spent: user.engagement.total_time_spent,
      total_time_spent_min: Math.round(user.engagement.total_time_spent / 60),
      current_session_id: sessionId,
      location: user.location,
      last_active_at: now,
      session_timeout: 120000,
      is_returning: isReturning,
      is_new_session: isNewSession
    }
  });
}

async function handlePageLeave({ user, current_page, page_stay_duration, now, res, isReturning }) {
  if (current_page?.url) {
    let durationInSeconds = page_stay_duration;

    if (page_stay_duration >= 1000) {
      durationInSeconds = Math.round(page_stay_duration / 1000);
    }

    if (durationInSeconds > 0 && durationInSeconds < 3600) {
      await Session.updateOne(
        {
          user_id: user.user_id,
          is_active: true,
          "page_sequence.page_url": current_page.url
        },
        {
          $set: {
            "page_sequence.$.duration": durationInSeconds,
            last_activity: now
          }
        }
      ).catch(console.error);

      updatePageMetrics(current_page, durationInSeconds, user.user_id).catch(console.error);
    }
  }

  user.is_online = true;
  user.last_active_at = now;
  await user.save();

  return res.json({
    success: true,
    message: "Page leave tracked",
    data: {
      user_id: user.user_id,
      is_online: true,
      status: user.status,
      location: user.location,
      last_active_at: now,
      is_returning: isReturning
    }
  });
}

// Export Functions
exports.claimUser = async (req, res) => {
  try {
    const now = new Date();
    const {
      user_id,
      device,
      location,
      events = [],
      referrer,
      current_page,
      page_stay_duration = 0,
      action_type = 'page_view',
      is_after_reset = false
    } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "User ID is required"
      });
    }

    const isResetMode = Boolean(is_after_reset);
    const parsedReferrer = parseReferrer(referrer);
    const parsedLocation = await parseLocation(location, req);

    console.log('📥 User Action:', {
      user_id,
      action_type,
      location: parsedLocation
    });

    if (isResetMode) {
      console.log('🔄 RESET MODE: Forcing new user creation for:', user_id);

      await Promise.all([
        User.deleteOne({ user_id }).catch(err =>
          console.log('ℹ️ No user to delete or error:', err.message)
        ),
        Session.deleteMany({ user_id }).catch(err =>
          console.log('ℹ️ No sessions to delete or error:', err.message)
        )
      ]);

      return await handleNewUser({
        user_id, device, location: parsedLocation, parsedReferrer, current_page,
        page_stay_duration, events, now, res
      });
    }

    let user = await User.findOne({ user_id: user_id });

    if (!user) {
      return await handleNewUser({
        user_id, device, location: parsedLocation, parsedReferrer, current_page,
        page_stay_duration, events, now, res
      });
    }

    const wasOffline = !user.is_online;
    const timeSinceLastActive = now - new Date(user.last_active_at);
    const OFFLINE_THRESHOLD = 2 * 60 * 1000;

    if (wasOffline && timeSinceLastActive > OFFLINE_THRESHOLD) {
      return await handleReturningUser({
        user, device, location: parsedLocation, parsedReferrer, current_page,
        page_stay_duration, events, now, action_type, res,
        isReturning: true
      });
    } else {
      return await handleReturningUser({
        user, device, location: parsedLocation, parsedReferrer, current_page,
        page_stay_duration, events, now, action_type, res,
        isReturning: false
      });
    }

  } catch (error) {
    console.error("❌ Error in claimUser:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, online } = req.query;
    const skip = (page - 1) * limit;

    const filter = {};
    if (search) {
      filter.$or = [
        { user_id: { $regex: search, $options: 'i' } },
        { 'location.country': { $regex: search, $options: 'i' } },
        { 'location.city': { $regex: search, $options: 'i' } }
      ];
    }
    if (status && status !== 'all') filter.status = status;
    if (online && online !== 'all') filter.is_online = online === 'true';

    const users = await User.find(filter)
      .select('user_id status is_online first_seen_at last_seen_at last_active_at device location referrer engagement')
      .sort({ last_active_at: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .lean();

    const usersWithStats = await Promise.all(
      users.map(async (user) => {
        const sessionStats = await Session.aggregate([
          { $match: { user_id: user.user_id } },
          {
            $group: {
              _id: null,
              totalSessions: { $sum: 1 },
              totalTimeSpent: { $sum: '$duration' },
              avgSessionTime: { $avg: '$duration' },
              totalPageVisits: {
                $sum: {
                  $cond: {
                    if: { $isArray: "$page_sequence" },
                    then: { $size: "$page_sequence" },
                    else: 0
                  }
                }
              }
            }
          }
        ]);

        const uniquePagesStats = await Session.aggregate([
          { $match: { user_id: user.user_id } },
          { $unwind: { path: '$page_sequence', preserveNullAndEmptyArrays: true } },
          { $match: { 'page_sequence.page_url': { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$page_sequence.page_url'
            }
          },
          {
            $group: {
              _id: null,
              uniquePagesCount: { $sum: 1 }
            }
          }
        ]);

        const stats = sessionStats[0] || {};
        const uniquePagesCount = uniquePagesStats[0]?.uniquePagesCount || 0;
        const totalTimeSpentSeconds = stats.totalTimeSpent || user.engagement?.total_time_spent || 0;
        const avgSessionTimeSeconds = stats.avgSessionTime || user.engagement?.avg_session_time || 0;

        // Enhanced location with fallbacks
        const locationData = user.location || {};
        const enhancedLocation = {
          country: locationData.country || 'India',
          city: locationData.city || 'Mumbai',
          region: locationData.region || 'Maharashtra',
          timezone: locationData.timezone || 'Asia/Calcutta',
          ip: locationData.ip || 'Unknown'
        };

        return {
          user_id: user.user_id,
          status: user.status,
          is_online: user.is_online,
          activity_status: getActivityStatus(user.last_active_at),
          first_seen_at: user.first_seen_at,
          last_active_at: user.last_active_at,
          total_sessions: stats.totalSessions || user.engagement?.total_sessions || 0,
          total_events: user.engagement?.total_events || 0,
          total_pages_visited: uniquePagesCount,
          total_page_visits: stats.totalPageVisits || 0,
          total_time_spent_min: Math.round(totalTimeSpentSeconds / 60),
          avg_session_time_min: Math.round(avgSessionTimeSeconds / 60),
          referrer: user.referrer || {},
          country: enhancedLocation.country,
          city: enhancedLocation.city,
          region: enhancedLocation.region,
          timezone: enhancedLocation.timezone,
          ip: enhancedLocation.ip,
          device: user.device?.device_type || user.device?.os || 'Unknown'
        };
      })
    );

    const total = await User.countDocuments(filter);

    res.json({
      success: true,
      data: usersWithStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ Error in getAllUsers:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// ... (getUserById and other functions remain the same as previous version)

exports.getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const { include_sessions = true, sessions_limit = 20 } = req.query;

    const [user, sessions, analytics] = await Promise.all([
      User.findOne({ user_id: userId }).lean(),
      include_sessions ? Session.find({ user_id: userId })
        .sort({ start_time: -1 })
        .limit(parseInt(sessions_limit))
        .lean() : Promise.resolve([]),
      getAggregatedAnalytics(userId)
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const locationData = user.location || {};
    const enhancedUserData = {
      ...user,
      location: {
        country: locationData.country || 'India',
        city: locationData.city || 'Mumbai',
        region: locationData.region || 'Maharashtra',
        timezone: locationData.timezone || 'Asia/Calcutta',
        ip: locationData.ip || 'Unknown'
      }
    };

    const response = {
      success: true,
      data: {
        user_id: enhancedUserData.user_id,
        status: enhancedUserData.status,
        is_online: enhancedUserData.is_online,
        activity_status: getActivityStatus(enhancedUserData.last_active_at),
        first_seen_at: enhancedUserData.first_seen_at,
        last_seen_at: enhancedUserData.last_seen_at,
        last_active_at: enhancedUserData.last_active_at,
        engagement: analytics.engagement,
        page_analytics: analytics.pages,
        acquisition: analytics.acquisition,
        device: enhancedUserData.device || {},
        location: enhancedUserData.location,
        sessions: include_sessions ? {
          total: analytics.sessionStats.totalSessions || 0,
          recent: sessions.map(formatSessionForDisplay)
        } : undefined
      }
    };

    res.json(response);

  } catch (error) {
    console.error("❌ Error in getUserById:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

async function getAggregatedAnalytics(userId) {
  const [sessionStats, pageStats, referrerStats, uniquePagesStats] = await Promise.all([
    Session.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          totalTimeSpent: { $sum: '$duration' },
          avgSessionTime: { $avg: '$duration' },
          totalPagesVisited: {
            $sum: {
              $cond: {
                if: { $isArray: "$page_sequence" },
                then: { $size: "$page_sequence" },
                else: 0
              }
            }
          }
        }
      }
    ]),
    Session.aggregate([
      { $match: { user_id: userId } },
      { $unwind: { path: '$page_sequence', preserveNullAndEmptyArrays: true } },
      { $match: { 'page_sequence.page_url': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$page_sequence.page_url',
          total_visits: { $sum: 1 },
          total_time_spent: { $sum: '$page_sequence.duration' },
          avg_time_spent: { $avg: '$page_sequence.duration' },
          last_visit: { $max: '$page_sequence.timestamp' },
          page_title: { $first: '$page_sequence.page_title' }
        }
      },
      { $sort: { total_visits: -1 } }
    ]),
    Session.aggregate([
      { $match: { user_id: userId } },
      { $match: { 'referrer.source': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$referrer.source',
          sessions: { $sum: 1 },
          first_visit: { $min: '$start_time' },
          last_visit: { $max: '$start_time' },
          medium: { $first: '$referrer.medium' },
          campaign: { $first: '$referrer.campaign' }
        }
      },
      { $sort: { sessions: -1 } }
    ]),
    Session.aggregate([
      { $match: { user_id: userId } },
      { $unwind: { path: '$page_sequence', preserveNullAndEmptyArrays: true } },
      { $match: { 'page_sequence.page_url': { $exists: true, $ne: null } } },
      {
        $group: {
          _id: '$page_sequence.page_url'
        }
      },
      {
        $group: {
          _id: null,
          uniquePagesCount: { $sum: 1 }
        }
      }
    ])
  ]);

  const uniquePagesCount = uniquePagesStats[0]?.uniquePagesCount || 0;
  const totalPageVisits = sessionStats[0]?.totalPagesVisited || 0;
  const totalTimeSpentSeconds = sessionStats[0]?.totalTimeSpent || 0;
  const avgSessionTimeSeconds = sessionStats[0]?.avgSessionTime || 0;

  return {
    engagement: {
      total_sessions: sessionStats[0]?.totalSessions || 0,
      total_time_spent: totalTimeSpentSeconds,
      total_time_spent_min: Math.round(totalTimeSpentSeconds / 60),
      avg_session_time: avgSessionTimeSeconds,
      avg_session_time_min: Math.round(avgSessionTimeSeconds / 60),
      total_pages_visited: uniquePagesCount,
      total_page_visits: totalPageVisits
    },
    pages: {
      popular_pages: pageStats.map(p => ({
        page_url: p._id,
        page_title: p.page_title || 'Unknown',
        total_visits: p.total_visits,
        total_time_spent: p.total_time_spent || 0,
        total_time_spent_min: Math.round((p.total_time_spent || 0) / 60),
        avg_time_spent: p.avg_time_spent || 0,
        avg_time_spent_min: Math.round((p.avg_time_spent || 0) / 60),
        last_visit: p.last_visit
      })),
      total_unique_pages: uniquePagesCount
    },
    acquisition: {
      sources: referrerStats,
      first_referrer: referrerStats[0] || null
    },
    sessionStats: sessionStats[0] || {}
  };
}

function formatSessionForDisplay(session) {
  const durationSeconds = session.duration || 0;

  return {
    session_id: session.session_id,
    start_time: session.start_time,
    end_time: session.end_time,
    duration: durationSeconds,
    duration_min: Math.round(durationSeconds / 60),
    is_active: session.is_active,
    page_views: session.page_sequence?.length || 0,
    referrer: session.referrer || {},
    page_flow: (session.page_sequence || []).map(p => ({
      page_url: p.page_url,
      page_title: p.page_title || 'Unknown',
      duration: p.duration || 0,
      duration_min: Math.round((p.duration || 0) / 60),
      timestamp: p.timestamp,
      referrer: p.referrer || {}
    }))
  };
}

exports.cleanupInactiveUsers = async () => {
  try {
    const now = new Date();
    const inactiveThreshold = 2 * 60 * 1000;
    const cutoffTime = new Date(now.getTime() - inactiveThreshold);

    const sessionsToEnd = await Session.find({
      is_active: true,
      last_activity: { $lt: cutoffTime },
    });

    console.log(`🕒 Cleaning up ${sessionsToEnd.length} inactive sessions`);

    for (const session of sessionsToEnd) {
      const sessionDuration = session.calculateDuration();

      session.is_active = false;
      session.end_time = now;
      session.duration = sessionDuration;

      await session.save();

      await User.updateOne(
        { user_id: session.user_id },
        {
          $set: {
            is_online: false,
            last_active_at: now
          }
        }
      );
    }

    const affectedUserIds = sessionsToEnd.map(s => s.user_id);
    for (const userId of affectedUserIds) {
      const user = await User.findOne({ user_id: userId });
      if (user) {
        await user.updateEngagementMetrics();
      }
    }

    console.log(`✅ Cleanup completed: ${sessionsToEnd.length} sessions ended`);
  } catch (error) {
    console.error("❌ Cleanup error:", error.message);
  }
};

exports.repairSessionDurations = async () => {
  try {
    console.log('🛠️ Starting session duration repair...');

    const sessions = await Session.find({});
    let updatedCount = 0;

    for (const session of sessions) {
      const originalDuration = session.duration;

      if (session.is_active) {
        session.duration = session.calculateDuration();
      } else if (session.end_time) {
        session.duration = Math.round((session.end_time - session.start_time) / 1000);
      }

      if (Math.abs(session.duration - originalDuration) > 5) {
        await session.save();
        updatedCount++;
      }
    }

    console.log(`✅ Session repair completed: ${updatedCount} sessions updated`);

    const users = await User.find({});
    for (const user of users) {
      await user.updateEngagementMetrics();
    }

    console.log(`✅ User engagement metrics updated for ${users.length} users`);

  } catch (error) {
    console.error('❌ Repair error:', error);
  }
};

// Update existing user locations
exports.updateExistingUserLocations = async () => {
  try {
    console.log('🔄 Updating existing user locations...');
    const users = await User.find({});
    let updatedCount = 0;

    for (const user of users) {
      if (!user.location || user.location.country === 'Unknown') {
        const clientIP = user.location?.ip || 'Unknown';
        const newLocation = await geolocationService.getLocationFromIP(clientIP);

        user.location = {
          country: newLocation.country,
          city: newLocation.city,
          region: newLocation.region,
          timezone: newLocation.timezone,
          ip: user.location?.ip || newLocation.ip,
          latitude: newLocation.latitude,
          longitude: newLocation.longitude
        };

        await user.save();
        updatedCount++;
        console.log(`✅ Updated location for user ${user.user_id}: ${newLocation.country}, ${newLocation.city}`);
      }
    }

    console.log(`✅ Updated locations for ${updatedCount} users`);
  } catch (error) {
    console.error('❌ Error updating user locations:', error);
  }
};

setInterval(() => {
  if (require('mongoose').connection.readyState === 1) {
    exports.cleanupInactiveUsers().catch(console.error);
  }
}, 2 * 60 * 1000);

module.exports = exports;