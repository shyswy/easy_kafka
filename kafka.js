/**
 * Copyright 2023 LG Electronics Inc.
 * SPDX-License-Identifier: LicenseRef-LGE-Proprietary
 */
const { Kafka: KafkaJs } = require('kafkajs');

const createKafka = (brokerAddresses, clientId, authObj = false, retries = 8, maxRetryTime = 30000) => {
  if (!authObj) {
    return new KafkaJs({
      clientId, // "msg-broker-app",
      brokers: brokerAddresses,
      retry: {
        maxRetryTime,
        initialRetryTime: 100, // 첫 Rettry를 100ms 이후에.
        retries, // Reconnect 시도
        restartOnFailure: async () => true, // Reconnect 실패 시, Restart
      },
    });
  }
  return new KafkaJs({
    clientId, // "msg-broker-app",
    brokers: brokerAddresses,
    ssl: true,
    sasl: authObj,
    retry: {
      maxRetryTime,
      initialRetryTime: 100, // 첫 Rettry를 100ms 이후에.
      retries, // Reconnect 시도
      restartOnFailure: async () => true, // Reconnect 실패 시, Restart
    },
  });
};

class Kafka {
  // _kafka;
  constructor(brokerAddresses, clientId, authObj = false, retries = 8, maxRetryTime = 30000) {
    this._kafka = createKafka(brokerAddresses, clientId, authObj, retries, maxRetryTime);
  }
}
module.exports = {
  Kafka,
};
