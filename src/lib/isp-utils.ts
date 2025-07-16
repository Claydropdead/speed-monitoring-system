// Client-safe ISP normalization utilities
// This file can be imported by both client and server components

import { ISPProvider } from '@/types';

interface ISPMapping {
  canonical: string;
  aliases: string[];
}

const ISP_MAPPINGS: ISPMapping[] = [
  {
    canonical: 'PLDT',
    aliases: [
      'pldt',
      'pldtr',
      'philippine long distance telephone company',
      'pldt inc',
      'pldt.com',
    ],
  },
  {
    canonical: 'Globe',
    aliases: ['globe', 'globe telecom', 'globe telecom inc', 'globe.com.ph'],
  },
  {
    canonical: 'Converge',
    aliases: ['converge', 'converge ict', 'converge ict solutions inc', 'convergeict.com'],
  },
  {
    canonical: 'Smart',
    aliases: ['smart', 'smart communications', 'smart communications inc', 'smart.com.ph'],
  },
  {
    canonical: 'Sky',
    aliases: ['sky', 'sky broadband', 'sky cable', 'skycable.com'],
  },
  {
    canonical: 'DITO',
    aliases: ['dito', 'dito telecommunity', 'dito cme', 'dito.ph'],
  },
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
export function validateISPMatch(
  selectedISP: string,
  detectedISP: string,
  relaxedMode: boolean = false
): {
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
      allowProceed: true,
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
      allowProceed: true,
    };
  }

  // In relaxed mode, allow special cases
  if (relaxedMode) {
    // Special case: PLDT infrastructure is used by many ISPs in the Philippines
    if (
      detectedCanonical === 'PLDT' &&
      ['Globe', 'Converge', 'Smart', 'Sky', 'DITO'].includes(selectedCanonical)
    ) {
      return {
        isMatch: false,
        confidence: 60,
        detectedCanonical,
        selectedCanonical,
        allowProceed: true,
        suggestion: `Note: Detected infrastructure provider is PLDT, but your service provider is ${selectedCanonical}. This is common in the Philippines. Test will proceed with ${selectedCanonical} as the ISP.`,
      };
    }

    // Allow other mismatches with warning
    return {
      isMatch: false,
      confidence: 30,
      detectedCanonical,
      selectedCanonical,
      allowProceed: true,
      suggestion: `Warning: Detected ISP "${detectedCanonical}" differs from selected ISP "${selectedCanonical}". Test will proceed but data may be attributed to the wrong ISP.`,
    };
  }

  // Strict mode - no match, block test
  return {
    isMatch: false,
    confidence: 0,
    detectedCanonical,
    selectedCanonical,
    allowProceed: false,
    suggestion: `Detected ISP "${detectedCanonical}" does not match selected ISP "${selectedCanonical}". Please verify your connection and select the correct ISP.`,
  };
}

// Generate a unique ISP ID within an office
export function generateISPId(ispName: string, existingIds: string[] = []): string {
  const baseName = normalizeISPName(ispName).replace(/\s+/g, '-').toLowerCase();
  
  // If no duplicate, return the base name
  if (!existingIds.includes(baseName)) {
    return baseName;
  }
  
  // Find next available number
  let counter = 2;
  let newId = `${baseName}-${counter}`;
  while (existingIds.includes(newId)) {
    counter++;
    newId = `${baseName}-${counter}`;
  }
  
  return newId;
}

