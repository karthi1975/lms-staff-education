/**
 * Seed Business Studies Form Two Quiz Questions
 * Loads all 125 questions (25 quizzes × 5 questions) into the database
 */

const { Pool } = require('pg');
const quizzesData = require('./generate-business-studies-quizzes');

// Database configuration
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'teachers_training',
    user: process.env.DB_USER || 'teachers_user',
    password: process.env.DB_PASSWORD || 'teachers_pass_2024'
});

async function seedQuizzes() {
    const client = await pool.connect();

    try {
        console.log('\n🌱 Starting Business Studies F2 quiz seeding...\n');

        // Begin transaction
        await client.query('BEGIN');

        // Get the course ID
        const courseResult = await client.query(
            'SELECT id FROM courses WHERE code = $1',
            ['BS-F2']
        );

        if (courseResult.rows.length === 0) {
            throw new Error('❌ Course BS-F2 not found! Please run migration_006 first.');
        }

        const courseId = courseResult.rows[0].id;
        console.log(`✅ Found course BS-F2 (ID: ${courseId})`);

        let totalQuestionsInserted = 0;

        // Process each chapter
        for (const chapter of quizzesData.chapters) {
            console.log(`\n📖 Processing Chapter ${chapter.chapter_number}: ${chapter.title}`);

            // Get the module ID for this chapter
            const moduleResult = await client.query(
                'SELECT id FROM modules WHERE course_id = $1 AND sequence_order = $2',
                [courseId, chapter.chapter_number]
            );

            if (moduleResult.rows.length === 0) {
                console.warn(`⚠️  Module not found for chapter ${chapter.chapter_number}, skipping...`);
                continue;
            }

            const moduleId = moduleResult.rows[0].id;
            console.log(`   Module ID: ${moduleId}`);

            // Process each quiz in this chapter
            for (let quizIndex = 0; quizIndex < chapter.quizzes.length; quizIndex++) {
                const quizData = chapter.quizzes[quizIndex];

                // Get the quiz ID by matching title and module
                const quizResult = await client.query(
                    'SELECT id FROM quizzes WHERE module_id = $1 AND title = $2',
                    [moduleId, quizData.title]
                );

                if (quizResult.rows.length === 0) {
                    console.warn(`   ⚠️  Quiz "${quizData.title}" not found, skipping...`);
                    continue;
                }

                const quizId = quizResult.rows[0].id;
                console.log(`   📝 Quiz: ${quizData.title} (ID: ${quizId})`);

                // Insert questions for this quiz
                for (let questionIndex = 0; questionIndex < quizData.questions.length; questionIndex++) {
                    const question = quizData.questions[questionIndex];

                    // correct_answer is stored as the text of the correct option, not the index
                    const correctAnswerText = question.options[question.correct_answer];

                    await client.query(
                        `INSERT INTO quiz_questions
                        (module_id, quiz_id, question_text, question_type, options, correct_answer, explanation, sequence_order)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT DO NOTHING`,
                        [
                            moduleId,
                            quizId,
                            question.question,
                            'multiple_choice',
                            JSON.stringify(question.options),
                            correctAnswerText,
                            question.explanation,
                            questionIndex + 1
                        ]
                    );

                    totalQuestionsInserted++;
                }

                console.log(`      ✓ Inserted ${quizData.questions.length} questions`);
            }
        }

        // Commit transaction
        await client.query('COMMIT');

        // Verification
        const verifyResult = await client.query(`
            SELECT
                c.title AS course,
                COUNT(DISTINCT m.id) AS modules,
                COUNT(DISTINCT q.id) AS quizzes,
                COUNT(qq.id) AS questions
            FROM courses c
            LEFT JOIN modules m ON c.id = m.course_id
            LEFT JOIN quizzes q ON m.id = q.module_id
            LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
            WHERE c.code = 'BS-F2'
            GROUP BY c.title
        `);

        console.log('\n' + '='.repeat(60));
        console.log('✅ SEEDING COMPLETE!');
        console.log('='.repeat(60));

        if (verifyResult.rows.length > 0) {
            const stats = verifyResult.rows[0];
            console.log(`📚 Course: ${stats.course}`);
            console.log(`📖 Modules: ${stats.modules}`);
            console.log(`📝 Quizzes: ${stats.quizzes}`);
            console.log(`❓ Questions: ${stats.questions}`);
        }

        console.log('\n✨ Business Studies Form Two is now ready for use!\n');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌ Error seeding quizzes:', error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// Run the seeding
seedQuizzes().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
