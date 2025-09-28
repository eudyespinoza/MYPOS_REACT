# 📋 API de Facturación AFIP - Documentación de Integración

## 🎯 Información General

**Endpoint Principal:** `POST http://localhost:8003/v1/invoices`

**Descripción:** Microservicio para emitir facturas electrónicas a través de AFIP usando WSFEv1.

**Estado:** ✅ Operativo con autonumeración automática y CAE simulado

---

## 🔐 Autenticación

### Token API Requerido
```http
X-API-TOKEN: 0AnwkC_GgkBvUi6q3DF1fy2L_2d-fwOxNT8M4YHGdHc
```

### Headers Obligatorios
```http
Content-Type: application/json
X-API-TOKEN: 0AnwkC_GgkBvUi6q3DF1fy2L_2d-fwOxNT8M4YHGdHc
Idempotency-Key: clave-unica-por-factura
```

---

## 📄 Estructura del JSON de Facturación

### Payload Completo

```json
{
    "schema": "wsfe.envelope",
    "schema_version": "1",
    "op": "authorize",
    "idempotency_key": "GENERAR_UNICO_POR_FACTURA",
    "tenant": {
        "tenant_id": "test",
        "cuit_emisor": 20232383403,
        "env": "homo",
        "credential_ref": "mi_certificado"
    },
    "trace": {
        "request_id": "GENERAR_UNICO_POR_REQUEST",
        "created_at": "2025-09-22T12:00:00Z",
        "source": "mi_aplicacion"
    },
    "afip": {
        "wsfev1": {
            "FeCabReq": {
                "CantReg": 1,
                "PtoVta": 524,
                "CbteTipo": 6
            },
            "FeDetReq": [
                {
                    "Concepto": 1,
                    "DocTipo": 96,
                    "DocNro": "0",
                    "CbteDesde": "0",
                    "CbteHasta": "0",
                    "CbteFch": "20250922",
                    "ImpTotal": 121.00,
                    "ImpTotConc": 0.00,
                    "ImpNeto": 100.00,
                    "ImpOpEx": 0.00,
                    "ImpIVA": 21.00,
                    "ImpTrib": 0.00,
                    "MonId": "PES",
                    "MonCotiz": 1.00,
                    "Iva": [
                        {
                            "Id": 5,
                            "BaseImp": 100.00,
                            "Importe": 21.00
                        }
                    ]
                }
            ]
        }
    }
}
```

---

## 📝 Campos Personalizables

### 🔄 Campos Dinámicos (cambiar en cada factura)

| Campo | Descripción | Ejemplo | Formato | Obligatorio |
|-------|-------------|---------|---------|-------------|
| `idempotency_key` | Clave única por factura | `"factura-001-20250922"` | String | ✅ |
| `trace.request_id` | ID único por request | `"req-12345-20250922"` | String | ✅ |
| `trace.created_at` | Timestamp actual | `"2025-09-22T15:30:00Z"` | ISO 8601 | ✅ |
| `trace.source` | Origen de la petición | `"mi_aplicacion"` | String | ✅ |
| `FeDetReq[0].DocNro` | **NIF del cliente** | `"20123456789"` (CUIT) o `"0"` (cons. final) | String | ✅ |
| `FeDetReq[0].CbteFch` | Fecha factura | `"20250922"` | YYYYMMDD | ✅ |
| `FeDetReq[0].ImpTotal` | Importe total | `121.00` | Decimal | ✅ |
| `FeDetReq[0].ImpNeto` | Importe neto (sin IVA) | `100.00` | Decimal | ✅ |
| `FeDetReq[0].ImpIVA` | Importe IVA | `21.00` | Decimal | ✅ |
| `Iva[0].BaseImp` | Base imponible IVA | `100.00` | Decimal | ✅ |
| `Iva[0].Importe` | Importe IVA | `21.00` | Decimal | ✅ |

### 🔢 Autonumeración Automática
- **`CbteDesde: "0"`** y **`CbteHasta: "0"`** → El sistema asigna automáticamente el número de comprobante
- No modificar estos campos para usar la autonumeración

### 🏢 Campos de Configuración (mantener fijos)
- `tenant.tenant_id: "test"` - Tenant configurado
- `tenant.cuit_emisor: 20232383403` - CUIT emisor
- `tenant.env: "homo"` - Ambiente de homologación

