/**
 * Copyright 2023 LG Electronics Inc.
 * SPDX-License-Identifier: LicenseRef-LGE-Proprietary
 */
/* eslint-disable no-restricted-syntax */
/* eslint-disable node/no-unsupported-features/es-syntax */

// const { createKafka } = require('./utils/kafka');
const _ = require('lodash');
const { Kafka } = require('./kafka');

const defaultErrorCallback = () => {
  console.log('[Producer Error]');
};

class KafkaProducer extends Kafka {
  #sendTimeout = 10000;

  /**
   * 프로듀서 인스턴스
   * @type {ReturnType<Kafka['_kafka']['producer']>}
   */
  #producer = null;

  #errorCallback = defaultErrorCallback;
  // kafka send control

  constructor(initObj) {
    super(initObj.brokerAddresses, initObj.clientId, initObj.authObj);
    console.log('[kafka Producer initObj]', JSON.stringify(initObj, null, 2));

    // this.#kafka = this.getKafka();
    this.#errorCallback = initObj.errorCallback;
  }

  #registerProducerEventHandler = async () => {
    await this.#producer.on(this.#producer.events.DISCONNECT, async () => {
      console.warn('Producer Disconnected');
    });

    await this.#producer.on(this.#producer.events.CONNECT, (payload) => {
      console.log('Producer connected');
      console.log({
        message: 'Producer Conntected',
        context: { ...payload },
      });
    });

    await this.#producer.on(this.#producer.events.REQUEST_TIMEOUT, async (payload) => {
      console.log({
        message: 'Producer Request Timeout',
        context: { ...payload },
      });
    });
  };

  start = async (allowAutoTopicCreation = true) => {
    // 이런식으로 말고, 내부적으로 TYPE.AUTH, TYPE.COMMON 이런식으로  enum 유사하게 고정 값 주입 받아서, 내부적으로만 auth 하던지, non auth 하던지..?
    console.log('kafka start called');
    try {
      console.log(`${this.brokerAddresses}, ${this.clientId}`);
      this.#producer = this._kafka.producer({
        allowAutoTopicCreation,
      });
      console.log(this.#producer, 'this.#producer');
      await this.#registerProducerEventHandler();
    } catch (err) {
      console.log('Kafka start Error');
      throw err;
    }
  };

  // 약 2000개에서 1MB 초과.( dummy 메시지는 1500개 까지 가능 )
  send = async (topic, messages, chunkSize = 1000) => {
    try {
      if (this.#producer) {
        await this.#producer.connect();
      }

      // 메시지를 100개 단위로 쪼갭니다.
      const messageChunks = _.chunk(messages, chunkSize);

      // 모든 청크를 동시에 전송합니다.
      const sendPromises = messageChunks.map(async (chunk) =>
        this.#producer.send({
          topic,
          timeout: this.#sendTimeout,
          messages: chunk,
        }),
      );

      // 모든 전송 결과를 기다립니다.
      const sendResults = await Promise.allSettled(sendPromises);

      // 결과를 처리합니다.
      sendResults.forEach((result) => {
        if (result.status === 'rejected') {
          console.error(`[Failed to send Chunk to Kafka]`, result?.reason);
        }
      });

      await this.#producer.disconnect();
      console.log('[kafka send end]');
    } catch (err) {
      console.log('Error While sending Message To Kafka');
      throw err;
    }
  };

  shutdown = async () => {
    console.log('kafka shutdown() called');
    // TBD: shutdown 중이면, 중복 수행 X하도록s
    if (this.#producer) {
      await this.#producer.disconnect();
      this.#producer = null;
    }
  };
}

module.exports = {
  KafkaProducer,
};
