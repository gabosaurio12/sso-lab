## Correr el proyecto

```
./init.sh
```

### Keycloak
```
KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin \
/opt/keycloak/bin/kc.sh start-dev \
  --http-port=8080 \
  --hostname=<LA_IP_DE_TU_VM> \
  --hostname-strict=false
```

### BFF

```
cd web-bff/
node index.js
```
