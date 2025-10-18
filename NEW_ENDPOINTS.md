# New AI Classification Endpoints to Add to admin.routes.js

Add these endpoints after line 239 (after existing bulk-upload endpoint):

```javascript
/**
 * @route POST /api/admin/courses/:courseId/classify-bulk
 * @desc Upload multiple files and get AI classification suggestions
 * @access Admin
 */
router.post('/courses/:courseId/classify-bulk',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  upload.array('files', 200),  // Accept up to 200 files
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const files = req.files;
      const adminUserId = req.user.id;

      if (!files || files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded'
        });
      }

      logger.info(`Starting AI classification for ${files.length} files (course: ${courseId})`);

      // Get existing modules for context
      const existingModules = await postgresService.pool.query(
        'SELECT id, title, description FROM modules WHERE course_id = $1 ORDER BY sequence_order',
        [courseId]
      );

      // Run AI classification
      const classificationResults = await contentClassificationService.classifyBatch(files, {
        courseId,
        existingModules: existingModules.rows
      });

      // Generate module structure suggestions
      const moduleStructure = await contentClassificationService.suggestModuleStructure(
        classificationResults.classifications
      );

      // Store classification results temporarily (expires in 24 hours)
      const classificationId = `classification_${Date.now()}_${adminUserId}`;

      // TODO: Store in Redis or PostgreSQL temp table
      // For now, just return in response

      res.json({
        success: true,
        classification_id: classificationId,
        course_id: parseInt(courseId),
        summary: {
          total_files: files.length,
          successful: classificationResults.successful,
          failed: classificationResults.failed,
          suggested_modules: moduleStructure.suggested_module_count,
          high_confidence: moduleStructure.high_confidence_files,
          needs_review: moduleStructure.needs_review_files
        },
        module_suggestions: moduleStructure.modules,
        detailed_classifications: classificationResults.classifications
      });

    } catch (error) {
      logger.error('Bulk classification failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * @route POST /api/admin/courses/:courseId/accept-classification
 * @desc Accept AI classification and create modules + process files
 * @access Admin
 */
router.post('/courses/:courseId/accept-classification',
  authMiddleware.authenticateToken,
  authMiddleware.requireRole(['admin']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const {
        classification_id,
        module_decisions,  // Array: [{title, files, action: 'create'|'merge'}]
        auto_process = true
      } = req.body;

      const adminUserId = req.user.id;

      logger.info(`Accepting classification ${classification_id} for course ${courseId}`);

      const createdModules = [];
      const processedFiles = [];

      // Create modules and assign files
      for (const decision of module_decisions) {
        let moduleId;

        if (decision.action === 'create') {
          // Create new module
          const moduleResult = await postgresService.pool.query(`
            INSERT INTO modules (
              course_id,
              title,
              description,
              sequence_order,
              learning_level,
              estimated_duration_hours,
              created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id, title
          `, [
            courseId,
            decision.title,
            decision.description || `Module covering: ${decision.topics.join(', ')}`,
            decision.sequence_order,
            decision.learning_level || 'intermediate',
            decision.estimated_duration_hours || 4
          ]);

          moduleId = moduleResult.rows[0].id;
          createdModules.push(moduleResult.rows[0]);

          logger.info(`Created module ${moduleId}: ${decision.title}`);

        } else if (decision.action === 'merge') {
          // Use existing module
          moduleId = decision.existing_module_id;
        }

        // Assign files to module and optionally process
        for (const fileInfo of decision.files) {
          try {
            // Create module_content record
            const contentResult = await postgresService.pool.query(`
              INSERT INTO module_content (
                module_id,
                file_name,
                original_name,
                file_path,
                file_type,
                file_size,
                uploaded_by,
                uploaded_at,
                processed,
                metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), false, $8)
              RETURNING id
            `, [
              moduleId,
              path.basename(fileInfo.file_path),
              fileInfo.file_name,
              fileInfo.file_path,
              fileInfo.file_type || 'application/pdf',
              fileInfo.file_size,
              adminUserId,
              JSON.stringify({
                classification: {
                  topics: fileInfo.topics,
                  confidence: fileInfo.confidence,
                  learning_level: fileInfo.learning_level
                }
              })
            ]);

            const contentId = contentResult.rows[0].id;

            // Process file immediately if requested
            if (auto_process) {
              try {
                await portalContentService.uploadModuleContent(
                  moduleId,
                  fileInfo.file_path,
                  {
                    originalname: fileInfo.file_name,
                    mimetype: fileInfo.file_type || 'application/pdf',
                    size: fileInfo.file_size
                  },
                  adminUserId
                );

                processedFiles.push({
                  file_name: fileInfo.file_name,
                  module_id: moduleId,
                  status: 'processed'
                });
              } catch (processError) {
                logger.error(`Failed to process ${fileInfo.file_name}:`, processError);
                processedFiles.push({
                  file_name: fileInfo.file_name,
                  module_id: moduleId,
                  status: 'failed',
                  error: processError.message
                });
              }
            }

          } catch (fileError) {
            logger.error(`Failed to assign file ${fileInfo.file_name}:`, fileError);
          }
        }
      }

      res.json({
        success: true,
        message: `Created ${createdModules.length} modules and assigned files`,
        created_modules: createdModules,
        processed_files: processedFiles.length,
        auto_processed: auto_process
      });

    } catch (error) {
      logger.error('Failed to accept classification:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);
```

## Also Add Database Migration

Create `database/migrations/add-classification-metadata.sql`:

```sql
-- Add classification metadata columns to module_content
ALTER TABLE module_content ADD COLUMN IF NOT EXISTS classification_confidence FLOAT;
ALTER TABLE module_content ADD COLUMN IF NOT EXISTS classification_topics TEXT[];
ALTER TABLE module_content ADD COLUMN IF NOT EXISTS ai_suggested_module VARCHAR(255);
ALTER TABLE module_content ADD COLUMN IF NOT EXISTS classification_metadata JSONB;

-- Create index for classification queries
CREATE INDEX IF NOT EXISTS idx_module_content_classification
  ON module_content(classification_confidence);

-- Add learning_level to modules table
ALTER TABLE modules ADD COLUMN IF NOT EXISTS learning_level VARCHAR(50) DEFAULT 'intermediate';
ALTER TABLE modules ADD COLUMN IF NOT EXISTS estimated_duration_hours INTEGER DEFAULT 4;
```

## Summary

These endpoints enable:
1. **Bulk upload + AI classification** of 100+ files at once
2. **Module suggestions** based on content analysis
3. **Admin review** with confidence scores
4. **One-click acceptance** to create modules and process files

All powered by Vertex AI LLM analyzing document content!
