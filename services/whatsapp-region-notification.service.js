/**
 * WhatsApp Region Notification Service
 * Sends WhatsApp notifications with bilingual support
 *
 * Features:
 * - Bilingual messages (English, Swahili, Both)
 * - Message templates for enrollments, updates, reminders
 * - Rate limiting (60 messages/minute)
 * - Delivery status tracking
 * - Message logging
 */

const postgresService = require('./database/postgres.service');
const courseChatbotService = require('./course-chatbot.service');

class WhatsAppRegionNotificationService {
  constructor() {
    this.MESSAGE_TYPES = {
      ENROLLMENT: 'enrollment',
      COURSE_UPDATE: 'course_update',
      REMINDER: 'reminder',
      CUSTOM: 'custom',
      ACCESS_DENIED: 'access_denied'
    };

    this.DELIVERY_STATUSES = {
      PENDING: 'pending',
      SENT: 'sent',
      DELIVERED: 'delivered',
      FAILED: 'failed'
    };

    // Rate limiting (60 messages per minute)
    this.RATE_LIMIT = 60;
    this.RATE_WINDOW_MS = 60 * 1000; // 1 minute
    this.messageQueue = [];
    this.lastResetTime = Date.now();

    // Message templates
    this.templates = {
      enrollment: {
        english: (data) => `🎉 Welcome to ${data.courseTitle}!\n\nYou have been enrolled in our teachers training program.\n\n📚 Course: ${data.courseTitle}\n📱 Your Number: ${data.whatsappNumber}\n\nTo get started, send:\n• "menu" - View course menu\n• "help" - Get assistance\n\nHappy learning! 📖`,

        swahili: (data) => `🎉 Karibu kwenye ${data.courseTitle}!\n\nUmesajiliwa katika programu yetu ya mafunzo ya walimu.\n\n📚 Kozi: ${data.courseTitle}\n📱 Namba Yako: ${data.whatsappNumber}\n\nKuanza, tuma:\n• "menu" - Angalia menyu ya kozi\n• "help" - Pata msaada\n\nKufurahia kujifunza! 📖`,

        bilingual: (data) => `🎉 Welcome to ${data.courseTitle}!\n   Karibu kwenye ${data.courseTitle}!\n\nYou have been enrolled in our teachers training program.\nUmesajiliwa katika programu yetu ya mafunzo ya walimu.\n\n📚 Course / Kozi: ${data.courseTitle}\n📱 Your Number / Namba Yako: ${data.whatsappNumber}\n\nTo get started / Kuanza:\n• "menu" - View course menu / Angalia menyu\n• "help" - Get assistance / Pata msaada\n\nHappy learning! / Kufurahia kujifunza! 📖`
      },

      course_update: {
        english: (data) => `📢 Course Update: ${data.courseTitle}\n\n${data.message}\n\nIf you have questions, send "help".`,

        swahili: (data) => `📢 Taarifa ya Kozi: ${data.courseTitle}\n\n${data.message}\n\nKama una maswali, tuma "help".`,

        bilingual: (data) => `📢 Course Update / Taarifa ya Kozi: ${data.courseTitle}\n\nEnglish:\n${data.messageEnglish || data.message}\n\nKiswahili:\n${data.messageSwahili || data.message}\n\nQuestions? / Maswali? Send "help" / Tuma "help"`
      },

      reminder: {
        english: (data) => `📅 Reminder: ${data.courseTitle}\n\n${data.message}\n\nContinue your learning journey today!`,

        swahili: (data) => `📅 Ukumbusho: ${data.courseTitle}\n\n${data.message}\n\nEndelea na safari yako ya kujifunza leo!`,

        bilingual: (data) => `📅 Reminder / Ukumbusho: ${data.courseTitle}\n\nEnglish: ${data.messageEnglish || data.message}\nKiswahili: ${data.messageSwahili || data.message}\n\nContinue your learning! / Endelea kujifunza!`
      },

      access_denied: {
        english: (data) => `❌ Access Denied\n\nThis course is not available in your region.\n\nCourse: ${data.courseTitle}\nAvailable in: ${data.availableRegions}\nYour region: ${data.userRegion}\n\nContact your administrator for more information.`,

        swahili: (data) => `❌ Ufikiaji Umekataliwa\n\nKozi hii haipatikani katika mkoa wako.\n\nKozi: ${data.courseTitle}\nInapatikana katika: ${data.availableRegions}\nMkoa wako: ${data.userRegion}\n\nWasiliana na msimamizi wako kwa maelezo zaidi.`,

        bilingual: (data) => `❌ Access Denied / Ufikiaji Umekataliwa\n\nThis course is not available in your region.\nKozi hii haipatikana katika mkoa wako.\n\nCourse / Kozi: ${data.courseTitle}\nAvailable in / Inapatikana: ${data.availableRegions}\nYour region / Mkoa wako: ${data.userRegion}\n\nContact your administrator / Wasiliana na msimamizi.`
      }
    };
  }

