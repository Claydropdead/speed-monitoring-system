// Client-safe ISP normalization utilities
// This file can be imported by both client and server components

interface ISPMapping {
  canonical: string;
  aliases: string[];
}

const ISP_MAPPINGS: ISPMapping[] = [
  {
    canonical: 'PLDT',
    aliases: ['PLDT', 'Philippine Long Distance Telephone Company', 'PLDT Inc', 'pldt.com']
  },
  {
    canonical: 'Globe',
    aliases: ['Globe', 'Globe Telecom', 'Globe Telecom Inc', 'globe.com.ph']
  },
  {
    canonical: 'Converge',
    aliases: ['Converge', 'Converge ICT', 'Converge ICT Solutions Inc', 'convergeict.com']
  },
  {
    canonical: 'Smart',
    aliases: ['Smart', 'Smart Communications', 'Smart Communications Inc', 'smart.com.ph']
  },
  {
    canonical: 'Sky',
    aliases: ['Sky', 'Sky Broadband', 'Sky Cable', 'skycable.com']
  },
  {
    canonical: 'DITO',
    aliases: ['DITO', 'DITO Telecommunity', 'DITO CME', 'dito.ph']
  }
];

// Normalize ISP name to canonical form
export function normalizeISPName(ispName: string): string {
  const normalized = ispName.trim().toLowerCase();
  
  for (const mapping of ISP_MAPPINGS) {
    if (mapping.aliases.some(alias => normalized.includes(alias.toLowerCase()))) {
      return mapping.canonical;
    }
  }
  
  // Return the original name if no mapping found
  return ispName.trim();
}

// Check if detected ISP matches selected ISP
export function validateISPMatch(selectedISP: string, detectedISP: string, relaxedMode: boolean = false): {
  isMatch: boolean;
  confidence: number;
  detectedCanonical: string;
  selectedCanonical: string;
  suggestion?: string;
  allowProceed?: boolean;
} {
  const selectedCanonical = normalizeISPName(selectedISP);
  const detectedCanonical = normalizeISPName(detectedISP);
  
  // Exact match
  if (selectedCanonical === detectedCanonical) {
    return {
      isMatch: true,
      confidence: 100,
      detectedCanonical,
      selectedCanonical,
      allowProceed: true
    };
  }
  
  // Partial match (case insensitive)
  const selectedLower = selectedCanonical.toLowerCase();
  const detectedLower = detectedCanonical.toLowerCase();
  
  if (selectedLower.includes(detectedLower) || detectedLower.includes(selectedLower)) {
    return {
      isMatch: true,
      confidence: 80,
      detectedCanonical,
      selectedCanonical,
      allowProceed: true
    };
  }

  // In relaxed mode, allow special cases
  if (relaxedMode) {
    // Special case: PLDT infrastructure is used by many ISPs in the Philippines
    if (detectedCanonical === 'PLDT' && ['Globe', 'Converge', 'Smart', 'Sky', 'DITO'].includes(selectedCanonical)) {
      return {
        isMatch: false,
        confidence: 60,
        detectedCanonical,
        selectedCanonical,
        allowProceed: true,
        suggestion: `Note: Detected infrastructure provider is PLDT, but your service provider is ${selectedCanonical}. This is common in the Philippines. Test will proceed with ${selectedCanonical} as the ISP.`
      };
    }
    
    // Allow other mismatches with warning
    return {
      isMatch: false,
      confidence: 30,
      detectedCanonical,
      selectedCanonical,
      allowProceed: true,
      suggestion: `Warning: Detected ISP "${detectedCanonical}" differs from selected ISP "${selectedCanonical}". Test will proceed but data may be attributed to the wrong ISP.`
    };
  }
  
  // Strict mode - no match, block test
  return {
    isMatch: false,
    confidence: 0,
    detectedCanonical,
    selectedCanonical,
    allowProceed: false,
    suggestion: `Detected ISP "${detectedCanonical}" does not match selected ISP "${selectedCanonical}". Please verify your connection and select the correct ISP.`
  };
}
