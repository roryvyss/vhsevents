import { MessageEmbed } from "discord.js";
import { IEvent, FUNCS, config } from "../settings/utils";

const event: IEvent<"messageUpdate"> = {
	name: "messageUpdate",
	run: async (oldMessage, newMessage) => {
		if (oldMessage.channel.type === "dm") return;

		if (
			(oldMessage.guild!.id || newMessage.guild?.id) != config.IDS.GUILDID
		)
			return;

		const oldContent =
			oldMessage.content || "Не удалось получить с **API**";
		const newContent =
			newMessage.content || "Не удалось получить с **API**";

		if (oldContent === newContent) return;

		const logChannel = FUNCS.getLogChannel(newMessage.guild!);

		const embed = new MessageEmbed()
			.setDescription(
				`${
					oldMessage.member
						? oldMessage.member.toString()
						: "Не удалось получить с API |"
				} отредактировал свое [сообщение](${
					oldMessage.url
				}) в ${newMessage.channel.toString()}` +
					`\n**Было**: ${oldContent}\n**Стало**: ${newContent}`
			)
			.setColor("PURPLE")
			.setFooter(
				`ID: ${
					oldMessage.member
						? oldMessage.member.id
						: "Не удалось получить с API"
				}`
			)
			.setTimestamp(new Date());

		logChannel.send(embed);
	},
};

export default event;
