const express = require('express');
const { MongoClient } = require('mongodb');
const app = express();
const PORT = 3000;
const MONGODB_URI = 'mongodb://mongo-service:27017/kubernetes-demo';

let db;

async function connectDB() {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db();
    console.log('✅ Conectado a MongoDB');
    
    // Inicializar pods SI NO EXISTEN
    const podsCount = await db.collection('pods').countDocuments();
    if (podsCount === 0) {
        await db.collection('pods').insertMany([
            { _id: 'pod-alpha', status: 'running', userCount: 0 },
            { _id: 'pod-beta', status: 'running', userCount: 0 },
            { _id: 'pod-gamma', status: 'running', userCount: 0 }
        ]);
        console.log('📊 Pods iniciales creados');
    }
}

// Función CORREGIDA para asignar usuarios
async function assignUserToPod(clientId) {
    const podsCollection = db.collection('pods');
    const usersCollection = db.collection('users');
    
    // Buscar pod activo con menos usuarios
    const availablePod = await podsCollection
        .find({ status: 'running' })
        .sort({ userCount: 1 })
        .limit(1)
        .next();
    
    if (!availablePod) {
        throw new Error('No hay pods disponibles');
    }
    
    const podName = availablePod._id;
    
    // Verificar si el usuario ya existe
    const existingUser = await usersCollection.findOne({ _id: clientId });
    
    if (existingUser) {
        // Si ya existe, decrementar contador del pod anterior
        if (existingUser.currentPod !== podName) {
            await podsCollection.updateOne(
                { _id: existingUser.currentPod },
                { $inc: { userCount: -1 } }
            );
        }
    }
    
    // Actualizar/crear usuario
    await usersCollection.updateOne(
        { _id: clientId },
        { 
            $set: { 
                currentPod: podName,
                lastSeen: new Date()
            },
            $setOnInsert: {
                connectedAt: new Date()
            }
        },
        { upsert: true }
    );
    
    // Incrementar contador del NUEVO pod
    await podsCollection.updateOne(
        { _id: podName },
        { $inc: { userCount: 1 } }
    );
    
    return podName;
}

// Health check MEJORADO que detecta pods caídos
async function healthCheck(clientId) {
    const usersCollection = db.collection('users');
    const podsCollection = db.collection('pods');
    
    if (!clientId) {
        const pods = await podsCollection.find().toArray();
        const status = {};
        pods.forEach(pod => {
            status[pod._id] = {
                visitors: pod.userCount,
                status: pod.status
            };
        });
        return { clusterStatus: status };
    }
    
    const user = await usersCollection.findOne({ _id: clientId });
    if (!user) {
        return { error: 'Usuario no encontrado' };
    }
    
    const currentPod = await podsCollection.findOne({ _id: user.currentPod });
    
    // DETECCIÓN REAL DE FALLOS
    if (!currentPod || currentPod.status !== 'running') {
        console.log(`🔴 Pod ${user.currentPod} caído para usuario ${clientId}`);
        
        // Reasignar a nuevo pod
        const newPodName = await assignUserToPod(clientId);
        const clusterStatus = await getClusterStatus();
        
        return {
            podName: newPodName,
            podVisitors: clusterStatus[newPodName].visitors,
            clusterStatus: clusterStatus,
            redirected: true
        };
    }
    
    // Estado normal
    const clusterStatus = await getClusterStatus();
    return {
        podName: user.currentPod,
        podVisitors: clusterStatus[user.currentPod].visitors,
        clusterStatus: clusterStatus
    };
}

async function getClusterStatus() {
    const pods = await db.collection('pods').find().toArray();
    const status = {};
    pods.forEach(pod => {
        status[pod._id] = {
            visitors: pod.userCount,
            status: pod.status
        };
    });
    return status;
}

app.use(express.json());
app.use(express.static('.'));

// Rutas
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

app.post('/api/connect', async (req, res) => {
    try {
        const { clientId } = req.body;
        const podName = await assignUserToPod(clientId);
        const clusterStatus = await getClusterStatus();
        
        res.json({
            podName: podName,
            podVisitors: clusterStatus[podName].visitors,
            clusterStatus: clusterStatus
        });
    } catch (error) {
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

// Endpoint administrativo MEJORADO
app.post('/api/admin/kill-pod', async (req, res) => {
    try {
        const { podName } = req.body;
        const podsCollection = db.collection('pods');
        const usersCollection = db.collection('users');
        
        // Verificar que el pod existe
        const pod = await podsCollection.findOne({ _id: podName });
        if (!pod) {
            return res.status(404).json({ error: 'Pod no encontrado' });
        }
        
        console.log(`🔴 Eliminando pod ${podName} con ${pod.userCount} usuarios`);
        
        // Marcar pod como terminado
        await podsCollection.updateOne(
            { _id: podName },
            { $set: { status: 'terminated', userCount: 0 } }
        );
        
        // Reasignar usuarios afectados
        const affectedUsers = await usersCollection.find({ currentPod: podName }).toArray();
        console.log(`↪ Reasignando ${affectedUsers.length} usuarios`);
        
        for (const user of affectedUsers) {
            await assignUserToPod(user._id);
        }
        
        const clusterStatus = await getClusterStatus();
        
        res.json({
            message: `Pod ${podName} eliminado`,
            affectedUsers: affectedUsers.length,
            clusterStatus: clusterStatus
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint para estado
app.get('/api/admin/status', async (req, res) => {
    try {
        const pods = await db.collection('pods').find().toArray();
        const users = await db.collection('users').find().toArray();
        
        const clusterStatus = {};
        pods.forEach(pod => {
            clusterStatus[pod._id] = {
                visitors: pod.userCount,
                status: pod.status
            };
        });
        
        res.json({
            clusterStatus: clusterStatus,
            totalUsers: users.length,
            pods: pods,
            users: users
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reset completo
app.post('/api/admin/reset', async (req, res) => {
    try {
        await db.collection('pods').deleteMany({});
        await db.collection('users').deleteMany({});
        
        await db.collection('pods').insertMany([
            { _id: 'pod-alpha', status: 'running', userCount: 0 },
            { _id: 'pod-beta', status: 'running', userCount: 0 },
            { _id: 'pod-gamma', status: 'running', userCount: 0 }
        ]);
        
        const clusterStatus = await getClusterStatus();
        res.json({
            message: 'Cluster reiniciado',
            clusterStatus: clusterStatus
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor MongoDB CORREGIDO en puerto ${PORT}`);
    });
});