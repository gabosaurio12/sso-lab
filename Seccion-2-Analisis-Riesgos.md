# 2) Análisis de riesgos (antes de construir)
Fecha: 2025-11-19

## 2.1 Activos y datos
- **A1 – Identidad del usuario (credenciales, sesión IdP)**: sesión mantenida en cookie `session` con `httpOnly`, `secure` y `sameSite=lax`, vinculada al flujo de login/callback del BFF. 
- **A2 – Tokens OIDC (ID/Access/Refresh)**: se almacenan en la sesión tras el callback para reutilizarlos en vistas y llamadas API. 
- **A3 – Datos personales básicos (email, nombre)**: se obtienen del ID Token y se renderizan en la vista de perfil. 
- **A4 – API protegida (endpoints, lógica de negocio)**: endpoint `/api/perfil` requiere `Authorization: Bearer` y consulta `userinfo` con el access token. 
- **A5 – Infraestructura (VM, SO, red, servicios)**: BFF Node.js expuesto en HTTPS local con certificados PEM; el IdP se descubre por la URL de entorno (`ISSUER`) y el tráfico hacia él es HTTP.
> Referencia rápida de propietarios/criticidad: ver `assets.yml` en la raíz del repo.

## 2.2 Contexto y supuestos
- **Uso docente y red interna**: el BFF activa `trust proxy` y levanta un servidor HTTPS local con certificados propios, pensado para laboratorio sin exposición pública. 
- **IdP centralizado (Keycloak)**: el cliente OIDC se descubre con `Issuer.discover` y se registra como *public client* (`token_endpoint_auth_method: "none"`). 
- **Gestión de sesión y correlación en el BFF**: `/login` genera `code_verifier`, `code_challenge` (S256), `state` y `nonce`; `/callback` reaprovecha esos valores desde la sesión para canjear el código. 
- **Validación del access token por `userinfo`**: la API integrada usa `client.userinfo(accessToken)` y devuelve el JSON resultante; no hay validación local de firma. 
- **Canales actuales**: navegador↔BFF por HTTPS (certificados locales); BFF/API↔Keycloak según `ISSUER` (HTTP en este laboratorio). 
## 2.3 DFD (Data Flow Diagram) y fronteras de confianza

flowchart TD

  %% ============================
  %% FRONTERA 1: USUARIO
  %% ============================
  subgraph F1["Frontera Usuario"]
    U[Browser]
  end

  %% ============================
  %% FRONTERA 2: BFF (SERVIDOR SEGURO)
  %% ============================
  subgraph F2["Frontera BFF Entorno Confiable HTTPS"]
    APP[App Express login callback perfil]
    API[Router api perfil]
    S[(Session Store PKCE tokens OIDC claims)]
    JWK[(JWKS firma JWT app)]
  end

  %% ============================
  %% FRONTERA 3: IDP (RED NO CONFIABLE)
  %% ============================
  subgraph F3["Frontera IdP Red No Confiable HTTP"]
    KC[OIDC Provider]
  end


  %% Browser ↔ BFF
  U -->| GET login con state y nonce| APP
  APP -->|Guardar PKCE y state| S

  U -->|GET callback con code y state| APP
  APP -->|Token exchange HTTP| KC

  APP -->|Guardar tokens y claims| S
  APP -->|Emitir JWT app| U


  %% Perfil
  U -->|GET perfil con JWT app| APP
  APP -->|Validar firma JWT| JWK


  %% API protegida
  U -->|GET api perfil con JWT app| API
  API -->|Validar JWT app| JWK
  API -->|Userinfo con AT| KC


  %% Sesion
  APP <-->|Acceso a sesion| S
  API <-->|Acceso a sesion| S


  %% Keycloak
  APP -->|Discovery HTTP| KC
  APP -->|Auth Request PKCE HTTP| KC
  APP -->|Token Exchange HTTP| KC