// Parse ISPs from legacy string format to new ISPProvider format
export function parseISPsFromOffice(office: any): ISPProvider[] {
  const isps: ISPProvider[] = [];
  
  // Handle legacy single ISP format
  if (office.isp && !office.isps) {
    isps.push({
      id: generateISPId(office.isp),
      name: office.isp,
      description: 'Primary ISP'
    });
    return isps;
  }
  
  // Handle modern ISPs array format
  if (office.isps) {
    try {
      const ispArray = typeof office.isps === 'string' ? JSON.parse(office.isps) : office.isps;
      
      if (Array.isArray(ispArray)) {
        const existingIds: string[] = [];
        
        ispArray.forEach((fullIspName: string, index: number) => {
          if (fullIspName.trim()) {
            // Check if the ISP name already has a description in parentheses
            const match = fullIspName.match(/^(.+?)\s*\((.+?)\)$/);
            
            let ispName: string;
            let description: string;
            let id: string;
            
            if (match) {
              // ISP already has description: "PLDT (Backup Line)" -> name: "PLDT", description: "Backup Line"
              ispName = match[1].trim();
              description = match[2].trim();
              id = generateISPId(`${ispName}-${description}`, existingIds);
            } else {
              // No description in parentheses, treat as plain ISP name
              ispName = fullIspName.trim();
              description = index === 0 ? 'Primary ISP' : `ISP ${index + 1}`;
              id = generateISPId(ispName, existingIds);
            }
            
            existingIds.push(id);
            
            const ispProvider: ISPProvider = {
              id,
              name: ispName,
              description
            };
            
            isps.push(ispProvider);
          }
        });
      }
    } catch (error) {
      // Fallback to legacy format
      if (office.isp) {
        isps.push({
          id: generateISPId(office.isp),
          name: office.isp,
          description: 'Primary ISP'
        });
      }
    }
  }
  
  // Handle section-specific ISPs
  if (office.sectionISPs) {
    try {
      const sectionISPs = typeof office.sectionISPs === 'string' ? JSON.parse(office.sectionISPs) : office.sectionISPs;
      
      Object.entries(sectionISPs).forEach(([section, sectionIspArray]) => {
        if (Array.isArray(sectionIspArray)) {
          const existingIds = isps.map(isp => isp.id);
          
          sectionIspArray.forEach((fullIspName: string, index: number) => {
            if (fullIspName.trim()) {
              // Check if the ISP name already has a description in parentheses
              const match = fullIspName.match(/^(.+?)\s*\((.+?)\)$/);
              
              let ispName: string;
              let description: string;
              let id: string;
              
              if (match) {
                // ISP already has description: "PLDT (Primary Connection)" -> name: "PLDT", description: "Primary Connection"
                ispName = match[1].trim();
                description = match[2].trim();
                id = generateISPId(`${ispName}-${description}-${section}`, existingIds);
              } else {
                // No description in parentheses, treat as plain ISP name
                ispName = fullIspName.trim();
                description = `${section} - ISP ${index + 1}`;
                id = generateISPId(`${ispName}-${section}`, existingIds);
              }
              
              existingIds.push(id);
              
              const ispProvider: ISPProvider = {
                id,
                name: ispName,
                description,
                section
              };
              
              isps.push(ispProvider);
            }
          });
        }
      });
    } catch (error) {
      // Silent fallback on parse error
    }
  }
  
  return isps;
}

// Find ISP by ID from an office
export function findISPById(office: any, ispId: string): ISPProvider | null {
  const isps = parseISPsFromOffice(office);
  return isps.find(isp => isp.id === ispId) || null;
}

// Get display name for ISP (includes section if applicable)
export function getISPDisplayName(isp: ISPProvider): string {
  // Check if description is already included in the name to avoid duplication
  if (isp.name.includes('(') && isp.name.includes(')')) {
    return isp.name;
  }
  
  // Handle section-specific ISPs with proper descriptions
  if (isp.section && isp.description && !isp.description.startsWith(isp.section)) {
    const result = `${isp.name} (${isp.description})`;
    return result;
  }
  
  // Handle regular ISPs with descriptions
  if (isp.description && isp.description !== 'Primary ISP' && !isp.description.startsWith('ISP ') && !isp.description.includes(' - ISP ')) {
    const result = `${isp.name} (${isp.description})`;
    return result;
  }
  
  return isp.name;
}

// Resolve ISP ID back to ISP name for speed test execution
export function resolveISPFromId(ispId: string, office: any): { name: string; displayName: string } | null {
  const isps = parseISPsFromOffice(office);
  
  const foundISP = isps.find(isp => isp.id === ispId);
  
  if (foundISP) {
    const result = {
      name: foundISP.name,
      displayName: getISPDisplayName(foundISP)
    };
    return result;
  }
  
  // Fallback: if ID looks like it might be a direct ISP name, return it
  if (ispId && typeof ispId === 'string') {
    return {
      name: ispId,
      displayName: ispId
    };
  }
  
  return null;
}
