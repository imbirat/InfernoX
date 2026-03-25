// ================= IMPORTS =================
const { 
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder
} = require('discord.js');

const db = require('quick.db'); // ✅ classic quick.db for Railway

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const PREFIX = "?";

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder().setName("help").setDescription("Show help menu"),
  new SlashCommandBuilder().setName("rules").setDescription("Show server rules"),
  new SlashCommandBuilder().setName("daily").setDescription("Claim your daily coins"),
  new SlashCommandBuilder().setName("cash").setDescription("Check your coin balance"),
  new SlashCommandBuilder()
    .setName("give")
    .setDescription("Give coins to another user")
    .addUserOption(o => o.setName("user").setDescription("User to give coins to").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount of coins").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Rob coins from another user")
    .addUserOption(o => o.setName("user").setDescription("User to rob").setRequired(true)),
  new SlashCommandBuilder()
    .setName("gamble")
    .setDescription("Gamble your coins")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount to gamble").setRequired(true)),
  new SlashCommandBuilder().setName("fish").setDescription("Go fishing to earn coins"),
  new SlashCommandBuilder().setName("profile").setDescription("Check your profile"),
  new SlashCommandBuilder()
    .setName("setwelcomechannel")
    .setDescription("Set the welcome channel")
    .addChannelOption(o => o.setName("channel").setDescription("Select welcome channel").setRequired(true)),
  new SlashCommandBuilder()
    .setName("setxpchannel")
    .setDescription("Set the channel for level-up messages")
    .addChannelOption(o => o.setName("channel").setDescription("Select XP channel").setRequired(true)),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true)),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true)),
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a user for 10 minutes")
    .addUserOption(o => o.setName("user").setDescription("User to mute").setRequired(true)),
  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a user")
    .addUserOption(o => o.setName("user").setDescription("User to unmute").setRequired(true)),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency")
].map(cmd => cmd.toJSON());

// ================= REGISTER SLASH COMMANDS =================
client.on("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    console.log("⚡ Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands }
    );
    console.log("✅ Slash commands registered!");
  } catch (err) {
    console.error(err);
  }
});

// ================= WELCOME SYSTEM =================
client.on("guildMemberAdd", async member => {
  const channelId = db.get(`welcome_${member.guild.id}`);
  if (!channelId) return;
  const channel = member.guild.channels.cache.get(channelId);
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor("Green")
    .setDescription(
`👋 Hello ${member}

Welcome to **${member.guild.name}**
Make sure to read rules <#rules-channel>

🎉 Member #${member.guild.memberCount} — enjoy your stay!`
    );
  channel.send({ embeds: [embed] });
});

// ================= LEVELING & PREFIX COMMANDS =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  // XP system
  let xp = db.get(`xp_${message.author.id}`) || 0;
  xp += 10;
  let level = Math.floor(0.1 * Math.sqrt(xp));
  db.set(`xp_${message.author.id}`, xp);

  if (xp % 100 === 0) {
    const xpChannelId = db.get(`xpchannel_${message.guild.id}`);
    const xpChannel = message.guild.channels.cache.get(xpChannelId) || message.channel;
    xpChannel.send(`🎉 ${message.author} you have reached level ${level}`);
  }

  // PREFIX COMMANDS
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  // -------- ?help --------
  if (cmd === "help") {
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📘 Help Menu")
      .setDescription(`
💰 Economy: /daily /cash /give /rob /gamble /fish
📊 Level: /profile
🛠 Admin: /ban /kick /mute /unmute /setwelcomechannel /setxpchannel
📜 Info: /rules /ping
      `);
    return message.reply({ embeds: [embed] });
  }

  if (cmd === "ping") {
    message.reply(`🏓 Pong! Latency is ${Date.now() - message.createdTimestamp}ms`);
  }

  if (cmd === "setxpchannel") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return message.reply("❌ You need Admin permissions!");
    
    const channel = message.mentions.channels.first();
    if (!channel) return message.reply("❌ Please mention a channel!");

    db.set(`xpchannel_${message.guild.id}`, channel.id);
    message.reply(`✅ XP level-up messages will now be sent in ${channel}`);
  }
});

