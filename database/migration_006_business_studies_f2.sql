-- Business Studies Form Two Course Migration
-- Adds BS-F2 course with 5 chapters (modules) and 25 quizzes (5 per chapter)
-- Each quiz contains 5 questions for a total of 125 questions

-- ============================================================
-- INSERT BUSINESS STUDIES FORM TWO COURSE
-- ============================================================
INSERT INTO courses (title, code, description, category, difficulty_level, duration_weeks, sequence_order, is_active)
VALUES (
    'Business Studies Form Two',
    'BS-F2',
    'Business Studies curriculum for Form Two secondary students in Tanzania covering production, financing, management, warehousing, and business opportunities',
    'Business Education',
    'intermediate',
    12,
    2,
    TRUE
)
ON CONFLICT (code) DO UPDATE SET
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    difficulty_level = EXCLUDED.difficulty_level;

-- ============================================================
-- INSERT CHAPTERS (AS MODULES)
-- ============================================================
WITH course_data AS (
    SELECT id FROM courses WHERE code = 'BS-F2'
)
INSERT INTO modules (course_id, title, description, sequence_order, is_active)
SELECT
    (SELECT id FROM course_data),
    title,
    description,
    sequence_order,
    TRUE
FROM (VALUES
    ('Production', 'Understanding the concept and factors of production including land, labour, capital, and entrepreneurship', 1),
    ('Financing Small-Sized Businesses', 'Sources of finance for small businesses including loans, savings, deferred payment, and microfinancing', 2),
    ('Small Business Management', 'Management principles, record keeping, cash books, sales/purchases books, profit/loss, and budgeting', 3),
    ('Warehousing and Inventorying', 'Warehousing concepts, types, management, inventorying methods, and documentation', 4),
    ('Business Opportunity Identification', 'Identifying business opportunities through passion, observation, networking, and market research', 5)
) AS chapter_data(title, description, sequence_order)
WHERE NOT EXISTS (
    SELECT 1 FROM modules m
    WHERE m.course_id = (SELECT id FROM course_data)
    AND m.title = chapter_data.title
);

-- ============================================================
-- CLEANUP - Remove existing quizzes for BS-F2 modules (if re-running migration)
-- ============================================================
-- Skip cleanup if tables don't have quiz_id column yet

-- ============================================================
-- CREATE QUIZZES FOR EACH CHAPTER
-- Note: These are NOT marked as is_optional=TRUE because they are part of the assessment
-- ============================================================

-- Chapter 1: Production - 5 Quizzes
DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT m.id INTO v_module_id FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE c.code = 'BS-F2' AND m.sequence_order = 1
    LIMIT 1;

    INSERT INTO quizzes (module_id, title, description, pass_threshold, max_attempts, shuffle_questions, shuffle_options, is_active, is_optional)
    VALUES
        (v_module_id, 'The Concept of Production', 'Understanding what production means and its importance in creating goods and services', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Land as a Factor of Production', 'Natural resources and raw materials used in production', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Labour in Production', 'Human effort and skills in the production process', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Capital and Production', 'Capital goods, financial resources, and their role in production', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Entrepreneurship', 'Risk-taking, innovation, and the entrepreneurial mindset', 70, 2, TRUE, TRUE, TRUE, FALSE);
END $$;

-- Chapter 2: Financing Small-Sized Businesses - 5 Quizzes
DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT m.id INTO v_module_id FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE c.code = 'BS-F2' AND m.sequence_order = 2
    LIMIT 1;

    INSERT INTO quizzes (module_id, title, description, pass_threshold, max_attempts, shuffle_questions, shuffle_options, is_active, is_optional)
    VALUES
        (v_module_id, 'Small Business Concept', 'Understanding what defines a small business and its characteristics', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Loans for Small Businesses', 'Types of loans, how to obtain them, and their terms', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Savings and Capital Accumulation', 'Building capital through savings for business growth', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Deferred Payment Systems', 'Credit sales and buy-now-pay-later arrangements', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Family and Microfinancing', 'Alternative financing sources including family support and microfinance', 70, 2, TRUE, TRUE, TRUE, FALSE);
END $$;