**Fronteras reales**
- **Navegador ↔ BFF/API**: comunicación protegida mediante **HTTPS** con certificados locales; las cookies se envían con `secure`, `httpOnly` y `sameSite=lax`, y dentro de esta frontera el BFF puede emitir y validar **JWT de aplicación**.
- **BFF/API ↔ IdP**: la conexión sigue el esquema definido en `ISSUER`; si es **HTTPS**, el flujo OIDC viaja cifrado, y si es **HTTP**, el intercambio de metadatos, códigos y tokens ocurre sin protección TLS.


## 2.4 Modelo de amenazas (STRIDE)
| Categoría | Ejemplo en este sistema | Evidencia | Controles propuestos (basados en código actual) |
| --- | --- | --- | --- |
| Spoofing | Suplantar sesión o token sin correlación | Generación/uso de `state` y `nonce` en `/login` y `/callback`. | Fortalecer MFA en fase 2; forzar validación de `iss/aud/exp/nonce` del ID Token antes de usarlo.  |
| Tampering | Modificar código/tokens en tránsito IdP↔BFF | `ISSUER` apunta a HTTP; los flujos OIDC y `userinfo` viajan sin TLS. | Migrar a HTTPS (fase 2 con Nginx+Certbot); validar hash `code_challenge` en IdP y registrar redirect URIs exactas. |
| Repudiation | Usuario niega acciones | El BFF y la API no registran auditoría de llamadas ni `sub/jti`. | Añadir logging firmado con correlación de `sub` y `state`, y retención WORM para revisiones.  |
| Information Disclosure | Fuga de tokens o datos personales | Tokens se guardan en sesión; `userinfo` e ID Token incluyen email/nombre. | Evitar loguear tokens; aplicar mínimos scopes y activar HTTPS extremo a extremo; limpiar sesión al cerrar.  |
| DoS | Caída del servicio por fallo de IdP | `initOidcClient` termina el proceso con `process.exit(1)` si falla la discovery. | Implementar reintentos y circuit breaker; health checks para reinicios controlados.  |
| Elevation of Privilege | Uso de API sin validar firma del access token | `/api/perfil` usa `client.userinfo` pero no verifica JWKS localmente; depende de llamada HTTP. | Validar JWT localmente (RS256 + JWKS); limitar roles/claims antes de responder; añadir rate limiting. |

## 2.5 Matriz de riesgos

| ID | Amenaza | Activo | P | I | Riesgo | Controles (ASVS/OAuth/OIDC) | Mitigacion|
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Intercepción o manipulación del code/token en IdP↔BFF (HTTP) | A2 | 4 | 4 | 16 | Migrar a HTTPS (V1), PKCE+state/nonce estrictos (RFC 7636), redirect URIs exactas (OAuth 2.1). | `ISSUER` HTTP y uso de PKCE/state/nonce.  |
| R2 | Access token manipulado sin validación de firma local | A2/A4 | 3 | 4 | 12 | Validar RS256+JWKS (V2), verificar `aud/exp` antes de `userinfo`, cache de JWKS. | `/api/perfil` confía en `client.userinfo` sin validar JWT.  |
| R3 | Fuga de tokens/datos por captura de sesión | A1/A2/A3 | 3 | 4 | 12 | HTTPS extremo (V3), políticas de expiración corta y regeneración de sesión tras login, no loguear tokens. | Tokens en sesión y logging del callback.  |
| R4 | Caída del BFF si falla discovery del IdP | A5 | 3 | 3 | 9 | Reintentos con backoff, circuit breaker y healthchecks (V1 Disponibilidad). | `process.exit(1)` ante error en `initOidcClient`.  |
| R5 | Bypass o error en API por cliente OIDC no inicializado | A4 | 3 | 2 | 6 | Validar `req.client` y proteger acceso con middleware dedicado; pruebas negativas. | Chequeo `req.client` y dependencia de variable global.  |
| R6 | Falta de trazabilidad/auditoría | A1/A4 | 2 | 3 | 6 | Logging firmado con `sub`, `jti`, `state` (V2, V3); correlación en reverse proxy. | Ausencia de logs de seguridad en rutas principales.  |
