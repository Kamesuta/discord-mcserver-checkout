import type { APIEmbedField } from "discord.js";

/**
 * ワークフロー共通フィールド（企画・申請ID・主催者・期限）を生成する
 * @param workflow ワークフロー情報
 * @param endDate 期限日付（null の場合は期限フィールドを省略）
 */
export function workflowFields(workflow: {
  id: number;
  name: string;
  organizerDiscordId: string;
  endDate: Date | null;
  serverName?: string | null;
}): APIEmbedField[] {
  return [
    { name: "企画", value: workflow.name },
    { name: "申請ID", value: workflow.id.toString(), inline: true },
    {
      name: "主催者",
      value: `<@${workflow.organizerDiscordId}>`,
      inline: true,
    },
    ...(workflow.endDate
      ? [
          {
            name: "期限",
            value: `<t:${Math.floor(workflow.endDate.getTime() / 1000)}:R>`,
            inline: true,
          },
        ]
      : []),
    ...(workflow.serverName
      ? [
          {
            name: "サーバー",
            value: workflow.serverName,
            inline: true,
          },
        ]
      : []),
  ];
}
