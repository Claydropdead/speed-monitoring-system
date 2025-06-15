const { PrismaClient } = require('@prisma/client');

async function verifySeeding() {
  const prisma = new PrismaClient();
  
  try {
    const offices = await prisma.office.findMany();
    const users = await prisma.user.findMany();
    const tests = await prisma.speedTest.findMany();
    
    console.log('=== Database Seeding Verification ===');
    console.log(`Offices: ${offices.length}`);
    console.log(`Users: ${users.length}`);
    console.log(`Speed Tests: ${tests.length}`);
    
    if (offices.length > 0) {
      console.log('\nSample Office:', {
        name: offices[0].name,
        unitOffice: offices[0].unitOffice,
        subUnitOffice: offices[0].subUnitOffice,
        isp: offices[0].isp
      });
    }
    
    
    if (tests.length > 0) {
      console.log('\nSample Speed Test:', {
        download: tests[0].download,
        upload: tests[0].upload,
        ping: tests[0].ping,
        isp: tests[0].isp,
        date: tests[0].createdAt
      });
    }
    
    console.log('\n✅ Database seeding verification complete');
  } catch (error) {
    console.error('❌ Error verifying database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifySeeding();
