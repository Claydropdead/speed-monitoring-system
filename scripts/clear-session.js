console.log('🔧 Clearing NextAuth session...');

// Clear all NextAuth related cookies and session data
if (typeof window !== 'undefined') {
  // Clear all cookies
  document.cookie.split(";").forEach(function(c) { 
    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
  });
  
  // Clear localStorage
  localStorage.clear();
  
  // Clear sessionStorage  
  sessionStorage.clear();
  
  console.log('✅ Session data cleared. Please refresh the page.');
  
  // Redirect to signin
  window.location.href = '/auth/signin';
} else {
  console.log('Run this in browser console to clear session data.');
}
