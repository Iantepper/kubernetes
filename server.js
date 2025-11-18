const express = require('express');
const { MongoClient } = require('mongodb');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo-service:27017/kubernetes-demo';
const DB_NAME = 'kubernetes-demo';

let db;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Conectar e inicializar MongoDB
async function connectDB() {
    try {
        console.log('🔗 Conectando a MongoDB...');
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        db = client.db(DB_NAME);
        console.log('✅ Conectado a MongoDB');
        
        // INICIALIZACIÓN AUTOMÁTICA
        await initializeDatabase();
        return true;
    } catch (error) {
        console.error('❌ Error MongoDB:', error.message);
        return false;
    }
}

// Inicializar base de datos automáticamente
async function initializeDatabase() {
    try {
        const podsCount = await db.collection('pods').countDocuments();
        
        if (podsCount === 0) {
            console.log('📊 Creando pods iniciales...');
            
            const k8sPods = [
                { 
                    _id: 'pod-tracker-1', 
                    name: 'pod-tracker-1',
                    status: 'running', 
                    userCount: 0,
                    ip: '10.0.0.1',
                    createdAt: new Date(),
                    lastSeen: new Date()
                },
                { 
                    _id: 'pod-tracker-2', 
                    name: 'pod-tracker-2',
                    status: 'running', 
                    userCount: 0,
                    ip: '10.0.0.2',
                    createdAt: new Date(),
                    lastSeen: new Date()
                },
                { 
                    _id: 'pod-tracker-3', 
                    name: 'pod-tracker-3',
                    status: 'running', 
                    userCount: 0,
                    ip: '10.0.0.3',
                    createdAt: new Date(),
                    lastSeen: new Date()
                }
            ];
            
            await db.collection('pods').insertMany(k8sPods);
            console.log('✅ Pods iniciales creados');
        }
        
        // Crear índices
        await db.collection('users').createIndex({ lastSeen: 1 });
        await db.collection('pods').createIndex({ name: 1 });
        
    } catch (error) {
        console.log('⚠️  BD ya inicializada');
    }
}

// Obtener estado del cluster
async function getClusterStatus() {
    if (!db) return {};
    
    try {
        const pods = await db.collection('pods').find().toArray();
        const status = {};
        
        pods.forEach(pod => {
            status[pod.name] = {
                visitors: pod.userCount || 0,
                status: pod.status,
                ip: pod.ip
            };
        });
        
        return status;
    } catch (error) {
        console.error('Error obteniendo cluster:', error);
        return {};
    }
}

// Asignar usuario a pod
async function assignUserToPod(clientId) {
    if (!db) throw new Error('Database no disponible');

    const usersCollection = db.collection('users');
    const podsCollection = db.collection('pods');

    // Buscar pod con menos usuarios
    const availablePods = await podsCollection
        .find({ status: 'running' })
        .sort({ userCount: 1 })
        .limit(1)
        .toArray();

    if (availablePods.length === 0) {
        throw new Error('No hay pods disponibles');
    }

    const targetPod = availablePods[0];
    const podName = targetPod.name;

    // Actualizar usuario
    await usersCollection.updateOne(
        { _id: clientId },
        { 
            $set: { 
                currentPod: podName,
                lastSeen: new Date(),
                connectedAt: new Date()
            }
        },
        { upsert: true }
    );

    // Incrementar contador del pod
    await podsCollection.updateOne(
        { _id: podName },
        { $inc: { userCount: 1 } }
    );

    return podName;
}

// HEALTH CHECK mejorado
async function healthCheck(clientId) {
    if (!db) {
        return { error: 'Database no disponible', podName: 'unknown' };
    }

    try {
        const clusterStatus = await getClusterStatus();
        
        if (!clientId) {
            return { clusterStatus };
        }

        const usersCollection = db.collection('users');
        const user = await usersCollection.findOne({ _id: clientId });

        if (!user) {
            return { error: 'Usuario no encontrado', clusterStatus };
        }

        // Verificar si el pod del usuario sigue activo
        const userPod = clusterStatus[user.currentPod];
        if (!userPod || userPod.status !== 'running') {
            // Pod caído, reasignar
            console.log(`🔴 Pod ${user.currentPod} caído, reasignando usuario ${clientId}`);
            const newPod = await assignUserToPod(clientId);
            const newStatus = await getClusterStatus();
            
            return {
                podName: newPod,
                podVisitors: newStatus[newPod]?.visitors || 0,
                clusterStatus: newStatus,
                redirected: true
            };
        }

        // Actualizar último visto
        await usersCollection.updateOne(
            { _id: clientId },
            { $set: { lastSeen: new Date() } }
        );

        return {
            podName: user.currentPod,
            podVisitors: userPod.visitors,
            clusterStatus: clusterStatus
        };

    } catch (error) {
        console.error('Error en health check:', error);
        return { error: error.message };
    }
}

// RUTAS DE LA API
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

app.post('/api/connect', async (req, res) => {
    try {
        const { clientId } = req.body;
        
        if (!clientId) {
            return res.status(400).json({ error: 'clientId es requerido' });
        }

        const podName = await assignUserToPod(clientId);
        const clusterStatus = await getClusterStatus();

        res.json({
            podName: podName,
            podVisitors: clusterStatus[podName]?.visitors || 0,
            clusterStatus: clusterStatus
        });
    } catch (error) {
        console.error('Error en /api/connect:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const result = await healthCheck(req.query.clientId);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/cluster-status', async (req, res) => {
    try {
        const clusterStatus = await getClusterStatus();
        res.json({ clusterStatus });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eliminar pod (para demo)
app.post('/api/admin/kill-pod', async (req, res) => {
    try {
        const { podName } = req.body;
        
        if (!db) {
            return res.status(500).json({ error: 'Database no disponible' });
        }

        const podsCollection = db.collection('pods');
        
        // Marcar pod como terminado
        await podsCollection.updateOne(
            { name: podName },
            { $set: { status: 'terminated', userCount: 0 } }
        );

        console.log(`🔴 Pod ${podName} eliminado para demo`);

        const clusterStatus = await getClusterStatus();
        
        res.json({
            message: `Pod ${podName} eliminado`,
            clusterStatus: clusterStatus
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reiniciar todos los pods
app.post('/api/admin/restart-pods', async (req, res) => {
    try {
        if (!db) {
            return res.status(500).json({ error: 'Database no disponible' });
        }

        const podsCollection = db.collection('pods');
        
        // Reactivar todos los pods
        await podsCollection.updateMany(
            {},
            { $set: { status: 'running', userCount: 0 } }
        );

        console.log('🔄 Todos los pods reactivados');
        const clusterStatus = await getClusterStatus();
        
        res.json({
            message: 'Todos los pods reactivados',
            clusterStatus: clusterStatus
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Iniciar servidor
connectDB().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 Servidor ejecutándose en puerto ${PORT}`);
        console.log(`📊 MongoDB: ${db ? '✅ Conectado' : '❌ No conectado'}`);
    });
});