// ================= INTERACTIONS (SLASH COMMANDS) =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;

  // HELP
  if (commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📘 Help Menu")
      .setDescription(`
💰 Economy: /daily /cash /give /rob /gamble /fish
📊 Level: /profile
🛠 Admin: /ban /kick /mute /unmute /setwelcomechannel /setxpchannel
📜 Info: /rules /ping
      `);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // RULES
  if (commandName === "rules") {
    const embed = new EmbedBuilder()
      .setColor("Orange")
      .setTitle("📜 Discord Server Rules")
      .setDescription(`
1. Respect Everyone  
2. No Spamming  
3. Keep Content Appropriate  
4. Respect Privacy  
5. No Advertising  
6. Follow Staff Instructions  
7. No Impersonation  
9. Have Fun! 🎉
      `);
    return interaction.reply({ embeds: [embed] });
  }

  // PING
  if (commandName === "ping") {
    return interaction.reply(`🏓 Pong! Latency is ${Date.now() - interaction.createdTimestamp}ms`);
  }

  // ECONOMY
  if (commandName === "daily") {
    let money = db.get(`money_${interaction.user.id}`) || 0;
    money += 500;
    db.set(`money_${interaction.user.id}`, money);
    return interaction.reply("💰 You claimed 500 coins!");
  }

  if (commandName === "cash") {
    let money = db.get(`money_${interaction.user.id}`) || 0;
    return interaction.reply(`💰 You have ${money} coins`);
  }

  if (commandName === "give") {
    const user = options.getUser("user");
    const amount = options.getInteger("amount");
    const sender = db.get(`money_${interaction.user.id}`) || 0;
    if (sender < amount) return interaction.reply("❌ Not enough money");

    db.add(`money_${user.id}`, amount);
    db.sub(`money_${interaction.user.id}`, amount);
    return interaction.reply(`💸 Sent ${amount} coins to ${user}`);
  }

  if (commandName === "rob") {
    const user = options.getUser("user");
    const amount = Math.floor(Math.random() * 300);
    db.sub(`money_${user.id}`, amount);
    db.add(`money_${interaction.user.id}`, amount);
    return interaction.reply(`🕵️ You robbed ${amount} coins from ${user}`);
  }

  if (commandName === "gamble") {
    const amount = options.getInteger("amount");
    const win = Math.random() > 0.5;
    if (win) {
      db.add(`money_${interaction.user.id}`, amount);
      return interaction.reply("🎉 You won!");
    } else {
      db.sub(`money_${interaction.user.id}`, amount);
      return interaction.reply("💀 You lost!");
    }
  }

  if (commandName === "fish") {
    const amount = Math.floor(Math.random() * 200);
    db.add(`money_${interaction.user.id}`, amount);
    return interaction.reply(`🎣 You earned ${amount} coins`);
  }

  // PROFILE
  if (commandName === "profile") {
    const xp = db.get(`xp_${interaction.user.id}`) || 0;
    const money = db.get(`money_${interaction.user.id}`) || 0;
    const level = Math.floor(0.1 * Math.sqrt(xp));

    const embed = new EmbedBuilder()
      .setColor("Purple")
      .setTitle(`${interaction.user.username}'s Profile`)
      .setDescription(`Level: ${level}\nXP: ${xp}\nCoins: ${money}`);

    return interaction.reply({ embeds: [embed] });
  }

  // SET WELCOME CHANNEL
  if (commandName === "setwelcomechannel") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply("❌ You need Admin perms!");
    const channel = options.getChannel("channel");
    db.set(`welcome_${interaction.guild.id}`, channel.id);
    return interaction.reply("✅ Welcome channel set!");
  }

  // SET XP CHANNEL
  if (commandName === "setxpchannel") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply("❌ You need Admin perms!");
    const channel = options.getChannel("channel");
    db.set(`xpchannel_${interaction.guild.id}`, channel.id);
    return interaction.reply(`✅ XP level-up messages will now be sent in ${channel}`);
  }

  // ADMIN
  if (commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply("❌ You need Ban perms!");
    const user = options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);
    member.ban();
    return interaction.reply(`🔨 ${user.username} banned`);
  }

  if (commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.reply("❌ You need Kick perms!");
    const user = options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);
    member.kick();
    return interaction.reply(`👢 ${user.username} kicked`);
  }

  if (commandName === "mute") {
    const user = options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);
    await member.timeout(600000);
    return interaction.reply(`🔇 ${user.username} muted for 10min`);
  }

  if (commandName === "unmute") {
    const user = options.getUser("user");
    const member = await interaction.guild.members.fetch(user.id);
    await member.timeout(null);
    return interaction.reply(`🔊 ${user.username} unmuted`);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
