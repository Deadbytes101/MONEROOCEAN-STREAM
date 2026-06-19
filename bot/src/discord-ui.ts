import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";

import {
  atomicToXmr,
  formatHashrate,
  readNumber,
  readString,
  shortWallet,
  type MinerStats,
  type PaymentRecord,
  type WorkerMap,
} from "./moneroocean.js";

const CYAN = 0x00d9ff;
const GREEN = 0x22c55e;
const RED = 0xef4444;
const MUTED = 0x64748b;

export type DiscordReplyShape = {
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
};

function chip(id: string, label: string, style: ButtonStyle): ButtonBuilder {
  return new ButtonBuilder()
    .setCustomId(id)
    .setLabel(label.slice(0, 80))
    .setStyle(style)
    .setDisabled(true);
}

function link(label: string, url: string): ButtonBuilder {
  return new ButtonBuilder()
    .setLabel(label)
    .setStyle(ButtonStyle.Link)
    .setURL(url);
}

function dashboardUrl(wallet: string): string {
  return `https://moneroocean.stream/?addr=${encodeURIComponent(wallet)}`;
}

function unixAge(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return "unknown";

  const now = Math.floor(Date.now() / 1000);
  const delta = Math.max(0, now - seconds);

  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;

  return `${Math.floor(delta / 86400)}d ago`;
}

function progressBar(value: number, width = 10): string {
  const clamped = Math.max(0, Math.min(1, value));
  const filled = Math.round(clamped * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function workerRate(record: Record<string, unknown>): number | undefined {
  return readNumber(record, ["hash2", "hash", "h", "r", "rate", "hashrate"]);
}

function workerAlgo(record: Record<string, unknown>): string | undefined {
  return readString(record, ["algo", "algorithm", "coin", "ticker"]);
}

export function buildStatsReply(wallet: string, stats: MinerStats): DiscordReplyShape {
  const rawHashrate = stats.hash ?? stats.lastHash ?? 0;
  const xmrHashrate = stats.hash2 ?? stats.hash ?? 0;
  const pending = atomicToXmr(stats.amtDue ?? stats.due);
  const paid = atomicToXmr(stats.amtPaid ?? stats.paid);
  const isAlive = rawHashrate > 0 || xmrHashrate > 0;

  const embed = new EmbedBuilder()
    .setColor(isAlive ? GREEN : MUTED)
    .setTitle("MoneroOcean Steam")
    .setDescription(`\`${shortWallet(wallet)}\`\nclean pool monitor · read-only`)
    .addFields(
      {
        name: "Hashrate",
        value: [`raw  **${formatHashrate(rawHashrate)}**`, `xmr  **${formatHashrate(xmrHashrate)}**`].join("\n"),
        inline: true,
      },
      {
        name: "Balance",
        value: [`due  **${pending} XMR**`, `paid **${paid} XMR**`].join("\n"),
        inline: true,
      },
      {
        name: "Pulse",
        value: [`last share **${unixAge(stats.lastShare)}**`, `tx count   **${stats.txnCount ?? 0}**`].join("\n"),
        inline: false,
      },
    )
    .setFooter({ text: "MoneroOcean API · no keys · no wallet actions" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    chip("mo:stats:hash", formatHashrate(xmrHashrate), isAlive ? ButtonStyle.Success : ButtonStyle.Secondary),
    chip("mo:stats:due", `${pending} XMR`, ButtonStyle.Secondary),
    link("Open dashboard", dashboardUrl(wallet)),
  );

  return { embeds: [embed], components: [row] };
}

export function buildWorkersReply(workers: WorkerMap): DiscordReplyShape {
  const entries = Object.entries(workers).sort(([aName, a], [bName, b]) => {
    const aRate = workerRate(a) ?? 0;
    const bRate = workerRate(b) ?? 0;
    return bRate - aRate || aName.localeCompare(bName);
  });

  const online = entries.filter(([, record]) => Number(workerRate(record) ?? 0) > 0).length;
  const total = entries.length;
  const health = total === 0 ? 0 : online / total;
  const topRate = Math.max(0, ...entries.map(([, record]) => workerRate(record) ?? 0));

  const lines = entries.slice(0, 12).map(([name, record]) => {
    const rate = workerRate(record) ?? 0;
    const algo = workerAlgo(record);
    const live = rate > 0;
    const share = topRate > 0 ? rate / topRate : 0;
    const icon = live ? "●" : "○";
    const algoText = algo ? ` · ${algo}` : "";

    return `${icon} \`${name}\` ${progressBar(share)} **${formatHashrate(rate)}**${algoText}`;
  });

  const embed = new EmbedBuilder()
    .setColor(online === total && total > 0 ? GREEN : online > 0 ? CYAN : RED)
    .setTitle("Workers")
    .setDescription(lines.length > 0 ? lines.join("\n") : "No workers found.")
    .addFields({ name: "Online", value: `**${online} / ${total}** · ${progressBar(health, 12)}`, inline: false })
    .setFooter({ text: "sorted by live hashrate" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    chip("mo:workers:online", `${online}/${total} online`, online === total && total > 0 ? ButtonStyle.Success : ButtonStyle.Secondary),
    chip("mo:workers:top", `top ${formatHashrate(topRate)}`, ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [row] };
}

export function buildPaymentsReply(payments: PaymentRecord[]): DiscordReplyShape {
  const lines = payments.slice(0, 10).map((payment, index) => {
    const amount = readNumber(payment, ["amount", "amt", "value", "paid"]);
    const txid = readString(payment, ["txid", "tx", "hash"]);
    const time = readString(payment, ["ts", "time", "date", "timestamp"]);
    const tx = txid ? ` · \`${txid.slice(0, 8)}...${txid.slice(-8)}\`` : "";
    const stamp = time ? ` · ${time}` : "";

    return `**${index + 1}.** ${atomicToXmr(amount)} XMR${stamp}${tx}`;
  });

  const embed = new EmbedBuilder()
    .setColor(payments.length > 0 ? CYAN : MUTED)
    .setTitle("Payments")
    .setDescription(lines.length > 0 ? lines.join("\n") : "No payments found yet.")
    .setFooter({ text: "latest payout page" })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    chip("mo:payments:count", `${payments.length} rows`, ButtonStyle.Secondary),
    link("Pool site", "https://moneroocean.stream/"),
  );

  return { embeds: [embed], components: [row] };
}
