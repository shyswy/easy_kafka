# 🌀 easy\_kafka

**Kafka Wrapper Module**
KafkaJS 기반 Kafka Producer / Consumer 설정과 실행을 간편하게 추상화한 Wrapper module 입니다.
반복적인 코드를 줄이고 다양한 환경에서 유연하게 Kafka를 사용할 수 있도록 개발되었습니다.

---

## 📁 프로젝트 구조

```
wrapper/
├── kafka.js         // Kafka 기본 설정 래퍼
├── consumer.js      // KafkaConsumer 추상화 클래스
├── producer.js      // KafkaProducer 추상화 클래스
```

---

## ✨ 주요 기능

* 인증 및 기본 설정을 공통화한 Kafka 생성 클래스
* 다양한 메시지 consume 전략 지원
  (`PRE_COMMIT`, `POST_COMMIT`)
* 메시지 전송 시 자동 첱크 처리 (배치 전략)
* 이벤트 핸들링 및 오류 콜백 정의
* 재사용성 높은 구성

---

## 🔧 설치

```bash
npm install
```

---

## 🧹 사용법

### KafkaConsumer

```js
const { KafkaConsumer, CONSUME_TYPE } = require('./consumer');

const consumer = new KafkaConsumer({
  brokerAddresses: ['broker-address',
  clientId: 'clientid',
  topicConfigs: { topic: 'my-topic', fromBeginning: true },
  consumeType: CONSUME_TYPE.POST_COMMIT_BATCH,
  consumeMethod: async (messages) => {
    for (const msg of messages) {
      console.log(`Received: ${msg.value.toString()}`);
    }
  },
  crashCallback: () => {
    console.log('Consumer crashed');
  },
});

await consumer.init({
  groupId: 'my-consumer-group',
});

// shutdown 시
// await consumer.shutdown();
```

---

### KafkaProducer

```js
const { KafkaProducer } = require('./producer');

const producer = new KafkaProducer({
  brokerAddresses: ['broker-address'],
  clientId: 'client-id',
  errorCallback: () => {
    console.log('Producer error occurred');
  },
});

await producer.start();

await producer.send('my-topic', [
  { key: 'key1', value: 'message1' },
  { key: 'key2', value: 'message2' },
]);

// shutdown 시
// await producer.shutdown();
```

---

## 📌 Consume 전략

| Consume Type        | 설명                                                      |
| ------------------- | ------------------------------------------------------- |
| `PRE_COMMIT_BATCH`  | batch consuming 전략. 메시지 batch를 가져오자마자 offset을 전략한 후 처리  |
| `POST_COMMIT_BATCH` | batch consuming 전략. 메시지 batch 처리 완료 후 offset 전략 (실패 무시) |


> 기본 설정은 `PRE_COMMIT_BATCH`입니다.

---

## 📌 Produce 전략

* Kafka 기본 설정상 1MB 이상의 메시지는 전송이 불가합니다.
* 이를 방지하기 위해 메시지를 첱크 단위로 나누어 전송합니다.
* 기본적으로 `produce()` 호출 시마다 Kafka에 connect/disconnect를 반복합니다.
* 추후에는 연결을 유지하는 지속적 연결 전략도 제공할 예정입니다.

---

## 🛠 사용 예시

* 아래 repository를 참고하세요.
  🔗 [https://github.com/shyswy/easy\_kafka\_example](https://github.com/shyswy/easy_kafka_example)
