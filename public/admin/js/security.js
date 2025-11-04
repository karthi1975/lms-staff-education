/**
 * Security Utilities for Admin Portal
 * Prevents XSS attacks through input sanitization
 * Security Fix: FE-001
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Raw text that may contain HTML
 * @returns {string} - Escaped text safe for innerHTML
 */
function escapeHtml(text) {
  if (text === null || text === undefined) {
    return '';
  }

  // Convert to string if not already
  text = String(text);

  // Create a temporary div element
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Sanitize user input for safe display
 * More aggressive than escapeHtml - also removes potential dangerous patterns
 * @param {string} input - User input to sanitize
 * @returns {string} - Sanitized safe text
 */
function sanitizeInput(input) {
  if (input === null || input === undefined) {
    return '';
  }

  input = String(input);

  // First escape HTML
  let sanitized = escapeHtml(input);

  // Remove any remaining script-like patterns (defense in depth)
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // Remove event handlers

  return sanitized;
}

/**
 * Create a safe text node (preferred over innerHTML when possible)
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text to set
 */
function setSafeText(element, text) {
  // textContent is inherently safe - no HTML parsing
  element.textContent = text || '';
}

/**
 * Create a safe HTML string from template
 * Use this for creating HTML with user data
 * @param {string} template - HTML template with ${} placeholders
 * @param {object} data - Data object with values to insert
 * @returns {string} - Safe HTML string
 */
function safeTemplate(template, data) {
  return template.replace(/\$\{(\w+)\}/g, (match, key) => {
    const value = data[key];
    return value !== undefined ? escapeHtml(value) : '';
  });
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 * @param {string} url - URL to sanitize
 * @returns {string} - Safe URL or empty string if dangerous
 */
function sanitizeUrl(url) {
  if (!url) return '';

  url = String(url).trim();

  // Allow only safe protocols
  const safeProtocols = ['http://', 'https://', '/', '#', 'mailto:'];

  const isSafe = safeProtocols.some(protocol =>
    url.toLowerCase().startsWith(protocol)
  );

  if (!isSafe) {
    console.warn('Blocked potentially unsafe URL:', url);
    return '';
  }

  // Extra check for encoded javascript:
  if (url.toLowerCase().includes('javascript')) {
    console.warn('Blocked URL with javascript:', url);
    return '';
  }

  return url;
}

/**
 * Create a safe anchor element
 * @param {string} href - URL
 * @param {string} text - Link text
 * @param {object} attributes - Additional attributes
 * @returns {HTMLAnchorElement} - Safe anchor element
 */
function createSafeLink(href, text, attributes = {}) {
  const a = document.createElement('a');
  const safeHref = sanitizeUrl(href);

  if (safeHref) {
    a.href = safeHref;
  }

  a.textContent = text || '';

  // Add safe attributes
  for (const [key, value] of Object.entries(attributes)) {
    if (key.toLowerCase().startsWith('on')) {
      // Block event handler attributes
      console.warn('Blocked event handler attribute:', key);
      continue;
    }
    a.setAttribute(key, escapeHtml(value));
  }

  return a;
}

/**
 * Sanitize object for JSON serialization
 * Recursively escapes string values
 * @param {any} obj - Object to sanitize
 * @returns {any} - Sanitized object
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  return obj;
}

/**
 * Validate and sanitize form input
 * @param {HTMLInputElement} input - Form input element
 * @returns {{valid: boolean, value: string, error?: string}}
 */
function validateInput(input) {
  const value = input.value.trim();
  const type = input.type;
  const required = input.required;

  // Required field check
  if (required && !value) {
    return {
      valid: false,
      value: '',
      error: 'This field is required'
    };
  }

  // Type-specific validation
  switch (type) {
    case 'email':
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (value && !emailRegex.test(value)) {
        return {
          valid: false,
          value: sanitizeInput(value),
          error: 'Please enter a valid email address'
        };
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch (e) {
        return {
          valid: false,
          value: sanitizeInput(value),
          error: 'Please enter a valid URL'
        };
      }
      break;

    case 'number':
      if (value && isNaN(value)) {
        return {
          valid: false,
          value: '',
          error: 'Please enter a valid number'
        };
      }
      break;
  }

  return {
    valid: true,
    value: sanitizeInput(value)
  };
}

/**
 * Safe JSON parse with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {any} defaultValue - Default value if parse fails
 * @returns {any} - Parsed object or default value
 */
function safeJsonParse(jsonString, defaultValue = null) {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.error('JSON parse error:', e);
    return defaultValue;
  }
}

/**
 * Content Security Policy helper
 * Check if current page has CSP violations
 */
function setupCSPMonitoring() {
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error('CSP Violation:', {
      blockedURI: e.blockedURI,
      violatedDirective: e.violatedDirective,
      originalPolicy: e.originalPolicy
    });

    // Send CSP violations to backend for monitoring
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/security/csp-report', JSON.stringify({
        type: 'csp-violation',
        blockedURI: e.blockedURI,
        directive: e.violatedDirective,
        timestamp: new Date().toISOString()
      }));
    }
  });
}

/**
 * Sanitize HTML attributes
 * @param {object} attributes - Object of attribute key-value pairs
 * @returns {string} - Safe attribute string
 */
function sanitizeAttributes(attributes) {
  const safe = [];

  for (const [key, value] of Object.entries(attributes)) {
    // Block event handlers
    if (key.toLowerCase().startsWith('on')) {
      console.warn('Blocked event handler:', key);
      continue;
    }

    // Sanitize href/src
    if (key.toLowerCase() === 'href' || key.toLowerCase() === 'src') {
      const safeUrl = sanitizeUrl(value);
      if (safeUrl) {
        safe.push(`${key}="${escapeHtml(safeUrl)}"`);
      }
      continue;
    }

    // Sanitize other attributes
    safe.push(`${key}="${escapeHtml(value)}"`);
  }

  return safe.join(' ');
}

// Initialize CSP monitoring on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupCSPMonitoring);
} else {
  setupCSPMonitoring();
}

// Export for use in modules (if using ES modules)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    sanitizeInput,
    setSafeText,
    safeTemplate,
    sanitizeUrl,
    createSafeLink,
    sanitizeObject,
    validateInput,
    safeJsonParse,
    sanitizeAttributes
  };
}
