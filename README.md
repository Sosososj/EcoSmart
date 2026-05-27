# EcoSmart - Sistema de Reciclaje Escolar Inteligente

## Descripción General

EcoSmart es un sistema completo de recolección de botellas reciclables diseñado específicamente para entornos escolares. Combina hardware IoT (ESP32-C3) con una aplicación web moderna para crear una experiencia gamificada que incentiva el reciclaje entre estudiantes.

## Características Principales

### 🏫 **Sistema Escolar Completo**
- Soporte para 6 grados: 6-1, 6-2, 6-3, 7-1, 7-2, 7-3
- Capacidad para 180+ estudiantes
- Códigos únicos de 4 dígitos por estudiante
- Sistema de puntos gamificado

### 🔧 **Hardware ESP32-C3**
- Detección automática de botellas con sensor ultrasónico
- Interfaz de usuario con LCD y teclado matricial
- Feedback inmediato con LEDs y buzzer
- Conectividad WiFi con reconexión automática
- Modo de ahorro de energía

### 🌐 **Aplicación Web Moderna**
- Interfaz responsive para todos los dispositivos
- Dashboard personalizado para estudiantes
- Ranking en tiempo real con filtros por grado
- Panel administrativo completo
- Acceso público como invitado

### 📊 **Funcionalidades en Tiempo Real**
- Sincronización automática con Firebase
- Estadísticas actualizadas instantáneamente
- Historial detallado de actividades
- Exportación de datos en CSV

## Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   ESP32-C3      │    │   Firebase      │    │  Aplicación Web │
│   Hardware      │◄──►│   Realtime DB   │◄──►│   (Bolt.new)    │
│                 │    │                 │    │                 │
│ • LCD Display   │    │ • Estudiantes   │    │ • Dashboard     │
│ • Teclado 4x4   │    │ • Estadísticas  │    │ • Ranking       │
│ • Sensor HC-SR04│    │ • Configuración │    │ • Admin Panel   │
│ • LEDs + Buzzer │    │ • Historial     │    │ • Exportación   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Instalación y Configuración

### 1. Configuración del Hardware

#### Componentes Requeridos:
- ESP32-C3 Development Board
- LCD I2C 16x2 (Dirección: 0x27)
- Teclado matricial 4x4
- Sensor ultrasónico HC-SR04
- 2 LEDs (Verde y Rojo) o 1 LED RGB
- Buzzer activo
- Resistencias y cables de conexión

#### Conexiones de Pines:
```
ESP32-C3 Pin    Componente
─────────────────────────────
GPIO 8          LCD SDA
GPIO 9          LCD SCL
GPIO 0-3        Keypad Rows
GPIO 4-7        Keypad Cols
GPIO 10         HC-SR04 Trig
GPIO 18         HC-SR04 Echo
GPIO 19         LED Verde
GPIO 20         LED Rojo
GPIO 21         Buzzer
```

#### Esquema de Conexión:
```
                    ESP32-C3
                 ┌─────────────┐
    LCD SDA ────►│ GPIO 8      │
    LCD SCL ────►│ GPIO 9      │
                 │             │
 Keypad R1 ────►│ GPIO 0      │
 Keypad R2 ────►│ GPIO 1      │
 Keypad R3 ────►│ GPIO 2      │
 Keypad R4 ────►│ GPIO 3      │
 Keypad C1 ────►│ GPIO 4      │
 Keypad C2 ────►│ GPIO 5      │
 Keypad C3 ────►│ GPIO 6      │
 Keypad C4 ────►│ GPIO 7      │
                 │             │
HC-SR04 Trig ──►│ GPIO 10     │
HC-SR04 Echo ──►│ GPIO 18     │
                 │             │
  LED Verde ───►│ GPIO 19     │
  LED Rojo ────►│ GPIO 20     │
  Buzzer ──────►│ GPIO 21     │
                 └─────────────┘
```

### 2. Configuración del Software

#### Arduino IDE:
1. Instalar ESP32 Board Package
2. Instalar librerías requeridas:
   - `LiquidCrystal_I2C`
   - `Keypad`
   - `ArduinoJson`
   - `WiFi` (incluida)
   - `HTTPClient` (incluida)

#### Configuración WiFi:
```cpp
const char* ssid = "TU_RED_WIFI";
const char* password = "TU_CONTRASEÑA_WIFI";
```


#### Datos de Ejemplo Incluidos:
- 10 estudiantes de muestra distribuidos en todos los grados
- Usuario administrador: `admin` / `EcoSmart2025!`
- Configuración inicial del sistema

### 4. Despliegue de la Aplicación Web

La aplicación está lista para desplegar en Bolt.new:

1. **Archivos principales:**
   - `index.html` - Página principal
   - `styles.css` - Estilos responsive
   - `app.js` - Lógica de la aplicación
   - `firebase-config.js` - Configuración de Firebase

2. **Funcionalidades:**
   - **Estudiantes:** Login con código de 4 dígitos
   - **Invitados:** Acceso público al ranking
   - **Administradores:** Panel completo de gestión

