const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function createAdminUser() {
    console.log('=========================================');
    console.log('Creating Admin User with Fresh Hash');
    console.log('=========================================\n');

    const pool = new Pool({
        host: 'localhost',
        port: 5432,
        database: 'teachers_training',
        user: 'teachers_user',
        password: 'teachers_pass_2024'
    });

    try {
        // Generate fresh password hash
        console.log('Step 1: Generating password hash...');
        const password = 'Admin123!';
        const hash = await bcrypt.hash(password, 10);
        console.log('✅ Password hash generated');
        console.log('Hash:', hash.substring(0, 20) + '...\n');

        // Check if user exists
        console.log('Step 2: Checking if user exists...');
        const checkResult = await pool.query(
            'SELECT id, email FROM admin_users WHERE email = $1',
            ['admin@school.edu']
        );

        if (checkResult.rows.length > 0) {
            console.log('User already exists, updating password...');
            await pool.query(
                'UPDATE admin_users SET password_hash = $1, updated_at = NOW() WHERE email = $2',
                [hash, 'admin@school.edu']
            );
            console.log('✅ Password updated\n');
        } else {
            console.log('Creating new user...');
            await pool.query(
                `INSERT INTO admin_users (email, password_hash, name, role, is_active, created_at, updated_at)
                 VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
                ['admin@school.edu', hash, 'System Admin', 'admin', true]
            );
            console.log('✅ User created\n');
        }

        // Verify user was created
        console.log('Step 3: Verifying user...');
        const result = await pool.query(
            'SELECT id, email, name, role, is_active FROM admin_users WHERE email = $1',
            ['admin@school.edu']
        );

        if (result.rows.length > 0) {
            console.log('✅ User verified:');
            console.log(result.rows[0]);
        } else {
            console.log('❌ User not found after creation!');
        }

        console.log('\n=========================================');
        console.log('✅ COMPLETE!');
        console.log('=========================================');
        console.log('\nLogin credentials:');
        console.log('  URL: http://localhost:3000/admin/login.html');
        console.log('  Email: admin@school.edu');
        console.log('  Password: Admin123!');
        console.log('');

    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

createAdminUser();
