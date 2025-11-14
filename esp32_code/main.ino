#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>

#include <HardwareSerial.h> 
#include <PMS.h> 

#include "time.h"

#define LED_BUILTIN 2
#define RX2_PIN 23 
#define TX2_PIN 19
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = -3 * 3600;
const int amazonOffset_sec = -4 * 3600;

const char* WIFI_SSID ="";
const char* WIFI_PASSWORD = "";

const char* MQTT_BROKER = "";
const int MQTT_PORT = 8883;
const char* MQTT_USER ="";
const char* MQTT_PASS= "";
const char* MQTT_TOPIC = "";

int pm1_0 = 0;
int pm2_5 = 0;
int pm10_0 = 0;
String deviceMAC = ""; 

unsigned long cycleTime = 1000 * 5; 
// unsigned long cycleTime = 1000 * 60 * 15; 
unsigned long lastCycle = 0;
unsigned long errorModeStayTime = 120000; 
unsigned long errorModeEntry = 0;
int wifiFails = 0;
const int MAX_WIFI_FAILS = 5;

enum MachineState {
  INITIALIZING,
  WAITING_CYCLE,
  READING,
  CONNECT_WIFI,
  CONNECT_MQTT,
  SEND_DATA,
  ERROR_STATE,
  KERNEL_PANIC
};
MachineState currentState = INITIALIZING;

PMS pms(Serial2);
PMS::DATA data;  

WiFiClientSecure wifiClient; 
PubSubClient mqttClient(wifiClient);


bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("  -> Wifi já conectado");
    wifiFails = 0;
    return true;
  }
  Serial.println("Estado: CONECTANDO_WIFI");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print(".");
    retries++;
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n  -> WiFi Conectado!");
    Serial.print("  -> IP: ");
    Serial.println(WiFi.localIP());
    wifiFails = 0;
    return true;
  } else {
    Serial.println("\n  -> Falha ao conectar WiFi.");
    wifiFails++;
    return false;
  }
}

bool connectMQTT() {
  Serial.println("Estado: CONECTANDO_MQTT (Seguro)");
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  
  Serial.print("  -> Tentando conectar ao broker... ");
  if (mqttClient.connect("esp32_cliente_fsm", MQTT_USER, MQTT_PASS)) {
    Serial.println("MQTT Conectado!");
    return true;
  } else {
    Serial.print("Falha, rc=");
    Serial.print(mqttClient.state());
    if (mqttClient.state() == 5) { 
      Serial.println("\nERRO CRITICO,CREDENCIAIS MQTT ERRADAS");
      Serial.println("KERNEL PANIC INICIADO");
      currentState = KERNEL_PANIC;
      return false;
    }
    Serial.println(" (Verifique credenciais, SSL ou broker)");
    return false;
  }
}

void errorState() {
  if (millis() - errorModeEntry >= errorModeStayTime) {
    Serial.println("  -> Tempo de erro esgotado. Reiniciando ciclo.");
    wifiFails = 0; 
    currentState = INITIALIZING;
    digitalWrite(LED_BUILTIN, LOW);
    return; 
  }
  digitalWrite(LED_BUILTIN, HIGH); 
  delay(250);                      
  digitalWrite(LED_BUILTIN, LOW);
  delay(250);
}

void kernelPanicState() {
  Serial.println("!!! KERNEL PANIC !!!");
  Serial.println("O sistema foi interrompido devido a um erro critico.");
  Serial.println("Reinicie o dispositivo manualmente.");
  digitalWrite(LED_BUILTIN, HIGH);
  while (1) {
    delay(1000);
  }
}


void waitingCycleState() {
  if (millis() - lastCycle >= cycleTime) {
    Serial.println("\nEstado: AGUARDANDO_CICLO");
    Serial.println("  -> Timer disparou!");
    currentState = READING; 
  }
}

void readingState() {
  Serial.println("Estado: LEITURA");
  Serial.println("  -> Procurando pacote no stream (timeout de 5s)...");
  unsigned long startReadingTime = millis();
  bool readSuccess = false;
  while (millis() - startReadingTime < 5000) {
    if (pms.read(data)) {
      readSuccess = true;
      break; 
    }
    delay(50); 
  }

  if (!readSuccess) {
    Serial.println("  -> FALHA NO SENSOR. Nenhum pacote recebido em 5 segundos.");
    currentState = WAITING_CYCLE; 
    lastCycle = millis(); 
    return;
  }
  pm1_0 = data.PM_AE_UG_1_0;
  pm2_5 = data.PM_AE_UG_2_5;
  pm10_0 = data.PM_AE_UG_10_0;
  Serial.printf("  -> SUCESSO! PM1.0: %d | PM2.5: %d | PM10: %d\n", pm1_0, pm2_5, pm10_0);
  
  
  currentState = CONNECT_WIFI;
}


