# UI Implementation Guide: AI Classification System

## Overview

This guide provides complete, working code for the bulk upload and classification review user interfaces. All code is production-ready and can be copied directly into your project.

---

## File 1: Bulk Upload Interface

**Path**: `public/admin/bulk-upload.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bulk Upload Course Content - Teachers Training</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
    }

    .header {
      margin-bottom: 30px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 20px;
    }

    .header h1 {
      color: #2c3e50;
      font-size: 28px;
      margin-bottom: 10px;
    }

    .breadcrumb {
      color: #7f8c8d;
      font-size: 14px;
      margin-bottom: 10px;
    }

    .breadcrumb a {
      color: #3498db;
      text-decoration: none;
    }

    .breadcrumb a:hover {
      text-decoration: underline;
    }

    .course-info {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 8px;
      margin-bottom: 30px;
      border-left: 4px solid #667eea;
    }

    .course-info h2 {
      color: #2c3e50;
      font-size: 20px;
      margin-bottom: 5px;
    }

    .course-info p {
      color: #7f8c8d;
      font-size: 14px;
    }

    .upload-zone {
      border: 3px dashed #cbd5e0;
      border-radius: 12px;
      padding: 60px 40px;
      text-align: center;
      background: #f7fafc;
      transition: all 0.3s ease;
      cursor: pointer;
      margin-bottom: 30px;
    }

    .upload-zone:hover {
      border-color: #667eea;
      background: #edf2f7;
    }

    .upload-zone.dragover {
      border-color: #667eea;
      background: #e6f3ff;
      transform: scale(1.02);
    }

    .upload-icon {
      font-size: 48px;
      color: #a0aec0;
      margin-bottom: 20px;
    }

    .upload-zone h3 {
      color: #2d3748;
      font-size: 20px;
      margin-bottom: 10px;
    }

    .upload-zone p {
      color: #718096;
      font-size: 14px;
      margin-bottom: 20px;
    }

    .upload-btn {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-size: 16px;
      cursor: pointer;
      transition: transform 0.2s;
    }

    .upload-btn:hover {
      transform: translateY(-2px);
    }

    .file-list {
      max-height: 400px;
      overflow-y: auto;
      margin-bottom: 30px;
    }

    .file-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 15px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      margin-bottom: 10px;
      background: white;
      transition: all 0.2s;
    }

    .file-item:hover {
      background: #f7fafc;
      border-color: #cbd5e0;
    }

    .file-info {
      display: flex;
      align-items: center;
      flex: 1;
    }

    .file-icon {
      width: 40px;
      height: 40px;
      background: #edf2f7;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 15px;
      font-size: 20px;
    }

    .file-details {
      flex: 1;
    }

    .file-name {
      color: #2d3748;
      font-size: 14px;
      font-weight: 500;
      margin-bottom: 4px;
    }

    .file-size {
      color: #a0aec0;
      font-size: 12px;
    }

    .file-status {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-pending {
      background: #fef5e7;
      color: #f39c12;
    }

    .status-uploading {
      background: #ebf5fb;
      color: #3498db;
    }

    .status-success {
      background: #eafaf1;
      color: #27ae60;
    }

    .status-error {
      background: #fadbd8;
      color: #e74c3c;
    }

    .remove-btn {
      background: none;
      border: none;
      color: #e74c3c;
      cursor: pointer;
      font-size: 18px;
      padding: 5px 10px;
      margin-left: 10px;
    }

    .remove-btn:hover {
      background: #fadbd8;
      border-radius: 4px;
    }

    .progress-bar {
      width: 100%;
      height: 4px;
      background: #edf2f7;
      border-radius: 2px;
      overflow: hidden;
      margin-top: 5px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      width: 0%;
      transition: width 0.3s ease;
    }

    .summary-box {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-value {
      font-size: 32px;
      font-weight: bold;
      color: #2c3e50;
      margin-bottom: 5px;
    }

    .summary-label {
      color: #7f8c8d;
      font-size: 12px;
      text-transform: uppercase;
    }

    .action-buttons {
      display: flex;
      gap: 15px;
      justify-content: center;
    }

    .btn {
      padding: 12px 30px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .btn-secondary:hover {
      background: #f7fafc;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
      vertical-align: middle;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .alert {
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: none;
    }

    .alert.show {
      display: block;
    }

    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .alert-info {
      background: #d1ecf1;
      color: #0c5460;
      border: 1px solid #bee5eb;
    }

    #fileInput {
      display: none;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="breadcrumb">
        <a href="index.html">Dashboard</a> /
        <a href="courses.html">Courses</a> /
        <span id="courseName">Loading...</span> /
        Bulk Upload
      </div>
      <h1>AI-Powered Bulk Upload</h1>
      <p style="color: #7f8c8d; margin-top: 10px;">
        Upload all your course files at once. Our AI will automatically analyze content and suggest module organization.
      </p>
    </div>

    <div class="course-info" id="courseInfo">
      <h2 id="courseTitle">Loading...</h2>
      <p id="courseDescription">Loading course details...</p>
    </div>

    <div class="alert" id="alertBox">
      <p id="alertMessage"></p>
    </div>

    <!-- Upload Zone -->
    <div class="upload-zone" id="uploadZone">
      <div class="upload-icon">📁</div>
      <h3>Drop files here or click to browse</h3>
      <p>Support for PDF, DOCX, TXT, PNG, JPG files (up to 50MB each, 200 files max)</p>
      <button class="upload-btn" type="button" onclick="document.getElementById('fileInput').click()">
        Select Files
      </button>
      <input type="file" id="fileInput" multiple accept=".pdf,.docx,.txt,.png,.jpg,.jpeg">
    </div>

    <!-- File List -->
    <div id="fileListContainer" class="hidden">
      <h3 style="margin-bottom: 15px; color: #2c3e50;">Selected Files</h3>
      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-value" id="totalFiles">0</div>
          <div class="summary-label">Files</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" id="totalSize">0 MB</div>
          <div class="summary-label">Total Size</div>
        </div>
        <div class="summary-item">
          <div class="summary-value" id="uploadProgress">0%</div>
          <div class="summary-label">Progress</div>
        </div>
      </div>

      <div class="file-list" id="fileList"></div>

      <div class="action-buttons">
        <button class="btn btn-secondary" id="clearBtn" onclick="clearFiles()">
          Clear All
        </button>
        <button class="btn btn-primary" id="uploadBtn" onclick="startUpload()">
          <span id="uploadBtnText">Start AI Classification</span>
        </button>
      </div>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const courseId = urlParams.get('courseId');
    const token = localStorage.getItem('token');
    let selectedFiles = [];
    let uploadInProgress = false;

    // Load course details
    async function loadCourseDetails() {
      try {
        const response = await fetch(`/api/admin/courses/${courseId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load course');

        const course = await response.json();
        document.getElementById('courseName').textContent = course.title;
        document.getElementById('courseTitle').textContent = course.title;
        document.getElementById('courseDescription').textContent = course.description || 'No description available';
      } catch (error) {
        console.error('Error loading course:', error);
        showAlert('error', 'Failed to load course details');
      }
    }

    // File selection handling
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    uploadZone.addEventListener('click', () => {
      if (!uploadInProgress) fileInput.click();
    });

    uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      if (!uploadInProgress) {
        handleFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', (e) => {
      handleFiles(e.target.files);
    });

    function handleFiles(files) {
      const newFiles = Array.from(files);

      // Validate file count
      if (selectedFiles.length + newFiles.length > 200) {
        showAlert('error', 'Maximum 200 files allowed');
        return;
      }

      // Validate file types and size
      const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                          'text/plain', 'image/png', 'image/jpeg', 'image/jpg'];

      for (const file of newFiles) {
        if (!validTypes.includes(file.type)) {
          showAlert('error', `File type not supported: ${file.name}`);
          continue;
        }

        if (file.size > 50 * 1024 * 1024) {
          showAlert('error', `File too large (max 50MB): ${file.name}`);
          continue;
        }

        selectedFiles.push({
          file: file,
          status: 'pending',
          id: Date.now() + Math.random()
        });
      }

      renderFileList();
      updateSummary();
      document.getElementById('fileListContainer').classList.remove('hidden');
    }

    function renderFileList() {
      const fileList = document.getElementById('fileList');
      fileList.innerHTML = '';

      selectedFiles.forEach((item) => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.innerHTML = `
          <div class="file-info">
            <div class="file-icon">${getFileIcon(item.file.type)}</div>
            <div class="file-details">
              <div class="file-name">${item.file.name}</div>
              <div class="file-size">${formatFileSize(item.file.size)}</div>
              ${item.status === 'uploading' ? '<div class="progress-bar"><div class="progress-fill" style="width: ' + (item.progress || 0) + '%"></div></div>' : ''}
            </div>
          </div>
          <span class="file-status status-${item.status}">${getStatusText(item.status)}</span>
          ${item.status === 'pending' ? `<button class="remove-btn" onclick="removeFile(${item.id})">✕</button>` : ''}
        `;
        fileList.appendChild(fileDiv);
      });
    }

    function getFileIcon(type) {
      if (type === 'application/pdf') return '📄';
      if (type.includes('word')) return '📝';
      if (type.includes('text')) return '📃';
      if (type.includes('image')) return '🖼️';
      return '📎';
    }

    function formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    function getStatusText(status) {
      const statusMap = {
        'pending': 'Pending',
        'uploading': 'Uploading...',
        'success': 'Uploaded',
        'error': 'Failed'
      };
      return statusMap[status] || status;
    }

    function removeFile(id) {
      selectedFiles = selectedFiles.filter(item => item.id !== id);
      renderFileList();
      updateSummary();

      if (selectedFiles.length === 0) {
        document.getElementById('fileListContainer').classList.add('hidden');
      }
    }

    function clearFiles() {
      if (confirm('Clear all selected files?')) {
        selectedFiles = [];
        renderFileList();
        document.getElementById('fileListContainer').classList.add('hidden');
      }
    }

    function updateSummary() {
      const totalSize = selectedFiles.reduce((sum, item) => sum + item.file.size, 0);
      const uploadedCount = selectedFiles.filter(item => item.status === 'success').length;
      const progress = selectedFiles.length > 0 ? Math.round((uploadedCount / selectedFiles.length) * 100) : 0;

      document.getElementById('totalFiles').textContent = selectedFiles.length;
      document.getElementById('totalSize').textContent = formatFileSize(totalSize);
      document.getElementById('uploadProgress').textContent = progress + '%';
    }

    async function startUpload() {
      if (selectedFiles.length === 0) {
        showAlert('error', 'Please select files to upload');
        return;
      }

      if (uploadInProgress) return;

      uploadInProgress = true;
      document.getElementById('uploadBtn').disabled = true;
      document.getElementById('clearBtn').disabled = true;
      document.getElementById('uploadBtnText').innerHTML = '<span class="loading-spinner"></span>Analyzing with AI...';

      try {
        const formData = new FormData();
        selectedFiles.forEach((item) => {
          formData.append('files', item.file);
          item.status = 'uploading';
        });

        renderFileList();

        const response = await fetch(`/api/admin/classify/courses/${courseId}/bulk`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Upload failed');
        }

        const result = await response.json();

        // Mark all as success
        selectedFiles.forEach(item => item.status = 'success');
        renderFileList();
        updateSummary();

        showAlert('success', `AI classification complete! Analyzing ${result.summary.total_files} files...`);

        // Redirect to review page after 2 seconds
        setTimeout(() => {
          window.location.href = `classification-review.html?classificationId=${result.classification_id}&courseId=${courseId}`;
        }, 2000);

      } catch (error) {
        console.error('Upload error:', error);
        showAlert('error', `Upload failed: ${error.message}`);

        selectedFiles.forEach(item => {
          if (item.status === 'uploading') item.status = 'error';
        });
        renderFileList();

        uploadInProgress = false;
        document.getElementById('uploadBtn').disabled = false;
        document.getElementById('clearBtn').disabled = false;
        document.getElementById('uploadBtnText').textContent = 'Start AI Classification';
      }
    }

    function showAlert(type, message) {
      const alertBox = document.getElementById('alertBox');
      const alertMessage = document.getElementById('alertMessage');

      alertBox.className = `alert alert-${type} show`;
      alertMessage.textContent = message;

      setTimeout(() => {
        alertBox.classList.remove('show');
      }, 5000);
    }

    // Initialize
    if (!token || !courseId) {
      window.location.href = 'login.html';
    } else {
      loadCourseDetails();
    }
  </script>
