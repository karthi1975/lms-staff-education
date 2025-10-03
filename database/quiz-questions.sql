-- Quiz Questions Table and Seed Data
-- Teachers Training System

-- ============================================================
-- QUIZ QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS quiz_questions (
    id SERIAL PRIMARY KEY,
    module_id INTEGER NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(20) DEFAULT 'multiple_choice', -- multiple_choice, true_false, short_answer
    options JSONB, -- Array of options for multiple choice
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    difficulty VARCHAR(20) DEFAULT 'medium', -- easy, medium, hard
    points INTEGER DEFAULT 10,
    sequence_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quiz_questions_module ON quiz_questions(module_id);
CREATE INDEX idx_quiz_questions_active ON quiz_questions(is_active);

-- ============================================================
-- MODULE 1: Introduction to Teaching
-- ============================================================
INSERT INTO quiz_questions (module_id, question_text, question_type, options, correct_answer, explanation, difficulty, sequence_order) VALUES
(1, 'What is the primary goal of effective teaching?', 'multiple_choice',
 '["To cover all curriculum content", "To facilitate student learning and understanding", "To maintain classroom discipline", "To prepare students for standardized tests"]',
 'To facilitate student learning and understanding',
 'The primary goal of effective teaching is to facilitate student learning and understanding, not just to transmit information or maintain order.',
 'easy', 1),

(1, 'Which of the following is a key characteristic of learner-centered teaching?', 'multiple_choice',
 '["Teacher does most of the talking", "Students are passive recipients of knowledge", "Students actively participate in their learning", "Focus is solely on test scores"]',
 'Students actively participate in their learning',
 'Learner-centered teaching emphasizes active student participation and engagement in the learning process.',
 'medium', 2),

(1, 'Differentiated instruction means:', 'multiple_choice',
 '["Teaching all students the same way", "Adapting teaching methods to meet diverse student needs", "Only helping struggling students", "Using only one teaching strategy"]',
 'Adapting teaching methods to meet diverse student needs',
 'Differentiated instruction involves tailoring teaching approaches to accommodate different learning styles, abilities, and interests.',
 'medium', 3),

(1, 'Effective teachers regularly reflect on their practice.', 'true_false',
 '["True", "False"]',
 'True',
 'Self-reflection is a critical component of professional growth and improving teaching effectiveness.',
 'easy', 4),

(1, 'What does pedagogical content knowledge (PCK) refer to?', 'multiple_choice',
 '["Knowledge of subject matter only", "Knowledge of teaching methods only", "Understanding how to teach specific content effectively", "Knowledge of classroom management"]',
 'Understanding how to teach specific content effectively',
 'PCK combines subject matter expertise with knowledge of how to teach that content in ways students can understand.',
 'hard', 5);

-- ============================================================
-- MODULE 2: Classroom Management
-- ============================================================
INSERT INTO quiz_questions (module_id, question_text, question_type, options, correct_answer, explanation, difficulty, sequence_order) VALUES
(2, 'The most effective approach to classroom management is:', 'multiple_choice',
 '["Reactive - addressing issues as they arise", "Preventive - establishing clear expectations and routines", "Punitive - using strict consequences", "Permissive - allowing students freedom"]',
 'Preventive - establishing clear expectations and routines',
 'Preventive classroom management through clear expectations and routines reduces behavioral issues before they occur.',
 'medium', 1),

(2, 'Which strategy helps create a positive classroom environment?', 'multiple_choice',
 '["Focusing only on negative behaviors", "Building positive relationships with students", "Ignoring student concerns", "Maintaining strict control at all times"]',
 'Building positive relationships with students',
 'Positive teacher-student relationships are foundational to effective classroom management and student engagement.',
 'easy', 2),

(2, 'Classroom rules should be:', 'multiple_choice',
 '["Many and very detailed", "Few, clear, and positively stated", "Changed frequently", "Only enforced sometimes"]',
 'Few, clear, and positively stated',
 'Effective classroom rules are limited in number, clearly communicated, and stated in positive terms.',
 'medium', 3),

(2, 'Consistency in enforcing rules is important for classroom management.', 'true_false',
 '["True", "False"]',
 'True',
 'Consistent enforcement of rules helps students understand expectations and creates a fair, predictable environment.',
 'easy', 4),

(2, 'What is the purpose of establishing classroom routines?', 'multiple_choice',
 '["To waste time", "To maximize instructional time and minimize disruptions", "To confuse students", "To show teacher authority"]',
 'To maximize instructional time and minimize disruptions',
 'Well-established routines create smooth transitions and maximize time available for learning.',
 'medium', 5);

-- ============================================================
-- MODULE 3: Lesson Planning
-- ============================================================
INSERT INTO quiz_questions (module_id, question_text, question_type, options, correct_answer, explanation, difficulty, sequence_order) VALUES
(3, 'The first step in effective lesson planning is:', 'multiple_choice',
 '["Choosing teaching materials", "Identifying clear learning objectives", "Planning activities", "Creating assessments"]',
 'Identifying clear learning objectives',
 'Learning objectives guide all other aspects of lesson planning and ensure alignment between instruction and desired outcomes.',
 'medium', 1),

(3, 'A well-written learning objective should be:', 'multiple_choice',
 '["Vague and general", "Specific, measurable, and achievable", "Teacher-focused", "Only about content coverage"]',
 'Specific, measurable, and achievable',
 'Effective learning objectives use action verbs and clearly state what students will be able to do.',
 'medium', 2),

(3, 'What does "backward design" mean in lesson planning?', 'multiple_choice',
 '["Planning lessons in reverse chronological order", "Starting with desired outcomes and working backward", "Teaching content backwards", "Reviewing previous lessons"]',
 'Starting with desired outcomes and working backward',
 'Backward design begins with the end goals (assessments and objectives) and then plans instruction to achieve those goals.',
 'hard', 3),

(3, 'Lesson plans should include time for student practice and application.', 'true_false',
 '["True", "False"]',
 'True',
 'Effective lessons include opportunities for students to practice and apply new knowledge and skills.',
 'easy', 4),

(3, 'Which element is essential in a complete lesson plan?', 'multiple_choice',
 '["Only lecture notes", "Learning objectives, instructional strategies, and assessments", "Detailed student seating chart", "List of rewards and punishments"]',
 'Learning objectives, instructional strategies, and assessments',
 'Complete lesson plans include clear objectives, aligned teaching strategies, and methods to assess student learning.',
 'medium', 5);

-- ============================================================
-- MODULE 4: Assessment Strategies
-- ============================================================
INSERT INTO quiz_questions (module_id, question_text, question_type, options, correct_answer, explanation, difficulty, sequence_order) VALUES
(4, 'Formative assessment is used to:', 'multiple_choice',
 '["Assign final grades", "Monitor student learning during instruction", "Compare students to each other", "Evaluate teacher performance"]',
 'Monitor student learning during instruction',
 'Formative assessment provides ongoing feedback during the learning process to guide instruction and improve student outcomes.',
 'medium', 1),

(4, 'Which is an example of formative assessment?', 'multiple_choice',
 '["Final exam", "Exit ticket", "Standardized test", "Report card"]',
 'Exit ticket',
 'Exit tickets are quick formative assessments that check student understanding at the end of a lesson.',
 'easy', 2),

(4, 'Summative assessment occurs:', 'multiple_choice',
 '["Throughout the learning process", "At the end of a unit or course", "Only at the beginning of the year", "Randomly during instruction"]',
 'At the end of a unit or course',
 'Summative assessments evaluate student learning after instruction is complete, often for grading purposes.',
 'medium', 3),

(4, 'Effective feedback should be timely, specific, and actionable.', 'true_false',
 '["True", "False"]',
 'True',
 'Quality feedback is provided promptly, describes specific strengths and areas for improvement, and offers guidance for next steps.',
 'easy', 4),

(4, 'What is the purpose of rubrics in assessment?', 'multiple_choice',
 '["To make grading harder", "To provide clear criteria and expectations for student work", "To confuse students", "To reduce teacher workload only"]',
 'To provide clear criteria and expectations for student work',
 'Rubrics clarify expectations, ensure consistent grading, and help students understand quality standards.',
 'medium', 5);

-- ============================================================
-- MODULE 5: Technology in Education
-- ============================================================
INSERT INTO quiz_questions (module_id, question_text, question_type, options, correct_answer, explanation, difficulty, sequence_order) VALUES
(5, 'The primary reason for using technology in education should be to:', 'multiple_choice',
 '["Replace teachers", "Enhance learning and engagement", "Keep students busy", "Follow trends"]',
 'Enhance learning and engagement',
 'Technology should be used purposefully to improve learning outcomes and student engagement, not as an end in itself.',
 'medium', 1),

(5, 'Which framework helps teachers integrate technology effectively?', 'multiple_choice',
 '["BYOD", "SAMR or TPACK", "HTML", "PDF"]',
 'SAMR or TPACK',
 'SAMR (Substitution, Augmentation, Modification, Redefinition) and TPACK (Technological Pedagogical Content Knowledge) are frameworks for effective technology integration.',
 'hard', 2),

(5, 'Digital citizenship includes:', 'multiple_choice',
 '["Only using social media", "Responsible and ethical use of technology", "Avoiding all technology", "Playing online games"]',
 'Responsible and ethical use of technology',
 'Digital citizenship encompasses responsible, ethical, and safe technology use, including respecting others online and protecting privacy.',
 'medium', 3),

(5, 'Technology can help differentiate instruction for diverse learners.', 'true_false',
 '["True", "False"]',
 'True',
 'Technology tools can provide personalized learning experiences, adaptive content, and multiple ways for students to demonstrate understanding.',
 'easy', 4),

(5, 'What should guide technology tool selection for lessons?', 'multiple_choice',
 '["Cost only", "Popularity among teachers", "Alignment with learning objectives and student needs", "Latest trends"]',
 'Alignment with learning objectives and student needs',
 'Technology tools should be selected based on how well they support specific learning goals and meet student needs.',
 'medium', 5);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE quiz_questions TO teachers_user;
GRANT ALL PRIVILEGES ON SEQUENCE quiz_questions_id_seq TO teachers_user;