## Uso del Sistema

### Para Estudiantes:

1. **Depositar Botella:**
   - Acercarse al dispositivo EcoSmart
   - Ingresar código de 4 dígitos en el teclado
   - Esperar validación (LED verde)
   - Depositar botella en el sensor
   - Recibir confirmación de puntos

2. **Consultar Progreso:**
   - Acceder a la aplicación web
   - Seleccionar "Estudiante"
   - Ingresar código de 4 dígitos
   - Ver dashboard personalizado con:
     - Puntos actuales
     - Posición en ranking
     - Historial de actividades
     - Botellas necesarias para subir posiciones

### Para Invitados:

1. **Ver Ranking:**
   - Acceder a la aplicación web
   - Seleccionar "Acceso Invitado"
   - Explorar ranking general o por grado
   - Ver estadísticas globales del sistema

### Para Administradores:

1. **Gestión de Estudiantes:**
   - Login: `admin` / `EcoSmart2025!`
   - Agregar, editar o eliminar estudiantes
   - Asignar códigos únicos de 4 dígitos
   - Organizar por grados

2. **Análisis y Reportes:**
   - Ver estadísticas detalladas
   - Analizar progreso por grado
   - Exportar datos en formato CSV
   - Configurar parámetros del sistema

## Estructura de la Base de Datos

```json
{
  "students": {
    "1001": {
      "nombre": "Ana García López",
      "grado": "6-1",
      "puntos": 15,
      "historial": {
        "2025-01-15T10:30:00Z": 1,
        "2025-01-16T11:45:00Z": 1
      }
    }
  },
  "admins": {
    "admin1": {
      "usuario": "admin",
      "contraseña": "EcoSmart2025!"
    }
  },
  "config": {
    "puntosPorBotella": 1
  }
}
```

## Seguridad y Validaciones

### Seguridad del Hardware:
- Validación de códigos de estudiante
- Timeout automático para ahorro de energía
- Reconexión automática WiFi
- Manejo de errores robusto

### Seguridad Web:
- Sanitización de todos los inputs
- Validación cliente y servidor
- Autenticación segura para administradores
- Protección contra inyecciones

### Reglas de Firebase:
```json
{
  "rules": {
    "students": {
      ".read": true,
      ".write": "auth != null"
    },
    "admins": {
      ".read": "auth != null",
      ".write": "auth != null"
    },
    "config": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

## Mantenimiento y Soporte

### Monitoreo del Sistema:
- Logs automáticos en Serial Monitor
- Indicadores LED de estado
- Mensajes de error descriptivos en LCD

### Actualizaciones:
- Configuración remota de puntos por botella
- Actualización OTA del firmware (opcional)
- Backup automático de datos

### Solución de Problemas:

#### Hardware:
- **LCD no enciende:** Verificar conexiones I2C y alimentación
- **Teclado no responde:** Revisar conexiones de filas y columnas
- **Sensor no detecta:** Limpiar sensor y verificar distancia
- **WiFi no conecta:** Verificar credenciales y señal

#### Software:
- **Error de Firebase:** Verificar URL y conectividad
- **Estudiante no encontrado:** Verificar código en base de datos
- **Datos no se actualizan:** Revisar permisos de Firebase

## Escalabilidad

### Múltiples Dispositivos:
- Cada ESP32-C3 puede operar independientemente
- Base de datos centralizada para todos los dispositivos
- Sincronización automática en tiempo real

### Expansión del Sistema:
- Fácil adición de nuevos grados
- Capacidad ilimitada de estudiantes
- Integración con otros sistemas escolares

## Especificaciones Técnicas

### Hardware:
- **Microcontrolador:** ESP32-C3 (160MHz, WiFi integrado)
- **Memoria:** 400KB SRAM, 4MB Flash
- **Conectividad:** WiFi 802.11 b/g/n
- **Sensores:** HC-SR04 (2-400cm, ±3mm precisión)
- **Display:** LCD 16x2 I2C
- **Entrada:** Teclado matricial 4x4
- **Salida:** 2 LEDs + Buzzer activo

### Software:
- **Framework:** Arduino Core para ESP32
- **Base de Datos:** Firebase Realtime Database
- **Frontend:** JavaScript Vanilla + HTML5 + CSS3
- **Comunicación:** HTTP/HTTPS REST API
- **Formato de Datos:** JSON

### Rendimiento:
- **Tiempo de respuesta:** < 2 segundos
- **Detección de botellas:** < 1 segundo
- **Sincronización:** Tiempo real
- **Autonomía:** 24/7 con alimentación externa

## Licencia y Créditos

### Desarrollado por:
- **Sistema IoT:** ESP32-C3 + Arduino
- **Base de Datos:** Firebase Realtime Database
- **Aplicación Web:** JavaScript Vanilla
- **Diseño UI/UX:** CSS3 + Font Awesome

### Licencia:
Este proyecto está diseñado para uso educativo y puede ser modificado según las necesidades específicas de cada institución.

---

**EcoSmart - Transformando el reciclaje escolar a través de la tecnología** 🌱♻️
