/**
 * Moodle-style Sidebar Navigation Component
 * Material Design 3 Theme - Teal
 * Reusable across all admin pages
 */

// Navigation structure
const navigationMenu = [
  {
    id: 'dashboard',
    icon: '🏠',
    label: 'Dashboard',
    url: 'lms-dashboard.html', // Section link
    items: [
      { label: 'LMS Dashboard', url: 'lms-dashboard.html' },
      { label: 'Overview', url: 'dashboard.html' }
    ]
  },
  {
    id: 'courses',
    icon: '📚',
    label: 'Course Management',
    url: 'courses.html', // Section link - goes to All Courses
    items: [
      { label: 'All Courses', url: 'courses.html' },
      { label: 'Course Details', url: 'course-detail.html' },
      { label: 'Modules', url: 'modules.html' },
      { label: 'Module Details', url: 'module-detail.html' }
    ]
  },
  {
    id: 'users',
    icon: '👥',
    label: 'User Management',
    url: 'users.html', // Section link
    items: [
      { label: 'WhatsApp Users', url: 'users.html' },
      { label: 'User Progress', url: 'user-detail.html' },
      { label: 'User Management', url: 'user-management.html' },
      { label: 'Admin Users', url: 'admin-users.html' }
    ]
  },
  {
    id: 'content',
    icon: '📁',
    label: 'Content',
    url: 'quiz.html', // Section link
    items: [
      { label: 'Quiz Management', url: 'quiz.html' }
    ]
  },
  {
    id: 'communication',
    icon: '💬',
    label: 'Communication',
    url: 'chat.html', // Section link
    items: [
      { label: 'Chat Interface', url: 'chat.html' },
      { label: 'Chat v2', url: 'chat-v2.html' }
    ]
  },
  {
    id: 'settings',
    icon: '⚙️',
    label: 'Settings',
    url: 'moodle-settings.html', // Section link
    items: [
      { label: 'Moodle Settings', url: 'moodle-settings.html' }
    ]
  }
];

