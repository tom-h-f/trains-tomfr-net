// Prints the first 3 raw Darwin Kafka messages then exits.
// Run: bun run scripts/sample-darwin.ts

import { Kafka, logLevel } from "kafkajs";

const kafka = new Kafka({
  clientId: "darwin-sampler",
  brokers: ["pkc-z3p1v0.europe-west2.gcp.confluent.cloud:9092"],
  ssl: true,
  sasl: { mechanism: "plain", username: "KEH5EXZPPBEVJ5CO", password: "cfltcM+KcxMCK4cJvSkm834kOaK4c60jncn4EJhoq546+BA3rzoZHo/40BseiB5A" },
  logLevel: logLevel.ERROR,
});

const consumer = kafka.consumer({ groupId: "SC-20fb8f39-30e5-4ec4-a0ce-8f9fff1b42ab" });
await consumer.connect();
await consumer.subscribe({ topic: "prod-1010-Darwin-Train-Information-Push-Port-IIII2_0-JSON", fromBeginning: false });

let count = 0;
await consumer.run({
  eachMessage: async ({ message }) => {
    if (count >= 3) return;
    count++;
    const val = message.value?.toString() ?? "";
    console.log(`\n--- Message ${count} (${val.length} bytes) ---`);
    console.log(val.slice(0, 1200));
    if (count >= 3) {
      await consumer.disconnect();
      process.exit(0);
    }
  },
});
