/**
 * Client-side ISP detection utilities
 * These functions run in the browser to detect the user's actual ISP
 * instead of the server's ISP (which would be Railway in production)
 */

export interface ClientISPResult {
  detectedISP: string;
  method: 'client-direct' | 'client-api' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
  error?: string;
}

/**
 * Detect ISP directly from the client browser using public IP services
 */
export async function detectClientISP(): Promise<ClientISPResult> {
  try {
    console.log('🌐 [Client] Starting client-side ISP detection');

    // List of CORS-enabled public IP services that can detect ISP
    const corsEnabledServices = [
      {
        url: 'https://api.ipify.org?format=json',
        parser: (data: any) => null, // Only returns IP, not ISP
      },
      {
        url: 'https://ipapi.co/json/',
        parser: (data: any) => data.org || data.isp,
      },
      {
        url: 'https://ipwhois.app/json/',
        parser: (data: any) => data.isp || data.org,
      },
      {
        url: 'https://ip-api.com/json/',
        parser: (data: any) => data.isp || data.org || data.as,
      }
    ];

    for (const service of corsEnabledServices) {
      try {
        console.log(`🔍 [Client] Trying ISP detection service: ${service.url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
        
        const response = await fetch(service.url, {
          signal: controller.signal,
          mode: 'cors',
          headers: {
            'Accept': 'application/json',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.log(`❌ [Client] Service ${service.url} responded with status: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        console.log(`📡 [Client] Response from ${service.url}:`, data);

        const detectedISP = service.parser(data);
        
        if (detectedISP && 
            detectedISP !== 'Unknown' && 
            !detectedISP.toLowerCase().includes('railway') &&
            !detectedISP.toLowerCase().includes('vercel') &&
            !detectedISP.toLowerCase().includes('aws') &&
            !detectedISP.toLowerCase().includes('google cloud')) {
          
          console.log(`✅ [Client] Successfully detected ISP: ${detectedISP}`);
          return {
            detectedISP,
            method: 'client-direct',
            confidence: 'high'
          };
        }
        
      } catch (serviceError) {
        console.log(`❌ [Client] Service ${service.url} failed:`, serviceError);
        continue;
      }
    }

    // If direct client detection fails, fall back to server-side detection
    console.log(`🔄 [Client] Direct detection failed, trying server-side detection...`);
    return await detectISPViaServer();
    
  } catch (error) {
    console.error('❌ [Client] ISP detection failed:', error);
    return {
      detectedISP: 'Unknown ISP - Please select manually',
      method: 'fallback',
      confidence: 'low',
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Fallback to server-side ISP detection via our API
 */
async function detectISPViaServer(): Promise<ClientISPResult> {
  try {
    console.log('🔄 [Client] Using server-side ISP detection fallback');
    
    const response = await fetch('/api/speedtest/detect-isp', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Server detection failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.detectedISP && 
        !data.detectedISP.toLowerCase().includes('railway') &&
        !data.detectedISP.toLowerCase().includes('unknown')) {
      
      return {
        detectedISP: data.detectedISP,
        method: 'client-api',
        confidence: 'medium'
      };
    }

    return {
      detectedISP: 'Unknown ISP - Please select manually',
      method: 'fallback',
      confidence: 'low'
    };
    
  } catch (error) {
    console.error('❌ [Client] Server-side detection failed:', error);
    return {
      detectedISP: 'Unknown ISP - Please select manually',
      method: 'fallback',
      confidence: 'low',
      error: error instanceof Error ? error.message : 'Server detection failed'
    };
  }
}

/**
 * Check if a detected ISP appears to be a hosting provider rather than a real ISP
 */
export function isHostingProvider(isp: string): boolean {
  const hostingIndicators = [
    'railway',
    'vercel',
    'aws',
    'amazon',
    'google cloud',
    'microsoft azure',
    'digitalocean',
    'linode',
    'vultr',
    'cloudflare',
    'netlify',
    'heroku'
  ];

  const lowercaseISP = isp.toLowerCase();
  return hostingIndicators.some(indicator => lowercaseISP.includes(indicator));
}

/**
 * Validate that a detected ISP is likely a real ISP and not a hosting provider
 */
export function validateDetectedISP(isp: string): boolean {
  if (!isp || isp === 'Unknown' || isp.includes('Unknown')) {
    return false;
  }

  if (isHostingProvider(isp)) {
    return false;
  }

  // Additional validation - real ISPs usually have certain patterns
  const realISPIndicators = [
    'telecom',
    'communications',
    'internet',
    'broadband',
    'cable',
    'fiber',
    'dsl',
    'pldt',
    'globe',
    'sky',
    'converge',
    'smart'
  ];

  const lowercaseISP = isp.toLowerCase();
  const hasRealISPIndicator = realISPIndicators.some(indicator => 
    lowercaseISP.includes(indicator)
  );

  // If it has real ISP indicators, it's probably valid
  // If it doesn't but also isn't a hosting provider, it might still be valid
  return hasRealISPIndicator || !isHostingProvider(isp);
}
