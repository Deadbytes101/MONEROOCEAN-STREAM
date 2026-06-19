import "dotenv/config";

import {
  Client,
  DiscordAPIError,
  Events,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

import {
  getMinerStats,
  getPayments,
  getWorkers,
} from "./moneroocean.js";

import {
  buildPaymentsReply,
  buildStatsReply,
  buildWorkersReply,
} from "./discord-ui.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const defaultWallet = process.env.DEFAULT_WALLET;
const commandScope = process.env.COMMAND_SCOPE?.trim().toLowerCase() || "guild";

if (!token || !clientId) {
  throw new Error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID");
}

if (commandScope === "guild" && !guildId) {
  throw new Error("Missing DISCORD_GUILD_ID while COMMAND_SCOPE=guild");
}

const walletOption = (builder: SlashCommandBuilder): SlashCommandBuilder =>
  builder.addStringOption((option) =>
    option
      .setName("wallet")
      .setDescription("XMR payout wallet address. Falls back to DEFAULT_WALLET when omitted.")
      .setRequired(false),
  ) as SlashCommandBuilder;

const commands = [
  walletOption(
    new SlashCommandBuilder()
      .setName("mo-stats")
      .setDescription("Show MoneroOcean wallet status."),
  ),
  walletOption(
    new SlashCommandBuilder()
      .setName("mo-workers")
      .setDescription("Show MoneroOcean worker status."),
  ),
  walletOption(
    new SlashCommandBuilder()
      .setName("mo-payments")
      .setDescription("Show recent MoneroOcean payments."),
  ),
].map((command) => command.toJSON());

function resolveWallet(input: string | null): string {
  const wallet = input?.trim() || defaultWallet?.trim();

  if (!wallet) {
    throw new Error("Wallet is required. Provide / command wallet or set DEFAULT_WALLET in .env.");
  }

  return wallet;
}

function inviteUrl(): string {
  const params = new URLSearchParams({
    client_id: clientId as string,
    scope: "bot applications.commands",
    permissions: "2147485696",
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

function dumpDiscordShape(client: Client): void {
  console.log("discord env");
  console.log(`  client id: ${clientId}`);
  console.log(`  guild id:  ${guildId ?? "none"}`);
  console.log(`  scope:     ${commandScope}`);
  console.log(`  bot user:  ${client.user?.tag ?? "unknown"} (${client.user?.id ?? "unknown"})`);

  const guilds = client.guilds.cache.map((guild) => `${guild.name} (${guild.id})`);
  console.log("  guilds:");

  if (guilds.length === 0) {
    console.log("    none visible to this token");
    return;
  }

  for (const guild of guilds) {
    console.log(`    ${guild}`);
  }
}

function explainDiscordRegisterError(error: unknown): never {
  if (error instanceof DiscordAPIError && error.code === 50001) {
    throw new Error(
      [
        "Discord denied command registration: Missing Access.",
        "",
        "This means the token/client/guild triangle is wrong, or the app was installed without slash-command access.",
        "",
        "Fix it:",
        "1. Re-invite the bot with BOTH scopes: bot + applications.commands.",
        "2. Use the Application ID as DISCORD_CLIENT_ID, not the public key.",
        "3. Use the bot token from that same application.",
        "4. Set DISCORD_GUILD_ID to one of the guild IDs printed above.",
        "",
        `Invite URL: ${inviteUrl()}`,
      ].join("\n"),
    );
  }

  throw error;
}

async function registerCommands(): Promise<void> {
  if (commandScope === "skip") {
    console.log("command registration skipped");
    return;
  }

  const rest = new REST({ version: "10" }).setToken(token as string);

  try {
    if (commandScope === "global") {
      await rest.put(Routes.applicationCommands(clientId as string), {
        body: commands,
      });
      console.log("global commands registered");
      return;
    }

    await rest.put(Routes.applicationGuildCommands(clientId as string, guildId as string), {
      body: commands,
    });
    console.log(`guild commands registered for ${guildId}`);
  } catch (error) {
    explainDiscordRegisterError(error);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once(Events.ClientReady, async () => {
  console.log(`MoneroOcean bot online as ${client.user?.tag ?? "unknown"}`);
  dumpDiscordShape(client);

  try {
    await registerCommands();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  }
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const wallet = resolveWallet(interaction.options.getString("wallet"));

    if (interaction.commandName === "mo-stats") {
      await interaction.deferReply();
      const stats = await getMinerStats(wallet);
      await interaction.editReply(buildStatsReply(wallet, stats));
      return;
    }

    if (interaction.commandName === "mo-workers") {
      await interaction.deferReply();
      const workers = await getWorkers(wallet);
      await interaction.editReply(buildWorkersReply(workers));
      return;
    }

    if (interaction.commandName === "mo-payments") {
      await interaction.deferReply();
      const payments = await getPayments(wallet);
      await interaction.editReply(buildPaymentsReply(payments));
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`Error: ${message}`);
    } else {
      await interaction.reply({ content: `Error: ${message}`, ephemeral: true });
    }
  }
});

try {
  await client.login(token);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
}