// CSS Styles
const sidebarStyles = `
<style>
  /* Sidebar Container */
  .lms-sidebar {
    position: fixed;
    left: 0;
    top: 70px; /* Below top navbar */
    width: 260px;
    height: calc(100vh - 70px);
    background: #fff;
    border-right: 1px solid #e0e0e0;
    box-shadow: 2px 0 4px rgba(0,0,0,0.05);
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 999;
    transition: transform 0.3s ease;
  }

  .lms-sidebar.collapsed {
    transform: translateX(-260px);
  }

  /* Sidebar Header */
  .lms-sidebar-header {
    padding: 15px 20px;
    background: linear-gradient(135deg, #00897B 0%, #00695C 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .lms-sidebar-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-toggle {
    background: none;
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 5px;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .sidebar-toggle:hover {
    background: rgba(255,255,255,0.1);
  }

  /* Navigation Menu */
  .lms-nav-menu {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .lms-nav-section {
    border-bottom: 1px solid #f0f0f0;
  }

  .lms-nav-section-header {
    display: flex;
    align-items: center;
    background: #fff;
    border: none;
    width: 100%;
    padding: 0;
    transition: background 0.2s;
  }

  .lms-nav-section-header:hover {
    background: #f8f9fa;
  }

  .lms-nav-section-header.active {
    background: #e8f5f4;
  }

  .nav-section-main {
    display: flex;
    align-items: center;
    flex: 1;
    padding: 15px 10px 15px 20px;
    text-decoration: none;
    color: #3a3a3a;
    font-size: 15px;
    font-weight: 500;
    cursor: pointer;
    transition: color 0.2s;
  }

  .nav-section-main:hover {
    color: #00897B;
  }

  .lms-nav-section-header.active .nav-section-main {
    color: #00897B;
  }

  .nav-section-icon {
    font-size: 20px;
    margin-right: 12px;
  }

  .nav-section-label {
    flex: 1;
  }

  .nav-section-arrow-btn {
    background: none;
    border: none;
    padding: 15px 20px 15px 10px;
    color: #3a3a3a;
    cursor: pointer;
    font-size: 12px;
    transition: transform 0.3s, color 0.2s;
    display: flex;
    align-items: center;
  }

  .nav-section-arrow-btn:hover {
    color: #00897B;
  }

  .lms-nav-section.expanded .nav-section-arrow-btn {
    transform: rotate(180deg);
  }

  /* Submenu */
  .lms-nav-submenu {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
    background: #f8f9fa;
  }

  .lms-nav-section.expanded .lms-nav-submenu {
    max-height: 500px;
  }

  .lms-nav-submenu-item {
    margin: 0;
  }

  .lms-nav-submenu-link {
    display: block;
    padding: 12px 20px 12px 52px;
    color: #5a5a5a;
    text-decoration: none;
    font-size: 14px;
    transition: all 0.2s;
    border-left: 3px solid transparent;
  }

  .lms-nav-submenu-link:hover {
    background: #e8f5f4;
    color: #00897B;
    border-left-color: #00897B;
  }

  .lms-nav-submenu-link.active {
    background: #e8f5f4;
    color: #00897B;
    font-weight: 500;
    border-left-color: #00897B;
  }

  /* Content Area Adjustment */
  .lms-content-with-sidebar {
    margin-left: 260px;
    transition: margin-left 0.3s ease;
  }

  .lms-content-with-sidebar.sidebar-collapsed {
    margin-left: 0;
  }

  /* Mobile Toggle Button (always visible) */
  .mobile-sidebar-toggle {
    position: fixed;
    left: 10px;
    top: 80px;
    z-index: 1000;
    background: #00897B;
    color: white;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    font-size: 20px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }

  .mobile-sidebar-toggle:hover {
    background: #00695C;
    transform: scale(1.05);
  }

  .mobile-sidebar-toggle.sidebar-open {
    left: 270px;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .lms-sidebar {
      transform: translateX(-260px);
    }

    .lms-sidebar.mobile-open {
      transform: translateX(0);
    }

    .lms-content-with-sidebar {
      margin-left: 0;
    }
  }

  /* Scrollbar Styling */
  .lms-sidebar::-webkit-scrollbar {
    width: 6px;
  }

  .lms-sidebar::-webkit-scrollbar-track {
    background: #f1f1f1;
  }

  .lms-sidebar::-webkit-scrollbar-thumb {
    background: #00897B;
    border-radius: 3px;
  }

  .lms-sidebar::-webkit-scrollbar-thumb:hover {
    background: #00695C;
  }
</style>
`;

// HTML Template
function generateSidebarHTML() {
  let html = `
    <button class="mobile-sidebar-toggle" onclick="toggleSidebar()" title="Toggle Sidebar">
      ☰
    </button>

    <aside class="lms-sidebar" id="lmsSidebar">
      <div class="lms-sidebar-header">
        <h2 class="lms-sidebar-title">Menu</h2>
        <button class="sidebar-toggle" onclick="toggleSidebar()" title="Collapse Sidebar">
          ◀
        </button>
      </div>

      <nav>
        <ul class="lms-nav-menu">
  `;

  // Generate navigation sections
  navigationMenu.forEach(section => {
    const sectionId = `nav-section-${section.id}`;
    html += `
      <li class="lms-nav-section" id="${sectionId}">
        <div class="lms-nav-section-header">
          <a href="${section.url}" class="nav-section-main">
            <span class="nav-section-icon">${section.icon}</span>
            <span class="nav-section-label">${section.label}</span>
          </a>
          <button class="nav-section-arrow-btn" onclick="toggleSection('${sectionId}'); event.stopPropagation();" title="Expand/Collapse">
            ▼
          </button>
        </div>
        <ul class="lms-nav-submenu">
    `;

    section.items.forEach(item => {
      html += `
          <li class="lms-nav-submenu-item">
            <a href="${item.url}" class="lms-nav-submenu-link">${item.label}</a>
          </li>
      `;
    });

    html += `
        </ul>
      </li>
    `;
  });

  html += `
        </ul>
      </nav>
    </aside>
  `;

  return html;
}

