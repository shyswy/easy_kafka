/**
 * Copyright 2023 LG Electronics Inc.
 * SPDX-License-Identifier: LicenseRef-LGE-Proprietary
 */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-return-await */
/* eslint-disable node/no-unsupported-features/es-syntax */

const { v4: uuidv4 } = require('uuid');
const { Kafka } = require('./kafka');
const defaultCrashCallback = () => {
  console.log('[Consumer Crash]');
};
const CONSUME_TYPE = {
  // message 처리 전에 성공 처리
  EACH_MESSAGE_PRE_COMMIT_BATCH: 'PRE_COMMIT_BATCH',
  //
  PRE_COMMIT_BATCH: 'PRE_COMMIT_BATCH',

  POST_COMMIT_BATCH: 'POST_COMMIT_BATCH',

  // message 처리 후에 성공 처리
  AUTO_COMMIT_BATCH: 'AUTO_COMMIT_BATCH',
  // kafkajs에서 제공하는 EACH_MESSAGE 사용
  EACH_MESSAGE: 'EACH_MESSAGE',
};

const GROUP_ID = 'groupId';

// TBD: createKafka ( producer 공통 부분) 은 상위에 'Kafka 클래스' 를 부모로 두게 구현, 하위에 KafkaConsumer, KafkaProducer 존재하도록..
class KafkaConsumer extends Kafka {
  #reconnectCount = 5;

  #topicConfigs;

  /**
   * 프로듀서 인스턴스
   * @type {() => Promise<void>} // 메시지를 처리하는 비동기 화살표 함수
   */
  #consumeMethod;

  #consumerGroupName;

  // nonretriable 에러 발생 시 대응: server shutdown 코드 추가 권장.
  #crashCallback;

  #consumeType;

  /**
   * 프로듀서 인스턴스
   * @type {ReturnType<Kafka['_kafka']['consumer']>}
   */
  #consumer;

  #kafkaConfig;
  // #kafka;

  constructor(initObj) {
    super(initObj.brokerAddresses, initObj.clientId, initObj.authObj);
    console.log('[kafka Consumer initObj]', JSON.stringify(initObj, null, 2));
    // this.#kafka = this.getKafka();
    this.#topicConfigs = initObj.topicConfigs;
    this.#consumeMethod = initObj.consumeMethod;
    this.#consumerGroupName = initObj.consumerGroupName ?? `Consumer-${uuidv4()}`;
    this.#crashCallback = initObj.crashCallback ?? defaultCrashCallback;
    this.#consumeType = initObj.consumeType ?? CONSUME_TYPE.EACH_MESSAGE_PRE_COMMIT_BATCH;
  }

