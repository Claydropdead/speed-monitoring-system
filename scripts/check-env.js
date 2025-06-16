#!/usr/bin/env node

// Environment check script for Speed Test Monitoring System
const { spawn } = require('child_process');
const { platform } = require('os');

console.log('🔍 Checking system requirements...\n');

// Check Node.js version
const nodeVersion = process.version;
console.log(`✅ Node.js: ${nodeVersion}`);

// Check if speedtest CLI is available
function checkSpeedtestCLI() {
  return new Promise((resolve) => {
    const speedtest = spawn('speedtest', ['--version'], { shell: true });
    let output = '';
    
    speedtest.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    speedtest.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ Speedtest CLI: ${output.trim()}`);
        resolve(true);
      } else {
        console.log('❌ Speedtest CLI: Not found');
        console.log('\n📋 To install Speedtest CLI:');
        
        if (platform() === 'win32') {
          console.log('   • Run: npm run setup:speedtest');
          console.log('   • Or: winget install Ookla.Speedtest.CLI');
          console.log('   • Or download from: https://www.speedtest.net/apps/cli');
        } else {
          console.log('   • Visit: https://www.speedtest.net/apps/cli');
        }
        resolve(false);
      }
    });
    
    speedtest.on('error', () => {
      console.log('❌ Speedtest CLI: Not found');
      resolve(false);
    });
  });
}

// Check database
function checkDatabase() {
  try {
    const fs = require('fs');
    const dbPath = './prisma/dev.db';
    
    if (fs.existsSync(dbPath)) {
      console.log('✅ Database: SQLite database found');
      return true;
    } else {
      console.log('⚠️  Database: Not found (run: npm run db:push)');
      return false;
    }
  } catch (error) {
    console.log('❌ Database: Error checking database');
    return false;
  }
}

async function main() {
  const speedtestOK = await checkSpeedtestCLI();
  const databaseOK = checkDatabase();
  
  console.log('\n' + '='.repeat(50));
  
  if (speedtestOK && databaseOK) {
    console.log('🎉 All requirements met! You can run: npm run dev');
  } else {
    console.log('⚠️  Some requirements missing. Please install them first.');
    console.log('\n📋 Quick setup:');
    console.log('   1. npm run setup:speedtest');
    console.log('   2. npm run db:push');
    console.log('   3. npm run db:seed');
    console.log('   4. npm run dev');
  }
}

main().catch(console.error);
