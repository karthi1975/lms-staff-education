/**
 * Unit Tests for Enrollment Service
 * Tests PIN generation, verification, and enrollment workflows
 */

const enrollmentService = require('../../services/enrollment.service');
const postgresService = require('../../services/database/postgres.service');
const bcrypt = require('bcrypt');

// Mock dependencies
jest.mock('../../services/database/postgres.service');
jest.mock('../../utils/logger');

describe('EnrollmentService', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PIN Generation and Hashing', () => {

    test('should generate a 4-digit PIN', () => {
      const pin = enrollmentService.generatePIN();

      expect(pin).toMatch(/^\d{4}$/);
      expect(parseInt(pin)).toBeGreaterThanOrEqual(1000);
      expect(parseInt(pin)).toBeLessThanOrEqual(9999);
    });

    test('should generate unique PINs', () => {
      const pins = new Set();
      for (let i = 0; i < 100; i++) {
        pins.add(enrollmentService.generatePIN());
      }

      // Should have at least 95% unique values
      expect(pins.size).toBeGreaterThan(95);
    });

    test('should hash PIN correctly', async () => {
      const pin = '1234';
      const hashed = await enrollmentService.hashPIN(pin);

      expect(hashed).toBeTruthy();
      expect(hashed).not.toBe(pin);
      expect(hashed.length).toBeGreaterThan(50); // bcrypt hash length
    });

    test('should verify correct PIN', async () => {
      const pin = '5678';
      const hashed = await enrollmentService.hashPIN(pin);

      const isValid = await enrollmentService.verifyPIN(pin, hashed);
      expect(isValid).toBe(true);
    });

    test('should reject incorrect PIN', async () => {
      const pin = '1234';
      const wrongPin = '5678';
      const hashed = await enrollmentService.hashPIN(pin);

      const isValid = await enrollmentService.verifyPIN(wrongPin, hashed);
      expect(isValid).toBe(false);
    });
  });

  describe('Phone Number Normalization', () => {

    test('should normalize phone number with + prefix', () => {
      const normalized = enrollmentService.normalizePhoneNumber('+254724444625');
      expect(normalized).toBe('+254724444625');
    });

    test('should add + prefix if missing', () => {
      const normalized = enrollmentService.normalizePhoneNumber('254724444625');
      expect(normalized).toBe('+254724444625');
    });

    test('should remove spaces and hyphens', () => {
      const normalized = enrollmentService.normalizePhoneNumber('+254 724-444-625');
      expect(normalized).toBe('+254724444625');
    });

    test('should remove parentheses', () => {
      const normalized = enrollmentService.normalizePhoneNumber('+254 (724) 444-625');
      expect(normalized).toBe('+254724444625');
    });
  });

  describe('enrollUser()', () => {

    test('should enroll new user successfully', async () => {
      // Mock: User doesn't exist
      postgresService.query
        .mockResolvedValueOnce({ rows: [] }) // Check existing user
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // Get first module
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            whatsapp_id: '+254724444625',
            name: 'Lynda',
            enrollment_status: 'pending'
          }]
        }) // Insert user
        .mockResolvedValueOnce({ rows: [] }); // Record history

      const result = await enrollmentService.enrollUser('Lynda', '+254724444625', 1);

      expect(result.success).toBe(true);
      expect(result.pin).toMatch(/^\d{4}$/);
      expect(result.userId).toBe(10);
      expect(result.phoneNumber).toBe('+254724444625');
      expect(result.message).toContain('enrolled successfully');
    });

    test('should reject enrollment if user already exists', async () => {
      postgresService.query.mockResolvedValueOnce({
        rows: [{ id: 5, name: 'Existing User', enrollment_status: 'active' }]
      });

      const result = await enrollmentService.enrollUser('Lynda', '+254724444625', 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
      expect(result.userId).toBe(5);
    });

    test('should accept custom 4-digit PIN', async () => {
      postgresService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            whatsapp_id: '+254724444625',
            name: 'Lynda',
            enrollment_status: 'pending'
          }]
        })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.enrollUser('Lynda', '+254724444625', 1, '9876');

      expect(result.success).toBe(true);
      expect(result.pin).toBe('9876');
    });

    test('should reject non-4-digit custom PIN', async () => {
      postgresService.query.mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.enrollUser('Lynda', '+254724444625', 1, '123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('4 digits');
    });

    test('should handle database errors gracefully', async () => {
      postgresService.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await enrollmentService.enrollUser('Lynda', '+254724444625', 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to enroll user');
    });
  });

  describe('verifyUserPIN()', () => {

    test('should verify correct PIN and activate user', async () => {
      const hashedPin = await bcrypt.hash('1234', 10);

      postgresService.query
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            name: 'Lynda',
            enrollment_pin: hashedPin,
            enrollment_status: 'pending',
            pin_attempts: 3,
            pin_expires_at: new Date(Date.now() + 86400000), // Tomorrow
            is_verified: false
          }]
        }) // Get user
        .mockResolvedValueOnce({ rows: [] }) // Update user to active
        .mockResolvedValueOnce({ rows: [{ current_module_id: 1 }] }) // Get current module
        .mockResolvedValueOnce({ rows: [] }) // Initialize progress
        .mockResolvedValueOnce({ rows: [] }); // Record history

      const result = await enrollmentService.verifyUserPIN('+254724444625', '1234');

      expect(result.verified).toBe(true);
      expect(result.userId).toBe(10);
      expect(result.name).toBe('Lynda');
    });

    test('should reject incorrect PIN and decrement attempts', async () => {
      const hashedPin = await bcrypt.hash('1234', 10);

      postgresService.query
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            name: 'Lynda',
            enrollment_pin: hashedPin,
            enrollment_status: 'pending',
            pin_attempts: 3,
            pin_expires_at: new Date(Date.now() + 86400000),
            is_verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Decrement attempts
        .mockResolvedValueOnce({ rows: [] }); // Record history

      const result = await enrollmentService.verifyUserPIN('+254724444625', '9999');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('Incorrect PIN');
      expect(result.message).toContain('2 attempts remaining');
    });

    test('should block user after 3 failed attempts', async () => {
      const hashedPin = await bcrypt.hash('1234', 10);

      postgresService.query
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            name: 'Lynda',
            enrollment_pin: hashedPin,
            enrollment_status: 'pending',
            pin_attempts: 1, // Last attempt
            pin_expires_at: new Date(Date.now() + 86400000),
            is_verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Decrement attempts
        .mockResolvedValueOnce({ rows: [] }) // Record failed attempt
        .mockResolvedValueOnce({ rows: [] }) // Block user
        .mockResolvedValueOnce({ rows: [] }); // Record block

      const result = await enrollmentService.verifyUserPIN('+254724444625', '9999');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('blocked');
    });

    test('should reject user with expired PIN', async () => {
      const hashedPin = await bcrypt.hash('1234', 10);

      postgresService.query
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            name: 'Lynda',
            enrollment_pin: hashedPin,
            enrollment_status: 'pending',
            pin_attempts: 3,
            pin_expires_at: new Date(Date.now() - 86400000), // Yesterday
            is_verified: false
          }]
        })
        .mockResolvedValueOnce({ rows: [] }); // Record expiry

      const result = await enrollmentService.verifyUserPIN('+254724444625', '1234');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('expired');
    });

    test('should reject blocked user', async () => {
      const hashedPin = await bcrypt.hash('1234', 10);

      postgresService.query.mockResolvedValueOnce({
        rows: [{
          id: 10,
          name: 'Lynda',
          enrollment_pin: hashedPin,
          enrollment_status: 'blocked',
          pin_attempts: 0,
          pin_expires_at: new Date(Date.now() + 86400000),
          is_verified: false
        }]
      });

      const result = await enrollmentService.verifyUserPIN('+254724444625', '1234');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('blocked');
    });

    test('should reject non-enrolled user', async () => {
      postgresService.query.mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.verifyUserPIN('+254724444625', '1234');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('not enrolled');
    });

    test('should reject invalid PIN format', async () => {
      const result = await enrollmentService.verifyUserPIN('+254724444625', '12');

      expect(result.verified).toBe(false);
      expect(result.message).toContain('Invalid PIN format');
    });

    test('should allow already verified user', async () => {
      postgresService.query.mockResolvedValueOnce({
        rows: [{
          id: 10,
          name: 'Lynda',
          enrollment_pin: null,
          enrollment_status: 'active',
          pin_attempts: 3,
          pin_expires_at: null,
          is_verified: true
        }]
      });

      const result = await enrollmentService.verifyUserPIN('+254724444625', '1234');

      expect(result.verified).toBe(true);
      expect(result.alreadyVerified).toBe(true);
    });
  });

  describe('resetPIN()', () => {

    test('should reset PIN successfully', async () => {
      postgresService.query
        .mockResolvedValueOnce({
          rows: [{ id: 10, name: 'Lynda', enrollment_status: 'pending' }]
        })
        .mockResolvedValueOnce({ rows: [] }) // Update user
        .mockResolvedValueOnce({ rows: [] }); // Record history

      const result = await enrollmentService.resetPIN('+254724444625', 1);

      expect(result.success).toBe(true);
      expect(result.pin).toMatch(/^\d{4}$/);
      expect(result.userId).toBe(10);
      expect(result.message).toContain('reset successfully');
    });

    test('should reset PIN with custom PIN', async () => {
      postgresService.query
        .mockResolvedValueOnce({
          rows: [{ id: 10, name: 'Lynda', enrollment_status: 'pending' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.resetPIN('+254724444625', 1, '5555');

      expect(result.success).toBe(true);
      expect(result.pin).toBe('5555');
    });

    test('should unblock user when resetting PIN', async () => {
      postgresService.query
        .mockResolvedValueOnce({
          rows: [{ id: 10, name: 'Lynda', enrollment_status: 'blocked' }]
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.resetPIN('+254724444625', 1);

      expect(result.success).toBe(true);
      // Verify update query would set status to 'pending' if blocked
    });

    test('should reject reset for non-existent user', async () => {
      postgresService.query.mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.resetPIN('+254724444625', 1);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('getEnrollmentStatus()', () => {

    test('should return enrollment status for enrolled user', async () => {
      const pinExpiresAt = new Date(Date.now() + 86400000);
      const enrolledAt = new Date(Date.now() - 3600000);

      postgresService.query.mockResolvedValueOnce({
        rows: [{
          id: 10,
          name: 'Lynda',
          enrollment_status: 'pending',
          pin_attempts: 2,
          pin_expires_at: pinExpiresAt,
          is_verified: false,
          enrolled_at: enrolledAt
        }]
      });

      const result = await enrollmentService.getEnrollmentStatus('+254724444625');

      expect(result.enrolled).toBe(true);
      expect(result.userId).toBe(10);
      expect(result.name).toBe('Lynda');
      expect(result.status).toBe('pending');
      expect(result.isVerified).toBe(false);
      expect(result.attemptsRemaining).toBe(2);
    });

    test('should return not enrolled for non-existent user', async () => {
      postgresService.query.mockResolvedValueOnce({ rows: [] });

      const result = await enrollmentService.getEnrollmentStatus('+254724444625');

      expect(result.enrolled).toBe(false);
      expect(result.message).toContain('not enrolled');
    });
  });

  describe('blockUser() and unblockUser()', () => {

    test('should block user', async () => {
      postgresService.query
        .mockResolvedValueOnce({ rows: [] }) // Update user
        .mockResolvedValueOnce({ rows: [] }); // Record history

      await enrollmentService.blockUser(10, 1);

      expect(postgresService.query).toHaveBeenCalledWith(
        expect.stringContaining("enrollment_status = 'blocked'"),
        [10]
      );
    });

    test('should unblock user', async () => {
      postgresService.query
        .mockResolvedValueOnce({ rows: [{ id: 10 }] })
        .mockResolvedValueOnce({ rows: [] }) // Update user
        .mockResolvedValueOnce({ rows: [] }); // Record history

      const result = await enrollmentService.unblockUser('+254724444625', 1);

      expect(result.success).toBe(true);
      expect(result.message).toContain('unblocked successfully');
    });
  });

  describe('getEnrollmentHistory()', () => {

    test('should return enrollment history', async () => {
      const mockHistory = [
        {
          id: 1,
          user_id: 10,
          action: 'enrolled',
          performed_by: 1,
          admin_email: 'admin@school.edu',
          created_at: new Date()
        },
        {
          id: 2,
          user_id: 10,
          action: 'pin_verified',
          performed_by: null,
          admin_email: null,
          created_at: new Date()
        }
      ];

      postgresService.query.mockResolvedValueOnce({ rows: mockHistory });

      const result = await enrollmentService.getEnrollmentHistory(10);

      expect(result).toHaveLength(2);
      expect(result[0].action).toBe('enrolled');
      expect(result[1].action).toBe('pin_verified');
    });

    test('should handle errors and return empty array', async () => {
      postgresService.query.mockRejectedValueOnce(new Error('Database error'));

      const result = await enrollmentService.getEnrollmentHistory(10);

      expect(result).toEqual([]);
    });
  });
});
