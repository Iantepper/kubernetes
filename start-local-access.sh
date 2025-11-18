#!/bin/bash

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔗 Iniciando acceso local a la aplicación...${NC}"
echo -e "${GREEN}🌐 La aplicación estará disponible en: http://localhost${NC}"
echo -e "${BLUE}⏹️  Presiona Ctrl+C para detener el acceso${NC}"

# Port-forward al service
kubectl port-forward service/pod-tracker-service 80:80