  /**
   * Send WhatsApp notification
   * @param {Object} notificationData - { userId, messageType, courseId, messageData, sentBy, languagePreference }
   * @returns {Promise<Object>} Send result
   */
  async sendNotification(notificationData) {
    try {
      const { userId, messageType, courseId, messageData, sentBy, languagePreference } = notificationData;

      // Get user whatsapp number
      const user = await this.getUserWhatsAppNumber(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Get language preference from course if not provided
      let language = languagePreference;
      if (!language && courseId) {
        const coursePrompt = await courseChatbotService.getCoursePrompt(courseId);
        language = coursePrompt ? coursePrompt.language_preference : 'english';
      }
      language = language || 'english';

      // Generate message content
      const messageContent = this.generateMessage(messageType, messageData, language);

      // Check rate limit
      if (!this.checkRateLimit()) {
        return { success: false, error: 'Rate limit exceeded. Please wait before sending more messages.' };
      }

      // Log notification (pending)
      const logResult = await this.logNotification({
        user_id: userId,
        message_type: messageType,
        message_content: messageContent,
        course_id: courseId || null,
        sent_by: sentBy || null,
        delivery_status: this.DELIVERY_STATUSES.PENDING
      });

      const notificationId = logResult.id;

      // Send via Twilio (mock implementation - replace with actual Twilio service)
      const sendResult = await this.sendVia

Twilio(user.whatsapp_id, messageContent);

      // Update delivery status
      if (sendResult.success) {
        await this.updateNotificationStatus(notificationId, this.DELIVERY_STATUSES.SENT, sendResult.messageSid);
        return { success: true, notificationId, messageSid: sendResult.messageSid };
      } else {
        await this.updateNotificationStatus(notificationId, this.DELIVERY_STATUSES.FAILED, null, sendResult.error);
        return { success: false, error: sendResult.error, notificationId };
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send bulk notifications (with rate limiting)
   * @param {Array} notifications - Array of notification data
   * @returns {Promise<Object>} Bulk send result
   */
  async sendBulkNotifications(notifications) {
    const results = {
      total: notifications.length,
      successful: 0,
      failed: 0,
      rateLimited: 0,
      errors: []
    };

    for (let i = 0; i < notifications.length; i++) {
      const notification = notifications[i];

      try {
        const result = await this.sendNotification(notification);

        if (result.success) {
          results.successful++;
        } else {
          if (result.error && result.error.includes('Rate limit')) {
            results.rateLimited++;
            // Wait for rate limit window to reset
            await this.waitForRateLimitReset();
            // Retry
            const retryResult = await this.sendNotification(notification);
            if (retryResult.success) {
              results.successful++;
            } else {
              results.failed++;
              results.errors.push({ index: i, error: retryResult.error });
            }
          } else {
            results.failed++;
            results.errors.push({ index: i, error: result.error });
          }
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ index: i, error: error.message });
      }
    }

    return results;
  }

  /**
   * Generate message content
   * @param {string} messageType - Message type
   * @param {Object} messageData - Data for template
   * @param {string} language - Language preference
   * @returns {string} Message content
   */
  generateMessage(messageType, messageData, language) {
    const template = this.templates[messageType];

    if (!template) {
      return messageData.customMessage || 'Message content not available';
    }

    const templateFunction = template[language] || template.english;
    return templateFunction(messageData);
  }

  /**
   * Check rate limit
   * @returns {boolean} Can send message
   */
  checkRateLimit() {
    const now = Date.now();

    // Reset counter if window has passed
    if (now - this.lastResetTime >= this.RATE_WINDOW_MS) {
      this.messageQueue = [];
      this.lastResetTime = now;
    }

    // Remove old messages from queue
    this.messageQueue = this.messageQueue.filter(
      timestamp => now - timestamp < this.RATE_WINDOW_MS
    );

    // Check if under limit
    if (this.messageQueue.length >= this.RATE_LIMIT) {
      return false;
    }

    // Add current message to queue
    this.messageQueue.push(now);
    return true;
  }

  /**
   * Wait for rate limit to reset
   * @returns {Promise<void>}
   */
  async waitForRateLimitReset() {
    const now = Date.now();
    const timeUntilReset = this.RATE_WINDOW_MS - (now - this.lastResetTime);

    if (timeUntilReset > 0) {
      await new Promise(resolve => setTimeout(resolve, timeUntilReset));
    }
  }

  /**
   * Get user WhatsApp number
   * @param {number} userId - User ID
   * @returns {Promise<Object|null>} User data
   */
  async getUserWhatsAppNumber(userId) {
    try {
      const query = 'SELECT id, whatsapp_id, name FROM users WHERE id = $1 AND is_active = TRUE';
      const result = await postgresService.query(query, [userId]);
      return result.rows.length > 0 ? result.rows[0] : null;
    } catch (error) {
      console.error('Error getting user WhatsApp number:', error);
      return null;
    }
  }

  /**
   * Log notification
   * @param {Object} logData - Notification log data
   * @returns {Promise<Object>} Logged notification
   */
  async logNotification(logData) {
    try {
      const query = `
        INSERT INTO whatsapp_notifications
        (user_id, message_type, message_content, course_id, sent_by, delivery_status, sent_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      const result = await postgresService.query(query, [
        logData.user_id,
        logData.message_type,
        logData.message_content,
        logData.course_id,
        logData.sent_by,
        logData.delivery_status
      ]);
      return result.rows[0];
    } catch (error) {
      console.error('Error logging notification:', error);
      throw error;
    }
  }

  /**
   * Update notification status
   * @param {number} notificationId - Notification ID
   * @param {string} status - New status
   * @param {string} messageSid - Twilio message SID
   * @param {string} errorMessage - Error message if failed
   * @returns {Promise<void>}
   */
  async updateNotificationStatus(notificationId, status, messageSid = null, errorMessage = null) {
    try {
      const query = `
        UPDATE whatsapp_notifications
        SET delivery_status = $1, twilio_message_sid = $2, error_message = $3
        WHERE id = $4
      `;
      await postgresService.query(query, [status, messageSid, errorMessage, notificationId]);
    } catch (error) {
      console.error('Error updating notification status:', error);
      // Don't throw - status update failure shouldn't block main flow
    }
  }

  /**
   * Send via Twilio (mock implementation)
   * Replace this with actual Twilio service call
   * @param {string} whatsappNumber - WhatsApp number
   * @param {string} message - Message content
   * @returns {Promise<Object>} Send result
   */
  async sendViaTwilio(whatsappNumber, message) {
    try {
      // TODO: Replace with actual Twilio service call
      // const twilioService = require('./twilio-whatsapp.service');
      // return await twilioService.sendMessage(whatsappNumber, message);

      // Mock implementation for testing
      console.log(`[MOCK] Sending WhatsApp message to ${whatsappNumber}:`);
      console.log(message);

      return {
        success: true,
        messageSid: `SM_MOCK_${Date.now()}`
      };
    } catch (error) {
      console.error('Error sending via Twilio:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get notification history for user
   * @param {number} userId - User ID
   * @param {number} limit - Result limit
   * @returns {Promise<Array>} Notification history
   */
  async getUserNotificationHistory(userId, limit = 50) {
    try {
      const query = `
        SELECT
          wn.*,
          c.title AS course_title,
          a.name AS sent_by_name
        FROM whatsapp_notifications wn
        LEFT JOIN courses c ON wn.course_id = c.id
        LEFT JOIN admin_users a ON wn.sent_by = a.id
        WHERE wn.user_id = $1
        ORDER BY wn.sent_at DESC
        LIMIT $2
      `;
      const result = await postgresService.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user notification history:', error);
      throw error;
    }
  }

  /**
   * Get notification statistics
   * @param {Object} filters - { courseId, userId, messageType, startDate, endDate }
   * @returns {Promise<Object>} Statistics
   */
  async getNotificationStats(filters = {}) {
    try {
      let query = 'SELECT delivery_status, COUNT(*) as count FROM whatsapp_notifications WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (filters.courseId) {
        query += ` AND course_id = $${paramCount++}`;
        params.push(filters.courseId);
      }

      if (filters.userId) {
        query += ` AND user_id = $${paramCount++}`;
        params.push(filters.userId);
      }

      if (filters.messageType) {
        query += ` AND message_type = $${paramCount++}`;
        params.push(filters.messageType);
      }

      if (filters.startDate) {
        query += ` AND sent_at >= $${paramCount++}`;
        params.push(filters.startDate);
      }

      if (filters.endDate) {
        query += ` AND sent_at <= $${paramCount++}`;
        params.push(filters.endDate);
      }

      query += ' GROUP BY delivery_status';

      const result = await postgresService.query(query, params);

      // Format statistics
      const stats = {
        total: 0,
        pending: 0,
        sent: 0,
        delivered: 0,
        failed: 0
      };

      result.rows.forEach(row => {
        stats[row.delivery_status] = parseInt(row.count);
        stats.total += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      console.error('Error getting notification stats:', error);
      throw error;
    }
  }

  /**
   * Send enrollment notification
   * @param {number} userId - User ID
   * @param {number} courseId - Course ID
   * @param {number} sentBy - Admin user ID
   * @returns {Promise<Object>} Send result
   */
  async sendEnrollmentNotification(userId, courseId, sentBy) {
    try {
      // Get course details
      const courseQuery = 'SELECT title FROM courses WHERE id = $1';
      const courseResult = await postgresService.query(courseQuery, [courseId]);

      if (courseResult.rows.length === 0) {
        return { success: false, error: 'Course not found' };
      }

      const course = courseResult.rows[0];

      // Get user details
      const user = await this.getUserWhatsAppNumber(userId);
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      return await this.sendNotification({
        userId,
        messageType: this.MESSAGE_TYPES.ENROLLMENT,
        courseId,
        messageData: {
          courseTitle: course.title,
          whatsappNumber: user.whatsapp_id
        },
        sentBy
      });
    } catch (error) {
      console.error('Error sending enrollment notification:', error);
      return { success: false, error: error.message };
    }
  }
}

// Create singleton instance
const whatsAppRegionNotificationService = new WhatsAppRegionNotificationService();

module.exports = whatsAppRegionNotificationService;
