## Correr el proyecto

```
./init.sh
```

### Keycloak
```
KEYCLOAK_ADMIN=admin KEYCLOAK_ADMIN_PASSWORD=admin \
/opt/keycloak/bin/kc.sh start-dev \
  --http-port=8080 \
  --hostname=<IP-VM> \
  --hostname-strict=false
```
#### Pasos para crear el realm

1. Iniciar sesión como admin en Keycloak
2. Vamos a Manage Realms
3. Damos clic en Create Realm
- Name: demo
- Clic en create
4. Dentro de realm demo:
- Clic en Clients
- Clic en Create client
- Llenamos:
	- Client type: OpenID Connect
	- Client ID: web-app
	- Name: Web App BFF
	- Enabled: On
	- Next
	- Capability config
		- Client authentication: Off
		- Standard flow: On
		- Direct access grants: Off
		- Service accounts: Off
		- PKCE: ON
		- PKCE method: S256
	- Next
	- Login settings
		- Valid redirect URIs: https://<ip-vm>:3000/callback
		- Web origins: https://<ip-vm:3000
5. En Users damos clic en Add user
6. Creamos un usuario

### BFF

```
cd web-bff/
node index.js
```
