// Client-safe ISP normalization utilities
// This file can be imported by both client and server components

interface ISPMapping {
  canonical: string;
  aliases: string[];
}

const ISP_MAPPINGS: ISPMapping[] = [
  {
    canonical: 'PLDT',
    aliases: ['pldt', 'pldtr', 'philippine long distance telephone company', 'pldt inc', 'pldt.com']
  },
  {
    canonical: 'Globe',
    aliases: ['globe', 'globe telecom', 'globe telecom inc', 'globe.com.ph']
  },
  {
    canonical: 'Converge',
    aliases: ['converge', 'converge ict', 'converge ict solutions inc', 'convergeict.com']
  },
  {
    canonical: 'Smart',
    aliases: ['smart', 'smart communications', 'smart communications inc', 'smart.com.ph']
  },
  {
    canonical: 'Sky',
    aliases: ['sky', 'sky broadband', 'sky cable', 'skycable.com']
  },
  {
    canonical: 'DITO',
    aliases: ['dito', 'dito telecommunity', 'dito cme', 'dito.ph']
  }
];

// Normalize ISP name to canonical form
export function normalizeISPName(ispName: string): string {
  if (!ispName || !ispName.trim()) return '';
  
  const normalized = ispName.trim().toLowerCase();
  
  // First check if the input matches any canonical name (case-insensitive)
  for (const mapping of ISP_MAPPINGS) {
    if (mapping.canonical.toLowerCase() === normalized) {
      return mapping.canonical;
    }
  }
  
  // Then check aliases
  for (const mapping of ISP_MAPPINGS) {
    // Check for exact match in aliases
    if (mapping.aliases.includes(normalized)) {
      return mapping.canonical;
    }
    // Check for partial match as fallback
    if (mapping.aliases.some(alias => normalized.includes(alias))) {
      return mapping.canonical;
    }
  }
  
  // Return the original name with proper casing if no mapping found
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