void sendDataState() {
  Serial.println("Estado: MANDANDO DADOS");
  time_t now;
  time(&now);
  unsigned long timestamp = now;
  
  char msgBuffer[256];
  snprintf(msgBuffer, 256,
    "{\"uid\":\"%s\", \"uxt\":%lu, \"pm1_0\":%d, \"pm2_5\":%d, \"pm10_0\":%d}",
    deviceMAC.c_str(),  
    timestamp,          
    pm1_0,              
    pm2_5,              
    pm10_0              
  );
  
  Serial.print("  -> Publicando mensagem: ");
  Serial.println(msgBuffer);
  
  if (mqttClient.connected()) {
    if (mqttClient.publish(MQTT_TOPIC, msgBuffer)) {
      Serial.println("  -> Mensagem publicada com sucesso.");
    } else {
      Serial.println("  -> Falha ao publicar mensagem.");
    }
  } else {
    Serial.println("  -> MQTT desconectado. Não foi possível enviar.");
  }
  
  currentState = WAITING_CYCLE; 
  lastCycle = millis();
}

void setup() {
  Serial.begin(115200);
  while (!Serial) { }
  
  Serial2.begin(9600, SERIAL_8N1, RX2_PIN, TX2_PIN);
  
  pinMode(LED_BUILTIN, OUTPUT);
  
  wifiClient.setInsecure(); 
  
  Serial.println("\n\nIniciando FSM - Leitor PMS3003 (v6 - Always-On)");
  
  Serial.println("  -> Acordando o sensor permanentemente...");
  pms.wakeUp();
  delay(1000); 
  
  configTime(gmtOffset_sec, amazonOffset_sec, ntpServer);
  
  currentState = INITIALIZING;
}

void loop() {
  if (WiFi.status() == WL_CONNECTED && mqttClient.connected()) {
    mqttClient.loop();
  }

  switch (currentState) {

    case INITIALIZING:
      Serial.println("Estado: INICIALIZANDO");
      
      deviceMAC = WiFi.macAddress();
      Serial.print("  -> Device MAC (UID): ");
      Serial.println(deviceMAC);

      Serial.println("  -> OK, inicializado.");
      currentState = WAITING_CYCLE; 
      lastCycle = millis(); 
      break;

    case WAITING_CYCLE:
      waitingCycleState();
      break;

    case READING:
      readingState();
      break;

    case CONNECT_WIFI:
      if (connectWifi()) {
        deviceMAC = WiFi.macAddress();
        currentState = CONNECT_MQTT;
      } else {
        if (wifiFails >= MAX_WIFI_FAILS) {
          Serial.println("\nEstado: MODO_ERRO");
          Serial.println("  -> FALHOU " + String(MAX_WIFI_FAILS) + " VEZES (ou mais).");
          Serial.println("  -> Aguardando 2 minutos para reiniciar...");
          currentState = ERROR_STATE;
          errorModeEntry = millis();
        } else {
          Serial.println("  -> Falha de WiFi. Tentando novamente no próximo ciclo.");
          currentState = WAITING_CYCLE; 
          lastCycle = millis(); 
        }
      }
      break;

    case CONNECT_MQTT:
      if (connectMQTT()) {
        currentState = SEND_DATA;
      } else {
        if (currentState != KERNEL_PANIC) { 
          Serial.println("\nEstado: MODO_ERRO");
          Serial.println(">>> FALHA DE MQTT. Entrando em MODO DE ERRO. <<<");
          Serial.println("  -> Aguardando 2 minutos para reiniciar...");
          currentState = ERROR_STATE;
          errorModeEntry = millis(); 
        }
      }
      break;

    case SEND_DATA:
      sendDataState();
      break;

    case ERROR_STATE:
      errorState();
      break;

    case KERNEL_PANIC:
      kernelPanicState();
      break;
  }
}
