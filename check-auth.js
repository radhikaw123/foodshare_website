// Authentication check for protected pages
// Add this script to pages that require authentication (dashboard, profile, etc.)

document.addEventListener('DOMContentLoaded', () => {
  const user = localStorage.getItem('user');
  const sessionToken = localStorage.getItem('session_token');
  
  // If no user or session token, redirect to login
  if (!user || !sessionToken) {
    window.location.href = 'login.html';
    return;
  }
  
  // Verify session with server
  fetch('/api/verify', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${sessionToken}`
    },
    credentials: 'include'
  })
  .then(response => response.json())
  .then(data => {
    if (!data.success) {
      localStorage.removeItem('user');
      localStorage.removeItem('session_token');
      window.location.href = 'login.html';
    } else {
      // Update user data from server
      localStorage.setItem('user', JSON.stringify(data.user));
    }
  })
  .catch(error => {
    console.error('Auth check error:', error);
    localStorage.removeItem('user');
    localStorage.removeItem('session_token');
    window.location.href = 'login.html';
  });
});


