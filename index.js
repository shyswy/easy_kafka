const { KafkaConsumer, CONSUME_TYPE } = require('./wrapper/consumer');
const { KafkaProducer } = require('./wrapper/producer');

module.exports = {
  KafkaConsumer,
  CONSUME_TYPE,
  KafkaProducer,
};
