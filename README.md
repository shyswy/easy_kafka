# easy_kafka
Kafka Wrapper Module
이 모듈은 kafkajs를 기반으로 Kafka Producer / Consumer의 설정과 실행을 간편하게 추상화한 래퍼입니다.
보일러플레이트 코드를 줄이고, 다양한 환경에서 유연하게 Kafka를 사용할 수 있도록 설계되었습니다.

📁 프로젝트 구조
pgsql
복사
편집
wrapper/
├── kafka.js         // Kafka 기본 설정 래퍼
├── consumer.js      // KafkaConsumer 추상화 클래스
├── producer.js      // KafkaProducer 추상화 클래스
✨ 주요 기능
인증 및 기본 설정을 공통화한 Kafka 생성 클래스

다양한 메시지 consume 전략 지원 (PRE_COMMIT, POST_COMMIT, AUTO_COMMIT, EACH_MESSAGE)

메시지 전송 시 자동 청크 처리 (배치 전송)

이벤트 핸들링 및 오류 콜백 정의

재사용성 높은 구성

🔧 설치
bash
복사
편집
npm install
🧩 사용법
KafkaConsumer
js
복사
편집
const { KafkaConsumer, CONSUME_TYPE } = require('./consumer');

const consumer = new KafkaConsumer({
  brokerAddresses: ['localhost:9092'],
  clientId: 'my-app',
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
KafkaProducer
js
복사
편집
const { KafkaProducer } = require('./producer');

const producer = new KafkaProducer({
  brokerAddresses: ['localhost:9092'],
  clientId: 'my-app',
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
📌 Consume 전략
Consume Type	설명
PRE_COMMIT_BATCH	batch consuming 전략. 메시지 batch를 가져오자마자 last offset을 커밋한 후 처리
POST_COMMIT_BATCH	batch consuming 전략. 메시지 batch를 가져온 뒤, 모든 처리 완료 후 last offset을 커밋 ( 실패는 무시한다. )

기본 설정은 PRE_COMMIT_BATCH입니다.

📌 produce 전략
kafka 기본 설정 상, 한번에 1MB 크기의 메시지 모음만 전송 가능합니다.
따라서, message size 초과를 방지하기 위하여 chunk 수를 전달하여 1번에 전달하는 메시지 수를 제어 가능합니다.
또한, 기본적으로 매 produce 마다 kafka와 connect & disconnect를 반복하는 전략을 취하고 있습니다.
추후 확장에서, 한번 kafka와 맺은 연결을 지속할 수 있도록 정책을 추가할 예정입니다.

🛠 사용 예시
아래 repository 참고.
https://github.com/shyswy/easy_kafka_example
