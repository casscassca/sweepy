import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  MQTT_BASE_ENV,
  MQTT_DISCOVERY_PREFIX_ENV,
  MQTT_URL_ENV,
  mqttMissingMessage,
  mqttSettings,
} from "./mqtt-env";

const keys = [MQTT_URL_ENV, "MQTT_USER", "MQTT_PASSWORD", MQTT_DISCOVERY_PREFIX_ENV, MQTT_BASE_ENV];

describe("mqtt env", () => {
  const previous = new Map<string, string | undefined>();

  afterEach(() => {
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    previous.clear();
  });

  function setEnv(name: string, value: string | undefined) {
    if (!previous.has(name)) previous.set(name, process.env[name]);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  it("reads MQTT_URL at call time and names it when it is missing", () => {
    for (const key of keys) setEnv(key, undefined);
    const missing = mqttSettings();
    assert.equal(missing.url, null);
    assert.deepEqual(missing.missing, [MQTT_URL_ENV]);
    assert.equal(missing.discoveryPrefix, "homeassistant");
    assert.equal(missing.base, "sweepy");
    assert.match(mqttMissingMessage(), /MQTT_URL/);

    setEnv(MQTT_URL_ENV, "mqtt://host.docker.internal:1883/");
    setEnv("MQTT_USER", "sweepy");
    setEnv("MQTT_PASSWORD", "secret");
    setEnv(MQTT_DISCOVERY_PREFIX_ENV, "ha");
    setEnv(MQTT_BASE_ENV, "house");
    const set = mqttSettings();
    assert.equal(set.url, "mqtt://host.docker.internal:1883");
    assert.deepEqual(set.missing, []);
    assert.equal(set.username, "sweepy");
    assert.equal(set.password, "secret");
    assert.equal(set.discoveryPrefix, "ha");
    assert.equal(set.base, "house");
  });
});