### 📋 Campos con Lógica Específica

| Campo | Valor Actual | Descripción | Estado |
|-------|--------------|-------------|--------|
| `DocNro` | `"0"` | **NIF del cliente** - Número de identificación fiscal del comprador | 🔄 Configurar según cliente |
| `DocTipo` | `96` | Tipo de documento del cliente (96 = DNI, 80 = CUIT, etc.) | 🔧 Forzado, se definirá lógica |
| `CbteTipo` | `6` | Tipo de comprobante (6 = Factura B, 1 = Factura A, etc.) | 🔧 Forzado, se definirá lógica |
| `PtoVta` | `524` | Punto de venta autorizado en AFIP | 🔧 Forzado, se definirá lógica |

### 📝 Notas Importantes sobre Campos

#### 🆔 DocNro (NIF del Cliente)
- **Definición**: Número de Identificación Fiscal del cliente que recibe la factura
- **Uso actual**: Se envía como `"0"` (consumidor final)
- **Uso futuro**: Debe contener el DNI, CUIT o documento del cliente
- **Ejemplos**:
  - DNI: `"12345678"`
  - CUIT: `"20123456789"`
  - Consumidor final: `"0"`

#### 🧾 CbteTipo (Tipo de Comprobante)
- **Valor actual**: `6` (Factura B - forzado)
- **Estado**: Configuración temporal, se implementará lógica de negocio
- **Valores comunes**:
  - `1` = Factura A
  - `6` = Factura B  
  - `11` = Factura C
  - `51` = Factura M

#### 📄 DocTipo (Tipo de Documento del Cliente)
- **Valor actual**: `96` (DNI - forzado)
- **Estado**: Configuración temporal, se implementará lógica de negocio
- **Valores comunes**:
  - `80` = CUIT
  - `86` = CUIL
  - `96` = DNI
  - `99` = Consumidor Final

#### 🏪 PtoVta (Punto de Venta)
- **Valor actual**: `524` (forzado)
- **Estado**: Configuración temporal, se definirá lógica por origen
- **Descripción**: Punto de venta autorizado por AFIP para emitir comprobantes

---

## 💻 Ejemplos de Código

### 📱 JavaScript/TypeScript

```javascript
async function facturarAFIP(datosFactura) {
    const ahora = new Date();
    const fechaFactura = ahora.toISOString().slice(0,10).replace(/-/g, ''); // YYYYMMDD
    
    const payload = {
        schema: "wsfe.envelope",
        schema_version: "1",
        op: "authorize",
        idempotency_key: `factura-${Date.now()}`,
        tenant: {
            tenant_id: "test",
            cuit_emisor: 20232383403,
            env: "homo",
            credential_ref: "mi_certificado"
        },
        trace: {
            request_id: `req-${Math.random().toString(36).substr(2, 9)}`,
            created_at: ahora.toISOString(),
            source: "mi_aplicacion"
        },
        afip: {
            wsfev1: {
                FeCabReq: {
                    CantReg: 1,
                    PtoVta: 524,        // TODO: Se definirá lógica por origen
                    CbteTipo: 6         // TODO: Se definirá lógica (6=Factura B)
                },
                FeDetReq: [{
                    Concepto: 1,
                    DocTipo: 96,        // TODO: Se definirá lógica (96=DNI, 80=CUIT)
                    DocNro: datosFactura.nif_cliente || "0", // NIF del cliente
                    CbteDesde: "0",     // Autonumeración automática
                    CbteHasta: "0",     // Autonumeración automática
                    CbteFch: fechaFactura,
                    ImpTotal: datosFactura.total,
                    ImpTotConc: 0.00,
                    ImpNeto: datosFactura.neto,
                    ImpOpEx: 0.00,
                    ImpIVA: datosFactura.iva,
                    ImpTrib: 0.00,
                    MonId: "PES",
                    MonCotiz: 1.00,
                    Iva: [{
                        Id: 5,
                        BaseImp: datosFactura.neto,
                        Importe: datosFactura.iva
                    }]
                }]
            }
        }
    };

    const response = await fetch('http://localhost:8003/v1/invoices', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-TOKEN': '0AnwkC_GgkBvUi6q3DF1fy2L_2d-fwOxNT8M4YHGdHc',
            'Idempotency-Key': `factura-${Date.now()}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
    }

    return await response.json();
}