  // 메시지 batch 수신 후 바로 offset 증가 후 처리
  #preCommit = async (batch, resolveOffset, heartbeat, commitOffsetsIfNecessary) => {
    try {
      const lastOffset = batch.messages.at(-1).offset; // batch.messages.length ?? 0 처리 (P1) **
      await resolveOffset(lastOffset); // manually acknowledge the message
      await heartbeat();
      await commitOffsetsIfNecessary();
    } catch (err) {
      console.log(err, `Kafka Consumer Error In kafka Level`);
      // Kafka 관련 에러는 KafkaJS에 Throw -> retry, consumer restart 반복 -> 계속 실패 시, disconnect되어서 다시 연결 X -> 이후 Sync 에서 재연결
      throw err;
    }
    try {
      await this.#consumeMethod(batch.messages ?? []);
    } catch (err) {
      console.log(err, `[Kafka Consume Message Level Error]`);
      // console.log(err, `[Kafka Consume Message Level Error] Retry Start`);
      // const retryConsumeResult = await retry(this.#reconnectCount, async () => {
      //   await this.#consumeMethod(message);
      // });
      // console.log(`Kafka Consume Message Level Retry Result: ${retryConsumeResult}`);
    }
  };

  // 메시지 batch 수신 후 처리 완료 한 뒤 offset 증가.
  #postCommit = async (batch, resolveOffset, heartbeat, commitOffsetsIfNecessary) => {
    try {
      await this.#consumeMethod(batch.messages ?? []);
    } catch (err) {
      console.log(err, `[Kafka Consume Message Level Error]`);
    }
    try {
      const lastOffset = batch.messages.at(-1).offset; // batch.messages.length ?? 0 처리 (P1) **
      await resolveOffset(lastOffset); // manually acknowledge the message
      await heartbeat();
      await commitOffsetsIfNecessary();
    } catch (err) {
      console.log(err, `Kafka Consumer Error In kafka Level`);
      // Kafka 관련 에러는 KafkaJS에 Throw -> retry, consumer restart 반복 -> 계속 실패 시, disconnect되어서 다시 연결 X -> 이후 Sync 에서 재연결
      throw err;
    }
  };

  #connectConsumer = async () => {
    if (!this.#consumer) {
      throw new Error('[Consumer Object is Null]');
    }

    await this.#consumer.subscribe(this.#topicConfigs);

    // TBD: eachMessage 버전, eachBatch 버전, eachBatch + Commit 미리하기버전 3자리를 enum 값따라 제공하도록 수정
    // contain connect & subscribe
    await this.#consumer.run({
      // effect commitOffsetsIfNecessary
      autoCommitInterval: 5000, // default null 주어진 시간 만큼 시간이후에  자동으로 commit 된다.
      autoCommitThreshold: 100, // default null 주어진 숫자만큼의 message 가 resolve 되면 자동으로 offset을 commit 한다.

      // Auto commit if No Error
      eachBatchAutoResolve: false,
      eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        commitOffsetsIfNecessary, // consumer 생성시 설정한 autoCommitInterval and autoCommitThreshold 에 따라 auto commits
        // uncommittedOffsets,  //아직 commit되지 못한 모든 offset을 리턴한다.
      }) => {
        switch (this.#consumeType) {
          case CONSUME_TYPE.POST_COMMIT_BATCH:
            // TBD
            await this.#postCommit(batch, resolveOffset, heartbeat, commitOffsetsIfNecessary);
            break;
          case CONSUME_TYPE.PRE_COMMIT_BATCH:
            // TBD
            await this.#preCommit(batch, resolveOffset, heartbeat, commitOffsetsIfNecessary);
            break;
          default:
            await this.#postCommit(batch, resolveOffset, heartbeat, commitOffsetsIfNecessary);
        }
      },
    });
  };

  #initConsumer = async () => {
    return this._kafka.consumer(this.#kafkaConfig);
  };

  #registerConsumerEventHandler = async () => {
    await this.#consumer.on(this.#consumer.events.DISCONNECT, () => {
      console.log('Kafka Disconnected');
    });

    await this.#consumer.on(this.#consumer.events.CONNECT, () => {
      console.log('Consumer connected');
    });

    await this.#consumer.on(this.#consumer.events.REBALANCING, async (payload) => {
      console.log({
        message: 'Consumer is reblancing',
        context: { ...payload },
      });
    });

    await this.#consumer.on(this.#consumer.events.STOP, async (payload) => {
      console.log({
        message: 'Consumer is STOPPED',
        context: { ...payload },
      });
    });

    // 아래 문제 발생 시, 외부에 문제 사항 전달 -> 문제 전달 받은 쪽에서 주기적으로 reconnect 시도 VS shutdown 수행
    this.#consumer.on(this.#consumer.events.CRASH, async (payload) => {
      // Error: 에러 발생 시 몇 번 재시도 후 Consumer crashed, KafkaJSNumberOfRetriesExceeded가 되고 disconnect 된다 -> consumer reconnect 한다.
      // retriable: false,  restart: true
      // Reference Error: Retry X, 바로 Consumer crashed, KafkaJSNonRetriableError 이라고 판단하고 disconnected, reconnect 시도 안함.-> 이후 Sync 로직에서 다시 연결시도한다.
      // retriable: false, restart: false
      const { error, groupId, restart } = payload?.payload ?? {};

      console.log({
        message: `kafka is crashed`,
        restart: { ...restart },
        error: { ...error },
        groupId: { groupId },
      });
      if (this.#crashCallback) {
        this.#crashCallback();
      }
      // try {
      //   const reconnectResult = await this.consumerReconnect();
      //   console.log(`[Consumer Crash Event] reConnect Result: ${reconnectResult}`);
      // } catch (err) {
      //   console.log('[Consumer Crash Event] impossible to Reconnect');
      //   if (this.#crashCallback) {
      //     this.#crashCallback();
      //   }
      // }
    });
  };

  init = async (kafkaConfig = {}) => {
    this.#kafkaConfig = kafkaConfig;

    // TBD: 이런식으로 말고, 내부적으로 TYPE.AUTH, TYPE.COMMON 이런식으로  enum 유사하게 고정 값 주입 받아서, 내부적으로만 auth 하던지, non auth 하던지..?
    console.log('kafka start called');
    try {
      if (!Object.prototype.hasOwnProperty.call(this.#kafkaConfig, GROUP_ID)) {
        this.#kafkaConfig.groupId = this.#consumerGroupName;
      }
      // const kafkaInstance = this.createKafka(this.brokerAddresses, this.clientId, this.authObj);
      this.#consumer = await this.#initConsumer();
      await this.#registerConsumerEventHandler();
      await this.#connectConsumer().catch((e) => {
        // 일정 기간 후 reconnect or server shutdown 추가 필요.
        if (this.#crashCallback) {
          this.#crashCallback();
        }
        console.log(`[Kafka Connection Error] ${e.message}`, e);
      });
    } catch (err) {
      console.log('Kafka start Error');
      throw err;
    }
  };

  // reconnect logic 제거
  // consumerReconnect = async () => {
  //   return await retry(this.#reconnectCount, async () => this.init(this.kafkaConfig));
  // };

  shutdown = async () => {
    console.log('kafka shutdown() called');
    // TBD: shutdown 중이면, 중복 수행 X하도록s
    if (this.#consumer) {
      await this.#consumer.disconnect();
      this.#consumer = null;
    }
  };
}

module.exports = {
  KafkaConsumer,
  CONSUME_TYPE,
};
