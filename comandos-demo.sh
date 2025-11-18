#!/bin/bash

echo "🚀 COMANDOS RÁPIDOS PARA DEMO"
echo "1 - Escalar a 5 pods"
echo "2 - Reducir a 2 pods" 
echo "3 - Eliminar un pod aleatorio"
echo "4 - Eliminar TODOS los pods"
echo "5 - Resetear aplicación"
echo "6 - Ver logs en tiempo real"
echo "q - Salir"

while true; do
    read -p "Selecciona opción: " choice
    
    case $choice in
        1)
            echo "📈 Escalando a 5 pods..."
            kubectl scale deployment pod-tracker --replicas=5
            ;;
        2)
            echo "📉 Reduciendo a 2 pods..."
            kubectl scale deployment pod-tracker --replicas=2
            ;;
        3)
            echo "🎯 Eliminando pod aleatorio..."
            kubectl delete pod $(kubectl get pods -l app=pod-tracker -o name | shuf -n 1)
            ;;
        4)
            echo "💥 Eliminando TODOS los pods..."
            kubectl delete pods -l app=pod-tracker
            ;;
        5)
            echo "🔄 Reseteando aplicación..."
            curl -X POST http://localhost:8080/api/admin/restart-pods -H "Content-Type: application/json"
            ;;
        6)
            echo "📋 Mostrando logs..."
            kubectl logs -f deployment/pod-tracker
            ;;
        q)
            echo "👋 Saliendo..."
            exit 0
            ;;
        *)
            echo "❌ Opción inválida"
            ;;
    esac
    
    echo ""
done