-- Chapter 3: Small Business Management - 5 Quizzes
DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT m.id INTO v_module_id FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE c.code = 'BS-F2' AND m.sequence_order = 3
    LIMIT 1;

    INSERT INTO quizzes (module_id, title, description, pass_threshold, max_attempts, shuffle_questions, shuffle_options, is_active, is_optional)
    VALUES
        (v_module_id, 'Management Concepts', 'Basic principles of business management and planning', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Cash Book Management', 'Recording cash receipts and payments', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Sales and Purchases Books', 'Credit transaction recording and tracking', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Profit and Loss Analysis', 'Understanding income, expenses, and profitability', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Budgeting Basics', 'Creating and managing business budgets', 70, 2, TRUE, TRUE, TRUE, FALSE);
END $$;

-- Chapter 4: Warehousing and Inventorying - 5 Quizzes
DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT m.id INTO v_module_id FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE c.code = 'BS-F2' AND m.sequence_order = 4
    LIMIT 1;

    INSERT INTO quizzes (module_id, title, description, pass_threshold, max_attempts, shuffle_questions, shuffle_options, is_active, is_optional)
    VALUES
        (v_module_id, 'Warehousing Concepts', 'Understanding the purpose and importance of warehousing', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Types of Warehouses', 'Different warehouse types and their specific uses', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Warehouse Management', 'Operating and organizing warehouse facilities effectively', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Inventorying Basics', 'Stock control, tracking, and inventory management systems', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Inventory Documents and Methods', 'Documentation, FIFO, LIFO, and weighted average methods', 70, 2, TRUE, TRUE, TRUE, FALSE);
END $$;

-- Chapter 5: Business Opportunity Identification - 5 Quizzes
DO $$
DECLARE
    v_module_id INTEGER;
BEGIN
    SELECT m.id INTO v_module_id FROM modules m
    JOIN courses c ON m.course_id = c.id
    WHERE c.code = 'BS-F2' AND m.sequence_order = 5
    LIMIT 1;

    INSERT INTO quizzes (module_id, title, description, pass_threshold, max_attempts, shuffle_questions, shuffle_options, is_active, is_optional)
    VALUES
        (v_module_id, 'Business Opportunity Concepts', 'Understanding what makes a good business opportunity', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Finding Your Passion', 'Aligning business ideas with personal interests and skills', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Observation Skills', 'Identifying market gaps and customer needs through observation', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Networking for Opportunities', 'Building connections and learning from others', 70, 2, TRUE, TRUE, TRUE, FALSE),
        (v_module_id, 'Market Research Basics', 'Conducting research to validate business ideas', 70, 2, TRUE, TRUE, TRUE, FALSE);
END $$;

-- ============================================================
-- VERIFICATION
-- ============================================================
DO $$
DECLARE
    course_count INTEGER;
    module_count INTEGER;
    quiz_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO course_count FROM courses WHERE code = 'BS-F2';
    SELECT COUNT(*) INTO module_count FROM modules m
        JOIN courses c ON m.course_id = c.id
        WHERE c.code = 'BS-F2';
    SELECT COUNT(*) INTO quiz_count FROM quizzes q
        JOIN modules m ON q.module_id = m.id
        JOIN courses c ON m.course_id = c.id
        WHERE c.code = 'BS-F2';

    RAISE NOTICE '✅ Migration 006 (Business Studies F2) completed successfully!';
    RAISE NOTICE '📚 Course created: Business Studies Form Two (BS-F2)';
    RAISE NOTICE '📖 Chapters (modules) created: %', module_count;
    RAISE NOTICE '📝 Quizzes created: %', quiz_count;
    RAISE NOTICE '⏭️  Next: Run the seed script to add 125 quiz questions';

    IF course_count = 0 THEN
        RAISE EXCEPTION '❌ Failed to create course!';
    END IF;

    IF module_count != 5 THEN
        RAISE WARNING '⚠️  Expected 5 modules, found %', module_count;
    END IF;

    IF quiz_count != 25 THEN
        RAISE WARNING '⚠️  Expected 25 quizzes, found %', quiz_count;
    END IF;
END $$;
