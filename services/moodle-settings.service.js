/**
 * Moodle Settings Service
 * Manages Moodle connection configuration stored in database
 */

const postgresService = require('./database/postgres.service');

class MoodleSettingsService {
  /**
   * Get all Moodle settings
   * @param {boolean} includeInactive - Include inactive settings
   * @returns {Promise<Array>}
   */
  async getAllSettings(includeInactive = false) {
    const query = includeInactive
      ? 'SELECT * FROM moodle_settings ORDER BY setting_key'
      : 'SELECT * FROM moodle_settings WHERE is_active = true ORDER BY setting_key';

    const result = await postgresService.query(query);
    return result.rows;
  }

  /**
   * Get a specific setting by key
   * @param {string} key - Setting key
   * @returns {Promise<Object|null>}
   */
  async getSetting(key) {
    const query = 'SELECT * FROM moodle_settings WHERE setting_key = $1 AND is_active = true';
    const result = await postgresService.query(query, [key]);
    return result.rows[0] || null;
  }

  /**
   * Get setting value by key
   * @param {string} key - Setting key
   * @param {any} defaultValue - Default value if not found
   * @returns {Promise<any>}
   */
  async getSettingValue(key, defaultValue = null) {
    const setting = await this.getSetting(key);
    if (!setting) return defaultValue;

    // Convert boolean strings to actual booleans
    if (setting.setting_type === 'boolean') {
      return setting.setting_value === 'true';
    }

    // Convert number strings to numbers
    if (setting.setting_type === 'number') {
      return parseFloat(setting.setting_value);
    }

    return setting.setting_value;
  }

  /**
   * Get Moodle connection config
   * @returns {Promise<Object>}
   */
  async getMoodleConfig() {
    const settings = await this.getAllSettings();
    const config = {};

    settings.forEach(setting => {
      const key = setting.setting_key.replace('moodle_', '');
      let value = setting.setting_value;

      // Type conversion
      if (setting.setting_type === 'boolean') {
        value = value === 'true';
      } else if (setting.setting_type === 'number') {
        value = parseFloat(value);
      }

      config[key] = value;
    });

    return config;
  }

  /**
   * Update or create a setting
   * @param {string} key - Setting key
   * @param {any} value - Setting value
   * @param {Object} options - Additional options
   * @returns {Promise<Object>}
   */
  async updateSetting(key, value, options = {}) {
    const {
      settingType = 'string',
      description = null,
      isActive = true,
      updatedBy = null
    } = options;

    const query = `
      INSERT INTO moodle_settings (
        setting_key, setting_value, setting_type, description, is_active, updated_by, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        setting_type = EXCLUDED.setting_type,
        description = COALESCE(EXCLUDED.description, moodle_settings.description),
        is_active = EXCLUDED.is_active,
        updated_by = EXCLUDED.updated_by,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await postgresService.query(query, [
      key,
      String(value),
      settingType,
      description,
      isActive,
      updatedBy
    ]);

    return result.rows[0];
  }

  /**
   * Update multiple settings at once
   * @param {Object} settings - Key-value pairs of settings
   * @param {number} updatedBy - User ID who updated
   * @returns {Promise<Array>}
   */
  async updateMultipleSettings(settings, updatedBy = null) {
    const results = [];

    for (const [key, value] of Object.entries(settings)) {
      // Determine setting type
      let settingType = 'string';
      if (typeof value === 'boolean') settingType = 'boolean';
      else if (typeof value === 'number') settingType = 'number';
      else if (key.includes('token') || key.includes('password')) settingType = 'secret';

      const result = await this.updateSetting(key, value, {
        settingType,
        updatedBy
      });
      results.push(result);
    }

    return results;
  }

  /**
   * Delete a setting (soft delete by marking inactive)
   * @param {string} key - Setting key
   * @returns {Promise<boolean>}
   */
  async deleteSetting(key) {
    const query = 'UPDATE moodle_settings SET is_active = false, updated_at = NOW() WHERE setting_key = $1';
    const result = await postgresService.query(query, [key]);
    return result.rowCount > 0;
  }

  /**
   * Test Moodle connection with given settings
   * @param {Object} config - Moodle configuration
   * @returns {Promise<Object>}
   */
  async testConnection(config) {
    const { moodle_url, moodle_token } = config;

    if (!moodle_url || !moodle_token) {
      return {
        success: false,
        error: 'Missing Moodle URL or token'
      };
    }

    try {
      const fetch = require('node-fetch');
      const url = `${moodle_url}/webservice/rest/server.php`;
      const params = new URLSearchParams({
        wstoken: moodle_token,
        wsfunction: 'core_webservice_get_site_info',
        moodlewsrestformat: 'json'
      });

      const response = await fetch(`${url}?${params}`);
      const data = await response.json();

      if (data.errorcode) {
        return {
          success: false,
          error: data.message || 'Invalid token or permissions'
        };
      }

      return {
        success: true,
        siteInfo: {
          sitename: data.sitename,
          username: data.username,
          userid: data.userid,
          version: data.version
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get settings history (future enhancement with audit table)
   * @param {string} key - Setting key
   * @returns {Promise<Array>}
   */
  async getSettingHistory(key) {
    // TODO: Implement with audit table if needed
    return [];
  }

  /**
   * Export all settings as JSON
   * @returns {Promise<Object>}
   */
  async exportSettings() {
    const settings = await this.getAllSettings();
    const exported = {};

    settings.forEach(setting => {
      exported[setting.setting_key] = {
        value: setting.setting_value,
        type: setting.setting_type,
        description: setting.description
      };
    });

    return exported;
  }

  /**
   * Import settings from JSON
   * @param {Object} settings - Settings to import
   * @param {number} updatedBy - User ID who imported
   * @returns {Promise<Array>}
   */
  async importSettings(settings, updatedBy = null) {
    const results = [];

    for (const [key, config] of Object.entries(settings)) {
      const result = await this.updateSetting(key, config.value, {
        settingType: config.type || 'string',
        description: config.description,
        updatedBy
      });
      results.push(result);
    }

    return results;
  }
}

module.exports = new MoodleSettingsService();
