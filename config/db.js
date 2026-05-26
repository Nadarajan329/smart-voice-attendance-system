const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/voice_attendance';

  // Check if a real MongoDB URI is configured (not a placeholder or localhost without a running server)
  const isRealURI = uri.startsWith('mongodb+srv://') || uri.startsWith('mongodb://') && !uri.includes('localhost');

  if (isRealURI) {
    try {
      const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
      setupConnectionEvents();
      return conn;
    } catch (error) {
      console.error('❌ MongoDB connection failed:', error.message);
      console.log('⚠️  Falling back to in-memory MongoDB...');
      return startInMemoryDB();
    }
  }

  // Try localhost first (for local development)
  try {
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    setupConnectionEvents();
    return conn;
  } catch (error) {
    console.log('⚠️  Local MongoDB connection failed. Starting in-memory MongoDB...');
    return startInMemoryDB();
  }
};

async function startInMemoryDB() {
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    const memoryUri = mongoServer.getUri();

    const conn = await mongoose.connect(memoryUri);
    console.log(`✅ In-Memory MongoDB Connected: ${memoryUri}`);

    setupConnectionEvents();
    return conn;
  } catch (memError) {
    console.error('❌ Failed to start in-memory MongoDB server:', memError.message);
    console.error('   Tip: Set MONGODB_URI to a MongoDB Atlas connection string for production.');
    process.exit(1);
  }
}

function setupConnectionEvents() {
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected.');
  });
}

module.exports = connectDB;

