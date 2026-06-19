import "dotenv/config";

import {
  Client,
  EmbedBuilder,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
} from "discord.js";

import {
  atomicToXmr,
  formatHashrate,
  getMinerStats,
  getPayments,
  getWorkers,
  readNumber,
  readString,
  shortWallet,
} from "./moneroocean.js";

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;
const defaultWallet = process.env.DEFAULT_WALLET;

if (!token || !clientId || !guildId) {
  throw new Error("Missing DISCORD_TOKEN, DISCORD_CLIENT_ID, or DISCORD_GUILD_ID");
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

async function registerCommands(): Promise<void> {
  const rest = new REST({ version: "10" }).setToken(token as string);

  await rest.put(Routes.applicationGuildCommands(clientId as string, guildId as string), {
    body: commands,
  });
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`MoneroOcean bot online as ${client.user?.tag ?? "unknown"}`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    const wallet = resolveWallet(interaction.options.getString("wallet"));

    if (interaction.commandName === "mo-stats") {
      await interaction.deferReply();

      const stats = await getMinerStats(wallet);
      const rawHashrate = stats.hash ?? stats.lastHash ?? 0;
      const xmrHashrate = stats.hash2 ?? stats.hash ?? 0;

      const embed = new EmbedBuilder()
        .setTitle("MoneroOcean Steam")
        .setDescription(`Read-only pool status for \`${shortWallet(wallet)}\``)
        .addFields(
          { name: "Current Hashrate", value: formatHashrate(rawHashrate), inline: true },
          { name: "XMR Hashrate", value: formatHashrate(xmrHashrate), inline: true },
          { name: "Pending", value: `${atomicToXmr(stats.amtDue ?? stats.due)} XMR`, inline: true },
          { name: "Total Paid", value: `${atomicToXmr(stats.amtPaid ?? stats.paid)} XMR`, inline: true },
          { name: "Last Share", value: String(stats.lastShare ?? "unknown"), inline: true },
          { name: "Transactions", value: String(stats.txnCount ?? 0), inline: true },
        )
        .setFooter({ text: "monitoring only · no mining · no wallet actions" })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "mo-workers") {
      await interaction.deferReply();

      const workers = await getWorkers(wallet);
      const entries = Object.entries(workers);
      const onlineCount = entries.filter(([, record]) => {
        const rate = readNumber(record, ["hash2", "hash", "h", "r"]);
        return Number(rate ?? 0) > 0;
      }).length;

      const lines = entries.slice(0, 15).map(([name, record]) => {
        const hashrate = readNumber(record, ["hash2", "hash", "h", "r"]);
        const algo = readString(record, ["algo", "algorithm", "coin", "ticker"]);
        const online = Number(hashrate ?? 0) > 0;
        const state = online ? "online" : "offline";
        const algoSuffix = algo ? ` · ${algo}` : "";

        return `\`${name}\` — ${state} — ${formatHashrate(hashrate)}${algoSuffix}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("Workers")
        .setDescription(lines.length > 0 ? lines.join("\n") : "No workers found.")
        .addFields({ name: "Online", value: `${onlineCount} / ${entries.length}`, inline: true })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (interaction.commandName === "mo-payments") {
      await interaction.deferReply();

      const payments = await getPayments(wallet);
      const lines = payments.slice(0, 10).map((payment, index) => {
        const amount = readNumber(payment, ["amount", "amt", "value", "paid"]);
        const txid = readString(payment, ["txid", "tx", "hash"]);
        const time = readString(payment, ["ts", "time", "date", "timestamp"]);
        const tx = txid ? ` · ${txid.slice(0, 8)}...${txid.slice(-8)}` : "";
        const stamp = time ? ` · ${time}` : "";

        return `${index + 1}. ${atomicToXmr(amount)} XMR${stamp}${tx}`;
      });

      const embed = new EmbedBuilder()
        .setTitle("Payments")
        .setDescription(lines.length > 0 ? lines.join("\n") : "No payments found.")
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
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

await registerCommands();
await client.login(token);
