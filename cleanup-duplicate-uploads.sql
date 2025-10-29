-- Cleanup Duplicate File Uploads
-- This script removes duplicate files from the course_content table
-- Keeps only the FIRST upload of each file (earliest timestamp)

BEGIN;

-- Show duplicates before cleanup
SELECT
    'BEFORE CLEANUP:' as status,
    original_name,
    COUNT(*) as duplicate_count
FROM course_content
WHERE course_id = 1
GROUP BY original_name
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Delete duplicates, keeping only the earliest upload
DELETE FROM course_content
WHERE id IN (
    SELECT id
    FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY course_id, original_name
                ORDER BY uploaded_at ASC
            ) as row_num
        FROM course_content
        WHERE course_id = 1
    ) as ranked
    WHERE row_num > 1
);

-- Show results after cleanup
SELECT
    'AFTER CLEANUP:' as status,
    COUNT(*) as total_files,
    COUNT(DISTINCT original_name) as unique_files
FROM course_content
WHERE course_id = 1;

-- Show remaining files
SELECT
    id,
    original_name,
    file_size,
    uploaded_at,
    processing_status
FROM course_content
WHERE course_id = 1
ORDER BY uploaded_at DESC;

COMMIT;

-- Success message
SELECT '✅ Duplicate files cleaned up successfully!' as message;
