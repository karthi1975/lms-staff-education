#!/usr/bin/env python3
"""
Upload Business Studies F2 content to GCP server
"""

import requests
import json
import os
import time
from pathlib import Path

# Configuration
GCP_HOST = "http://34.162.136.203:3000"
CONTENT_DIR = "/Users/karthi/business/staff_education/education_materials"
EMAIL = "admin@school.edu"
PASSWORD = "Admin123!"
COURSE_ID = 2  # Business Studies for Entrepreneurs

# Module mappings
MODULES = {
    6: "Production",
    7: "Financing",
    8: "Management",
    9: "Warehousing",
    10: "Opportunity"
}

# File to module mappings (which files go to which modules)
FILE_MAPPINGS = {
    "BUSINESS_STUDIES_F2_Part1.pdf": [6, 7, 8, 9, 10],  # Upload to all modules
    "BUSINESS_STUDIES_F2_Part2.pdf": [6, 7, 8, 9, 10],  # Upload to all modules
    "BS Lesson Plan Book_Final_May 2025.pdf": [6, 8],   # Production & Management
    "BS Teachers-Project Manual_Final_May 2025.pdf": [7, 10],  # Financing & Opportunity
    "BS Syllabus Analysis.pdf": [8],  # Management
    "Form II-Term I-Project.pdf": [9],  # Warehousing
    "Form II-Term II-Project.pdf": [10],  # Opportunity
    "GUIDELINES_FOR_PROJECT_BASED_ASSESSMENT_FOR_BUSINESS_STUDIES.pdf": [10]  # Opportunity
}

def login():
    """Login and get JWT token"""
    print("📝 Logging in...")
    try:
        response = requests.post(
            f"{GCP_HOST}/api/login",
            json={"email": EMAIL, "password": PASSWORD},
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        token = data.get('token')
        if not token:
            print(f"❌ No token in response: {data}")
            return None
        print("✅ Login successful")
        return token
    except Exception as e:
        print(f"❌ Login failed: {e}")
        return None

def upload_file(token, module_id, module_name, file_path):
    """Upload a file to a specific module"""
    file_name = os.path.basename(file_path)
    print(f"📤 Uploading to Module {module_id} ({module_name}): {file_name}")

    # Check file size (10MB limit)
    file_size = os.path.getsize(file_path)
    if file_size > 10 * 1024 * 1024:
        print(f"   ⚠️  File too large ({file_size / 1024 / 1024:.1f}MB), skipping (max 10MB)")
        return False

    try:
        url = f"{GCP_HOST}/api/admin/portal/courses/{COURSE_ID}/modules/{module_id}/upload"
        headers = {"Authorization": f"Bearer {token}"}

        with open(file_path, 'rb') as f:
            files = {'file': (file_name, f, 'application/pdf')}
            data = {'original_file': file_name}

            response = requests.post(url, headers=headers, files=files, data=data, timeout=120)
            result = response.json()

            if result.get('success'):
                print(f"   ✅ Upload successful")
                return True
            else:
                print(f"   ❌ Upload failed: {result.get('error', 'Unknown error')}")
                return False

    except Exception as e:
        print(f"   ❌ Upload error: {e}")
        return False

def main():
    print("🚀 Business Studies Content Upload Script")
    print("=" * 50)
    print()

    # Login
    token = login()
    if not token:
        print("❌ Cannot proceed without authentication")
        return

    print()
    print(f"📚 Content directory: {CONTENT_DIR}")
    print(f"📊 Course ID: {COURSE_ID}")
    print()

    # Upload files
    uploaded_count = 0
    failed_count = 0

    print("🔄 Starting uploads...")
    print()

    for file_name, module_ids in FILE_MAPPINGS.items():
        file_path = os.path.join(CONTENT_DIR, file_name)

        if not os.path.exists(file_path):
            print(f"⚠️  File not found: {file_name}")
            continue

        for module_id in module_ids:
            module_name = MODULES.get(module_id, f"Module {module_id}")

            success = upload_file(token, module_id, module_name, file_path)

            if success:
                uploaded_count += 1
            else:
                failed_count += 1

            print()
            time.sleep(2)  # Rate limiting

    print("=" * 50)
    print(f"✅ Upload complete!")
    print(f"📊 Uploaded: {uploaded_count} files")
    if failed_count > 0:
        print(f"❌ Failed: {failed_count} files")
    print()
    print("🔍 Next steps:")
    print(f"1. Visit: {GCP_HOST}/admin/courses.html")
    print("2. Click on 'Business Studies for Entrepreneurs'")
    print("3. Verify files are uploaded for each module")
    print(f"4. Test chat: {GCP_HOST}/admin/chat.html")
    print()
    print("💬 The chat should now work with real content!")

if __name__ == "__main__":
    main()