// Ejemplo de uso con NIF del cliente
const datosFactura = {
    total: 121.00,
    neto: 100.00,
    iva: 21.00,
    nif_cliente: "20123456789"  // CUIT del cliente (opcional, "0" para consumidor final)
};

try {
    const resultado = await facturarAFIP(datosFactura);
    console.log('✅ Factura creada exitosamente:', resultado);
    // resultado.cbte_nro = número de comprobante
    // resultado.cae = código de autorización
    // resultado.cae_vto = fecha vencimiento CAE
} catch (error) {
    console.error('❌ Error al facturar:', error);
}
```

### 🐍 Python

```python
import requests
import json
from datetime import datetime
import time
import uuid

def facturar_afip(datos_factura):
    """
    Envía una factura al microservicio AFIP
    
    Args:
        datos_factura (dict): {
            "total": 121.00,
            "neto": 100.00, 
            "iva": 21.00,
            "nif_cliente": "20123456789"  # NIF del cliente (opcional)
        }
    
    Returns:
        dict: Respuesta de la API con CAE y número de comprobante
    """
    ahora = datetime.now()
    fecha_factura = ahora.strftime("%Y%m%d")
    
    payload = {
        "schema": "wsfe.envelope",
        "schema_version": "1",
        "op": "authorize",
        "idempotency_key": f"factura-{int(time.time())}",
        "tenant": {
            "tenant_id": "test",
            "cuit_emisor": 20232383403,
            "env": "homo",
            "credential_ref": "mi_certificado"
        },
        "trace": {
            "request_id": str(uuid.uuid4()),
            "created_at": ahora.isoformat() + "Z",
            "source": "mi_aplicacion"
        },
        "afip": {
            "wsfev1": {
                "FeCabReq": {
                    "CantReg": 1,
                    "PtoVta": 524,      # TODO: Se definirá lógica por origen
                    "CbteTipo": 6       # TODO: Se definirá lógica (6=Factura B)
                },
                "FeDetReq": [{
                    "Concepto": 1,
                    "DocTipo": 96,      # TODO: Se definirá lógica (96=DNI, 80=CUIT)
                    "DocNro": datos_factura.get("nif_cliente", "0"),  # NIF del cliente
                    "CbteDesde": "0",   # Autonumeración automática
                    "CbteHasta": "0",   # Autonumeración automática
                    "CbteFch": fecha_factura,
                    "ImpTotal": datos_factura["total"],
                    "ImpTotConc": 0.00,
                    "ImpNeto": datos_factura["neto"],
                    "ImpOpEx": 0.00,
                    "ImpIVA": datos_factura["iva"],
                    "ImpTrib": 0.00,
                    "MonId": "PES",
                    "MonCotiz": 1.00,
                    "Iva": [{
                        "Id": 5,
                        "BaseImp": datos_factura["neto"],
                        "Importe": datos_factura["iva"]
                    }]
                }]
            }
        }
    }
    
    headers = {
        'Content-Type': 'application/json',
        'X-API-TOKEN': '0AnwkC_GgkBvUi6q3DF1fy2L_2d-fwOxNT8M4YHGdHc',
        'Idempotency-Key': f'factura-{int(time.time())}'
    }
    
    response = requests.post(
        'http://localhost:8003/v1/invoices',
        headers=headers,
        json=payload,
        timeout=30
    )
    
    response.raise_for_status()
    return response.json()

# Ejemplo de uso con NIF del cliente
if __name__ == "__main__":
    # Ejemplo 1: Cliente con CUIT
    datos_factura_empresa = {
        "total": 121.00,
        "neto": 100.00,
        "iva": 21.00,
        "nif_cliente": "20123456789"  # CUIT del cliente empresa
    }
    
    # Ejemplo 2: Consumidor final
    datos_factura_consumidor = {
        "total": 121.00,
        "neto": 100.00,
        "iva": 21.00,
        "nif_cliente": "0"  # Consumidor final
    }
    
    try:
        resultado = facturar_afip(datos_factura_empresa)
        print("✅ Factura creada exitosamente:")
        print(f"   📄 Número: {resultado['cbte_nro']}")
        print(f"   🔐 CAE: {resultado['cae']}")
        print(f"   📅 Vencimiento: {resultado['cae_vto']}")
        print(f"   🆔 ID: {resultado['invoice_id']}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Error al facturar: {e}")
