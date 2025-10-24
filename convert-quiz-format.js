#!/usr/bin/env node
/**
 * Convert quiz files from array format to A/B/C/D object format
 * Input format: options: ["...", "...", "..."], correctAnswer: 0
 * Output format: options: {A: "...", B: "...", C: "...", D: "..."}, correct_answer: "A"
 */

const fs = require('fs');
const path = require('path');

const inputDir = process.argv[2] || './quizzes/CORRECT_MODULES';
const outputDir = process.argv[3] || './quizzes/CONVERTED';

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Get all JSON files
const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));

console.log(`Converting ${files.length} quiz files...`);

files.forEach(filename => {
  const inputPath = path.join(inputDir, filename);
  const outputPath = path.join(outputDir, filename);

  // Read input file
  const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

  // Extract questions array (handle both {questions: [...]} and [...] formats)
  const questions = data.questions || data;

  // Convert each question
  const converted = questions.map(q => {
    // Convert options array to {A, B, C, D} object
    const options = {
      A: q.options[0],
      B: q.options[1],
      C: q.options[2],
      D: q.options[3]
    };

    // Convert correctAnswer index to letter
    const correct_answer = ['A', 'B', 'C', 'D'][q.correctAnswer];

    return {
      question: q.question,
      options: options,
      correct_answer: correct_answer,
      explanation: q.explanation || null
    };
  });

  // Write output file
  fs.writeFileSync(outputPath, JSON.stringify(converted, null, 2));
  console.log(`✅ Converted: ${filename} (${converted.length} questions)`);
});

console.log(`\nConversion complete! Files saved to: ${outputDir}`);
console.log('\nYou can now upload these files through the admin portal at:');
console.log('http://34.162.136.203:3000/admin/course-detail.html?id=2');
