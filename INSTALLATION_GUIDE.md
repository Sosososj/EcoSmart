# Guía de Instalación EcoSmart

## Instalación Paso a Paso

### 1. Preparación del Hardware

#### Lista de Materiales:
```
□ ESP32-C3 Development Board
□ LCD I2C 16x2 (Dirección 0x27)
□ Teclado matricial 4x4
□ Sensor ultrasónico HC-SR04
□ 2 LEDs (Verde y Rojo)
□ Buzzer activo 5V
□ Resistencias: 2x 220Ω (para LEDs)
□ Protoboard o PCB
□ Cables jumper macho-macho y macho-hembra
□ Fuente de alimentación 5V/2A
□ Carcasa protectora (opcional)
```

#### Herramientas Necesarias:
```
□ Soldador y estaño
□ Alicates pelacables
□ Multímetro
□ Destornilladores
□ Computadora con Arduino IDE
```

### 2. Ensamblaje del Hardware

#### Paso 1: Preparar la Protoboard
1. Colocar el ESP32-C3 en el centro de la protoboard
2. Conectar las líneas de alimentación (VCC y GND)
3. Verificar continuidad con multímetro

#### Paso 2: Conectar el LCD I2C
```
LCD I2C    →    ESP32-C3
VCC        →    3.3V
GND        →    GND
SDA        →    GPIO 8
SCL        →    GPIO 9
```

#### Paso 3: Conectar el Teclado Matricial
```
Teclado    →    ESP32-C3
Fila 1     →    GPIO 0
Fila 2     →    GPIO 1
Fila 3     →    GPIO 2
Fila 4     →    GPIO 3
Columna 1  →    GPIO 4
Columna 2  →    GPIO 5
Columna 3  →    GPIO 6
Columna 4  →    GPIO 7
```

#### Paso 4: Conectar el Sensor HC-SR04
```
HC-SR04    →    ESP32-C3
VCC        →    5V
GND        →    GND
Trig       →    GPIO 10
Echo       →    GPIO 18
```

#### Paso 5: Conectar LEDs y Buzzer
```
Componente     →    ESP32-C3
LED Verde (+)  →    GPIO 19 → Resistencia 220Ω → GND
LED Rojo (+)   →    GPIO 20 → Resistencia 220Ω → GND
Buzzer (+)     →    GPIO 21
Buzzer (-)     →    GND
```

### 3. Configuración del Software