```

### 🌐 cURL (para testing)

```bash
curl --location 'http://localhost:8003/v1/invoices' \
--header 'X-API-TOKEN: 0AnwkC_GgkBvUi6q3DF1fy2L_2d-fwOxNT8M4YHGdHc' \
--header 'Content-Type: application/json' \
--header 'Idempotency-Key: test-20250922-001' \
--data '{
    "schema": "wsfe.envelope",
    "schema_version": "1",
    "op": "authorize",
    "idempotency_key": "factura-test-20250922",
    "tenant": {
        "tenant_id": "test",
        "cuit_emisor": 20232383403,
        "env": "homo",
        "credential_ref": "mi_certificado"
    },
    "trace": {
        "request_id": "req-test-001",
        "created_at": "2025-09-22T12:00:00Z",
        "source": "curl_test"
    },
    "afip": {
        "wsfev1": {
            "FeCabReq": {
                "CantReg": 1,
                "PtoVta": 524,
                "CbteTipo": 6
            },
            "FeDetReq": [{
                "Concepto": 1,
                "DocTipo": 96,
                "DocNro": "0",
                "CbteDesde": "0",
                "CbteHasta": "0",
                "CbteFch": "20250922",
                "ImpTotal": 121.00,
                "ImpTotConc": 0.00,
                "ImpNeto": 100.00,
                "ImpOpEx": 0.00,
                "ImpIVA": 21.00,
                "ImpTrib": 0.00,
                "MonId": "PES",
                "MonCotiz": 1.00,
                "Iva": [{
                    "Id": 5,
                    "BaseImp": 100.00,
                    "Importe": 21.00
                }]
            }]
        }
    }
}'
```

---

## 📤 Respuesta de la API

### ✅ Respuesta Exitosa (HTTP 200)

```json
{
    "invoice_id": "5a2c9190-1897-4a16-a43d-99a6ca31c082",
    "status": "APPROVED",
    "cbte_nro": "15",
    "cae": "64467183668225",
    "cae_vto": "20251002"
}
```

### 📋 Descripción de Campos de Respuesta

| Campo | Descripción | Ejemplo | Tipo |
|-------|-------------|---------|------|
| `invoice_id` | ID único de la factura en el sistema | `"5a2c9190-1897-4a16-a43d-99a6ca31c082"` | UUID |
| `status` | Estado de la factura | `"APPROVED"` o `"ERROR"` | String |
| `cbte_nro` | Número de comprobante asignado | `"15"` | String |
| `cae` | Código de Autorización Electrónico | `"64467183668225"` | String (14 dígitos) |
| `cae_vto` | Fecha de vencimiento del CAE | `"20251002"` | String (YYYYMMDD) |

### ❌ Respuesta de Error (HTTP 4xx/5xx)

```json
{
    "detail": "Descripción del error",
    "error_code": "VALIDATION_ERROR",
    "timestamp": "2025-09-22T15:30:00Z"
}
```

---

## ⚠️ Consideraciones Importantes

### 🔑 Seguridad
- **Token único**: Cada instalación debe tener su propio token API
- **HTTPS**: En producción usar HTTPS siempre
- **Rate limiting**: Respetar límites de velocidad de requests

### 🔄 Idempotencia
- **Clave única**: Usar `idempotency_key` diferente para cada factura
- **Prevención duplicados**: El sistema rechazará keys duplicadas
- **Formato sugerido**: `"factura-{timestamp}"` o `"factura-{id_interno}"`

### 📅 Formatos de Fecha
- **CbteFch**: Formato `YYYYMMDD` (ej: `"20250922"`)
- **created_at**: Formato ISO 8601 con Z (ej: `"2025-09-22T15:30:00Z"`)
- **Zona horaria**: UTC recomendado

### 💰 Formatos Numéricos
- **Decimales**: Usar punto (.) como separador decimal
- **Precisión**: Máximo 2 decimales para importes
- **Consistencia**: `ImpTotal = ImpNeto + ImpIVA`

### 🆔 Configuración de Cliente (NIF)
- **DocNro**: Debe contener el **NIF (Número de Identificación Fiscal)** del cliente
- **Valores válidos**:
  - `"0"` = Consumidor final (sin identificación)
  - `"12345678"` = DNI (8 dígitos)
  - `"20123456789"` = CUIT (11 dígitos)
  - `"27123456784"` = CUIL (11 dígitos)
- **DocTipo**: Debe corresponder con el tipo de DocNro
  - `96` = DNI
  - `80` = CUIT
  - `86` = CUIL
  - `99` = Consumidor Final

### 🏢 Configuración Temporal
- **CbteTipo**: Actualmente forzado a `6` (Factura B) - se definirá lógica de negocio
- **DocTipo**: Actualmente forzado a `96` (DNI) - se definirá lógica de negocio  
- **PtoVta**: Actualmente forzado a `524` - se definirá lógica por origen

### 🔢 Autonumeración
- **CbteDesde/CbteHasta**: Mantener en `"0"` para autonumeración
- **Secuencial**: El sistema incrementa automáticamente por punto de venta
- **Persistente**: Los números se guardan en base de datos

---

## 🏗️ Arquitectura del Sistema

### 🎯 Estado Actual
- **✅ Operativo**: Sistema v1 completamente funcional
- **🔢 Autonumeración**: Gestión automática de secuencias
- **🔄 Fallback**: CAE simulado cuando AFIP no está disponible
- **📦 Docker**: Ambiente containerizado
- **🗄️ PostgreSQL**: Base de datos persistente

### 🌐 Endpoints Disponibles
- `POST /v1/invoices` - Emitir factura (principal)
- `GET /health` - Estado del servicio
- `GET /docs` - Documentación Swagger

### 🔧 Configuración Técnica
- **Puerto**: 8003
- **Base URL**: `http://localhost:8003`
- **Ambiente**: Homologación AFIP
- **Tenant**: `test`
- **Punto de Venta**: 524

