# SSO Seguro en Express

Este es el proyecto final de la Experiencia Educativa Aspectos de Seguridad, es un SSO Seguro en Express que muestra los datos de la cuenta.

## Tecnologías usadaas
- Nodejs
- Express
- Jwt
- Idp (Keycloak)
- Kali
- ZAP

## Notas
- HTTPS puede ser detectado como "No seguro" por los navegdores porque se usó un certificado propio firmado (self-signed)

## Pasos de ejecución

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
		- Valid redirect URIs: _https://<ip-vm>:3000/callback_
		- Web origins: _https://<ip-vm:3000_
5. En Users damos clic en Add user
6. Creamos un usuario

### BFF

```
cd web-bff/
node index.js
```

### Uso del proyecto
- Entrar por el navegador web a la dirección: _https://<ip-vm>:3000/login_
- Iniciar sesión con el usuario creado
- Se deben mostrar sus datos