#### Paso 1: Instalar Arduino IDE
1. Descargar Arduino IDE desde [arduino.cc](https://www.arduino.cc/en/software)
2. Instalar y ejecutar
3. Ir a File → Preferences
4. Agregar URL del ESP32: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`

#### Paso 2: Instalar Board Package
1. Tools → Board → Boards Manager
2. Buscar "ESP32"
3. Instalar "ESP32 by Espressif Systems"

#### Paso 3: Instalar Librerías
```
Sketch → Include Library → Manage Libraries
Buscar e instalar:
- LiquidCrystal_I2C by Frank de Brabander
- Keypad by Mark Stanley
- ArduinoJson by Benoit Blanchon
```

#### Paso 4: Configurar Board
```
Tools → Board → ESP32 Arduino → ESP32C3 Dev Module
Tools → Port → [Seleccionar puerto COM]
Tools → Upload Speed → 921600
Tools → CPU Frequency → 160MHz
Tools → Flash Size → 4MB
```

### 4. Programación del ESP32-C3

#### Paso 1: Configurar WiFi
Editar en el código:
```cpp
const char* ssid = "TU_RED_WIFI";
const char* password = "TU_CONTRASEÑA_WIFI";
```

#### Paso 2: Verificar Conexiones
Antes de cargar el código, verificar:
- Todas las conexiones con multímetro
- Alimentación correcta (3.3V y 5V)
- Dirección I2C del LCD (usar I2C Scanner si es necesario)

#### Paso 3: Cargar el Código
1. Abrir `ecosmart_esp32.ino`
2. Verificar (Ctrl+R)
3. Cargar (Ctrl+U)
4. Abrir Serial Monitor (Ctrl+Shift+M) a 115200 baud

### 5. Configuración de Firebase

#### Paso 1: Verificar Base de Datos
La base de datos ya está configurada en:
`https://botellasreciclaje-542b1-default-rtdb.firebaseio.com/`

#### Paso 2: Datos de Prueba
El sistema incluye datos de ejemplo:
- 10 estudiantes distribuidos en todos los grados
- Usuario admin: `admin` / `EcoSmart2025!`
- Configuración inicial

### 6. Despliegue de la Aplicación Web

#### La aplicación ya está lista en Bolt.new con:
- Interfaz responsive
- Conexión a Firebase configurada
- Datos de ejemplo cargados
- Todas las funcionalidades implementadas

### 7. Pruebas del Sistema

#### Prueba 1: Hardware
```
□ LCD muestra mensaje de bienvenida
□ Teclado responde a pulsaciones
□ LEDs encienden correctamente
□ Buzzer emite sonidos
□ Sensor detecta objetos a < 10cm
□ WiFi se conecta automáticamente
```

#### Prueba 2: Funcionalidad
```
□ Ingreso de código de estudiante
□ Validación en Firebase
□ Detección de botella
□ Actualización de puntos
□ Feedback visual y auditivo
□ Retorno al estado inicial
```

#### Prueba 3: Aplicación Web
```
□ Acceso de estudiante funciona
□ Dashboard muestra datos correctos
□ Ranking se actualiza en tiempo real
□ Panel admin permite gestión
□ Exportación de datos funciona
```

### 8. Instalación Física

#### Ubicación Recomendada:
- Área de fácil acceso para estudiantes
- Cerca de punto de alimentación
- Cobertura WiFi estable
- Protegido de lluvia y vandalismo

#### Montaje:
1. Fijar carcasa a pared o pedestal
2. Conectar alimentación estable
3. Posicionar sensor para detección óptima
4. Colocar recipiente para botellas debajo del sensor

### 9. Configuración Inicial

#### Paso 1: Primer Encendido
1. Conectar alimentación
2. Esperar inicialización (30 segundos)
3. Verificar conexión WiFi en LCD
4. Probar con código de estudiante de ejemplo

#### Paso 2: Configuración Admin
1. Acceder a aplicación web
2. Login como admin (`admin` / `EcoSmart2025!`)
3. Verificar datos de estudiantes
4. Ajustar configuración si es necesario

### 10. Mantenimiento

#### Diario:
- Verificar funcionamiento básico
- Limpiar sensor ultrasónico
- Vaciar recipiente de botellas

#### Semanal:
- Revisar conexiones físicas
- Verificar datos en aplicación web
- Limpiar LCD y teclado

#### Mensual:
- Backup de datos de Firebase
- Verificar estadísticas del sistema
- Actualizar configuración si es necesario

## Solución de Problemas

### Problema: LCD no enciende
**Solución:**
1. Verificar alimentación 5V
2. Revisar conexiones I2C
3. Probar con I2C Scanner
4. Verificar dirección I2C (0x27 o 0x3F)

### Problema: WiFi no conecta
**Solución:**
1. Verificar credenciales WiFi
2. Comprobar señal WiFi en ubicación
3. Reiniciar router si es necesario
4. Verificar firewall/restricciones de red

### Problema: Sensor no detecta
**Solución:**
1. Limpiar sensor con aire comprimido
2. Verificar conexiones Trig/Echo
3. Ajustar umbral de distancia en código
4. Probar con objeto de prueba

### Problema: Datos no se guardan
**Solución:**
1. Verificar conexión a internet
2. Comprobar URL de Firebase
3. Revisar formato JSON de datos
4. Verificar permisos de Firebase

## Contacto y Soporte

Para soporte técnico o consultas:
- Revisar documentación completa en README.md
- Verificar conexiones según esquemas
- Consultar logs en Serial Monitor
- Probar componentes individualmente

---

**¡EcoSmart está listo para transformar el reciclaje en tu escuela!** 🌱♻️