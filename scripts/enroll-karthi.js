/**
 * Enroll Karthi with correct phone number
 */

const postgresService = require('../services/database/postgres.service');
const enrollmentService = require('../services/enrollment.service');

async function enrollKarthi() {
  try {
    await postgresService.initialize();
    console.log('✅ Database connected\n');

    // Enroll with correct WhatsApp number
    const result = await enrollmentService.enrollUser(
      'Karthi Jeyabalan',
      '+18016809129', // Correct WhatsApp number from Twilio logs
      1 // Admin ID
    );

    console.log('📋 Enrollment Result:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (result.success) {
      console.log(`✅ User enrolled successfully!`);
      console.log(`📱 Phone: ${result.phoneNumber}`);
      console.log(`🔑 PIN: ${result.pin}`);
      console.log(`⏰ Expires: ${result.expiresAt}`);
      console.log('');
      console.log('📨 Send this PIN via WhatsApp: "Your enrollment PIN is: ' + result.pin + '"');
    } else {
      console.log(`❌ Enrollment failed: ${result.message}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

enrollKarthi();
