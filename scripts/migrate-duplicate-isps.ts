/**
 * Migration utility to help update existing offices with duplicate ISP names
 * This script can be run to automatically add descriptions to duplicate ISPs
 */

import { PrismaClient } from '@prisma/client';
import { parseISPsFromOffice, generateISPId } from '../src/lib/isp-utils';

const prisma = new PrismaClient();

export async function migrateDuplicateISPs() {
  console.log('🔄 Starting ISP migration for duplicate names...');

  try {
    // Get all offices
    const offices = await prisma.office.findMany({
      select: {
        id: true,
        unitOffice: true,
        subUnitOffice: true,
        isp: true,
        isps: true,
        sectionISPs: true
      }
    });

    let updatedCount = 0;

    for (const office of offices) {
      console.log(`\n📍 Processing office: ${office.unitOffice}${office.subUnitOffice ? ` - ${office.subUnitOffice}` : ''}`);
      
      // Parse current ISPs
      let needsUpdate = false;
      let updatedISPs: string[] = [];

      if (office.isps) {
        try {
          const currentISPs = JSON.parse(office.isps);
          if (Array.isArray(currentISPs)) {
            // Check for duplicates
            const ispCounts = new Map();
            currentISPs.forEach(isp => {
              if (isp && isp.trim()) {
                const normalizedName = isp.trim();
                ispCounts.set(normalizedName, (ispCounts.get(normalizedName) || 0) + 1);
              }
            });

            // Find duplicates
            const duplicates = Array.from(ispCounts.entries()).filter(([, count]) => count > 1);
            
            if (duplicates.length > 0) {
              console.log(`  ⚠️ Found duplicates: ${duplicates.map(([isp]) => isp).join(', ')}`);
              
              // Create updated ISP list with descriptions
              const seenISPs = new Map();
              updatedISPs = currentISPs.map(isp => {
                if (!isp || !isp.trim()) return isp;
                
                const normalizedName = isp.trim();
                const count = ispCounts.get(normalizedName);
                
                if (count > 1) {
                  // This is a duplicate, add a description
                  const occurrence = (seenISPs.get(normalizedName) || 0) + 1;
                  seenISPs.set(normalizedName, occurrence);
                  
                  if (occurrence === 1) {
                    return `${normalizedName} (Primary)`;
                  } else {
                    return `${normalizedName} (Connection ${occurrence})`;
                  }
                }
                
                return isp;
              });

              needsUpdate = true;
              console.log(`  ✅ Updated ISPs: ${updatedISPs.join(', ')}`);
            } else {
              console.log(`  ✅ No duplicates found`);
            }
          }
        } catch (error) {
          console.log(`  ❌ Error parsing ISPs: ${error}`);
        }
      }

      // Update the office if needed
      if (needsUpdate) {
        await prisma.office.update({
          where: { id: office.id },
          data: {
            isps: JSON.stringify(updatedISPs),
            isp: updatedISPs[0] || office.isp // Update primary ISP
          }
        });
        
        updatedCount++;
        console.log(`  💾 Updated office database`);
      }
    }

    console.log(`\n🎉 Migration complete! Updated ${updatedCount} offices.`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrateDuplicateISPs().catch(console.error);
}