---

## 📞 Soporte y Resolución de Problemas

### ❓ Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Invalid API token` | Token incorrecto | Verificar X-API-TOKEN |
| `Validation error` | JSON malformado | Revisar estructura del payload |
| `Duplicate idempotency key` | Clave repetida | Usar clave única por factura |
| `Date format error` | Fecha incorrecta | Usar formato YYYYMMDD |

### 🔍 Debug
1. Verificar que el servicio esté ejecutándose: `docker ps`
2. Revisar logs del contenedor: `docker logs docker-api-1`
3. Validar connectivity: `curl http://localhost:8003/health`
4. Verificar formato JSON con herramientas online

### 📊 Monitoreo
- **Logs**: Disponibles en `docker logs docker-api-1`
- **Métricas**: Estado del servicio via `/health`
- **Base de datos**: Secuencias en tabla `sequences`

---

## 🚀 Próximos Pasos

### Para Desarrollo
1. ✅ Integrar con tu aplicación usando los ejemplos de código
2. ✅ Implementar manejo de errores robusto
3. ✅ Agregar logging de transacciones
4. ✅ Crear tests unitarios

### Para Producción
1. 🔄 Obtener certificados reales de AFIP
2. 🔄 Configurar HTTPS/TLS
3. 🔄 Implementar rate limiting
4. 🔄 Configurar monitoring avanzado
5. 🔄 Backup de base de datos

---

## 📝 Changelog

### v1.0.0 (2025-09-22)
- ✅ Integración completa WSFEv1
- ✅ Autonumeración automática
- ✅ CAE simulado para desarrollo
- ✅ API REST documentada
- ✅ Docker containerizado
- ✅ Base de datos PostgreSQL

---

**📧 Contacto:** Para soporte técnico o consultas sobre la integración.

**🔗 Recursos:**
- [Documentación AFIP WSFEv1](https://www.afip.gob.ar/ws/documentacion/ws-facturacion.asp)
- [Postman Collection](./afip-invoicing-service.postman_collection.json)

---

*Generado automáticamente - Fecha: 2025-09-22*