-- Add Karthi as a test user
INSERT INTO users (whatsapp_id, name, current_module_id, is_active, metadata)
VALUES (
    '+18016809129',
    'Karthi',
    1,
    true,
    '{"role": "developer", "added_date": "2025-10-02"}'::jsonb
)
ON CONFLICT (whatsapp_id) DO UPDATE
SET
    name = EXCLUDED.name,
    is_active = true,
    updated_at = NOW();

-- Initialize progress for all modules
INSERT INTO user_progress (user_id, module_id, status, progress_percentage)
SELECT
    u.id,
    m.id,
    'not_started',
    0
FROM users u
CROSS JOIN modules m
WHERE u.whatsapp_id = '+18016809129'
ON CONFLICT (user_id, module_id) DO NOTHING;

-- Display result
SELECT
    id,
    whatsapp_id,
    name,
    current_module_id,
    created_at
FROM users
WHERE whatsapp_id = '+18016809129';
