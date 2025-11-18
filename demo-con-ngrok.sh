#!/bin/bash

echo "🌐 DEMO KUBERNETES CON NGROK"
echo "============================="

# Verificar que ngrok está configurado
if ! ngrok config check &>/dev/null; then
    echo "❌ Ngrok no configurado. Seguí estos pasos:"
    echo "   1. Registrate en: https://dashboard.ngrok.com/signup"
    echo "   2. Obtené tu token en: https://dashboard.ngrok.com/get-started/your-authtoken" 
    echo "   3. Configuralo: ngrok config add-authtoken TU_TOKEN"
    exit 1
fi

# Iniciar aplicación
echo "🚀 Iniciando aplicación..."
kubectl port-forward service/pod-tracker-service 8080:80 &
APP_PID=$!

# Esperar y mostrar URL
sleep 3
echo ""
echo "✅ Aplicación corriendo en: http://localhost:8080"
echo ""
echo "🌐 EXPONIENDO A INTERNET CON NGROK..."
echo "   📢 COMPARTÍ ESTA URL CON LOS ALUMNOS:"
echo ""

# Iniciar ngrok
ngrok http 8080

# Limpiar
kill $APP_PID 2>/dev/null