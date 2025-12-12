== Correr el proyecto

=== Keycloak
```
cd /opt/
wget https://github.com/keycloak/keycloak/releases/download/26.4.6/keycloak-26.4.6.zip
unzip keycloak-26.4.6.zip && mv keycloak-26.4.6.zip keycloak
sudo chown -R $USER:$USER /opt/keycloak
chmod -R 755 /opt/keycloak
KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin \
/opt/keycloak/bin/kc.sh start-dev \
  --http-port=8080 \
  --hostname=<LA_IP_DE_TU_VM> \
  --hostname-strict=false
```

=== BFF

```
cd web-bff/
node index.js
```
