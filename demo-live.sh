#!/bin/bash

echo "🐳 KUBERNETES LIVE DASHBOARD"
echo "============================="
echo "Demo en vivo - Mirá cómo responde el cluster!"
echo ""

while true; do
    clear
    
    # Obtener URL de la aplicación (si usás ngrok)
    echo "🌐 URL para alumnos: http://localhost:8080"
    echo "   (o la URL de ngrok si estás usando)"
    echo ""
    
    # PODS FÍSICOS DE KUBERNETES
    echo "🏗️  PODS FÍSICOS EN K8s:"
    echo "-----------------------"
    kubectl get pods -l app=pod-tracker -o wide | head -10
    
    # SERVICIOS
    echo ""
    echo "🌐 SERVICIOS:"
    echo "------------"
    kubectl get services -l app=pod-tracker
    
    # ESTADO DE LA APLICACIÓN (desde MongoDB)
    echo ""
    echo "📊 ESTADO DE LA APLICACIÓN:"
    echo "--------------------------"
    kubectl exec -it $(kubectl get pods -l app=mongo -o name | head -1) -- mongosh kubernetes-demo --quiet --eval "
    var pods = db.pods.find().toArray();
    var totalUsers = pods.reduce((sum, p) => sum + p.userCount, 0);
    
    pods.forEach(p => {
        var icon = p.status === 'running' ? '🟢' : '🔴';
        var current = p.userCount > 0 ? ' 👥' + p.userCount : '';
        print('   ' + icon + ' ' + p.name.padEnd(25) + p.status.padEnd(12) + current);
    });
    print('   📈 TOTAL USUARIOS: ' + totalUsers);
    " 2>/dev/null
    
    # COMANDOS DISPONIBLES
    echo ""
    echo "🎮 COMANDOS PARA DEMO:"
    echo "---------------------"
    echo "1.  Escalar a 5 pods:    kubectl scale deployment pod-tracker --replicas=5"
    echo "2.  Reducir a 2 pods:    kubectl scale deployment pod-tracker --replicas=2" 
    echo "3.  Eliminar un pod:     kubectl delete pod pod-tracker-XXXXX-XXXX"
    echo "4.  Ver logs:            kubectl logs -f deployment/pod-tracker"
    echo "5.  Eliminar TODOS:      kubectl delete pods -l app=pod-tracker"
    echo "6.  Resetear aplicación: curl -X POST http://localhost:8080/api/admin/restart-pods"
    echo ""
    echo "⏱️  Actualizando cada 3 segundos..."
    echo "🛑 Ctrl+C para salir"
    
    sleep 15
done