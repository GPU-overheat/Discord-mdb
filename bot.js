const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");

const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;
const CHANNEL_ID_TO_MONITOR = process.env.TARGET_CHANNEL_ID;

if (!BOT_TOKEN || !N8N_WEBHOOK_URL || !CHANNEL_ID_TO_MONITOR) {
  console.error("Missing required environment variables!");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const messageQueue = [];
const PROCESSING_INTERVAL = 5000; // 5 seconds
const MAX_RETRIES = 3;

setInterval(async () => {
  if (messageQueue.length === 0) return;

  // Take a snapshot of the queue to process, in case new messages arrive
  const batchToSend = [...messageQueue];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await axios.post(N8N_WEBHOOK_URL, {
        batch: batchToSend,
        itemCount: batchToSend.length,
      });

      console.log(
        `✅ Batch of ${batchToSend.length} messages sent successfully to n8n.`
      );
      // IMPORTANT: Clear the queue ONLY on success
      messageQueue.splice(0, batchToSend.length);
      return; // Exit the retry loop on success
    } catch (error) {
      console.error(
        `❌ Attempt ${attempt}/${MAX_RETRIES} failed for batch of ${batchToSend.length} messages:`,
        error.message
      );
      if (attempt === MAX_RETRIES) {
        console.error(
          "☠️ All retries failed. The batch will be attempted again later with new messages."
        );
      } else {
        // Wait before retrying (e.g., exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
}, PROCESSING_INTERVAL);

// Function to add data to the queue
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
      type: message.channel.type,
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

client.on("ready", () => {
  console.log(
    `Bot online as ${client.user.tag} | Monitoring channel: ${CHANNEL_ID_TO_MONITOR}`
  );
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || message.channel.id !== CHANNEL_ID_TO_MONITOR)
    return;

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

process.on("SIGINT", async () => {
  console.log("\nShutting down...");
  client.destroy();
  process.exit();
});

client.login(BOT_TOKEN);
