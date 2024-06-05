import { MessageEmbed } from "discord.js";
import { IEvent, FUNCS, config } from "../settings/utils";

const event: IEvent<"messageDelete"> = {
	name: "messageDelete",
	run: async (message, client) => {
		if (message.channel.type === "dm") return;
		if (message.author?.bot) return;

		if (message.guild && message.guild.id != config.IDS.GUILDID) return;

		const logChannel = FUNCS.getLogChannel(message.guild!);

		if (!logChannel) return;

		const embed = new MessageEmbed()
			.setDescription(
				`${
					message.member ? message.member.toString() : "Неизвестный"
				} удалил свое сообщение в ${message.channel.toString()}\n**Текст**: ${
					message.content
						? message.content
						: "Не удалось получить с **API**"
				}`
			)
			.setFooter(`ID: ${message.member?.id}`)
			.setColor("PURPLE")
			.setTimestamp(new Date());

		logChannel.send(embed);
	},
};

export default event;
