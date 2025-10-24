const axios = require('axios');

/**
 * HttpClient
 *
 * SOLID Principle: Dependency Inversion Principle (DIP)
 * Provides abstraction over HTTP client implementation
 *
 * This allows us to easily swap axios for another HTTP library
 * or mock it for testing without changing dependent code.
 */
class HttpClient {
  /**
   * POST request
   * @param {string} url - Request URL
   * @param {Object} data - Request body
   * @param {Object} headers - Request headers
   * @returns {Promise<Object>} - Response data
   */
  async post(url, data, headers = {}) {
    try {
      const response = await axios.post(url, data, { headers });
      return response.data;
    } catch (error) {
      // Transform axios error to generic error
      throw this.transformError(error);
    }
  }

  /**
   * GET request
   * @param {string} url - Request URL
   * @param {Object} headers - Request headers
   * @returns {Promise<Object>} - Response data
   */
  async get(url, headers = {}) {
    try {
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (error) {
      throw this.transformError(error);
    }
  }

  /**
   * Transform HTTP client error to generic error
   * @param {Error} error - Original error
   * @returns {Error} - Transformed error
   */
  transformError(error) {
    const genericError = new Error(error.message);
    genericError.statusCode = error.response?.status;
    genericError.responseData = error.response?.data;
    genericError.originalError = error;
    return genericError;
  }
}

module.exports = HttpClient;
