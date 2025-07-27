/*
  EcoSmart - Sistema de Recolección de Botellas Reciclables
  ESP32-C3 Code for Bottle Collection Station
  
  Hardware Requirements:
  - ESP32-C3 Development Board
  - LCD I2C 16x2 or 20x4 (Address: 0x27)
  - 4x4 Matrix Keypad
  - HC-SR04 Ultrasonic Sensor
  - RGB LED or 2 LEDs (Green/Red)
  - Active Buzzer
  - Resistors and connecting wires
  
  Pin Configuration:
  - LCD: SDA (GPIO 8), SCL (GPIO 9)
  - Keypad: Rows (GPIO 0,1,2,3), Cols (GPIO 4,5,6,7)
  - HC-SR04: Trig (GPIO 10), Echo (GPIO 18)
  - LEDs: Green (GPIO 19), Red (GPIO 20)
  - Buzzer: GPIO 21
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // For JSON parsing and serialization
#include <LiquidCrystal_I2C.h> // For LCD display
#include <Keypad.h> // For keypad input
#include <esp_sleep.h> // For deep sleep functionality
#include <NTPClient.h> // For Network Time Protocol (getting accurate time)
#include <WiFiUdp.h> // Required for NTPClient

// WiFi Configuration
const char* ssid = "YOUR_WIFI_SSID"; // !!! CAMBIA ESTO: Tu SSID de WiFi
const char* password = "YOUR_WIFI_PASSWORD"; // !!! CAMBIA ESTO: Tu contraseña de WiFi

// Firebase Configuration
// !!! CAMBIA ESTO: Asegúrate de que esta URL sea la base de tu Realtime Database
const char* firebaseURL = "https://botellasreciclaje-542b1-default-rtdb.firebaseio.com";

// Hardware Pin Definitions
#define TRIG_PIN 10
#define ECHO_PIN 18
#define GREEN_LED 19
#define RED_LED 20
#define BUZZER 21

// LCD Configuration
LiquidCrystal_I2C lcd(0x27, 16, 2); // Address 0x27, 16 chars, 2 lines. Adjust if your LCD is 20x4 or has a different address.

// Keypad Configuration
const byte ROWS = 4;
const byte COLS = 4;
char keys[ROWS][COLS] = {
  {'1','2','3','A'},
  {'4','5','6','B'},
  {'7','8','9','C'},
  {'*','0','#','D'}
};
byte rowPins[ROWS] = {0, 1, 2, 3}; // Connect to ESP32 GPIOs
byte colPins[COLS] = {4, 5, 6, 7}; // Connect to ESP32 GPIOs
Keypad keypad = Keypad(makeKeymap(keys), rowPins, colPins, ROWS, COLS);

// NTP Client for accurate time (required for Firebase history timestamps)
WiFiUDP ntpUDP;
// NTPClient(UDP_CLIENT, NTP_SERVER, TIME_OFFSET_SECONDS, UPDATE_INTERVAL_MILLISECONDS)
// Time offset for Colombia (GMT-5) = -5 * 3600 = -18000 seconds
NTPClient timeClient(ntpUDP, "pool.ntp.org", -18000, 60000); // Update every 60 seconds

// System Variables
String studentCode = "";
bool bottleDetected = false;
unsigned long lastActivity = 0;
const unsigned long SLEEP_TIMEOUT = 300000; // 5 minutes (300,000 ms)
const unsigned long DETECTION_DELAY = 1000; // 1 second to confirm bottle is stable
const int DISTANCE_THRESHOLD = 10; // 10cm for bottle detection (adjust based on sensor placement)
int pointsPerBottle = 1; // Default points per bottle, will be loaded from Firebase

// System States
enum SystemState {
  WAITING_FOR_CODE,
  VALIDATING_CODE,
  WAITING_FOR_BOTTLE,
  PROCESSING_BOTTLE,
  SUCCESS,
  ERROR,
  SLEEPING
};

SystemState currentState = WAITING_FOR_CODE;

void setup() {
  Serial.begin(115200);
  
  // Initialize hardware pins
  initializeHardware();
  
  // Initialize LCD display
  lcd.init();
  lcd.backlight(); // Turn on LCD backlight
  displayWelcome();
  
  // Connect to WiFi network
  connectToWiFi();
  
  // Initialize NTP client after WiFi is connected
  timeClient.begin();
  timeClient.update(); // Initial time update
  
  // Load configuration (points per bottle) from Firebase
  loadConfiguration();
  
  // Set the initial state of the system
  setState(WAITING_FOR_CODE);
  
  Serial.println("EcoSmart System Initialized");
}

void loop() {
  // Check for inactivity timeout to enter sleep mode
  if (millis() - lastActivity > SLEEP_TIMEOUT && currentState != SLEEPING) {
    enterSleepMode();
  }
  
  // Handle actions based on the current system state
  switch (currentState) {
    case WAITING_FOR_CODE:
      handleCodeInput();
      break;
      
    case VALIDATING_CODE:
      // This state transitions quickly, no continuous handling needed here
      break; 
      
    case WAITING_FOR_BOTTLE:
      handleBottleDetection();
      break;
      
    case PROCESSING_BOTTLE:
      // This state transitions quickly, no continuous handling needed here
      break;
      
    case SUCCESS:
      // This state is for displaying success message, then returns to WAITING_FOR_CODE
      break;
      
    case ERROR:
      // This state is for displaying error message, then returns to WAITING_FOR_CODE
      break;
      
    case SLEEPING:
      // In sleep mode, the ESP32 is mostly idle, waiting for external interrupt
      break;
  }
  
  delay(50); // Small delay to prevent watchdog timer issues and reduce CPU usage
}

// Initializes all hardware pins to their default states
void initializeHardware() {
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(GREEN_LED, OUTPUT);
  pinMode(RED_LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  
  // Ensure all LEDs and buzzer are off initially
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  digitalWrite(BUZZER, LOW);
  
  Serial.println("Hardware initialized");
}

// Connects the ESP32 to the configured WiFi network
void connectToWiFi() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Conectando WiFi");
  lcd.setCursor(0, 1);
  lcd.print("Por favor espere");
  
  WiFi.begin(ssid, password);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) { // Increased attempts for robustness
    delay(500); // Shorter delay for faster attempts
    Serial.print(".");
    attempts++;
    
    // Update LCD with dots for progress
    lcd.setCursor(attempts % 16, 1); // Cycle dots across the second line
    lcd.print(".");
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected successfully");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("WiFi Conectado");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP());
    delay(2000);
  } else {
    Serial.println("\nFailed to connect to WiFi");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Error WiFi");
    lcd.setCursor(0, 1);
    lcd.print("Reiniciando...");
    playErrorSound(); // Play error sound on WiFi failure
    delay(3000);
    ESP.restart(); // Restart ESP32 if WiFi connection fails
  }
}

// Loads system configuration (e.g., points per bottle) from Firebase
void loadConfiguration() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected to WiFi, cannot load configuration.");
    return;
  }

  HTTPClient http;
  String url = String(firebaseURL) + "/config/puntosPorBotella.json";
  Serial.println("Loading config from: " + url);
  http.begin(url);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    // Use DynamicJsonDocument for parsing the response
    DynamicJsonDocument doc(256); // Small buffer for a single integer
    DeserializationError error = deserializeJson(doc, response);

    if (!error) {
      pointsPerBottle = doc.as<int>();
      if (pointsPerBottle <= 0) {
        pointsPerBottle = 1; // Ensure points are at least 1
        Serial.println("Invalid pointsPerBottle from Firebase, defaulting to 1.");
      }
      Serial.println("Configuration loaded: " + String(pointsPerBottle) + " points per bottle");
    } else {
      Serial.print("JSON deserialization failed: ");
      Serial.println(error.c_str());
      pointsPerBottle = 1; // Fallback to default
      Serial.println("Failed to parse configuration, using default.");
    }
  } else {
    Serial.print("Failed to load configuration. HTTP Response code: ");
    Serial.println(httpResponseCode);
    pointsPerBottle = 1; // Fallback to default
    Serial.println("Using default points per bottle: " + String(pointsPerBottle));
  }
  
  http.end();
}

// Displays the initial welcome message on the LCD
void displayWelcome() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("   EcoSmart   ");
  lcd.setCursor(0, 1);
  lcd.print("Sistema Reciclaje");
  delay(3000);
}

// Sets the current system state and updates the LCD and LEDs accordingly
void setState(SystemState newState) {
  currentState = newState;
  lastActivity = millis(); // Reset activity timer on state change
  
  // Update display and LED indicators based on the new state
  switch (newState) {
    case WAITING_FOR_CODE:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Ingresa tu codigo");
      lcd.setCursor(0, 1);
      lcd.print("Codigo: ____");
      studentCode = ""; // Clear student code for new input
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(RED_LED, LOW);
      break;
      
    case VALIDATING_CODE:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Validando...");
      lcd.setCursor(0, 1);
      lcd.print("Por favor espera");
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(RED_LED, HIGH); // Red LED indicates processing/waiting
      break;
      
    case WAITING_FOR_BOTTLE:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Deposita botella");
      lcd.setCursor(0, 1);
      lcd.print("Esperando...");
      digitalWrite(GREEN_LED, HIGH); // Green LED indicates ready for bottle
      digitalWrite(RED_LED, LOW);
      bottleDetected = false; // Reset bottle detection flag
      break;
      
    case PROCESSING_BOTTLE:
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Procesando...");
      lcd.setCursor(0, 1);
      lcd.print("No mover botella");
      digitalWrite(GREEN_LED, HIGH); // Both LEDs on for processing
      digitalWrite(RED_LED, HIGH);
      break;

    case SUCCESS:
      // Handled in processBottleDeposit, but defined here for completeness
      digitalWrite(GREEN_LED, HIGH);
      digitalWrite(RED_LED, LOW);
      break;

    case ERROR:
      // Handled in showError, but defined here for completeness
      digitalWrite(GREEN_LED, LOW);
      digitalWrite(RED_LED, HIGH);
      break;

    case SLEEPING:
      // LEDs and backlight handled in enterSleepMode
      break;
  }
}

// Handles input from the keypad for student code entry
void handleCodeInput() {
  char key = keypad.getKey();
  
  if (key) {
    lastActivity = millis(); // Reset activity timer on any key press
    
    if (key >= '0' && key <= '9') {
      if (studentCode.length() < 4) {
        studentCode += key;
        
        // Update LCD to show entered digits
        lcd.setCursor(8 + studentCode.length() - 1, 1);
        lcd.print(key);
        
        playBeep(100); // Short beep for key press
        
        // If 4 digits are entered, proceed to validation
        if (studentCode.length() == 4) {
          delay(500); // Small delay for user feedback
          setState(VALIDATING_CODE);
          validateStudentCode(); // Immediately call validation
        }
      }
    } else if (key == '*') { // '*' key to clear the current code
      studentCode = "";
      lcd.setCursor(8, 1);
      lcd.print("____"); // Clear digits on LCD
      playBeep(200); // Longer beep for clear action
    } else {
      // Ignore other keys like A, B, C, D, # for code input
      playErrorBeep(); // Indicate invalid key
    }
  }
}

// Validates the entered student code against Firebase
void validateStudentCode() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi(); // Attempt to reconnect if disconnected
    if (WiFi.status() != WL_CONNECTED) {
      showError("Error: No hay WiFi"); // More specific error message
      return;
    }
  }
  
  HTTPClient http;
  String url = String(firebaseURL) + "/students/" + studentCode + ".json";
  Serial.println("Validating code: " + url);
  http.begin(url);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    Serial.println("Firebase response: " + response);
    
    if (response == "null" || response.length() == 0) { // "null" means no data at that path
      showError("Error: Codigo Invalido"); // More specific error message
    } else {
      DynamicJsonDocument doc(1024); // Adjust size as needed for student data
      DeserializationError error = deserializeJson(doc, response);

      if (!error) {
        String studentName = doc["nombre"];
        String studentGrade = doc["grado"];
        
        lcd.clear();
        lcd.setCursor(0, 0);
        // Display student name, truncate if too long for 16x2 LCD
        if (studentName.length() > 15) {
          lcd.print("Hola " + studentName.substring(0, 10) + "..."); 
        } else {
          lcd.print("Hola " + studentName);
        }
        lcd.setCursor(0, 1);
        lcd.print("Grado: " + studentGrade);
        
        playSuccessSound();
        delay(3000); // Display student info for a few seconds
        
        setState(WAITING_FOR_BOTTLE); // Move to next state
      } else {
        Serial.print("JSON deserialization failed: ");
        Serial.println(error.c_str());
        showError("Error: Datos Corruptos"); // More specific error message
      }
    }
  } else {
    Serial.print("HTTP GET failed for student validation. Code: ");
    Serial.println(httpResponseCode);
    showError("Error: Servidor"); // More specific error message
  }
  
  http.end(); // Close HTTP connection
}

// Monitors the ultrasonic sensor for bottle detection
void handleBottleDetection() {
  long distance = measureDistance();
  
  // Check if a bottle is detected within the threshold
  if (distance > 0 && distance < DISTANCE_THRESHOLD) {
    if (!bottleDetected) {
      bottleDetected = true; // Mark as detected
      Serial.println("Bottle initially detected. Distance: " + String(distance) + " cm");
      playDetectionSound(); // Play sound on initial detection
      flashGreenLED(2); // Flash green LED twice on initial detection
      delay(DETECTION_DELAY); // Wait to confirm bottle is stable in place
      
      // Re-measure to confirm the bottle is still there after delay
      long confirmDistance = measureDistance();
      if (confirmDistance > 0 && confirmDistance < DISTANCE_THRESHOLD) {
        Serial.println("Bottle confirmed. Processing...");
        setState(PROCESSING_BOTTLE); // Bottle confirmed, proceed to process
        processBottleDeposit(); // Immediately call processing
      } else {
        bottleDetected = false; // Bottle moved or was a false positive
        Serial.println("Bottle not confirmed after delay. Resetting.");
        // Optionally, return to WAITING_FOR_BOTTLE state if bottle moved
        setState(WAITING_FOR_BOTTLE); 
      }
    }
  } else {
    bottleDetected = false; // No bottle or too far
  }
}

// Processes the bottle deposit: updates points and history in Firebase
void processBottleDeposit() {
  if (WiFi.status() != WL_CONNECTED) {
    connectToWiFi(); // Attempt to reconnect if disconnected
    if (WiFi.status() != WL_CONNECTED) {
      showError("Error: No hay WiFi"); // More specific error message
      return;
    }
  }
  
  // --- Step 1: Get current student data from Firebase ---
  HTTPClient httpGet;
  String studentUrl = String(firebaseURL) + "/students/" + studentCode + ".json";
  httpGet.begin(studentUrl);
  
  int httpResponseCodeGet = httpGet.GET();
  
  if (httpResponseCodeGet != 200) {
    Serial.print("Failed to get student data for update. Code: ");
    Serial.println(httpResponseCodeGet);
    showError("Error: Obtener Datos"); // More specific error message
    httpGet.end();
    return;
  }
  
  String responseGet = httpGet.getString();
  httpGet.end(); // Close GET connection

  DynamicJsonDocument doc(1024); // Buffer for student data
  DeserializationError error = deserializeJson(doc, responseGet);

  if (error) {
    Serial.print("JSON deserialization failed during update: ");
    Serial.println(error.c_str());
    showError("Error: Datos Corruptos"); // More specific error message
    return;
  }
  
  // --- Step 2: Calculate new points and prepare history entry ---
  int currentPoints = doc["puntos"] | 0; // Get current points, default to 0 if null
  int newPoints = currentPoints + pointsPerBottle;
  
  String timestamp = getCurrentTimestamp(); // Get accurate timestamp from NTP
  
  // --- Step 3: Prepare the update payload ---
  // We will use PATCH to update 'puntos' and add a new entry to 'historial'
  // Firebase Realtime Database handles adding to a map (historial) by key (timestamp)
  DynamicJsonDocument updatePayload(1024); // Buffer for update payload
  updatePayload["puntos"] = newPoints;
  updatePayload["historial"][timestamp] = pointsPerBottle; // Add new history entry

  String updateData;
  serializeJson(updatePayload, updateData);
  Serial.println("Firebase update payload: " + updateData);
  
  // --- Step 4: Send PATCH request to Firebase ---
  HTTPClient httpPatch;
  httpPatch.begin(studentUrl); // PATCH to the student's root
  httpPatch.addHeader("Content-Type", "application/json");
  
  int httpResponseCodePatch = httpPatch.PATCH(updateData); // Use PATCH for partial update

  if (httpResponseCodePatch == 200) {
    Serial.println("Firebase update successful.");
    // Success display
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Exito! +" + String(pointsPerBottle) + " puntos");
    lcd.setCursor(0, 1);
    lcd.print("Total: " + String(newPoints));
    
    playSuccessSound();
    digitalWrite(GREEN_LED, HIGH); // Green LED indicates success
    digitalWrite(RED_LED, LOW);
    
    delay(5000); // Display success message for a few seconds
    setState(WAITING_FOR_CODE); // Return to waiting for new code
  } else {
    Serial.print("Failed to update Firebase. HTTP Response code: ");
    Serial.println(httpResponseCodePatch);
    Serial.println("Response: " + httpPatch.getString());
    showError("Error: Guardar Datos"); // More specific error message
  }
  
  httpPatch.end(); // Close PATCH connection
  bottleDetected = false; // Reset bottle detection flag
}

// Handles error state: displays message and returns to WAITING_FOR_CODE after delay
void handleError() {
  playErrorSound(); // Play error sound
  delay(3000); // Display error message for a few seconds
  setState(WAITING_FOR_CODE); // Return to waiting for new code
}

// Measures distance using the HC-SR04 ultrasonic sensor
long measureDistance() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // Max 30ms pulse duration (for ~5m range)
  
  if (duration == 0) {
    return -1; // No echo received within timeout
  }
  
  // Calculate distance in cm (speed of sound ~0.034 cm/microsecond)
  // Divide by 2 because the sound travels to the object and back
  long distance = duration * 0.034 / 2;
  return distance;
}

// Displays an error message on the LCD and activates the red LED
void showError(String message) {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Error:");
  lcd.setCursor(0, 1);
  lcd.print(message);
  
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, HIGH); // Red LED for error
  
  playErrorSound(); // Play error sound
  setState(ERROR); // Set state to ERROR
}

// Plays a short beep sound
void playBeep(int duration) {
  digitalWrite(BUZZER, HIGH);
  delay(duration);
  digitalWrite(BUZZER, LOW);
}

// Plays a success sound sequence
void playSuccessSound() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(100);
    digitalWrite(BUZZER, LOW);
    delay(100);
  }
}

// Plays an error sound sequence
void playErrorSound() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER, HIGH);
    delay(500);
    digitalWrite(BUZZER, LOW);
    delay(200);
  }
}

// Plays a short error beep for invalid key presses
void playErrorBeep() {
  digitalWrite(BUZZER, HIGH);
  delay(50);
  digitalWrite(BUZZER, LOW);
  delay(50);
}

// Plays a sound on initial bottle detection
void playDetectionSound() {
  digitalWrite(BUZZER, HIGH);
  delay(75);
  digitalWrite(BUZZER, LOW);
  delay(50);
  digitalWrite(BUZZER, HIGH);
  delay(75);
  digitalWrite(BUZZER, LOW);
}

// Flashes the green LED a specified number of times
void flashGreenLED(int times) {
  for (int i = 0; i < times; i++) {
    digitalWrite(GREEN_LED, HIGH);
    delay(150);
    digitalWrite(GREEN_LED, LOW);
    delay(150);
  }
}

// Gets the current timestamp (milliseconds since epoch) from NTP client
String getCurrentTimestamp() {
  timeClient.update(); // Ensure time is updated
  // Return epoch time in milliseconds, as expected by Firebase Realtime Database for timestamps
  return String(timeClient.getEpochTime() * 1000); 
}

// Puts the ESP32 into light sleep mode to save power
void enterSleepMode() {
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Modo reposo");
  lcd.setCursor(0, 1);
  lcd.print("Presiona tecla");
  
  digitalWrite(GREEN_LED, LOW);
  digitalWrite(RED_LED, LOW);
  lcd.noBacklight(); // Turn off LCD backlight in sleep
  
  // Configure external wake up source (any key press on row 0)
  // GPIO_NUM_0 is the first row pin. Adjust if you want other pins to wake up.
  // The '0' means LOW level to trigger wake up (assuming pull-up on keypad rows)
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_0, 0); 
  
  Serial.println("Entering sleep mode");
  esp_light_sleep_start(); // Enter light sleep
  
  // Code resumes here after wake up
  lcd.backlight(); // Turn LCD backlight back on
  
  // Show "Waking up..." message briefly
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Despertando...");
  delay(2000); // Display for 2 seconds
  
  setState(WAITING_FOR_CODE); // Return to initial state
  Serial.println("Woke up from sleep");
}
