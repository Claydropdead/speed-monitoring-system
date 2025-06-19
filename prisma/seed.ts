import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding development database...');  // Clean existing data first
  console.log('🧹 Cleaning existing data...');
  await prisma.speedTest.deleteMany();
  await prisma.testSchedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.office.deleteMany();
  console.log('✅ Cleaned existing data');

  // Create development admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@speedtest.local' },
    update: {},
    create: {
      email: 'admin@speedtest.local',
      name: 'Development Admin',
      password: adminPassword,
      role: 'ADMIN',
    },
  });
  console.log('✅ Created development admin user:', admin.email);
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
