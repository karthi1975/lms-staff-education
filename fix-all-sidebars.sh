#!/bin/bash

# Fix all admin pages to hide Administration section for Regional Admins

echo "Fixing sidebar RBAC for all admin pages..."

# List of files to update (those with sidebars)
FILES=(
    "public/admin/admin-users-rbac.html"
    "public/admin/regions.html"
    "public/admin/courses.html"
    "public/admin/user-management.html"
    "public/admin/chat.html"
    "public/admin/coaching-analytics.html"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing: $file"

        # Check if ADMINISTRATION section exists
        if grep -q "ADMINISTRATION" "$file"; then
            # Check if already has ID
            if ! grep -q 'id="administrationSection"' "$file"; then
                # Add ID to div
                sed -i '' 's/<div class="nav-section">[ ]*<div class="nav-section-title">ADMINISTRATION<\/div>/<div class="nav-section" id="administrationSection"><div class="nav-section-title">ADMINISTRATION<\/div>/g' "$file"
                echo "  ✅ Added ID to Administration section"
            else
                echo "  ✓ ID already present"
            fi

            # Check if RBAC logic exists
            if ! grep -q "Regional Admin detected" "$file"; then
                echo "  ⚠️  Need to manually add RBAC logic"
            else
                echo "  ✓ RBAC logic already present"
            fi
        else
            echo "  ✓ No Administration section (skip)"
        fi
    else
        echo "  ❌ File not found: $file"
    fi
    echo ""
done

echo "Done! Now manually add RBAC logic to files that need it."
