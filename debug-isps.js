// Debug script to check available ISPs API
// Open browser console and run this script to see what's happening

async function debugAvailableISPs() {
  console.log('🔍 Debugging Available ISPs API...');
  
  try {
    // Get client timezone
    const clientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    console.log('🌍 Client timezone:', clientTimezone);
    
    // Call the API
    const response = await fetch(`/api/speedtest/available-isps?timezone=${encodeURIComponent(clientTimezone)}`);
    console.log('📡 Response status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', data);
      console.log('📋 Available ISPs:', data.available);
      console.log('🔵 Tested ISPs:', data.tested);
      console.log('⏰ Current Time Slot:', data.currentTimeSlot);
      
      if (data.available.length === 0 && data.tested.length === 0) {
        console.log('❌ NO ISPs FOUND - Office might not have ISPs configured');
      }
    } else {
      const errorText = await response.text();
      console.error('❌ API Error:', errorText);
    }
  } catch (error) {
    console.error('❌ Request failed:', error);
  }
}

// Call the debug function
debugAvailableISPs();
