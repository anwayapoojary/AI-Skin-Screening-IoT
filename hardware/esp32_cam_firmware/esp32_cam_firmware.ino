// Arduino libraries: Adafruit SSD1306, Adafruit GFX Library, ArduinoJson.
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "esp_camera.h"

#include <Wire.h>

static constexpr uint32_t SERIAL_BAUD = 115200;
static constexpr char DEVICE_ID[] = "ESP32CAM-001";
static constexpr char FIRMWARE_VERSION[] = "usb-screening-1.0";
static constexpr uint8_t BUTTON_PIN = 13;
static constexpr uint8_t FLASH_LED_PIN = 4;
static constexpr uint8_t OLED_SDA_PIN = 15;
static constexpr uint8_t OLED_SCL_PIN = 14;
static constexpr uint8_t OLED_ADDRESS = 0x3C;
static constexpr uint8_t OLED_WIDTH = 128;
static constexpr uint8_t OLED_HEIGHT = 64;
static constexpr uint8_t EXTERNAL_LED_PIN = 2;
static constexpr uint8_t FRAME_MARKER[] = {0xA5, 0x5A, 0xC3, 0x3C};
static constexpr size_t SERIAL_CHUNK_SIZE = 1024;

Adafruit_SSD1306 display(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
bool displayReady = false;
bool linkConnected = false;
bool captureBusy = false;
bool captureRequested = false;
uint32_t lastHelloAt = 0;
uint32_t lastHeartbeatAt = 0;
uint32_t lastContactAt = 0;
uint32_t lastButtonChangeAt = 0;
bool previousButtonState = HIGH;
String serialLine;

void showState(const char *state, const char *detail = nullptr) {
  if (!displayReady) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("AI SKIN SCREENING"));
  display.drawFastHLine(0, 12, OLED_WIDTH, SSD1306_WHITE);
  display.setTextSize(2);
  display.setCursor(0, 19);
  display.println(state);
  if (detail != nullptr) {
    display.setTextSize(1);
    display.setCursor(0, 48);
    display.println(detail);
  }
  display.display();
}

void sendMessage(JsonDocument &message) {
  serializeJson(message, Serial);
  Serial.write('\n');
}

void sendHello() {
  StaticJsonDocument<128> message;
  message["type"] = "hello";
  message["device_id"] = DEVICE_ID;
  message["fw"] = FIRMWARE_VERSION;
  sendMessage(message);
  lastHelloAt = millis();
}

void sendHeartbeat() {
  StaticJsonDocument<64> message;
  message["type"] = "heartbeat";
  sendMessage(message);
  lastHeartbeatAt = millis();
}

void sendError(const char *messageText) {
  StaticJsonDocument<160> message;
  message["type"] = "error";
  message["msg"] = messageText;
  sendMessage(message);
  showState("Error", messageText);
}

uint32_t crc32Ieee(const uint8_t *data, size_t length) {
  uint32_t crc = 0xFFFFFFFF;
  for (size_t index = 0; index < length; ++index) {
    crc ^= data[index];
    for (uint8_t bit = 0; bit < 8; ++bit) {
      crc = (crc >> 1) ^ (0xEDB88320UL & (-(int32_t)(crc & 1)));
    }
  }
  return crc ^ 0xFFFFFFFF;
}

void writeFrame(camera_fb_t *frame) {
  Serial.write(FRAME_MARKER, sizeof(FRAME_MARKER));
  const uint32_t length = frame->len;
  const uint8_t lengthHeader[] = {
      static_cast<uint8_t>(length >> 24),
      static_cast<uint8_t>(length >> 16),
      static_cast<uint8_t>(length >> 8),
      static_cast<uint8_t>(length),
  };
  Serial.write(lengthHeader, sizeof(lengthHeader));
  for (size_t offset = 0; offset < frame->len; offset += SERIAL_CHUNK_SIZE) {
    const size_t chunkLength =
        min(SERIAL_CHUNK_SIZE, static_cast<size_t>(frame->len - offset));
    Serial.write(frame->buf + offset, chunkLength);
    Serial.flush();
    delay(1);
  }
  const uint32_t checksum = crc32Ieee(frame->buf, frame->len);
  const uint8_t checksumBytes[] = {
      static_cast<uint8_t>(checksum >> 24),
      static_cast<uint8_t>(checksum >> 16),
      static_cast<uint8_t>(checksum >> 8),
      static_cast<uint8_t>(checksum),
  };
  Serial.write(checksumBytes, sizeof(checksumBytes));
  Serial.flush();
}

bool configureCamera() {
  camera_config_t config = {};
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = 5;
  config.pin_d1 = 18;
  config.pin_d2 = 19;
  config.pin_d3 = 21;
  config.pin_d4 = 36;
  config.pin_d5 = 39;
  config.pin_d6 = 34;
  config.pin_d7 = 35;
  config.pin_xclk = 0;
  config.pin_pclk = 22;
  config.pin_vsync = 25;
  config.pin_href = 23;
  config.pin_sccb_sda = 26;
  config.pin_sccb_scl = 27;
  config.pin_pwdn = 32;
  config.pin_reset = -1;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  config.frame_size = FRAMESIZE_SVGA;
  config.jpeg_quality = 12;
  config.fb_count = 1;
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;
  config.fb_location = psramFound() ? CAMERA_FB_IN_PSRAM : CAMERA_FB_IN_DRAM;
  return esp_camera_init(&config) == ESP_OK;
}

