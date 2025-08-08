# Discord to n8n Channel Monitor 🚀

This repository contains a simple yet powerful Node.js script that monitors a specific Discord channel for new messages and forwards them in batches to an n8n workflow via a webhook. It's designed to be efficient, robust, and easy to set up.

This tool is perfect for automating tasks based on Discord activity, such as logging channel messages, triggering notifications, or integrating Discord conversations with hundreds of other applications through n8n.

---

## Features ✨

- **🎯 Specific Channel Monitoring**: Listens for new messages in a single, designated Discord channel.
- **📡 Real-time Forwarding**: Captures messages as they are created and sends them to your n8n workflow.
- **📦 Efficient Batching**: Messages are queued and sent in batches every 5 seconds to reduce network requests and handle high message volume gracefully.
- **💪 Robust Error Handling**: Includes a retry mechanism with exponential backoff to ensure messages are delivered even if the n8n webhook is temporarily unavailable.
- **📝 Rich Data**: Forwards comprehensive message data, including content, author details, attachments, embeds, and message references (replies).

---

## How It Works ⚙️

1.  A new message is posted in the target Discord channel.
2.  The Discord bot, listening to the `messageCreate` event, ignores any messages from other bots or other channels.
3.  The relevant message data is captured and added to a processing queue.
4.  Every 5 seconds, a `setInterval` function checks the queue. If it contains messages, the entire queue is sent as a single batch to your specified n8n webhook URL.
5.  If the webhook call fails, the script will automatically retry up to 3 times before logging a final error. The queue is only cleared upon a successful send.

---

## Setup & Installation 🛠️

Getting the bot running is straightforward.

1.  **Install dependencies:**

    ```bash
    npm install
    ```

2.  **Create an environment file:** Create a file named `.env` in the root of the project. You can copy the example file:

    ```bash
    cp .env.example .env
    ```

3.  **Configure your variables:** Open the `.env` file and fill in the required values as described in the configuration section below.

4.  **Run the bot:**
    ```bash
    node index.js
    ```
    Alternatively, for production use, it's highly recommended to use a process manager like `pm2`:
    ```bash
    pm2 start index.js --name "discord-n8n-monitor"
    ```

---

## Configuration 🔑

You must provide the following environment variables in the `.env` file for the bot to function correctly.

- `DISCORD_BOT_TOKEN`: Your Discord bot's authentication token. You can get this from the [Discord Developer Portal](https://discord.com/developers/applications).
- `N8N_WEBHOOK_URL`: The full URL of your n8n webhook trigger node.
- `TARGET_CHANNEL_ID`: The ID of the specific Discord channel you want the bot to monitor.
