/**
 * Automated Course & Module Creation Script
 *
 * This script creates:
 * - Course: Business Studies Teacher Training (BSTT-001)
 * - 12 Modules with proper sequencing
 * - Ready for content upload
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = 'http://localhost:3000/api';
const MATERIALS_DIR = '/Users/karthi/business/staff_education/education_materials';

// Module definitions from Content_Structure.txt
const COURSE = {
  code: 'BSTT-001',
  title: 'Business Studies Teacher Training',
  description: 'Comprehensive training for Business Studies teachers covering Form I-II curriculum and PBA implementation',
  category: 'Teacher Professional Development',
  difficulty_level: 'intermediate',
  duration_weeks: 24,
  sequence_order: 1
};

const MODULES = [
  {
    code: 'BSTT-001-M01',
    title: 'Overview & Textbooks',
    description: 'Introduction to Business Studies curriculum, syllabus analysis, and textbook navigation',
    sequence_order: 1,
    duration_weeks: 2,
    files: [
      'BS Syllabus Analysis.pdf',
      'BS F1 Textbook.pdf'
    ]
  },
  {
    code: 'BSTT-001-M02',
    title: 'Entrepreneurship & Business Ideas',
    description: 'Teaching entrepreneurship concepts and business idea generation',
    sequence_order: 2,
    duration_weeks: 2,
    files: [
      'BS F1 Textbook.pdf',
      'Form I-Term I_Project.pdf',
      'GUIDELINES_FOR_PROJECT_BASED_ASSESSMENT_FOR_BUSINESS_STUDIES.pdf'
    ]
  },
  {
    code: 'BSTT-001-M03',
    title: 'Community Needs & Resource Mapping',
    description: 'Teaching students to analyze local resources and community challenges',
    sequence_order: 3,
    duration_weeks: 2,
    files: [
      'Form I-Term I_Project.pdf',
      'ASSIGNMENT OF STUDENTS INTO GROUPS FORM .docx.pdf'
    ]
  },
  {
    code: 'BSTT-001-M04',
    title: 'Business Idea Feasibility',
    description: 'Evaluating business ideas and developing business plans',
    sequence_order: 4,
    duration_weeks: 2,
    files: [
      'BS F1 Textbook.pdf',
      'BS Lesson Plan Book_Final_May 2025.pdf'
    ]
  },
  {
    code: 'BSTT-001-M05',
    title: 'Project - Mapping & Business Idea Creation (Form I, Term I)',
    description: 'Implementing and assessing the first term project',
    sequence_order: 5,
    duration_weeks: 2,
    files: [
      'Form I-Term I_Project.pdf',
      'BS Teachers-Project Manual_Final_May 2025.pdf',
      'PBA_IMPLEMENTATION_MANUAL_FORM_I-IV .pdf'
    ]
  },
  {
    code: 'BSTT-001-M06',
    title: 'Sole Proprietorship (Form I, Term II)',
    description: 'Understanding sole proprietorship and interviewing entrepreneurs',
    sequence_order: 6,
    duration_weeks: 2,
    files: [
      'BS F1 Textbook.pdf',
      'Form I-Term II_Project.pdf',
      'BS Teachers-Project Manual_Final_May 2025.pdf'
    ]
  },
  {
    code: 'BSTT-001-M07',
    title: 'Sources of Funds, Microfinance & Cooperatives (Form II, Term I)',
    description: 'Teaching about business financing and cooperative societies',
    sequence_order: 7,
    duration_weeks: 2,
    files: [
      'BUSINESS STUDIES F2.pdf',
      'Form II-Term I-Project.pdf',
      'BS Lesson Plan Book_Final_May 2025.pdf'
    ]
  },
  {
    code: 'BSTT-001-M08',
    title: 'Production & Small Business Operations (Form II, Term II)',
    description: 'Teaching production processes and small business management',
    sequence_order: 8,
    duration_weeks: 2,
    files: [
      'BUSINESS STUDIES F2.pdf',
      'Form II-Term II-Project.pdf'
    ]
  },
  {
    code: 'BSTT-001-M09',
    title: 'Project-Based Assessment (PBA) Implementation',
    description: 'Mastering PBA methodology and assessment techniques',
    sequence_order: 9,
    duration_weeks: 2,
    files: [
      'PBA_IMPLEMENTATION_MANUAL_FORM_I-IV .pdf',
      'BS Teachers-Project Manual_Final_May 2025.pdf',
      'GUIDELINES_FOR_PROJECT_BASED_ASSESSMENT_FOR_BUSINESS_STUDIES.pdf'
    ]
  },
  {
    code: 'BSTT-001-M10',
    title: 'Lesson Planning & Classroom Management',
    description: 'Student-centered teaching methods and classroom management',
    sequence_order: 10,
    duration_weeks: 2,
    files: [
      'BS Lesson Plan Book_Final_May 2025.pdf',
      'BS Teachers-Project Manual_Final_May 2025.pdf'
    ]
  },
  {
    code: 'BSTT-001-M11',
    title: 'Teaching Resources & Technology Integration',
    description: 'Digital integration and improvising teaching materials',
    sequence_order: 11,
    duration_weeks: 2,
    files: [
      'BS Syllabus Analysis.pdf',
      'PBA_IMPLEMENTATION_MANUAL_FORM_I-IV .pdf'
    ]
  },
  {
    code: 'BSTT-001-M12',
    title: 'Assessment & Evaluation',
    description: 'Formative and summative assessment techniques using rubrics',
    sequence_order: 12,
    duration_weeks: 2,
    files: [
      'BS Syllabus Analysis.pdf',
      'BS Teachers-Project Manual_Final_May 2025.pdf'
    ]
  }
];

async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE}/admin/login`, {
      email: 'admin@school.edu',
      password: 'Admin123!'
    });
    return response.data.token;
  } catch (error) {
    console.error('❌ Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createCourse(token) {
  try {
    console.log(`\n📚 Creating course: ${COURSE.title}`);

    const response = await axios.post(`${API_BASE}/admin/courses`, COURSE, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ Course created: ${response.data.course.title} (ID: ${response.data.course.id})`);
    return response.data.course.id;
  } catch (error) {
    console.error('❌ Course creation failed:', error.response?.data || error.message);
    throw error;
  }
}

async function createModule(token, courseId, module) {
  try {
    const moduleData = {
      ...module,
      course_id: courseId
    };
    delete moduleData.files; // Remove files array for API call

    const response = await axios.post(`${API_BASE}/admin/modules`, moduleData, {
      headers: { Authorization: `Bearer ${token}` }
    });

    console.log(`✅ Module ${module.sequence_order}: ${module.title} (ID: ${response.data.module.id})`);
    return response.data.module.id;
  } catch (error) {
    console.error(`❌ Module creation failed for "${module.title}":`, error.response?.data || error.message);
    return null;
  }
}

async function verifyFiles() {
  console.log('\n🔍 Verifying files in education_materials folder...\n');

  const allFiles = new Set();
  MODULES.forEach(module => {
    module.files.forEach(file => allFiles.add(file));
  });

  const missing = [];
  const found = [];

  for (const file of allFiles) {
    const filePath = path.join(MATERIALS_DIR, file);
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      found.push({ file, size: (stats.size / 1024 / 1024).toFixed(2) + ' MB' });
    } else {
      missing.push(file);
    }
  }

  console.log(`✅ Found ${found.length} files:`);
  found.forEach(({ file, size }) => console.log(`   - ${file} (${size})`));

  if (missing.length > 0) {
    console.log(`\n❌ Missing ${missing.length} files:`);
    missing.forEach(file => console.log(`   - ${file}`));
    return false;
  }

  console.log(`\n✅ All ${found.length} unique files are available!`);
  return true;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Business Studies Teacher Training - Course Setup');
  console.log('═══════════════════════════════════════════════════════════');

  try {
    // Step 1: Verify files
    const filesOk = await verifyFiles();
    if (!filesOk) {
      console.log('\n❌ Cannot proceed - missing files!');
      process.exit(1);
    }

    // Step 2: Get auth token
    console.log('\n🔐 Authenticating...');
    const token = await getAuthToken();
    console.log('✅ Authentication successful');

    // Step 3: Create course
    const courseId = await createCourse(token);

    // Step 4: Create modules
    console.log(`\n📝 Creating ${MODULES.length} modules...\n`);
    const moduleMap = [];

    for (const module of MODULES) {
      const moduleId = await createModule(token, courseId, module);
      if (moduleId) {
        moduleMap.push({
          id: moduleId,
          code: module.code,
          title: module.title,
          files: module.files
        });
      }
    }

    // Step 5: Print summary
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('✅ Setup Complete!');
    console.log('═══════════════════════════════════════════════════════════\n');

    console.log(`📚 Course: ${COURSE.title} (${COURSE.code})`);
    console.log(`📋 Modules created: ${moduleMap.length}/${MODULES.length}\n`);

    console.log('📤 Next step: Upload content to each module\n');
    console.log('Use the upload script:');
    console.log('  node scripts/upload-module-content.js\n');

    console.log('Or manually via admin portal:');
    console.log('  http://localhost:3000/admin/modules.html\n');

    // Save module map for upload script
    const mapFile = path.join(__dirname, '../module-map.json');
    fs.writeFileSync(mapFile, JSON.stringify({
      course: { id: courseId, ...COURSE },
      modules: moduleMap
    }, null, 2));

    console.log(`✅ Module map saved to: ${mapFile}\n`);

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
