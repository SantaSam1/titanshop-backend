bot.on("message", (msg) => {
  console.log("📩 Message:", msg.text);
  bot.sendMessage(msg.chat.id, "✅ Я получил сообщение: " + msg.text);
});
