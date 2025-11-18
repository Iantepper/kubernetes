// mongo-init.js
db = db.getSiblingDB('kubernetes-demo-new');

// Crear colecciones iniciales
db.createCollection('pods');
db.createCollection('users');

// Insertar pods iniciales
db.pods.insertMany([
  { 
    _id: 'pod-tracker-1', 
    name: 'pod-tracker-1',
    status: 'running', 
    userCount: 0, 
    createdAt: new Date(),
    lastSeen: new Date()
  },
  { 
    _id: 'pod-tracker-2', 
    name: 'pod-tracker-2',
    status: 'running', 
    userCount: 0, 
    createdAt: new Date(),
    lastSeen: new Date()
  },
  { 
    _id: 'pod-tracker-3', 
    name: 'pod-tracker-3',
    status: 'running', 
    userCount: 0, 
    createdAt: new Date(),
    lastSeen: new Date()
  }
]);

print('✅ Base de datos kubernetes-demo-new inicializada');
print('📊 Pods creados: ' + db.pods.countDocuments());