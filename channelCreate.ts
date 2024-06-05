import { MessageEmbed, VoiceChannel } from "discord.js";
import { IEvent, FUNCS, config } from "../settings/utils";

const event: IEvent<"channelCreate"> = {
	name: "channelCreate",
	run: async (channel) => {
		if (channel.type != "voice") return;

		const vc = channel as VoiceChannel;

		if (vc.guild.id != config.IDS.GUILDID) return

		const logChannel = FUNCS.getLogChannel(vc.guild);

		const embed = new MessageEmbed()
			.setColor("PURPLE")
			.setTitle("Создание канала")
			.setDescription(
				`Канал ${channel.toString()}(\`${channel.id}\`) был создан`
			)
			.setFooter(`ID: ${channel.id}`)
			.setTimestamp(new Date());

		await logChannel.send(embed);
	},
};

export default event;
