const { KafkaConsumer, CONSUME_TYPE} = require('./consumer')
const {KafkaProducer} = require('./producer')

module.exports = {
    KafkaConsumer, 
    CONSUME_TYPE,
    KafkaProducer
}