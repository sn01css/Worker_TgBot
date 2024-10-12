addEventListener("fetch", event => {
  event.respondWith(handleRequest(event));
});

async function handleRequest(event) {
  const requestUrl = new URL(event.request.url);
  const requestPath = requestUrl.pathname;
  const requestMethod = event.request.method;
  const workerBaseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

  // Retrieve environment variables
  const botTokens = (event.env.BOT_TOKENS || "").split(','); // Handle multiple bot tokens
  const webhookPath = event.env.WEBHOOK_PATH || "/webhook";  // Default webhook path
  const emojis = (event.env.EMOJIS || "").split(','); // Retrieve available emojis
  const restrictedChats = (event.env.RESTRICTED_CHATS || "").split(',').map(id => id.trim()); // Handle restricted chats

  if (requestMethod === "POST" && requestPath === webhookPath) {
    const incomingUpdate = await event.request.json();

    // Process updates for all bots asynchronously
    await Promise.all(botTokens.map(token => processIncomingUpdate(incomingUpdate, token, emojis, restrictedChats)));

    return new Response("Webhook processed", { status: 200 });
  } else if (requestMethod === "GET" && requestPath === "/setup-webhooks") {
    // Set up webhooks for all bots asynchronously
    await Promise.all(botTokens.map(async (token) => {
      const setWebhookUrl = `https://api.telegram.org/bot${token}/setWebhook?url=${workerBaseUrl}${webhookPath}`;
      const response = await fetch(setWebhookUrl);

      if (!response.ok) {
        throw new Error(`Failed to set webhook for bot: ${token}`);
      }
    }));

    return new Response("Webhooks configured for all bots", { status: 200 });
  } else {
    return new Response("Endpoint not found", { status: 404 });
  }
}

async function processIncomingUpdate(update, botToken, emojis, restrictedChats) {
  if (update.message) {
    const chatId = update.message.chat.id;
    const messageId = update.message.message_id; // Get the message ID
    const chatType = update.message.chat.type;  // Get the chat type (channel, group, private, etc.)

    // Check if the message comes from a channel or group
    if (chatType === 'group' || chatType === 'supergroup' || chatType === 'channel') {
      // Check if the chat ID is in the restricted list
      if (restrictedChats.includes(String(chatId))) {
        console.log(`Chat ID ${chatId} is restricted from receiving reactions.`);
        return; // Exit the function if the chat is restricted
      }

      // Select a random emoji from the environment variable
      const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

      // Define the API endpoint and parameters
      const url = `https://api.telegram.org/bot${botToken}/setMessageReaction`;

      // Create the payload (request body)
      const body = {
        chat_id: chatId,           // The chat ID
        message_id: messageId,     // The message ID you want to react to
        reaction: JSON.stringify([{
          type: "emoji",
          emoji: randomEmoji,      // The random emoji
          is_big: true             // Optional: Indicates if it's a large emoji
        }])
      };

      // Send POST request using fetch
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)  // Stringify the body for the request
      })
      .then(response => response.json())  // Parse JSON response
      .then(data => {
        console.log(data);  // Handle response data
      })
      .catch(error => {
        console.error('Error:', error);  // Handle errors
      });
    }
  }
}

