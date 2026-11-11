export function readEnv(name: string) {
  return (process.env[name] ?? "").trim().replace(/^['"]+|['"]+$/g, "");
}

export const MQTT_URL_ENV = "MQTT_URL";
export const MQTT_USER_ENV = "MQTT_USER";
export const MQTT_PASSWORD_ENV = "MQTT_PASSWORD";
export const MQTT_DISCOVERY_PREFIX_ENV = "MQTT_DISCOVERY_PREFIX";
export const MQTT_BASE_ENV = "MQTT_BASE";

export type MqttSettings = {
  url: string | null;
  username: string | null;
  password: string | null;
  discoveryPrefix: string;
  base: string;
  missing: string[];
};

/** Read at call time. Next does not inline `process.env[name]`, so Docker can set these after the image is built. */
export function mqttSettings(): MqttSettings {
  const url = readEnv(MQTT_URL_ENV).replace(/\/$/, "");
  const username = readEnv(MQTT_USER_ENV);
  const password = readEnv(MQTT_PASSWORD_ENV);
  return {
    url: url || null,
    username: username || null,
    password: password || null,
    discoveryPrefix: readEnv(MQTT_DISCOVERY_PREFIX_ENV) || "homeassistant",
    base: readEnv(MQTT_BASE_ENV) || "sweepy",
    missing: url ? [] : [MQTT_URL_ENV],
  };
}

export function mqttMissingMessage() {
  return "MQTT_URL is not set. Add MQTT_URL to the container environment (the .env file Docker loads). Optional: MQTT_USER, MQTT_PASSWORD, MQTT_DISCOVERY_PREFIX (default homeassistant), MQTT_BASE (default sweepy).";
}
