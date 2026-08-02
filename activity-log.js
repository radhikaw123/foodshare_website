// Tab functionality
let currentTab = 'all';
const activityData = {
  all: [],
  login: [],
  donations: [],
  requests: []
};

document.addEventListener('DOMContentLoaded', () => {
  // Setup tab buttons
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTab = btn.dataset.tab;
      renderActivityLog();
    });
  });

  // Load activity data
  loadActivityLog();
});

// Fetch activity log data from server
async function loadActivityLog() {
  try {
    // Check if user is logged in
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      window.location.href = 'login.html';
      return;
    }

    const user = JSON.parse(userStr);
    showLoading();

    // Fetch login history
    const loginResp = await fetch('/api/login-history', {
      credentials: 'include'
    });

    if (!loginResp.ok) {
      console.error('Login history response error:', loginResp.status, loginResp.statusText);
    }

    const loginData = await loginResp.json();
    console.log('Login history data:', loginData);
    
    if (loginData.success && Array.isArray(loginData.history)) {
      activityData.login = loginData.history.map(session => ({
        type: 'login',
        title: '🔑 Login',
        description: `Logged in to your account`,
        timestamp: new Date(session.created_at),
        metadata: {
          ip: session.ip_address,
          userAgent: session.user_agent
        }
      }));
    }

    // Fetch donations and activities based on role
    const donationsResp = await fetch('/api/donations', {
      credentials: 'include'
    });

    if (!donationsResp.ok) {
      console.error('Donations response error:', donationsResp.status, donationsResp.statusText);
    }

    const donationsData = await donationsResp.json();
    console.log('Donations data:', donationsData);
    let donations = [];

    if (donationsData.success && Array.isArray(donationsData.donations)) {
      donations = donationsData.donations;
    } else if (Array.isArray(donationsData)) {
      donations = donationsData;
    }

    // Process donations based on user role
    if (user.role === 'donor') {
      // Show donations created by this user
      const myDonations = donations.filter(d => d.user_id === user.id);
      
      activityData.donations = myDonations.map(donation => ({
        type: 'donation',
        title: '📦 Donation Created',
        description: `You posted: ${donation.title}`,
        timestamp: new Date(donation.created_at),
        foodType: donation.food_type,
        quantity: donation.quantity,
        status: donation.status,
        metadata: {
          quantity: donation.quantity,
          foodType: donation.food_type,
          location: donation.pickup_location,
          requests: donations.filter(d => d.id === donation.id && d.recipient_id).length
        }
      }));

      // Show when donations get requested
      const requestedDonations = myDonations.filter(d => d.recipient_id);
      activityData.requests = requestedDonations.map(donation => ({
        type: 'request',
        title: '🙋 Donation Requested',
        description: `Someone requested: ${donation.title}`,
        timestamp: new Date(donation.created_at),
        status: donation.status,
        metadata: {
          foodType: donation.food_type,
          quantity: donation.quantity
        }
      }));

    } else if (user.role === 'recipient') {
      // Show donations requested by this user
      const myRequests = donations.filter(d => d.recipient_id === user.id);

      activityData.requests = myRequests.map(donation => ({
        type: 'request',
        title: '🙋 Donation Request',
        description: `You requested: ${donation.title}`,
        timestamp: new Date(donation.created_at),
        foodType: donation.food_type,
        quantity: donation.quantity,
        status: donation.status,
        metadata: {
          from: 'Donor',
          location: donation.pickup_location,
          quantity: donation.quantity,
          status: donation.status
        }
      }));

    } else if (user.role === 'volunteer') {
      // Show volunteering activities
      const myVolunteerActivities = donations.filter(d => d.volunteer_id === user.id);

      activityData.donations = myVolunteerActivities.map(donation => ({
        type: 'volunteer',
        title: '🤝 Volunteering',
        description: `You helped deliver: ${donation.title}`,
        timestamp: new Date(donation.created_at),
        foodType: donation.food_type,
        quantity: donation.quantity,
        status: donation.status,
        metadata: {
          from: 'Donor',
          to: 'Recipient',
          quantity: donation.quantity,
          status: donation.status
        }
      }));

      // Also show requested donations
      const requestedDonations = donations.filter(d => d.volunteer_id === user.id && d.recipient_id);
      activityData.requests = requestedDonations.map(donation => ({
        type: 'request',
        title: '📋 Delivery Handled',
        description: `Handled delivery for: ${donation.title}`,
        timestamp: new Date(donation.created_at),
        status: donation.status,
        metadata: {
          quantity: donation.quantity,
          status: donation.status
        }
      }));
    }

    // Combine all activities into 'all' tab
    activityData.all = [
      ...activityData.login,
      ...activityData.donations,
      ...activityData.requests
    ].sort((a, b) => b.timestamp - a.timestamp);

    // Initial render
    renderActivityLog();

  } catch (error) {
    console.error('Error loading activity log:', error);
    console.error('Error details:', error.message, error.stack);
    showError('Failed to load activity log: ' + error.message);
  }
}