// JavaScript Functions
const sidebarScripts = `
<script>
  // Toggle sidebar visibility
  function toggleSidebar() {
    const sidebar = document.getElementById('lmsSidebar');
    const content = document.querySelector('.lms-content-with-sidebar');
    const toggleBtn = document.querySelector('.mobile-sidebar-toggle');

    if (sidebar) {
      sidebar.classList.toggle('collapsed');
      sidebar.classList.toggle('mobile-open');

      if (content) {
        content.classList.toggle('sidebar-collapsed');
      }

      if (toggleBtn) {
        toggleBtn.classList.toggle('sidebar-open');
      }

      // Save state
      localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('collapsed'));
    }
  }

  // Toggle navigation section
  function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.toggle('expanded');

      // Save expanded sections
      const expandedSections = Array.from(document.querySelectorAll('.lms-nav-section.expanded'))
        .map(el => el.id);
      localStorage.setItem('expandedSections', JSON.stringify(expandedSections));
    }
  }

  // Restore sidebar state on page load
  function restoreSidebarState() {
    // Restore collapsed state
    const sidebarCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (sidebarCollapsed) {
      const sidebar = document.getElementById('lmsSidebar');
      const content = document.querySelector('.lms-content-with-sidebar');
      const toggleBtn = document.querySelector('.mobile-sidebar-toggle');

      if (sidebar) sidebar.classList.add('collapsed');
      if (content) content.classList.add('sidebar-collapsed');
      if (toggleBtn) toggleBtn.classList.add('sidebar-open');
    }

    // Restore expanded sections
    const expandedSections = JSON.parse(localStorage.getItem('expandedSections') || '[]');
    expandedSections.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) section.classList.add('expanded');
    });

    // Highlight current page
    highlightCurrentPage();
  }

  // Highlight current page in navigation
  function highlightCurrentPage() {
    const currentPage = window.location.pathname.split('/').pop();

    // Check section header links
    const sectionLinks = document.querySelectorAll('.nav-section-main');
    sectionLinks.forEach(link => {
      const linkUrl = link.getAttribute('href');
      if (linkUrl === currentPage) {
        const section = link.closest('.lms-nav-section');
        if (section) {
          section.classList.add('expanded');
          const header = section.querySelector('.lms-nav-section-header');
          if (header) header.classList.add('active');
        }
      }
    });

    // Check submenu links
    const subLinks = document.querySelectorAll('.lms-nav-submenu-link');
    subLinks.forEach(link => {
      const linkUrl = link.getAttribute('href');
      if (linkUrl === currentPage) {
        link.classList.add('active');

        // Expand parent section
        const section = link.closest('.lms-nav-section');
        if (section) {
          section.classList.add('expanded');
          const header = section.querySelector('.lms-nav-section-header');
          if (header) header.classList.add('active');
        }
      }
    });
  }

  // Initialize sidebar when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreSidebarState);
  } else {
    restoreSidebarState();
  }
</script>
`;

// Main initialization function
function initializeSidebar() {
  // Inject styles
  document.head.insertAdjacentHTML('beforeend', sidebarStyles);

  // Inject sidebar HTML at the start of body
  document.body.insertAdjacentHTML('afterbegin', generateSidebarHTML());

  // Inject scripts
  document.body.insertAdjacentHTML('beforeend', sidebarScripts);

  // Wrap main content if not already wrapped
  const existingWrapper = document.querySelector('.lms-content-with-sidebar');
  if (!existingWrapper) {
    // Find main content container (skip sidebar and mobile toggle)
    const sidebar = document.getElementById('lmsSidebar');
    const mobileToggle = document.querySelector('.mobile-sidebar-toggle');

    // Get all body children except sidebar and toggle
    const bodyChildren = Array.from(document.body.children).filter(
      child => child !== sidebar && child !== mobileToggle
    );

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'lms-content-with-sidebar';

    // Move children into wrapper
    bodyChildren.forEach(child => {
      if (!child.tagName || child.tagName !== 'SCRIPT') {
        wrapper.appendChild(child);
      }
    });

    document.body.appendChild(wrapper);
  }
}

// Auto-initialize if not login page
if (!window.location.pathname.includes('login.html')) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeSidebar);
  } else {
    initializeSidebar();
  }
}