void drawResult(JsonDocument &message) {
  const char *resultClass = message["class"] | "Unavailable";
  if (!displayReady) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println(F("RESULT"));
  display.setCursor(0, 12);
  if (strcmp(message["model"] | "", "mock") == 0) {
    display.println(F("MOCK AI - SCREENING"));
  } else {
    display.println(F("SCREENING ONLY"));
  }
  display.drawFastHLine(0, 23, OLED_WIDTH, SSD1306_WHITE);
  display.setCursor(0, 29);
  char shortClass[21];
  snprintf(shortClass, sizeof(shortClass), "%.20s", resultClass);
  display.setTextWrap(false);
  display.println(shortClass);
  display.setTextWrap(true);
  if (message["confidence"].is<float>() || message["confidence"].is<double>()) {
    const float confidence = message["confidence"].as<float>();
    char confidenceText[24];
    snprintf(confidenceText, sizeof(confidenceText), "Confidence: %.0f%%", confidence * 100.0f);
    display.setCursor(0, 42);
    display.println(confidenceText);
  }
  display.setCursor(0, 56);
  display.println(F("Not a diagnosis"));
  display.display();
}

void handleHostMessage(JsonDocument &message, camera_fb_t *pendingFrame) {
  const char *type = message["type"] | "";
  if (strcmp(type, "ack") == 0) {
    const char *status = message["status"] | "";
    const bool wasConnected = linkConnected;
    lastContactAt = millis();
    linkConnected = true;
    if (!wasConnected && strcmp(status, "connected") == 0 && pendingFrame != nullptr) {
      showState("Sending");
      writeFrame(pendingFrame);
    }
    if (strcmp(status, "resend") == 0 && pendingFrame != nullptr) {
      showState("Sending");
      writeFrame(pendingFrame);
    }
  } else if (strcmp(type, "result") == 0) {
    lastContactAt = millis();
    linkConnected = true;
    drawResult(message);
  } else if (strcmp(type, "capture_request") == 0) {
    lastContactAt = millis();
    linkConnected = true;
    if (!captureBusy) {
      captureRequested = true;
    }
  } else if (strcmp(type, "error") == 0) {
    const char *detail = message["msg"] | "Laptop bridge reported an error";
    showState("Error", detail);
  }
}

bool readHostMessage(JsonDocument &message, uint32_t timeoutMs, camera_fb_t *pendingFrame) {
  const uint32_t startedAt = millis();
  while (millis() - startedAt < timeoutMs) {
    while (Serial.available()) {
      const char value = static_cast<char>(Serial.read());
      if (value == '\n') {
        DeserializationError error = deserializeJson(message, serialLine);
        serialLine = "";
        if (!error) {
          handleHostMessage(message, pendingFrame);
          return true;
        }
      } else if (value != '\r' && serialLine.length() < 512) {
        serialLine += value;
      }
    }
    delay(2);
  }
  return false;
}

void captureAndSend() {
  captureBusy = true;
  showState("Capturing");
  digitalWrite(EXTERNAL_LED_PIN, HIGH);
  delay(180);
  camera_fb_t *frame = esp_camera_fb_get();
  digitalWrite(EXTERNAL_LED_PIN, LOW);
  if (frame == nullptr || frame->format != PIXFORMAT_JPEG) {
    if (frame != nullptr) esp_camera_fb_return(frame);
    sendError("Camera capture failed");
    captureBusy = false;
    return;
  }

  StaticJsonDocument<64> startMessage;
  startMessage["type"] = "capture_start";
  sendMessage(startMessage);
  showState("Sending");
  writeFrame(frame);
  showState("Analysing");
  const uint32_t waitStartedAt = millis();
  while (millis() - waitStartedAt < 120000) {
    StaticJsonDocument<512> response;
    if (readHostMessage(response, 250, frame) && strcmp(response["type"] | "", "result") == 0) {
      break;
    }
    if (millis() - lastContactAt > 8000) {
      linkConnected = false;
      showState("Waiting", "Laptop link lost");
      if (millis() - lastHelloAt >= 2500) sendHello();
    }
  }
  esp_camera_fb_return(frame);
  captureBusy = false;
}

void setup() {
  Serial.begin(SERIAL_BAUD);
  Serial.setTimeout(20);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(FLASH_LED_PIN, INPUT);
  pinMode(EXTERNAL_LED_PIN, OUTPUT);
  digitalWrite(EXTERNAL_LED_PIN, LOW);

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  displayReady = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  showState("Waiting", "Laptop not connected");
  if (!configureCamera()) {
    sendError("OV2640 camera initialization failed");
  }
  sendHello();
}

void loop() {
  const uint32_t now = millis();
  if (now - lastHeartbeatAt >= 2500) sendHeartbeat();
  if (now - lastContactAt > 8000) {
    if (linkConnected) showState("Waiting", "Laptop not connected");
    linkConnected = false;
    if (now - lastHelloAt >= 2500) sendHello();
  } else if (linkConnected && !captureBusy) {
    showState("Connected", "Press button to capture");
  }

  StaticJsonDocument<512> message;
  if (readHostMessage(message, 5, nullptr) &&
      strcmp(message["type"] | "", "capture_request") == 0) {
    captureRequested = true;
  }

  const bool buttonState = digitalRead(BUTTON_PIN);
  if (buttonState != previousButtonState && now - lastButtonChangeAt >= 35) {
    lastButtonChangeAt = now;
    previousButtonState = buttonState;
    if (buttonState == LOW && linkConnected && !captureBusy) {
      captureAndSend();
    }
  }
  if (captureRequested && linkConnected && !captureBusy) {
    captureRequested = false;
    captureAndSend();
  }
}