// Render activity log based on current tab
function renderActivityLog() {
  const container = document.getElementById('activity-container');
  const emptyState = document.getElementById('empty-state');
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');

  loadingState.style.display = 'none';
  errorState.style.display = 'none';

  const activities = activityData[currentTab] || [];

  if (activities.length === 0) {
    container.style.display = 'none';
    emptyState.style.display = 'flex';
    
    const emptyMessage = document.getElementById('empty-message');
    if (currentTab === 'login') {
      emptyMessage.textContent = 'No login history available.';
    } else if (currentTab === 'donations') {
      emptyMessage.textContent = 'You haven\'t created any donations yet.';
    } else if (currentTab === 'requests') {
      emptyMessage.textContent = 'You haven\'t made any requests yet.';
    } else {
      emptyMessage.textContent = 'Your activity log is empty. Start participating to see your activity here.';
    }
    return;
  }

  container.style.display = 'block';
  emptyState.style.display = 'none';

  const timeline = container.querySelector('.timeline');
  timeline.innerHTML = '';

  activities.forEach(activity => {
    const activityEl = createActivityElement(activity);
    timeline.appendChild(activityEl);
  });
}

// Create activity element
function createActivityElement(activity) {
  const div = document.createElement('div');
  div.className = `activity-item ${activity.type}`;

  const iconMap = {
    login: '🔑',
    donation: '📦',
    request: '🙋',
    volunteer: '🤝',
    completed: '✓'
  };

  const icon = iconMap[activity.type] || '•';
  const timeString = formatTime(activity.timestamp);
  
  let metadataHtml = '';
  if (activity.metadata) {
    if (activity.type === 'login' && activity.metadata.ip) {
      metadataHtml = `<div class="activity-meta login">
        <strong>IP Address:</strong> ${sanitize(activity.metadata.ip)}<br>
        <strong>Device:</strong> ${getDeviceInfo(activity.metadata.userAgent)}
      </div>`;
    } else if (activity.type === 'donation') {
      metadataHtml = `<div class="activity-meta donation">
        <strong>Food Type:</strong> ${sanitize(activity.metadata.foodType || 'N/A')}<br>
        <strong>Quantity:</strong> ${sanitize(activity.metadata.quantity || 'N/A')}<br>
        <strong>Status:</strong> <span class="activity-status-badge ${activity.status}">${sanitize(activity.status || 'N/A')}</span>
      </div>`;
    } else if (activity.type === 'request') {
      metadataHtml = `<div class="activity-meta request">
        <strong>Status:</strong> <span class="activity-status-badge ${activity.status}">${sanitize(activity.status || 'N/A')}</span>
      </div>`;
    } else if (activity.type === 'volunteer') {
      metadataHtml = `<div class="activity-meta volunteer">
        <strong>Quantity:</strong> ${sanitize(activity.metadata.quantity || 'N/A')}<br>
        <strong>Status:</strong> <span class="activity-status-badge ${activity.status}">${sanitize(activity.status || 'N/A')}</span>
      </div>`;
    }
  }

  div.innerHTML = `
    <div class="activity-icon">${icon}</div>
    <div class="activity-content">
      <div class="activity-title">${sanitize(activity.title)}</div>
      <div class="activity-description">${sanitize(activity.description)}</div>
      ${metadataHtml}
      <div class="activity-timestamp">
        <span>📅</span>
        <span>${timeString}</span>
      </div>
    </div>
  `;

  return div;
}

// Format timestamp
function formatTime(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }

  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Get device info from user agent
function getDeviceInfo(userAgent) {
  if (!userAgent) return 'Unknown Device';
  
  if (userAgent.includes('Mobile') || userAgent.includes('Android')) {
    return 'Mobile Device';
  } else if (userAgent.includes('iPad') || userAgent.includes('Tablet')) {
    return 'Tablet';
  } else {
    return 'Desktop';
  }
}

// Sanitize text to prevent XSS
function sanitize(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Show loading state
function showLoading() {
  document.getElementById('loading-state').style.display = 'flex';
  document.getElementById('activity-container').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
  document.getElementById('error-state').style.display = 'none';
}

// Show error state
function showError(message) {
  document.getElementById('error-state').style.display = 'flex';
  document.getElementById('error-message').textContent = message;
  document.getElementById('loading-state').style.display = 'none';
  document.getElementById('activity-container').style.display = 'none';
  document.getElementById('empty-state').style.display = 'none';
}

