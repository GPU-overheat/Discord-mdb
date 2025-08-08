const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

// --- Environment Variables ---
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const CHANNEL_ID_TO_MONITOR = process.env.TARGET_CHANNEL_ID;

if (!BOT_TOKEN || !N8N_WEBHOOK_URL || !CHANNEL_ID_TO_MONITOR) {
  console.error(
    "❌ Missing required environment variables! Check your .env file."
  );
  process.exit(1);
}

// --- Discord Client Setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// --- Queue & Processing Logic ---
const messageQueue = [];
const PROCESSING_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 1;
let isProcessing = false; // The "lock" to prevent race conditions
let isShuttingDown = false; // Flag for graceful shutdown

setInterval(async () => {
  // Don't run if a batch is already being processed or if the queue is empty
  if (isProcessing || messageQueue.length === 0) {
    return;
  }

  // Set the lock
  isProcessing = true;

  // Take a snapshot of the queue to process
  const batchToSend = [...messageQueue];

  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(
          `🚀 Attempt ${attempt}/${MAX_RETRIES}: Sending batch of ${batchToSend.length} messages...`
        );

        await axios.post(N8N_WEBHOOK_URL, {
          batch: batchToSend,
          itemCount: batchToSend.length,
        });

        console.log(
          `✅ Batch of ${batchToSend.length} messages sent successfully.`
        );

        // Clear the queue ONLY on success
        messageQueue.splice(0, batchToSend.length);
        return; // Exit the retry loop on success
      } catch (error) {
        console.error(
          `❌ Attempt ${attempt}/${MAX_RETRIES} failed:`,
          error.message
        );
        if (attempt === MAX_RETRIES) {
          console.error(
            "☠️ All retries failed. The batch will be attempted again later."
          );
        } else {
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
  } finally {
    // CRITICAL: Always release the lock, whether the request succeeded or failed.
    isProcessing = false;
  }
}, PROCESSING_INTERVAL);

// --- Function to add data to the queue ---
function addMessageToQueue(message) {
  const messageData = {
    content: message.content,
    author: {
      id: message.author.id,
      username: message.author.username,
      discriminator: message.author.discriminator,
      bot: message.author.bot,
    },
    channel: {
      id: message.channel.id,
      name: message.channel.name,
    },
    guild: message.guild
      ? { id: message.guild.id, name: message.guild.name }
      : null,
    attachments: message.attachments.map((att) => ({
      name: att.name,
      url: att.url,
      contentType: att.contentType,
      size: att.size,
    })),
    embeds: message.embeds,
    timestamp: message.createdAt.toISOString(),
    messageId: message.id,
    reference: message.reference
      ? {
          messageId: message.reference.messageId,
          channelId: message.reference.channelId,
          guildId: message.reference.guildId,
        }
      : null,
  };
  messageQueue.push(messageData);
}

// --- Bot Event Handlers ---
client.on("ready", () => {
  console.log(
    `Bot online as ${client.user.tag} | Monitoring channel: ${CHANNEL_ID_TO_MONITOR}`
  );
});

client.on("messageCreate", async (message) => {
  // Ignore messages if shutting down, from other bots, or from other channels
  if (
    isShuttingDown ||
    message.author.bot ||
    message.channel.id !== CHANNEL_ID_TO_MONITOR
  ) {
    return;
  }

  try {
    addMessageToQueue(message);
    console.log(
      `Queued message from @${
        message.author.username
      } (ID: ${message.id.substring(0, 6)}...)`
    );
  } catch (error) {
    console.error("Error queueing message:", error);
  }
});

// --- Graceful Shutdown Logic ---
async function gracefulShutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log("\n🛑 Shutting down... waiting for message queue to clear.");

  // Wait until the queue is empty
  while (messageQueue.length > 0) {
    console.log(`   Waiting for ${messageQueue.length} messages to be sent...`);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second
  }

  console.log("✅ Queue is empty. Bot is now offline.");
  client.destroy();
  process.exit(0);
}

process.on("SIGINT", gracefulShutdown); // Catches Ctrl+C
process.on("SIGTERM", gracefulShutdown); // Catches `pm2 restart`

// --- Login ---
client.login(BOT_TOKEN);
