// utils/redis.js
import { createClient } from "redis";
import dotenv from "dotenv";
dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  throw new Error("Missing REDIS_URL environment variable");
}

const redisPublisher = createClient({ url: redisUrl });

redisPublisher.on("error", (err) => {
  console.error("Redis Publisher Error:", err);
});

const resp = await redisPublisher.connect();
export const publishJob = async (channel, payload) => {
  try {
    const message = JSON.stringify(payload);
    await redisPublisher.publish(channel, message);
    console.log(`Published to ${channel}:`, message);
  } catch (err) {
    console.error("Failed to publish message:", err);
  }
};

export default redisPublisher;
