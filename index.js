// ================= IMPORTS =================
const { 
  Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField, REST, Routes, SlashCommandBuilder
} = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

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
    .addUserOption(o => o.setName("user").setDescription("The user you want to give coins to").setRequired(true))
    .addIntegerOption(o => o.setName("amount").setDescription("Amount of coins to give").setRequired(true)),
  new SlashCommandBuilder()
    .setName("rob")
    .setDescription("Rob coins from another user")
    .addUserOption(o => o.setName("user").setDescription("User to rob").setRequired(true)),
  new SlashCommandBuilder()
    .setName("gamble")
    .setDescription("Gamble your coins")
    .addIntegerOption(o => o.setName("amount").setDescription("Amount of coins to gamble").setRequired(true)),
  new SlashCommandBuilder().setName("fish").setDescription("Go fishing to earn coins"),
  new SlashCommandBuilder().setName("profile").setDescription("Check your profile"),
  new SlashCommandBuilder()
    .setName("setwelcomechannel")
    .setDescription("Set the welcome channel")
    .addChannelOption(o => o.setName("channel").setDescription("Select the welcome channel").setRequired(true)),
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a user")
    .addUserOption(o => o.setName("user").setDescription("The user to ban").setRequired(true)),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a user")
    .addUserOption(o => o.setName("user").setDescription("The user to kick").setRequired(true)),
  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mute a user for 10 minutes")
    .addUserOption(o => o.setName("user").setDescription("The user to mute").setRequired(true)),
  new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Unmute a user")
    .addUserOption(o => o.setName("user").setDescription("The user to unmute").setRequired(true)),
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
  const channelId = await db.get(`welcome_${member.guild.id}`);
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

// ================= LEVEL SYSTEM =================
client.on("messageCreate", async message => {
  if (message.author.bot) return;

  let xp = await db.get(`xp_${message.author.id}`) || 0;
  xp += 10;
  let level = Math.floor(0.1 * Math.sqrt(xp));
  await db.set(`xp_${message.author.id}`, xp);

  if (xp % 100 === 0) {
    message.channel.send(`🎉 ${message.author} you have reached level ${level}`);
  }

  // ================= PREFIX COMMANDS =================
  if (!message.content.startsWith(PREFIX)) return;
  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const cmd = args.shift().toLowerCase();

  if (cmd === "ping") {
    message.reply(`🏓 Pong! Latency is ${Date.now() - message.createdTimestamp}ms`);
  }
});

// ================= INTERACTIONS (SLASH COMMANDS) =================
client.on("interactionCreate", async interaction => {
  if (!interaction.isCommand()) return;
  const { commandName, options } = interaction;

  // ===== HELP =====
  if (commandName === "help") {
    const embed = new EmbedBuilder()
      .setColor("Blue")
      .setTitle("📘 Help Menu")
      .setDescription(`
💰 Economy:
 /daily /cash /give /rob /gamble /fish

📊 Level:
/profile

🛠 Admin:
/ban /kick /mute /unmute /setwelcomechannel

📜 Info:
/rules
/ping
      `);
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // ===== RULES =====
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

  // ===== PING =====
  if (commandName === "ping") {
    return interaction.reply(`🏓 Pong! Latency is ${Date.now() - interaction.createdTimestamp}ms`);
  }

  // ===== ECONOMY =====
  if (commandName === "daily") {
    let money = await db.get(`money_${interaction.user.id}`) || 0;
    money += 500;
    await db.set(`money_${interaction.user.id}`, money);
    return interaction.reply("💰 You claimed 500 coins!");
  }

  if (commandName === "cash") {
    let money = await db.get(`money_${interaction.user.id}`) || 0;
    return interaction.reply(`💰 You have ${money} coins`);
  }

  if (commandName === "give") {
    let user = options.getUser("user");
    let amount = options.getInteger("amount");
    let sender = await db.get(`money_${interaction.user.id}`) || 0;
    if (sender < amount) return interaction.reply("❌ Not enough money");

    await db.add(`money_${user.id}`, amount);
    await db.sub(`money_${interaction.user.id}`, amount);
    return interaction.reply(`💸 Sent ${amount} coins to ${user}`);
  }

  if (commandName === "rob") {
    let user = options.getUser("user");
    let amount = Math.floor(Math.random() * 300);
    await db.sub(`money_${user.id}`, amount);
    await db.add(`money_${interaction.user.id}`, amount);
    return interaction.reply(`🕵️ You robbed ${amount} coins from ${user}`);
  }

  if (commandName === "gamble") {
    let amount = options.getInteger("amount");
    let win = Math.random() > 0.5;
    if (win) {
      await db.add(`money_${interaction.user.id}`, amount);
      return interaction.reply("🎉 You won!");
    } else {
      await db.sub(`money_${interaction.user.id}`, amount);
      return interaction.reply("💀 You lost!");
    }
  }

  if (commandName === "fish") {
    let amount = Math.floor(Math.random() * 200);
    await db.add(`money_${interaction.user.id}`, amount);
    return interaction.reply(`🎣 You earned ${amount} coins`);
  }

  // ===== PROFILE =====
  if (commandName === "profile") {
    let xp = await db.get(`xp_${interaction.user.id}`) || 0;
    let money = await db.get(`money_${interaction.user.id}`) || 0;
    let level = Math.floor(0.1 * Math.sqrt(xp));

    const embed = new EmbedBuilder()
      .setColor("Purple")
      .setTitle(`${interaction.user.username}'s Profile`)
      .setDescription(`Level: ${level}\nXP: ${xp}\nCoins: ${money}`);

    return interaction.reply({ embeds: [embed] });
  }

  // ===== ADMIN =====
  if (commandName === "setwelcomechannel") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator))
      return interaction.reply("❌ You need Admin perms!");
    let channel = options.getChannel("channel");
    await db.set(`welcome_${interaction.guild.id}`, channel.id);
    return interaction.reply("✅ Welcome channel set!");
  }

  if (commandName === "ban") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.BanMembers))
      return interaction.reply("❌ You need Ban perms!");
    let user = options.getUser("user");
    let member = await interaction.guild.members.fetch(user.id);
    member.ban();
    return interaction.reply(`🔨 ${user.username} banned`);
  }

  if (commandName === "kick") {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.KickMembers))
      return interaction.reply("❌ You need Kick perms!");
    let user = options.getUser("user");
    let member = await interaction.guild.members.fetch(user.id);
    member.kick();
    return interaction.reply(`👢 ${user.username} kicked`);
  }

  if (commandName === "mute") {
    let user = options.getUser("user");
    let member = await interaction.guild.members.fetch(user.id);
    await member.timeout(600000);
    return interaction.reply(`🔇 ${user.username} muted for 10min`);
  }

  if (commandName === "unmute") {
    let user = options.getUser("user");
    let member = await interaction.guild.members.fetch(user.id);
    await member.timeout(null);
    return interaction.reply(`🔊 ${user.username} unmuted`);
  }
});

// ================= LOGIN =================
client.login(process.env.TOKEN);
