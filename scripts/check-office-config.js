// Script to check office ISP configuration
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkOfficeConfig() {
  try {
    console.log('🔍 Checking office ISP configuration...\n');
    
    // Get all offices with their ISP data
    const offices = await prisma.office.findMany({
      select: {
        id: true,
        unitOffice: true,
        subUnitOffice: true,
        isp: true,
        isps: true,
        sectionISPs: true,
      },
    });
    
    console.log(`📊 Found ${offices.length} office(s):\n`);
    
    offices.forEach((office, index) => {
      console.log(`🏢 Office ${index + 1}: ${office.unitOffice}${office.subUnitOffice ? ` > ${office.subUnitOffice}` : ''}`);
      console.log(`   ID: ${office.id}`);
      console.log(`   Primary ISP: ${office.isp || 'None'}`);
      console.log(`   General ISPs (isps): ${office.isps || 'None'}`);
      console.log(`   Section ISPs (sectionISPs): ${office.sectionISPs || 'None'}`);
      
      // Parse and display section ISPs in readable format
      if (office.sectionISPs) {
        try {
          const sectionData = JSON.parse(office.sectionISPs);
          console.log('   📋 Parsed Section ISPs:');
          Object.entries(sectionData).forEach(([section, isps]) => {
            console.log(`      ${section}: ${Array.isArray(isps) ? isps.join(', ') : isps}`);
          });
        } catch (e) {
          console.log('   ⚠️  Error parsing section ISPs:', e.message);
        }
      }
      
      // Parse and display general ISPs
      if (office.isps) {
        try {
          const generalData = JSON.parse(office.isps);
          console.log(`   🌐 Parsed General ISPs: ${Array.isArray(generalData) ? generalData.join(', ') : generalData}`);
        } catch (e) {
          console.log('   ⚠️  Error parsing general ISPs:', e.message);
        }
      }
      
      console.log('');
    });
    
    // Calculate expected total ISPs
    const targetOffice = offices[0]; // Assuming first office is the one we're working with
    if (targetOffice) {
      let totalExpected = 0;
      
      // Count general ISPs
      if (targetOffice.isps) {
        try {
          const generalISPs = JSON.parse(targetOffice.isps);
          totalExpected += Array.isArray(generalISPs) ? generalISPs.length : 0;
        } catch (e) {
          // Ignore
        }
      } else if (targetOffice.isp) {
        totalExpected += 1;
      }
      
      // Count section ISPs
      if (targetOffice.sectionISPs) {
        try {
          const sectionISPs = JSON.parse(targetOffice.sectionISPs);
          Object.values(sectionISPs).forEach(isps => {
            if (Array.isArray(isps)) {
              totalExpected += isps.length;
            }
          });
        } catch (e) {
          // Ignore
        }
      }
      
      console.log(`🎯 Expected total ISP-section combinations: ${totalExpected}`);
    }
    
  } catch (error) {
    console.error('❌ Error checking office configuration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkOfficeConfig();