</body>
</html>
```

---

## File 2: Classification Review Interface

**Path**: `public/admin/classification-review.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Review AI Classification - Teachers Training</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 40px;
    }

    .header {
      margin-bottom: 30px;
      border-bottom: 2px solid #e0e0e0;
      padding-bottom: 20px;
    }

    .header h1 {
      color: #2c3e50;
      font-size: 28px;
      margin-bottom: 10px;
    }

    .breadcrumb {
      color: #7f8c8d;
      font-size: 14px;
      margin-bottom: 10px;
    }

    .breadcrumb a {
      color: #3498db;
      text-decoration: none;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }

    .summary-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
    }

    .summary-card.success {
      background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    }

    .summary-card.warning {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }

    .summary-card.info {
      background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
    }

    .summary-value {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 5px;
    }

    .summary-label {
      font-size: 14px;
      opacity: 0.9;
    }

    .filters {
      display: flex;
      gap: 15px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 8px 16px;
      border: 2px solid #e0e0e0;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }

    .filter-btn:hover {
      border-color: #667eea;
    }

    .filter-btn.active {
      background: #667eea;
      color: white;
      border-color: #667eea;
    }

    .module-card {
      border: 2px solid #e0e0e0;
      border-radius: 10px;
      padding: 20px;
      margin-bottom: 20px;
      transition: all 0.3s;
    }

    .module-card:hover {
      border-color: #667eea;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
    }

    .module-card.high-confidence {
      border-left: 4px solid #27ae60;
    }

    .module-card.needs-review {
      border-left: 4px solid #f39c12;
    }

    .module-card.low-confidence {
      border-left: 4px solid #e74c3c;
    }

    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      margin-bottom: 15px;
    }

    .module-title {
      flex: 1;
    }

    .module-title h3 {
      color: #2c3e50;
      font-size: 20px;
      margin-bottom: 5px;
    }

    .module-meta {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      color: #7f8c8d;
      font-size: 13px;
      margin-top: 8px;
    }

    .meta-item {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .confidence-badge {
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
    }

    .confidence-high {
      background: #d4edda;
      color: #155724;
    }

    .confidence-medium {
      background: #fff3cd;
      color: #856404;
    }

    .confidence-low {
      background: #f8d7da;
      color: #721c24;
    }

    .module-topics {
      margin-bottom: 15px;
    }

    .topic-tag {
      display: inline-block;
      background: #f0f0f0;
      padding: 5px 12px;
      border-radius: 12px;
      font-size: 12px;
      margin-right: 8px;
      margin-bottom: 8px;
      color: #555;
    }

    .module-actions {
      display: flex;
      gap: 10px;
      align-items: center;
    }

    .action-select {
      padding: 8px 12px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
    }

    .action-select:focus {
      outline: none;
      border-color: #667eea;
    }

    .files-toggle {
      cursor: pointer;
      color: #667eea;
      font-size: 14px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 10px;
      padding: 8px 0;
    }

    .files-toggle:hover {
      text-decoration: underline;
    }

    .files-list {
      display: none;
      margin-top: 15px;
      padding-top: 15px;
      border-top: 1px solid #e0e0e0;
    }

    .files-list.show {
      display: block;
    }

    .file-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px;
      background: #f8f9fa;
      border-radius: 6px;
      margin-bottom: 8px;
    }

    .file-row:hover {
      background: #e9ecef;
    }

    .file-name {
      font-size: 14px;
      color: #2c3e50;
    }

    .file-confidence {
      font-size: 12px;
      color: #7f8c8d;
    }

    .bottom-actions {
      position: sticky;
      bottom: 0;
      background: white;
      padding: 20px;
      border-top: 2px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: 30px -40px -40px -40px;
      border-radius: 0 0 12px 12px;
    }

    .action-info {
      color: #7f8c8d;
      font-size: 14px;
    }

    .action-buttons {
      display: flex;
      gap: 15px;
    }

    .btn {
      padding: 12px 30px;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid #ffffff;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-right: 8px;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .alert {
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: none;
    }

    .alert.show {
      display: block;
    }

    .alert-success {
      background: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }

    .alert-error {
      background: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }

    .edit-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      align-items: center;
      justify-content: center;
    }

    .edit-modal.show {
      display: flex;
    }

    .modal-content {
      background: white;
      padding: 30px;
      border-radius: 12px;
      max-width: 600px;
      width: 90%;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #2c3e50;
      font-weight: 500;
    }

    .form-group input,
    .form-group textarea,
    .form-group select {
      width: 100%;
      padding: 10px;
      border: 2px solid #e0e0e0;
      border-radius: 6px;
      font-size: 14px;
    }

    .form-group textarea {
      min-height: 100px;
      resize: vertical;
    }

    .hidden {
      display: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="breadcrumb">
        <a href="index.html">Dashboard</a> /
        <a href="courses.html">Courses</a> /
        <span id="courseName">Loading...</span> /
        Classification Review
      </div>
      <h1>AI Classification Results</h1>
      <p style="color: #7f8c8d; margin-top: 10px;">
        Review AI-suggested module structure and file assignments. Edit, merge, or accept suggestions.
      </p>
    </div>

    <div class="alert" id="alertBox">
      <p id="alertMessage"></p>
    </div>

    <!-- Summary Cards -->
    <div class="summary-grid" id="summaryGrid">
      <div class="summary-card">
        <div class="summary-value" id="totalFilesCount">-</div>
        <div class="summary-label">Total Files</div>
      </div>
      <div class="summary-card success">
        <div class="summary-value" id="successCount">-</div>
        <div class="summary-label">Successfully Classified</div>
      </div>
      <div class="summary-card info">
        <div class="summary-value" id="suggestedModulesCount">-</div>
        <div class="summary-label">Suggested Modules</div>
      </div>
      <div class="summary-card success">
        <div class="summary-value" id="highConfidenceCount">-</div>
        <div class="summary-label">High Confidence</div>
      </div>
      <div class="summary-card warning">
        <div class="summary-value" id="needsReviewCount">-</div>
        <div class="summary-label">Needs Review</div>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters">
      <button class="filter-btn active" data-filter="all" onclick="filterModules('all')">All Modules</button>
      <button class="filter-btn" data-filter="high" onclick="filterModules('high')">High Confidence</button>
      <button class="filter-btn" data-filter="review" onclick="filterModules('review')">Needs Review</button>
      <button class="filter-btn" data-filter="low" onclick="filterModules('low')">Low Confidence</button>
    </div>

    <!-- Modules List -->
    <div id="modulesList"></div>

    <!-- Bottom Actions -->
    <div class="bottom-actions">
      <div class="action-info">
        <span id="acceptedCount">0</span> modules selected for creation
      </div>
      <div class="action-buttons">
        <button class="btn btn-secondary" onclick="window.location.href='bulk-upload.html?courseId=' + courseId">
          Cancel
        </button>
        <button class="btn btn-primary" id="acceptBtn" onclick="acceptClassification()">
          <span id="acceptBtnText">Accept & Process</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Edit Module Modal -->
  <div class="edit-modal" id="editModal">
    <div class="modal-content">
      <h2 style="margin-bottom: 20px; color: #2c3e50;">Edit Module</h2>
      <form id="editForm">
        <div class="form-group">
          <label>Module Title</label>
          <input type="text" id="editTitle" required>
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea id="editDescription"></textarea>
        </div>
        <div class="form-group">
          <label>Learning Level</label>
          <select id="editLevel">
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>
        <div class="form-group">
          <label>Estimated Duration (hours)</label>
          <input type="number" id="editDuration" min="1" max="100">
        </div>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="closeEditModal()">Cancel</button>
          <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    const urlParams = new URLSearchParams(window.location.search);
    const classificationId = urlParams.get('classificationId');
    const courseId = urlParams.get('courseId');
    const token = localStorage.getItem('token');

    let classificationData = null;
    let moduleDecisions = [];
    let currentEditIndex = null;

    async function loadClassification() {
      try {
        const response = await fetch(`/api/admin/classify/${classificationId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load classification');

        const result = await response.json();
        classificationData = result;

        // Populate summary
        const summary = result.classifications;
        document.getElementById('totalFilesCount').textContent = summary.total || 0;
        document.getElementById('successCount').textContent = summary.successful || 0;
        document.getElementById('suggestedModulesCount').textContent = result.module_suggestions.modules.length;
        document.getElementById('highConfidenceCount').textContent = result.module_suggestions.high_confidence_files || 0;
        document.getElementById('needsReviewCount').textContent = result.module_suggestions.needs_review_files || 0;

        // Initialize module decisions
        moduleDecisions = result.module_suggestions.modules.map(module => ({
          ...module,
          action: module.avg_confidence >= 0.8 ? 'create' : 'review'
        }));

        renderModules();
        updateAcceptedCount();

      } catch (error) {
        console.error('Error loading classification:', error);
        showAlert('error', 'Failed to load classification results');
      }
    }

    function renderModules() {
      const modulesList = document.getElementById('modulesList');
      modulesList.innerHTML = '';

      moduleDecisions.forEach((module, index) => {
        const confidenceClass = module.avg_confidence >= 0.8 ? 'high-confidence'
          : module.avg_confidence >= 0.6 ? 'needs-review'
          : 'low-confidence';

        const confidenceBadgeClass = module.avg_confidence >= 0.8 ? 'confidence-high'
          : module.avg_confidence >= 0.6 ? 'confidence-medium'
          : 'confidence-low';

        const confidenceText = module.avg_confidence >= 0.8 ? 'High Confidence'
          : module.avg_confidence >= 0.6 ? 'Needs Review'
          : 'Low Confidence';

        const moduleCard = document.createElement('div');
        moduleCard.className = `module-card ${confidenceClass}`;
        moduleCard.setAttribute('data-confidence', confidenceClass);
        moduleCard.innerHTML = `
          <div class="module-header">
            <div class="module-title">
              <h3>${module.title}</h3>
              <div class="module-meta">
                <span class="meta-item">📚 ${module.file_count} files</span>
                <span class="meta-item">⏱️ ${module.estimated_duration_hours} hours</span>
                <span class="meta-item">📊 ${module.learning_level}</span>
              </div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <span class="confidence-badge ${confidenceBadgeClass}">
                ${Math.round(module.avg_confidence * 100)}% ${confidenceText}
              </span>
            </div>
          </div>

          <div class="module-topics">
            ${module.topics.slice(0, 8).map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
          </div>

          <div class="module-actions">
            <select class="action-select" onchange="updateModuleAction(${index}, this.value)">
              <option value="create" ${module.action === 'create' ? 'selected' : ''}>✅ Create New Module</option>
              <option value="skip" ${module.action === 'skip' ? 'selected' : ''}>⏭️ Skip</option>
              <option value="review" ${module.action === 'review' ? 'selected' : ''}>⚠️ Review Later</option>
            </select>
            <button class="btn btn-secondary" style="padding: 8px 16px; font-size: 14px;" onclick="editModule(${index})">
              Edit Details
            </button>
          </div>

          <div class="files-toggle" onclick="toggleFiles(${index})">
            <span id="toggle-icon-${index}">▶</span>
            <span>View ${module.file_count} files</span>
          </div>

          <div class="files-list" id="files-${index}">
            ${module.files.map(file => `
              <div class="file-row">
                <span class="file-name">${file.file_name}</span>
                <span class="file-confidence">${Math.round(file.confidence * 100)}% confidence</span>
              </div>
            `).join('')}
          </div>
        `;

        modulesList.appendChild(moduleCard);
      });
    }

    function toggleFiles(index) {
      const filesList = document.getElementById(`files-${index}`);
      const icon = document.getElementById(`toggle-icon-${index}`);

      filesList.classList.toggle('show');
      icon.textContent = filesList.classList.contains('show') ? '▼' : '▶';
    }

    function updateModuleAction(index, action) {
      moduleDecisions[index].action = action;
      updateAcceptedCount();
    }

    function updateAcceptedCount() {
      const acceptedCount = moduleDecisions.filter(m => m.action === 'create').length;
      document.getElementById('acceptedCount').textContent = acceptedCount;
      document.getElementById('acceptBtn').disabled = acceptedCount === 0;
    }

    function filterModules(filter) {
      // Update active button
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');

      // Filter modules
      const modules = document.querySelectorAll('.module-card');
      modules.forEach(module => {
        if (filter === 'all') {
          module.style.display = 'block';
        } else if (filter === 'high' && module.classList.contains('high-confidence')) {
          module.style.display = 'block';
        } else if (filter === 'review' && module.classList.contains('needs-review')) {
          module.style.display = 'block';
        } else if (filter === 'low' && module.classList.contains('low-confidence')) {
          module.style.display = 'block';
        } else {
          module.style.display = 'none';
        }
      });
    }

    function editModule(index) {
      currentEditIndex = index;
      const module = moduleDecisions[index];

      document.getElementById('editTitle').value = module.title;
      document.getElementById('editDescription').value = module.description || '';
      document.getElementById('editLevel').value = module.learning_level;
      document.getElementById('editDuration').value = module.estimated_duration_hours;

      document.getElementById('editModal').classList.add('show');
    }

    function closeEditModal() {
      document.getElementById('editModal').classList.remove('show');
      currentEditIndex = null;
    }

    document.getElementById('editForm').addEventListener('submit', (e) => {
      e.preventDefault();

      if (currentEditIndex !== null) {
        moduleDecisions[currentEditIndex].title = document.getElementById('editTitle').value;
        moduleDecisions[currentEditIndex].description = document.getElementById('editDescription').value;
        moduleDecisions[currentEditIndex].learning_level = document.getElementById('editLevel').value;
        moduleDecisions[currentEditIndex].estimated_duration_hours = parseInt(document.getElementById('editDuration').value);

        renderModules();
        closeEditModal();
        showAlert('success', 'Module updated successfully');
      }
    });

    async function acceptClassification() {
      const acceptedModules = moduleDecisions.filter(m => m.action === 'create');

      if (acceptedModules.length === 0) {
        showAlert('error', 'Please select at least one module to create');
        return;
      }

      if (!confirm(`Create ${acceptedModules.length} modules and process all files?`)) {
        return;
      }

      document.getElementById('acceptBtn').disabled = true;
      document.getElementById('acceptBtnText').innerHTML = '<span class="loading-spinner"></span>Processing...';

      try {
        const response = await fetch(`/api/admin/classify/courses/${courseId}/accept`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            classification_id: classificationId,
            module_decisions: acceptedModules,
            auto_process: true
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to accept classification');
        }

        const result = await response.json();

        showAlert('success', `Success! Created ${result.created_modules.length} modules and processed ${result.processed_files} files`);

        setTimeout(() => {
          window.location.href = `course-detail.html?courseId=${courseId}`;
        }, 2000);

      } catch (error) {
        console.error('Error accepting classification:', error);
        showAlert('error', `Failed to create modules: ${error.message}`);
        document.getElementById('acceptBtn').disabled = false;
        document.getElementById('acceptBtnText').textContent = 'Accept & Process';
      }
    }

    function showAlert(type, message) {
      const alertBox = document.getElementById('alertBox');
      const alertMessage = document.getElementById('alertMessage');

      alertBox.className = `alert alert-${type} show`;
      alertMessage.textContent = message;

      setTimeout(() => {
        alertBox.classList.remove('show');
      }, 5000);
    }

    // Initialize
    if (!token || !classificationId || !courseId) {
      window.location.href = 'login.html';
    } else {
      loadClassification();
    }
  </script>
</body>
</html>
```

---

## Integration Steps

### Step 1: Add Routes to Main App

In `server.js` or `app.js`, add:

```javascript
const classificationRoutes = require('./routes/classification.routes');

// Mount classification routes
app.use('/api/admin/classify', classificationRoutes);
```

### Step 2: Run Database Migration

```bash
# Local
DB_HOST=localhost DB_PORT=5432 DB_NAME=teachers_training DB_USER=teachers_user DB_PASSWORD=teachers_pass_2024 node scripts/run-migration.js

# GCP
gcloud compute ssh teachers-training --zone=us-east5-a --command="sudo docker exec teachers_training_app_1 psql -U teachers_user -d teachers_training -f /app/database/migrations/005_add_classification_support.sql"
```

### Step 3: Add Navigation Links

In `public/admin/index.html` (dashboard), add button:

```html
<div class="action-card" onclick="window.location.href='courses.html'">
  <div class="card-icon">🎓</div>
  <h3>Manage Courses</h3>
  <p>Create courses and upload content with AI classification</p>
</div>
```

In `public/admin/course-detail.html`, add button:

```html
<button class="btn btn-primary" onclick="window.location.href='bulk-upload.html?courseId=' + courseId">
  📤 Bulk Upload with AI
</button>
```

### Step 4: Create Upload Directory

```bash
mkdir -p uploads
chmod 755 uploads
```

### Step 5: Test the Workflow

```bash
# 1. Start services
docker-compose up -d

# 2. Login as admin
curl -X POST http://localhost:3000/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@school.edu","password":"Admin123!"}'

# 3. Create test course
curl -X POST http://localhost:3000/api/admin/courses \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Python Course",
    "code": "PY-101",
    "description": "Test course for AI classification",
    "category": "Programming"
  }'

# 4. Upload files via UI
# Go to: http://localhost:3000/admin/bulk-upload.html?courseId=1
# Upload 10-20 test PDFs

# 5. Review classification
# Should redirect to classification-review.html automatically

# 6. Accept and verify
# Click "Accept & Process" button
# Check database for created modules
```

---

## API Reference

### POST /api/admin/classify/courses/:courseId/bulk

**Request**: `multipart/form-data` with files

**Response**:
```json
{
  "success": true,
  "classification_id": "classification_1729266000_123",
  "course_id": 1,
  "summary": {
    "total_files": 100,
    "successful": 98,
    "failed": 2,
    "suggested_modules": 5,
    "high_confidence": 85,
    "needs_review": 13
  },
  "module_suggestions": [...]
}
```

### GET /api/admin/classify/:classificationId

**Response**:
```json
{
  "success": true,
  "classification_id": "...",
  "course_id": 1,
  "created_at": "2025-10-18T12:00:00Z",
  "expires_at": "2025-10-19T12:00:00Z",
  "classifications": {...},
  "module_suggestions": {...}
}
```

### POST /api/admin/classify/courses/:courseId/accept

**Request**:
```json
{
  "classification_id": "classification_1729266000_123",
  "module_decisions": [
    {
      "action": "create",
      "title": "Python Fundamentals",
      "description": "...",
      "sequence_order": 1,
      "topics": ["variables", "syntax"],
      "learning_level": "beginner",
      "estimated_duration_hours": 8,
      "files": [...]
    }
  ],
  "auto_process": true
}
```

**Response**:
```json
{
  "success": true,
  "message": "Created 5 modules and assigned files",
  "created_modules": [...],
  "processed_files": 98,
  "uploaded_files": 0,
  "failed_files": 0,
  "auto_processed": true
}
```

---

## Troubleshooting

### Issue: Files not uploading
**Solution**: Check multer configuration and upload directory permissions
```bash
chmod 755 uploads/
```

### Issue: Classification taking too long
**Solution**: Reduce batch size or implement progress polling
```javascript
// Add polling endpoint to check classification progress
router.get('/status/:classificationId', async (req, res) => {
  // Return current progress
});
```

### Issue: Low classification confidence
**Solution**: Improve LLM prompt with better examples or increase context window

### Issue: Module suggestions not accurate
**Solution**: Fine-tune clustering algorithm parameters in `suggestModuleStructure()`

---

## Next Steps

1. **Add Progress Indicators**: Show real-time progress during upload/classification
2. **Implement Batch Processing**: Queue large uploads for background processing
3. **Add Manual File Reassignment**: Drag & drop files between modules
4. **Create Analytics Dashboard**: Track classification accuracy over time
5. **Add Export/Import**: Save classification templates for reuse

---

*Created: 2025-10-18*
*Version: 1.0*
*Status: Production-ready implementation*
