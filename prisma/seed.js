const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding production database...');
  
  // Create production admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@speedtest.local' },
    update: {},
    create: {
      email: 'admin@speedtest.local',
      name: 'Production Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created production admin user:', admin.email);
  console.log('🔐 Admin credentials: admin@speedtest.local / admin123');

  console.log('🎉 Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
