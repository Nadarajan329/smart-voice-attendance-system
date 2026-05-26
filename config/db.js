const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/voice_attendance';
  
  try {
    // Set a short server selection timeout so fallback happens quickly if local DB is not running
    const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 3000 });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);

    setupConnectionEvents();
    return conn;
  } catch (error) {
    if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
      console.log('⚠️  Local MongoDB connection failed. Spin-up of In-Memory MongoDB requested...');
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
        process.exit(1);
      }
    } else {
      console.error('❌ MongoDB connection failed:', error.message);
      process.exit(1);
    }
  }
};

function setupConnectionEvents() {
  mongoose.connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
  });
}

module.exports = connectDB;
