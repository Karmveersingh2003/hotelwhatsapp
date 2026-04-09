require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const DEFAULT_USERS = [
  { username: 'reception1', password: 'pass123', role: 'reception' },
  { username: 'housekeeping1', password: 'pass123', role: 'housekeeping' },
  { username: 'kitchen1', password: 'pass123', role: 'kitchen' },
  { username: 'maintenance1', password: 'pass123', role: 'maintenance' },
  { username: 'admin', password: 'admin123', role: 'admin' },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  for (const u of DEFAULT_USERS) {
    const exists = await User.findOne({ username: u.username });
    if (!exists) {
      await User.create(u);
      console.log(`✅ Created user: ${u.username} (${u.role})`);
    } else {
      console.log(`⏭️  Skipped (exists): ${u.username}`);
    }
  }

  console.log('\n🎉 Seed complete! Default credentials:');
  DEFAULT_USERS.forEach((u) => console.log(`   ${u.role.padEnd(14)} → ${u.username} / ${u.password}`));
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });
